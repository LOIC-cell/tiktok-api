const express = require('express');
const { getProcessingQueue } = require('../services/videoProcessor');

const router = express.Router();

// GET /api/status/:jobId
router.get('/:jobId', async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const queue = getProcessingQueue();
    const job = await queue.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const state = await job.getState();
    const progress = job.progress();

    res.json({
      jobId,
      state,
      progress,
      data: job.data,
      result: job.returnvalue || null,
      failedReason: job.failedReason || null,
      createdAt: new Date(job.timestamp).toISOString(),
      processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
      finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
