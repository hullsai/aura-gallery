import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { dbRun, dbGet } from '../db.js';
import { parseComfyUIMetadata, getImageStats } from '../imageParser.js';

const router = express.Router();

// Authentication middleware
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// Scan ComfyUI output directory
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

// Import images from ComfyUI output
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
        const fileCreatedAt = fileStats.birthtimeMs; // Use milliseconds timestamp
        
        // Check if this EXACT file (same name + creation date) already exists
        const exactMatch = await dbGet(
          'SELECT id FROM images WHERE filename = ? AND owner_id = ? AND file_created_at = ?',
          [filename, req.session.userId, fileCreatedAt]
        );

        if (exactMatch) {
          // This exact file was already imported - skip it
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
        const stats = await getImageStats(copyFiles || moveFiles ? finalPath : sourcefile);

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
            fileCreatedAt  // Use the actual file creation timestamp
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

export default router;