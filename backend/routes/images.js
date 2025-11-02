import express from 'express';
import multer from 'multer';
import { dbRun, dbGet, dbAll } from '../db.js';
import { parseComfyUIMetadata, getImageStats } from '../imageParser.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const userFolder = path.join(__dirname, '../../user_images', req.session.username);
    await fs.mkdir(userFolder, { recursive: true });
    cb(null, userFolder);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') {
      cb(null, true);
    } else {
      cb(new Error('Only PNG and JPEG images are allowed'));
    }
  }
});

// Authentication middleware
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// Upload image
router.post('/upload', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { filename, path: filepath } = req.file;
    
    // Parse metadata
    const metadata = await parseComfyUIMetadata(filepath);
    const stats = await getImageStats(filepath);

    // Save to database
    const result = await dbRun(
      `INSERT INTO images (owner_id, filepath, filename, workflow_json, prompt_text, node_info, file_created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.session.userId,
        filepath,
        filename,
        metadata.workflow ? JSON.stringify(metadata.workflow) : null,
        metadata.prompt,
        metadata.nodeInfo ? JSON.stringify(metadata.nodeInfo) : null,
        stats?.created || new Date().toISOString()
      ]
    );

    res.json({ 
      success: true, 
      imageId: result.id,
      hasMetadata: metadata.hasMetadata
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Get user's images
router.get('/', requireAuth, async (req, res) => {
  try {
    const { tags, search, limit = 10000, offset = 0, checkpoint, sampler, orientation, minSteps, maxSteps, minCfg, maxCfg, dateFrom, dateTo, noTags } = req.query;
    
    let sql = `
      SELECT i.*, 
             GROUP_CONCAT(t.tag_name) as tags,
             EXISTS(SELECT 1 FROM favorites f WHERE f.image_id = i.id AND f.user_id = ?) as is_favorite
      FROM images i
      LEFT JOIN tags t ON i.id = t.image_id AND t.user_id = ?
      WHERE i.owner_id = ?
    `;
    const params = [req.session.userId, req.session.userId, req.session.userId];

    // Add search filter
    if (search) {
      sql += ` AND (i.prompt_text LIKE ? OR i.filename LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    // Add tag filter or no tags filter
    if (noTags === 'true') {
      // Filter for images with NO tags
      sql += ` AND i.id NOT IN (
        SELECT DISTINCT image_id FROM tags WHERE user_id = ?
      )`;
      params.push(req.session.userId);
    } else if (tags) {
      // Filter for images WITH specific tags
      const tagList = tags.split(',').map(t => t.trim());
      
      sql += ` AND i.id IN (
        SELECT image_id FROM tags 
        WHERE user_id = ? AND tag_name IN (${tagList.map(() => '?').join(',')})
        GROUP BY image_id
        HAVING COUNT(DISTINCT tag_name) = ?
      )`;
      params.push(req.session.userId, ...tagList, tagList.length);
    }

    // Add advanced filters using JSON queries
    if (checkpoint) {
      sql += ` AND json_extract(i.node_info, '$.checkpoint') = ?`;
      params.push(checkpoint);
    }

    if (sampler) {
      sql += ` AND json_extract(i.node_info, '$.sampler') = ?`;
      params.push(sampler);
    }

    if (minSteps) {
      sql += ` AND CAST(json_extract(i.node_info, '$.steps') AS INTEGER) >= ?`;
      params.push(parseInt(minSteps));
    }

    if (maxSteps) {
      sql += ` AND CAST(json_extract(i.node_info, '$.steps') AS INTEGER) <= ?`;
      params.push(parseInt(maxSteps));
    }

    if (minCfg) {
      sql += ` AND CAST(json_extract(i.node_info, '$.cfg') AS REAL) >= ?`;
      params.push(parseFloat(minCfg));
    }

    if (maxCfg) {
      sql += ` AND CAST(json_extract(i.node_info, '$.cfg') AS REAL) <= ?`;
      params.push(parseFloat(maxCfg));
    }

    if (orientation && orientation !== 'all') {
      if (orientation === 'portrait') {
        sql += ` AND CAST(json_extract(i.node_info, '$.dimensions.height') AS INTEGER) > CAST(json_extract(i.node_info, '$.dimensions.width') AS INTEGER)`;
      } else if (orientation === 'landscape') {
        sql += ` AND CAST(json_extract(i.node_info, '$.dimensions.width') AS INTEGER) > CAST(json_extract(i.node_info, '$.dimensions.height') AS INTEGER)`;
      } else if (orientation === 'square') {
        sql += ` AND CAST(json_extract(i.node_info, '$.dimensions.width') AS INTEGER) = CAST(json_extract(i.node_info, '$.dimensions.height') AS INTEGER)`;
      }
    }

    if (dateFrom) {
      sql += ` AND date(i.file_created_at) >= date(?)`;
      params.push(dateFrom);
    }

    if (dateTo) {
      sql += ` AND date(i.file_created_at) <= date(?)`;
      params.push(dateTo);
    }

    sql += ` GROUP BY i.id ORDER BY i.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const images = await dbAll(sql, params);

    res.json({ images });
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

// Get shared images
router.get('/shared', requireAuth, async (req, res) => {
  try {
    const images = await dbAll(
      `SELECT i.*, u.username as owner_username, si.shared_at
       FROM shared_images si
       JOIN images i ON si.image_id = i.id
       JOIN users u ON i.owner_id = u.id
       WHERE si.shared_with_user_id = ?
       ORDER BY si.shared_at DESC`,
      [req.session.userId]
    );

    res.json({ images });
  } catch (error) {
    console.error('Error fetching shared images:', error);
    res.status(500).json({ error: 'Failed to fetch shared images' });
  }
});

// Get filter options
router.get('/filter-options', requireAuth, async (req, res) => {
  try {
    const images = await dbAll(
      'SELECT node_info FROM images WHERE owner_id = ? AND node_info IS NOT NULL',
      [req.session.userId]
    );

    const checkpoints = new Set();
    const samplers = new Set();

    images.forEach(img => {
      try {
        const nodeInfo = JSON.parse(img.node_info);
        if (nodeInfo.checkpoint) checkpoints.add(nodeInfo.checkpoint);
        if (nodeInfo.sampler) samplers.add(nodeInfo.sampler);
      } catch (e) {
        // Skip invalid JSON
      }
    });

    res.json({
      checkpoints: Array.from(checkpoints).sort(),
      samplers: Array.from(samplers).sort()
    });
  } catch (error) {
    console.error('Error getting filter options:', error);
    res.status(500).json({ error: 'Failed to get filter options' });
  }
});

// Get all tags for autocomplete
router.get('/tags/all', requireAuth, async (req, res) => {
  try {
    const tags = await dbAll(
      `SELECT DISTINCT tag_name, category, COUNT(*) as usage_count 
       FROM tags 
       WHERE user_id = ? 
       GROUP BY tag_name, category 
       ORDER BY usage_count DESC, tag_name ASC`,
      [req.session.userId]
    );

    res.json({ tags });
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// Get single image details
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const image = await dbGet(
      `SELECT i.* FROM images i WHERE i.id = ?`,
      [req.params.id]
    );

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Get tags
    const tags = await dbAll(
      'SELECT tag_name, category FROM tags WHERE image_id = ? AND user_id = ?',
      [req.params.id, req.session.userId]
    );

    // Parse node_info if it exists
    let nodeInfo = null;
    if (image.node_info) {
      try {
        nodeInfo = JSON.parse(image.node_info);
      } catch (e) {
        console.error('Error parsing node_info:', e);
      }
    }

    // Check if favorited
    const favorite = await dbGet(
      'SELECT * FROM favorites WHERE user_id = ? AND image_id = ?',
      [req.session.userId, req.params.id]
    );

    res.json({ 
      image: { 
        ...image, 
        tags, 
        nodeInfo,
        is_favorite: favorite ? 1 : 0
      } 
    });
  } catch (error) {
    console.error('Error fetching image:', error);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

router.post('/:id/tags', requireAuth, async (req, res) => {
  try {
    const { tagName, category } = req.body;
    
    // Verify ownership
    const image = await dbGet(
      'SELECT owner_id FROM images WHERE id = ?',
      [req.params.id]
    );

    if (!image || image.owner_id !== req.session.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await dbRun(
      'INSERT OR IGNORE INTO tags (user_id, image_id, tag_name, category) VALUES (?, ?, ?, ?)',
      [req.session.userId, req.params.id, tagName, category || null]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error adding tag:', error);
    res.status(500).json({ error: 'Failed to add tag' });
  }
});

// Remove tag from image
router.delete('/:id/tags/:tagName', requireAuth, async (req, res) => {
  try {
    await dbRun(
      'DELETE FROM tags WHERE user_id = ? AND image_id = ? AND tag_name = ?',
      [req.session.userId, req.params.id, req.params.tagName]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing tag:', error);
    res.status(500).json({ error: 'Failed to remove tag' });
  }
});

// Toggle favorite
router.post('/:id/favorite', requireAuth, async (req, res) => {
  try {
    const existing = await dbGet(
      'SELECT * FROM favorites WHERE user_id = ? AND image_id = ?',
      [req.session.userId, req.params.id]
    );

    if (existing) {
      await dbRun(
        'DELETE FROM favorites WHERE user_id = ? AND image_id = ?',
        [req.session.userId, req.params.id]
      );
      res.json({ success: true, favorited: false });
    } else {
      await dbRun(
        'INSERT INTO favorites (user_id, image_id) VALUES (?, ?)',
        [req.session.userId, req.params.id]
      );
      res.json({ success: true, favorited: true });
    }
  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

// Delete image
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const image = await dbGet(
      'SELECT * FROM images WHERE id = ? AND owner_id = ?',
      [req.params.id, req.session.userId]
    );

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Delete file
    await fs.unlink(image.filepath);

    // Delete from database (cascade will handle tags, favorites, shares)
    await dbRun('DELETE FROM images WHERE id = ?', [req.params.id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

export default router;