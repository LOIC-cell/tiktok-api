const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');

const execFileAsync = util.promisify(execFile);

// Extracts audio from a clip and generates an SRT subtitle file.
// Swap the stub transcription with Whisper, AssemblyAI, or Deepgram in production.
async function generate(clipPath) {
  const dir = path.dirname(clipPath);
  const base = path.basename(clipPath, path.extname(clipPath));
  const audioPath = path.join(dir, `${base}.wav`);
  const srtPath = path.join(dir, `${base}.srt`);

  await extractAudio(clipPath, audioPath);

  // TODO: replace with real ASR call, e.g. openai.audio.transcriptions.create()
  const srtContent = buildStubSrt();
  fs.writeFileSync(srtPath, srtContent, 'utf8');

  fs.rmSync(audioPath, { force: true });

  return srtPath;
}

async function extractAudio(clipPath, audioPath) {
  await execFileAsync('ffmpeg', [
    '-i', clipPath,
    '-vn',
    '-acodec', 'pcm_s16le',
    '-ar', '16000',
    '-ac', '1',
    '-y',
    audioPath,
  ]);
}

function buildStubSrt() {
  return `1\n00:00:00,000 --> 00:00:03,000\n[Gaming highlight]\n\n`;
}

module.exports = { generate };
