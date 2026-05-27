const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

let supabase;

function getClient() {
  if (!supabase) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
  }
  return supabase;
}

const BUCKET = () => process.env.SUPABASE_STORAGE_BUCKET || 'gaming-clips';

async function uploadRaw(localPath, jobId, originalName) {
  const client = getClient();
  const remotePath = `raw/${jobId}/${originalName}`;
  const buffer = fs.readFileSync(localPath);

  const { error } = await client.storage
    .from(BUCKET())
    .upload(remotePath, buffer, { upsert: true });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = client.storage.from(BUCKET()).getPublicUrl(remotePath);
  return data.publicUrl;
}

async function uploadClips(jobId, clips) {
  const client = getClient();
  const results = [];

  for (const clip of clips) {
    const clipBuffer = fs.readFileSync(clip.path);
    const clipRemote = `clips/${jobId}/${clip.id}.mp4`;

    const { error: clipErr } = await client.storage
      .from(BUCKET())
      .upload(clipRemote, clipBuffer, { upsert: true });

    if (clipErr) throw new Error(`Clip upload failed: ${clipErr.message}`);

    let subtitleUrl = null;
    if (clip.subtitlePath && fs.existsSync(clip.subtitlePath)) {
      const srtBuffer = fs.readFileSync(clip.subtitlePath);
      const srtRemote = `clips/${jobId}/${clip.id}.srt`;

      const { error: srtErr } = await client.storage
        .from(BUCKET())
        .upload(srtRemote, srtBuffer, { upsert: true, contentType: 'text/plain' });

      if (!srtErr) {
        const { data } = client.storage.from(BUCKET()).getPublicUrl(srtRemote);
        subtitleUrl = data.publicUrl;
      }
    }

    const { data: clipData } = client.storage.from(BUCKET()).getPublicUrl(clipRemote);
    results.push({
      id: clip.id,
      url: clipData.publicUrl,
      subtitleUrl,
      start: clip.start,
      duration: clip.duration,
    });
  }

  return results;
}

async function listClips({ page = 1, limit = 20 } = {}) {
  const client = getClient();
  const offset = (page - 1) * limit;

  const { data, error } = await client.storage
    .from(BUCKET())
    .list('clips', { limit, offset, sortBy: { column: 'created_at', order: 'desc' } });

  if (error) throw new Error(`List clips failed: ${error.message}`);
  return { page, limit, clips: data };
}

async function getClip(id) {
  const client = getClient();
  const { data, error } = await client.storage
    .from(BUCKET())
    .createSignedUrl(`clips/${id}.mp4`, 3600);

  if (error) return null;
  return { id, signedUrl: data.signedUrl, expiresIn: 3600 };
}

async function deleteClip(id) {
  const client = getClient();
  const { error } = await client.storage
    .from(BUCKET())
    .remove([`clips/${id}.mp4`, `clips/${id}.srt`]);

  if (error) throw new Error(`Delete clip failed: ${error.message}`);
}

module.exports = { uploadRaw, uploadClips, listClips, getClip, deleteClip };
