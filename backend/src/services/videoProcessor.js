const Bull = require('bull');
const clipDetector = require('./clipDetector');
const subtitleGenerator = require('./subtitleGenerator');
const storageService = require('./storageService');

let processingQueue;

function getProcessingQueue() {
  if (!processingQueue) {
    processingQueue = new Bull('video-processing', {
      redis: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
      },
    });

    processingQueue.process(async (job) => {
      const { jobId, filePath, remoteUrl, originalname } = job.data;

      await job.progress(10);
      const clips = await clipDetector.detect(filePath);

      await job.progress(50);
      const subtitledClips = [];
      for (const clip of clips) {
        const subtitlePath = await subtitleGenerator.generate(clip.path);
        subtitledClips.push({ ...clip, subtitlePath });
      }

      await job.progress(80);
      const stored = await storageService.uploadClips(jobId, subtitledClips);

      await job.progress(100);
      return { jobId, clips: stored };
    });

    processingQueue.on('failed', (job, err) => {
      console.error(`Job ${job.id} failed:`, err.message);
    });

    processingQueue.on('completed', (job, result) => {
      console.log(`Job ${job.id} completed with ${result.clips.length} clips`);
    });
  }

  return processingQueue;
}

module.exports = { getProcessingQueue };
