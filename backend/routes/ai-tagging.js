import express from 'express';
import { analyzeImage } from '../aiTagger.js';
import db from '../db.js';

const router = express.Router();

// Analyze a single image and return suggested tags
router.post('/analyze/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    const userId = req.session.userId;

    // Get image details
    const image = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM images WHERE id = ? AND owner_id = ?',
        [imageId, userId],
        (err, row) => err ? reject(err) : resolve(row)
      );
    });

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    console.log(`Analyzing image: ${image.filename}`);

    // Analyze with AI
    const suggestedTags = await analyzeImage(image.filepath);

    console.log(`Suggested tags for ${image.filename}:`, suggestedTags);

    res.json({ 
      imageId,
      filename: image.filename,
      filepath: image.filepath,
      suggestedTags
    });
  } catch (error) {
    console.error('AI tagging error:', error);
    res.status(500).json({ error: 'Failed to analyze image: ' + error.message });
  }
});

// Batch analyze multiple images
router.post('/batch-analyze', async (req, res) => {
  try {
    const { imageIds } = req.body;
    const userId = req.session.userId;

    if (!imageIds || !Array.isArray(imageIds)) {
      return res.status(400).json({ error: 'imageIds array required' });
    }

    console.log(`Starting batch analysis of ${imageIds.length} images`);

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < imageIds.length; i++) {
      const imageId = imageIds[i];
      
      try {
        // Get image
        const image = await new Promise((resolve, reject) => {
          db.get(
            'SELECT * FROM images WHERE id = ? AND owner_id = ?',
            [imageId, userId],
            (err, row) => err ? reject(err) : resolve(row)
          );
        });

        if (image) {
          console.log(`[${i+1}/${imageIds.length}] Analyzing: ${image.filename}`);
          
          const suggestedTags = await analyzeImage(image.filepath);
          
          results.push({
            imageId,
            filename: image.filename,
            filepath: image.filepath, // ADDED THIS
            suggestedTags,
            success: true
          });
          
          successCount++;
          console.log(`✓ ${image.filename}: ${suggestedTags.join(', ')}`);
        }
      } catch (error) {
        console.error(`✗ Error analyzing image ${imageId}:`, error.message);
        results.push({
          imageId,
          success: false,
          error: error.message
        });
        errorCount++;
      }
    }

    console.log(`Batch analysis complete: ${successCount} succeeded, ${errorCount} failed`);

    res.json({ 
      results,
      summary: {
        total: imageIds.length,
        succeeded: successCount,
        failed: errorCount
      }
    });
  } catch (error) {
    console.error('Batch AI tagging error:', error);
    res.status(500).json({ error: 'Failed to batch analyze images: ' + error.message });
  }
});

// Apply suggested tags to an image
router.post('/apply-tags/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    const { tags } = req.body;
    const userId = req.session.userId;

    if (!tags || !Array.isArray(tags)) {
      return res.status(400).json({ error: 'tags array required' });
    }

    // Verify image ownership
    const image = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id FROM images WHERE id = ? AND owner_id = ?',
        [imageId, userId],
        (err, row) => err ? reject(err) : resolve(row)
      );
    });

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Apply each tag
    for (const tagName of tags) {
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT OR IGNORE INTO image_tags (image_id, tag_name) VALUES (?, ?)',
          [imageId, tagName.toLowerCase()],
          (err) => err ? reject(err) : resolve()
        );
      });
    }

    console.log(`Applied ${tags.length} tags to image ${imageId}`);

    res.json({ success: true, appliedTags: tags });
  } catch (error) {
    console.error('Apply tags error:', error);
    res.status(500).json({ error: 'Failed to apply tags: ' + error.message });
  }
});

// Batch apply tags to multiple images
router.post('/batch-apply-tags', async (req, res) => {
  try {
    const { tagApplications } = req.body;
    const userId = req.session.userId;

    if (!tagApplications || !Array.isArray(tagApplications)) {
      return res.status(400).json({ error: 'tagApplications array required' });
    }

    console.log(`Applying tags to ${tagApplications.length} images`);

    let appliedCount = 0;

    for (const { imageId, tags } of tagApplications) {
      // Verify ownership
      const image = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id FROM images WHERE id = ? AND owner_id = ?',
          [imageId, userId],
          (err, row) => err ? reject(err) : resolve(row)
        );
      });

      if (image) {
        // Apply tags
        for (const tagName of tags) {
          await new Promise((resolve, reject) => {
            db.run(
              'INSERT OR IGNORE INTO image_tags (image_id, tag_name) VALUES (?, ?)',
              [imageId, tagName.toLowerCase()],
              (err) => err ? reject(err) : resolve()
            );
          });
        }
        appliedCount++;
      }
    }

    console.log(`Batch apply complete: ${appliedCount} images tagged`);

    res.json({ 
      success: true, 
      appliedCount 
    });
  } catch (error) {
    console.error('Batch apply tags error:', error);
    res.status(500).json({ error: 'Failed to batch apply tags: ' + error.message });
  }
});

export default router;