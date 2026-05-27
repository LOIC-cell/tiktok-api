const express = require('express');
const busboy = require('busboy');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getProcessingQueue } = require('../services/videoProcessor');
const storageService = require('../services/storageService');

const uploadDir = process.env.UPLOAD_DIR || '/tmp/uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const router = express.Router();

// POST /api/upload
router.post('/', (req, res, next) => {
  const bb = busboy({
    headers: req.headers,
    limits: { fileSize: 2 * 1024 * 1024 * 1024 },
  });

  let filePath = null;
  let originalname = null;
  let mimetype = null;
  let size = 0;
  let writeError = null;

  bb.on('file', (_fieldname, file, info) => {
    originalname = info.filename;
    mimetype = info.mimeType;
    filePath = path.join(uploadDir, uuidv4());
    const ws = fs.createWriteStream(filePath);

    file.on('data', (chunk) => { size += chunk.length; });
    file.on('error', (err) => { writeError = err; });
    file.pipe(ws);
  });

  bb.on('finish', async () => {
    if (writeError) return next(writeError);
    if (!filePath) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    try {
      const jobId = uuidv4();
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

  bb.on('error', next);
  req.pipe(bb);
});

module.exports = router;
