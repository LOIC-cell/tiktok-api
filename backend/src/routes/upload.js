const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getProcessingQueue } = require('../services/videoProcessor');
const storageService = require('../services/storageService');

const uploadDir = process.env.UPLOAD_DIR || '/tmp/uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const router = express.Router();

const upload = multer({
  dest: '/tmp/uploads/',
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
});

// POST /api/upload
router.post('/', upload.any(), async (req, res, next) => {
  try {
    const file = req.files[0];
    if (!file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const jobId = uuidv4();
    const { path: filePath, originalname, mimetype, size } = file;

    const remoteUrl = await storageService.uploadRaw(filePath, jobId, originalname);

    const queue = getProcessingQueue();
    await queue.add(
      { jobId, filePath, remoteUrl, originalname, mimetype, size },
      { jobId }
    );

    res.status(202).json({
      jobId,
      message: 'Video uploaded and queued for processing',
      originalName: originalname,
      size,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
