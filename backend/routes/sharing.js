import express from 'express';
import { dbRun, dbGet, dbAll } from '../db.js';

const router = express.Router();

// Authentication middleware
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// Share image with another user
router.post('/', requireAuth, async (req, res) => {
  try {
    const { imageId, shareWithUserId } = req.body;

    // Verify ownership
    const image = await dbGet(
      'SELECT owner_id FROM images WHERE id = ?',
      [imageId]
    );

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    if (image.owner_id !== req.session.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Can't share with yourself
    if (shareWithUserId === req.session.userId) {
      return res.status(400).json({ error: 'Cannot share with yourself' });
    }

    // Share the image
    await dbRun(
      `INSERT OR IGNORE INTO shared_images (image_id, shared_with_user_id, shared_by_user_id)
       VALUES (?, ?, ?)`,
      [imageId, shareWithUserId, req.session.userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error sharing image:', error);
    res.status(500).json({ error: 'Failed to share image' });
  }
});

// Unshare image
router.delete('/:imageId/user/:userId', requireAuth, async (req, res) => {
  try {
    const { imageId, userId } = req.params;

    // Verify ownership
    const image = await dbGet(
      'SELECT owner_id FROM images WHERE id = ?',
      [imageId]
    );

    if (!image || image.owner_id !== req.session.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await dbRun(
      'DELETE FROM shared_images WHERE image_id = ? AND shared_with_user_id = ?',
      [imageId, userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error unsharing image:', error);
    res.status(500).json({ error: 'Failed to unshare image' });
  }
});

// Get list of users an image is shared with
router.get('/:imageId/shared-with', requireAuth, async (req, res) => {
  try {
    const { imageId } = req.params;

    // Verify ownership
    const image = await dbGet(
      'SELECT owner_id FROM images WHERE id = ?',
      [imageId]
    );

    if (!image || image.owner_id !== req.session.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const sharedWith = await dbAll(
      `SELECT u.id, u.username, si.shared_at
       FROM shared_images si
       JOIN users u ON si.shared_with_user_id = u.id
       WHERE si.image_id = ?`,
      [imageId]
    );

    res.json({ sharedWith });
  } catch (error) {
    console.error('Error fetching shared users:', error);
    res.status(500).json({ error: 'Failed to fetch shared users' });
  }
});

export default router;