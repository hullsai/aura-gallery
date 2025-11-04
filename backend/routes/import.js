import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { dbRun, dbGet, dbAll } from '../db.js';
import { parseComfyUIMetadata, getImageStats } from '../imageParser.js';

const router = express.Router();

// Authentication middleware
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// Enhanced scan with thumbnails and duplicate detection for review screen
router.post('/scan-review', requireAuth, async (req, res) => {
    try {
    const { sourcePath, page = 1, pageSize = 50 } = req.body;
    
    if (!sourcePath) {
      return res.status(400).json({ error: 'Source path required' });
    }

    // Verify path exists
    try {
      await fs.access(sourcePath);
    } catch {
      return res.status(400).json({ error: 'Source path does not exist or is not accessible' });
    }

    // Read all files in directory
    const files = await fs.readdir(sourcePath);
    const imageFiles = files.filter(f => 
      f.toLowerCase().endsWith('.png') || 
      f.toLowerCase().endsWith('.jpg') || 
      f.toLowerCase().endsWith('.jpeg')
    );

    if (imageFiles.length === 0) {
      return res.json({
        total: 0,
        page: 1,
        pageSize,
        totalPages: 0,
        files: []
      });
    }

    // Get file stats for all images
    const filesWithStats = await Promise.all(
      imageFiles.map(async (filename) => {
        const filepath = path.join(sourcePath, filename);
        const stats = await fs.stat(filepath);
        return {
          filename,
          filepath,
          size: stats.size,
          created: stats.birthtimeMs
        };
      })
    );

    // Sort by creation date (newest first)
    filesWithStats.sort((a, b) => b.created - a.created);

    // Calculate pagination
    const totalPages = Math.ceil(filesWithStats.length / pageSize);
    const startIdx = (page - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    const paginatedFiles = filesWithStats.slice(startIdx, endIdx);

    // Generate thumbnails and check duplicates for current page
    const fileDetails = await Promise.all(
      paginatedFiles.map(async (file) => {
        try {
          // Check if exact duplicate exists (same filename + creation date)
          const exactMatch = await dbGet(
            'SELECT id FROM images WHERE filename = ? AND owner_id = ? AND file_created_at = ?',
            [file.filename, req.session.userId, file.created]
          );

          // Generate thumbnail (150px max width/height)
          const imageBuffer = await fs.readFile(file.filepath);
          const thumbnail = await sharp(imageBuffer)
            .resize(150, 150, { fit: 'inside' })
            .jpeg({ quality: 80 })
            .toBuffer();
          
          const thumbnailBase64 = `data:image/jpeg;base64,${thumbnail.toString('base64')}`;

          return {
            filename: file.filename,
            filepath: file.filepath,
            size: file.size,
            created: file.created,
            thumbnail: thumbnailBase64,
            isDuplicate: !!exactMatch,
            selected: !exactMatch // Auto-deselect duplicates, select new files
          };
        } catch (error) {
          console.error(`Error processing ${file.filename}:`, error);
          return {
            filename: file.filename,
            filepath: file.filepath,
            size: file.size,
            created: file.created,
            thumbnail: null,
            error: 'Failed to generate thumbnail',
            isDuplicate: false,
            selected: true
          };
        }
      })
    );

    // Calculate summary stats
    const duplicateCount = fileDetails.filter(f => f.isDuplicate).length;
    const selectedCount = fileDetails.filter(f => f.selected).length;

    res.json({
      total: filesWithStats.length,
      page,
      pageSize,
      totalPages,
      duplicates: duplicateCount,
      selected: selectedCount,
      files: fileDetails
    });

  } catch (error) {
    console.error('Scan review error:', error);
    res.status(500).json({ error: 'Failed to scan directory' });
  }
});

// Original simple scan (kept for backwards compatibility)
router.post('/scan', requireAuth, async (req, res) => {
  try {
    const { sourcePath } = req.body;
    
    if (!sourcePath) {
      return res.status(400).json({ error: 'Source path required' });
    }

    // Read all files in directory
    const files = await fs.readdir(sourcePath);
    const imageFiles = files.filter(f => 
      f.toLowerCase().endsWith('.png') || 
      f.toLowerCase().endsWith('.jpg') || 
      f.toLowerCase().endsWith('.jpeg')
    );

    // Get already imported files to avoid duplicates
    const existingImages = await dbGet(
      'SELECT COUNT(*) as count FROM images WHERE owner_id = ?',
      [req.session.userId]
    );

    res.json({
      total: imageFiles.length,
      existing: existingImages.count,
      files: imageFiles
    });
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({ error: 'Failed to scan directory' });
  }
});

// Import selected images with cleanup option
router.post('/import-selected', requireAuth, async (req, res) => {
  try {
    const { sourcePath, selectedFiles, importMode, cleanupRejected } = req.body;
    
    if (!sourcePath) {
      return res.status(400).json({ error: 'Source path required' });
    }

    if (!selectedFiles || !Array.isArray(selectedFiles) || selectedFiles.length === 0) {
      return res.status(400).json({ error: 'No files selected for import' });
    }

    if (!['copy', 'move', 'reference'].includes(importMode)) {
      return res.status(400).json({ error: 'Invalid import mode' });
    }

    const copyFiles = importMode === 'copy';
    const moveFiles = importMode === 'move';

    const results = {
      imported: 0,
      skipped: 0,
      deleted: 0,
      errors: 0,
      details: []
    };

    const userFolder = path.join(process.cwd(), '../user_images', req.session.username);
    await fs.mkdir(userFolder, { recursive: true });

    // Process selected files for import
    for (const fileInfo of selectedFiles) {
      try {
        const sourcefile = path.join(sourcePath, fileInfo.filename);
        const fileCreatedAt = fileInfo.created;
        
        // Double-check if this file was already imported (safety check)
        const exactMatch = await dbGet(
          'SELECT id FROM images WHERE filename = ? AND owner_id = ? AND file_created_at = ?',
          [fileInfo.filename, req.session.userId, fileCreatedAt]
        );

        if (exactMatch) {
          results.skipped++;
          results.details.push({ 
            filename: fileInfo.filename, 
            status: 'skipped', 
            reason: 'Already imported'
          });
          continue;
        }
        
        // Check if just the filename exists (different file, same name)
        const nameMatch = await dbGet(
          'SELECT id FROM images WHERE filename = ? AND owner_id = ?',
          [fileInfo.filename, req.session.userId]
        );

        let finalFilename = fileInfo.filename;
        
        // If duplicate filename but different file, rename it
        if (nameMatch) {
          const ext = path.extname(fileInfo.filename);
          const nameWithoutExt = path.basename(fileInfo.filename, ext);
          const timestamp = Date.now();
          finalFilename = `${nameWithoutExt}_${timestamp}${ext}`;
        }

        let finalPath;
        
        if (copyFiles || moveFiles) {
          // Copy file to user folder with potentially new name
          finalPath = path.join(userFolder, finalFilename);
          await fs.copyFile(sourcefile, finalPath);
          
          // If move mode, delete the source file after successful copy
          if (moveFiles) {
            await fs.unlink(sourcefile);
          }
        } else {
          // Just reference the original file
          finalPath = sourcefile;
        }

        // Parse metadata
        const metadata = await parseComfyUIMetadata(copyFiles || moveFiles ? finalPath : sourcefile);

        // Save to database
        await dbRun(
          `INSERT INTO images (owner_id, filepath, filename, workflow_json, prompt_text, node_info, file_created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            req.session.userId,
            finalPath,
            finalFilename,
            metadata.workflow ? JSON.stringify(metadata.workflow) : null,
            metadata.prompt,
            metadata.nodeInfo ? JSON.stringify(metadata.nodeInfo) : null,
            fileCreatedAt
          ]
        );

        results.imported++;
        results.details.push({ 
          filename: finalFilename, 
          originalName: fileInfo.filename,
          status: 'imported', 
          hasMetadata: metadata.hasMetadata,
          renamed: finalFilename !== fileInfo.filename
        });
      } catch (error) {
        console.error(`Error importing ${fileInfo.filename}:`, error);
        results.errors++;
        results.details.push({ 
          filename: fileInfo.filename, 
          status: 'error', 
          error: error.message 
        });
      }
    }

    // Cleanup rejected files if requested (only for copy/move modes)
    if (cleanupRejected && (copyFiles || moveFiles)) {
      try {
        // Get all image files in source directory
        const allFiles = await fs.readdir(sourcePath);
        const allImageFiles = allFiles.filter(f => 
          f.toLowerCase().endsWith('.png') || 
          f.toLowerCase().endsWith('.jpg') || 
          f.toLowerCase().endsWith('.jpeg')
        );

        // Create set of selected filenames for quick lookup
        const selectedFilenames = new Set(selectedFiles.map(f => f.filename));
        
        // Delete files that weren't selected
        for (const filename of allImageFiles) {
          if (!selectedFilenames.has(filename)) {
            try {
              const filepath = path.join(sourcePath, filename);
              await fs.unlink(filepath);
              results.deleted++;
              results.details.push({ 
                filename, 
                status: 'deleted',
                reason: 'Not selected for import'
              });
            } catch (error) {
              console.error(`Error deleting ${filename}:`, error);
              results.details.push({ 
                filename, 
                status: 'delete-failed', 
                error: error.message 
              });
            }
          }
        }
      } catch (error) {
        console.error('Cleanup error:', error);
        // Don't fail the entire import if cleanup fails
        results.details.push({ 
          status: 'cleanup-error', 
          error: error.message 
        });
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Import selected error:', error);
    res.status(500).json({ error: 'Import failed' });
  }
});

// Original import all (kept for backwards compatibility)
router.post('/import', requireAuth, async (req, res) => {
  try {
    const { sourcePath, copyFiles, moveFiles } = req.body;
    
    if (!sourcePath) {
      return res.status(400).json({ error: 'Source path required' });
    }

    const files = await fs.readdir(sourcePath);
    const imageFiles = files.filter(f => 
      f.toLowerCase().endsWith('.png') || 
      f.toLowerCase().endsWith('.jpg') || 
      f.toLowerCase().endsWith('.jpeg')
    );

    const results = {
      imported: 0,
      skipped: 0,
      errors: 0,
      details: []
    };

    const userFolder = path.join(process.cwd(), '../user_images', req.session.username);
    await fs.mkdir(userFolder, { recursive: true });

    for (const filename of imageFiles) {
      try {
        const sourcefile = path.join(sourcePath, filename);
        
        // Get file stats to check creation date (as Unix timestamp in milliseconds)
        const fileStats = await fs.stat(sourcefile);
        const fileCreatedAt = fileStats.birthtimeMs;
        
        // Check if this EXACT file (same name + creation date) already exists
        const exactMatch = await dbGet(
          'SELECT id FROM images WHERE filename = ? AND owner_id = ? AND file_created_at = ?',
          [filename, req.session.userId, fileCreatedAt]
        );

        if (exactMatch) {
          results.skipped++;
          results.details.push({ 
            filename, 
            status: 'skipped', 
            reason: 'Already imported (same file)'
          });
          continue;
        }
        
        // Check if just the filename exists (different file, same name)
        const nameMatch = await dbGet(
          'SELECT id FROM images WHERE filename = ? AND owner_id = ?',
          [filename, req.session.userId]
        );

        let finalFilename = filename;
        
        // If duplicate filename but different file, rename it
        if (nameMatch) {
          const ext = path.extname(filename);
          const nameWithoutExt = path.basename(filename, ext);
          const timestamp = Date.now();
          finalFilename = `${nameWithoutExt}_${timestamp}${ext}`;
        }

        let finalPath;
        
        if (copyFiles || moveFiles) {
          finalPath = path.join(userFolder, finalFilename);
          await fs.copyFile(sourcefile, finalPath);
          
          if (moveFiles) {
            await fs.unlink(sourcefile);
          }
        } else {
          finalPath = sourcefile;
        }

        // Parse metadata
        const metadata = await parseComfyUIMetadata(copyFiles || moveFiles ? finalPath : sourcefile);

        // Save to database
        await dbRun(
          `INSERT INTO images (owner_id, filepath, filename, workflow_json, prompt_text, node_info, file_created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            req.session.userId,
            finalPath,
            finalFilename,
            metadata.workflow ? JSON.stringify(metadata.workflow) : null,
            metadata.prompt,
            metadata.nodeInfo ? JSON.stringify(metadata.nodeInfo) : null,
            fileCreatedAt
          ]
        );

        results.imported++;
        results.details.push({ 
          filename: finalFilename, 
          originalName: filename,
          status: 'imported', 
          hasMetadata: metadata.hasMetadata,
          renamed: finalFilename !== filename
        });
      } catch (error) {
        console.error(`Error importing ${filename}:`, error);
        results.errors++;
        results.details.push({ filename, status: 'error', error: error.message });
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Import failed' });
  }
});

// Bulk delete rejected images (standalone cleanup endpoint)
router.post('/cleanup-rejected', requireAuth, async (req, res) => {
  try {
    const { rejectedFiles } = req.body;
    
    if (!rejectedFiles || !Array.isArray(rejectedFiles)) {
      return res.status(400).json({ error: 'Rejected files list required' });
    }

    const results = {
      deleted: 0,
      failed: 0,
      errors: []
    };

    for (const filepath of rejectedFiles) {
      try {
        // Verify file exists before attempting delete
        await fs.access(filepath);
        await fs.unlink(filepath);
        results.deleted++;
      } catch (error) {
        console.error(`Failed to delete ${filepath}:`, error);
        results.failed++;
        results.errors.push({ filepath, error: error.message });
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Cleanup failed' });
  }
});

export default router;