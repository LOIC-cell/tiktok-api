const express = require('express');
const storageService = require('../services/storageService');

const router = express.Router();

// GET /api/clips — list all clips
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const clips = await storageService.listClips({ page: Number(page), limit: Number(limit) });
    res.json(clips);
  } catch (err) {
    next(err);
  }
});

// GET /api/clips/:id — get a single clip with signed URL
router.get('/:id', async (req, res, next) => {
  try {
    const clip = await storageService.getClip(req.params.id);
    if (!clip) {
      return res.status(404).json({ error: 'Clip not found' });
    }
    res.json(clip);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/clips/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await storageService.deleteClip(req.params.id);
    res.json({ message: 'Clip deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
