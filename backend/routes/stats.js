import express from 'express';
import { dbAll, dbGet } from '../db.js';

const router = express.Router();

// Authentication middleware
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// Get advanced analytics
router.get('/advanced', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    // Overview stats
    const totalImages = await dbGet(
      'SELECT COUNT(*) as count FROM images WHERE owner_id = ?',
      [userId]
    );

    const totalFavorites = await dbGet(
      'SELECT COUNT(*) as count FROM favorites WHERE user_id = ?',
      [userId]
    );

    const totalTags = await dbGet(
      'SELECT COUNT(DISTINCT tag_name) as count FROM tags WHERE user_id = ?',
      [userId]
    );

    // Calculate average generations per day
    const firstImage = await dbGet(
      'SELECT MIN(created_at) as first FROM images WHERE owner_id = ?',
      [userId]
    );
    const daysSinceFirst = firstImage.first
      ? Math.max(1, Math.floor((Date.now() - new Date(firstImage.first).getTime()) / (1000 * 60 * 60 * 24)))
      : 1;
    const avgPerDay = totalImages.count / daysSinceFirst;

    // Quality Metrics - Favorite rate by checkpoint
    const favoritesByCheckpoint = await dbAll(
      `SELECT 
        json_extract(node_info, '$.checkpoint') as checkpoint,
        COUNT(*) as total_images,
        SUM(CASE WHEN f.user_id IS NOT NULL THEN 1 ELSE 0 END) as favorites
       FROM images i
       LEFT JOIN favorites f ON i.id = f.image_id AND f.user_id = ?
       WHERE i.owner_id = ? AND checkpoint IS NOT NULL
       GROUP BY checkpoint
       ORDER BY total_images DESC`,
      [userId, userId]
    );

    const qualityMetrics = {
      favoriteRateByCheckpoint: favoritesByCheckpoint.map(row => ({
        checkpoint: row.checkpoint,
        totalImages: row.total_images,
        favorites: row.favorites,
        rate: row.total_images > 0 ? row.favorites / row.total_images : 0
      })),
      favoriteRateBySettings: [] // Can expand this later
    };

    // Prompt Analysis
    const allPrompts = await dbAll(
      'SELECT prompt_text FROM images WHERE owner_id = ? AND prompt_text IS NOT NULL',
      [userId]
    );

    // Word frequency analysis
    const wordFreq = new Map();
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during']);
    let totalLength = 0;

    allPrompts.forEach(row => {
      const words = row.prompt_text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w));
      
      words.forEach(word => {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      });
      
      totalLength += row.prompt_text.length;
    });

    const commonWords = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([word, count]) => ({ word, count }));

    // Prompt length distribution
    const lengthRanges = [
      { range: '0-50', min: 0, max: 50 },
      { range: '51-100', min: 51, max: 100 },
      { range: '101-200', min: 101, max: 200 },
      { range: '201-300', min: 201, max: 300 },
      { range: '300+', min: 301, max: 999999 }
    ];

    const promptLengthDistribution = lengthRanges.map(range => ({
      range: range.range,
      count: allPrompts.filter(p => 
        p.prompt_text.length >= range.min && p.prompt_text.length <= range.max
      ).length
    }));

    const promptAnalysis = {
      commonWords,
      averagePromptLength: allPrompts.length > 0 ? totalLength / allPrompts.length : 0,
      promptLengthDistribution
    };

    // Checkpoint Deep Dive
    const checkpointStats = await dbAll(
      `SELECT 
        json_extract(node_info, '$.checkpoint') as checkpoint,
        COUNT(*) as count,
        AVG(CAST(json_extract(node_info, '$.steps') AS REAL)) as avg_steps,
        AVG(CAST(json_extract(node_info, '$.cfg') AS REAL)) as avg_cfg,
        json_extract(node_info, '$.sampler') as sampler,
        SUM(CASE WHEN f.user_id IS NOT NULL THEN 1 ELSE 0 END) as favorites
       FROM images i
       LEFT JOIN favorites f ON i.id = f.image_id AND f.user_id = ?
       WHERE i.owner_id = ? AND checkpoint IS NOT NULL
       GROUP BY checkpoint, sampler`,
      [userId, userId]
    );

    // Group by checkpoint and aggregate samplers
    const checkpointMap = new Map();
    checkpointStats.forEach(row => {
      if (!checkpointMap.has(row.checkpoint)) {
        checkpointMap.set(row.checkpoint, {
          checkpoint: row.checkpoint,
          count: 0,
          avgSteps: 0,
          avgCfg: 0,
          favorites: 0,
          samplers: new Map()
        });
      }
      const cp = checkpointMap.get(row.checkpoint);
      cp.count += row.count;
      cp.avgSteps += row.avg_steps * row.count;
      cp.avgCfg += row.avg_cfg * row.count;
      cp.favorites += row.favorites;
      if (row.sampler) {
        cp.samplers.set(row.sampler, (cp.samplers.get(row.sampler) || 0) + row.count);
      }
    });

    const checkpointDeepDive = {
      byCheckpoint: Array.from(checkpointMap.values()).map(cp => ({
        checkpoint: cp.checkpoint,
        count: cp.count,
        avgSteps: cp.avgSteps / cp.count,
        avgCfg: cp.avgCfg / cp.count,
        favoriteRate: cp.count > 0 ? cp.favorites / cp.count : 0,
        commonSamplers: Array.from(cp.samplers.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([sampler]) => sampler)
      })).sort((a, b) => b.count - a.count)
    };

    // Time Insights
    const imagesByMonth = await dbAll(
      `SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
       FROM images
       WHERE owner_id = ?
       GROUP BY month
       ORDER BY month DESC
       LIMIT 12`,
      [userId]
    );

    const imagesByDayOfWeek = await dbAll(
      `SELECT 
        CASE CAST(strftime('%w', created_at) AS INTEGER)
          WHEN 0 THEN 'Sun'
          WHEN 1 THEN 'Mon'
          WHEN 2 THEN 'Tue'
          WHEN 3 THEN 'Wed'
          WHEN 4 THEN 'Thu'
          WHEN 5 THEN 'Fri'
          WHEN 6 THEN 'Sat'
        END as day,
        COUNT(*) as count
       FROM images
       WHERE owner_id = ?
       GROUP BY CAST(strftime('%w', created_at) AS INTEGER)
       ORDER BY CAST(strftime('%w', created_at) AS INTEGER)`,
      [userId]
    );

    const timeInsights = {
      generationsByMonth: imagesByMonth.map(row => ({
        month: row.month,
        count: row.count
      })).reverse(),
      generationsByDayOfWeek: imagesByDayOfWeek.map(row => ({
        day: row.day,
        count: row.count
      })),
      productivityTrend: imagesByMonth.map(row => ({
        period: row.month,
        count: row.count
      }))
    };

    // Parameter Analysis
    const stepsRanges = [
      { range: '1-10', min: 1, max: 10 },
      { range: '11-20', min: 11, max: 20 },
      { range: '21-30', min: 21, max: 30 },
      { range: '31-50', min: 31, max: 50 },
      { range: '50+', min: 51, max: 999 }
    ];

    const stepsData = await dbAll(
      `SELECT 
        CAST(json_extract(node_info, '$.steps') AS INTEGER) as steps,
        COUNT(*) as count,
        SUM(CASE WHEN f.user_id IS NOT NULL THEN 1 ELSE 0 END) as favorites
       FROM images i
       LEFT JOIN favorites f ON i.id = f.image_id AND f.user_id = ?
       WHERE i.owner_id = ? AND steps IS NOT NULL
       GROUP BY steps`,
      [userId, userId]
    );

    const stepsDistribution = stepsRanges.map(range => {
      const filtered = stepsData.filter(d => d.steps >= range.min && d.steps <= range.max);
      const totalCount = filtered.reduce((sum, d) => sum + d.count, 0);
      const totalFavorites = filtered.reduce((sum, d) => sum + d.favorites, 0);
      return {
        range: range.range,
        count: totalCount,
        favoriteRate: totalCount > 0 ? totalFavorites / totalCount : 0
      };
    });

    const cfgRanges = [
      { range: '1-3', min: 1, max: 3 },
      { range: '3-5', min: 3, max: 5 },
      { range: '5-7', min: 5, max: 7 },
      { range: '7-10', min: 7, max: 10 },
      { range: '10+', min: 10, max: 999 }
    ];

    const cfgData = await dbAll(
      `SELECT 
        CAST(json_extract(node_info, '$.cfg') AS REAL) as cfg,
        COUNT(*) as count,
        SUM(CASE WHEN f.user_id IS NOT NULL THEN 1 ELSE 0 END) as favorites
       FROM images i
       LEFT JOIN favorites f ON i.id = f.image_id AND f.user_id = ?
       WHERE i.owner_id = ? AND cfg IS NOT NULL
       GROUP BY cfg`,
      [userId, userId]
    );

    const cfgDistribution = cfgRanges.map(range => {
      const filtered = cfgData.filter(d => d.cfg >= range.min && d.cfg <= range.max);
      const totalCount = filtered.reduce((sum, d) => sum + d.count, 0);
      const totalFavorites = filtered.reduce((sum, d) => sum + d.favorites, 0);
      return {
        range: range.range,
        count: totalCount,
        favoriteRate: totalCount > 0 ? totalFavorites / totalCount : 0
      };
    });

    const topSamplers = await dbAll(
      `SELECT 
        json_extract(node_info, '$.sampler') as sampler,
        COUNT(*) as count,
        SUM(CASE WHEN f.user_id IS NOT NULL THEN 1 ELSE 0 END) as favorites
       FROM images i
       LEFT JOIN favorites f ON i.id = f.image_id AND f.user_id = ?
       WHERE i.owner_id = ? AND sampler IS NOT NULL
       GROUP BY sampler
       ORDER BY count DESC
       LIMIT 10`,
      [userId, userId]
    );

    const parameterAnalysis = {
      stepsDistribution,
      cfgDistribution,
      topSamplers: topSamplers.map(row => ({
        sampler: row.sampler,
        count: row.count,
        favoriteRate: row.count > 0 ? row.favorites / row.count : 0
      }))
    };

    // LoRA Patterns
    const loraData = await dbAll(
      `SELECT json_extract(node_info, '$.loras') as loras
       FROM images
       WHERE owner_id = ? AND loras IS NOT NULL`,
      [userId]
    );

    const loraFreq = new Map();
    const loraCombos = new Map();

    loraData.forEach(row => {
      try {
        const loras = JSON.parse(row.loras);
        if (Array.isArray(loras) && loras.length > 0) {
          // Count individual LoRAs
          loras.forEach(lora => {
            const name = typeof lora === 'string' ? lora : lora.name || lora;
            loraFreq.set(name, (loraFreq.get(name) || 0) + 1);
          });

          // Count combinations (if more than one)
          if (loras.length > 1) {
            const comboKey = loras.map(l => typeof l === 'string' ? l : l.name || l).sort().join('|');
            loraCombos.set(comboKey, (loraCombos.get(comboKey) || 0) + 1);
          }
        }
      } catch (e) {
        // Skip invalid JSON
      }
    });

    const loraPatterns = {
      topLoras: Array.from(loraFreq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([lora, count]) => ({ lora, count })),
      commonCombinations: Array.from(loraCombos.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([combo, count]) => ({
          loras: combo.split('|'),
          count
        }))
    };

    // Compile all stats
    const stats = {
      overview: {
        totalImages: totalImages.count,
        totalFavorites: totalFavorites.count,
        totalTags: totalTags.count,
        averageGenerationsPerDay: avgPerDay
      },
      qualityMetrics,
      promptAnalysis,
      checkpointDeepDive,
      timeInsights,
      parameterAnalysis,
      loraPatterns
    };

    res.json(stats);
  } catch (error) {
    console.error('Error generating advanced stats:', error);
    res.status(500).json({ error: 'Failed to generate statistics' });
  }
});

export default router;