import { config } from 'dotenv';
import mongoose from 'mongoose';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

config({ path: '.env.local' });
config({ path: '../../.env' });

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;
const PLAYBILL_DIR = '/Users/peterfreeby/Documents/Founding Projects/Curtn/Data imports/Playbill Data';
const CONCURRENCY = 10;

const MIME_MAP = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
};

function extractShowName(filename) {
  let name = filename.replace(/\.(jpe?g|png|webp|gif)$/i, '');
  name = name.replace(/^[0-9a-f]{32}-/, '');
  name = name.replace(/[-_]?playbill.*$/i, '');
  name = name.replace(/[-_]?web$/i, '');
  name = name.replace(/-/g, ' ').trim();
  return name.toLowerCase();
}

function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

async function uploadFile(filename) {
  const filePath = path.join(PLAYBILL_DIR, filename);
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filename).toLowerCase();
  const contentType = MIME_MAP[ext] || 'image/jpeg';
  const key = `show/playbill/${filename}`;

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: key, Body: buffer,
    ContentType: contentType, CacheControl: 'public, max-age=31536000',
  }));

  return `${R2_PUBLIC_URL}/${key}`;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URL);
  const db = mongoose.connection.db;

  const shows = await db.collection('shows').find({
    $or: [{ posterUrl: '' }, { posterUrl: null }, { posterUrl: { $exists: false } }]
  }).toArray();
  console.log(`Shows still needing posters: ${shows.length}`);

  const titleMap = new Map();
  for (const show of shows) {
    titleMap.set(normalize(show.title), show);
  }

  const files = fs.readdirSync(PLAYBILL_DIR)
    .filter(f => /\.(jpe?g|png|webp|gif)$/i.test(f));

  const toProcess = [];
  const seen = new Set();
  for (const file of files) {
    const parsed = normalize(extractShowName(file));
    const show = titleMap.get(parsed);
    if (show && !seen.has(show._id.toString())) {
      seen.add(show._id.toString());
      toProcess.push({ file, show });
    }
  }
  console.log(`Matched: ${toProcess.length}`);

  let uploaded = 0, failed = 0;
  for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
    const batch = toProcess.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async ({ file, show }) => {
        const url = await uploadFile(file);
        await db.collection('shows').updateOne({ _id: show._id }, { $set: { posterUrl: url } });
        return show.title;
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled') uploaded++;
      else { failed++; console.error(`  ✗ ${r.reason?.message}`); }
    }
    if ((i + CONCURRENCY) % 50 < CONCURRENCY) {
      console.log(`  ${uploaded}/${toProcess.length} done`);
    }
  }

  console.log(`\nDone. Uploaded: ${uploaded}, Failed: ${failed}`);
  await mongoose.disconnect();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
