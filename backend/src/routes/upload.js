const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getProcessingQueue } = require('../services/videoProcessor');
const storageService = require('../services/storageService');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || './uploads');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${ext}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 500) * 1024 * 1024,
  },
});

// POST /api/upload
router.post('/', upload.single('video'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const jobId = uuidv4();
    const { path: filePath, originalname, mimetype, size } = req.file;

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
