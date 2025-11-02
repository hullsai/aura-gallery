import express from 'express';
import { dbRun, dbAll } from '../db.js';

const router = express.Router();

// Authentication middleware
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// Rename a tag globally for a user
router.put('/rename', requireAuth, async (req, res) => {
  try {
    const { oldName, newName } = req.body;
    
    if (!oldName || !newName) {
      return res.status(400).json({ error: 'Old name and new name are required' });
    }

    // Check if new tag name already exists
    const existing = await dbAll(
      'SELECT * FROM tags WHERE user_id = ? AND tag_name = ?',
      [req.session.userId, newName]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'A tag with that name already exists' });
    }

    // Update all instances of the old tag name
    await dbRun(
      'UPDATE tags SET tag_name = ? WHERE user_id = ? AND tag_name = ?',
      [newName, req.session.userId, oldName]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error renaming tag:', error);
    res.status(500).json({ error: 'Failed to rename tag' });
  }
});

// Delete a tag globally for a user
router.delete('/:tagName', requireAuth, async (req, res) => {
  try {
    const tagName = decodeURIComponent(req.params.tagName);

    // Delete all instances of this tag for the user
    await dbRun(
      'DELETE FROM tags WHERE user_id = ? AND tag_name = ?',
      [req.session.userId, tagName]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting tag:', error);
    res.status(500).json({ error: 'Failed to delete tag' });
  }
});

export default router;