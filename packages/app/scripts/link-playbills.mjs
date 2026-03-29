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
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

function extractShowName(filename) {
  let name = filename.replace(/\.(jpe?g|png|webp|gif)$/i, '');
  name = name.replace(/^[0-9a-f]{32}-/, '');
  name = name.replace(/[-_]?playbill.*$/i, '');
  name = name.replace(/[-_]?web$/i, '');
  name = name.replace(/-/g, ' ').trim();
  return name.toLowerCase();
}

async function uploadFile(filename) {
  const filePath = path.join(PLAYBILL_DIR, filename);
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filename).toLowerCase();
  const contentType = MIME_MAP[ext] || 'image/jpeg';
  const key = `show/playbill/${filename}`;

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000',
  }));

  return `${R2_PUBLIC_URL}/${key}`;
}

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URL);
  const db = mongoose.connection.db;

  // Get shows that need posters
  const shows = await db.collection('shows').find({
    $or: [{ posterUrl: '' }, { posterUrl: null }, { posterUrl: { $exists: false } }]
  }).toArray();
  console.log(`Shows needing posters: ${shows.length}`);

  // Build title → show map
  const titleMap = new Map();
  for (const show of shows) {
    titleMap.set(show.title.toLowerCase(), show);
  }

  // Get image files
  const files = fs.readdirSync(PLAYBILL_DIR)
    .filter(f => /\.(jpe?g|png|webp|gif)$/i.test(f));
  console.log(`Playbill images on disk: ${files.length}`);

  // Match files to shows
  const toProcess = [];
  for (const file of files) {
    const parsed = extractShowName(file);
    const show = titleMap.get(parsed);
    if (show) {
      toProcess.push({ file, show });
    }
  }
  console.log(`Matched to posterless shows: ${toProcess.length}`);

  // Deduplicate — if multiple images match the same show, pick the first
  const seen = new Set();
  const deduped = [];
  for (const item of toProcess) {
    const id = item.show._id.toString();
    if (!seen.has(id)) {
      seen.add(id);
      deduped.push(item);
    }
  }
  console.log(`After dedup (unique shows): ${deduped.length}`);

  // Estimate size
  let totalBytes = 0;
  for (const { file } of deduped) {
    totalBytes += fs.statSync(path.join(PLAYBILL_DIR, file)).size;
  }
  console.log(`Total upload size: ${(totalBytes / (1024 * 1024)).toFixed(1)} MB`);
  console.log(`Estimated cost: < $0.01/mo (within free tier)\n`);

  // Upload and link in batches
  let uploaded = 0;
  let failed = 0;

  for (let i = 0; i < deduped.length; i += CONCURRENCY) {
    const batch = deduped.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async ({ file, show }) => {
        const url = await uploadFile(file);
        await db.collection('shows').updateOne(
          { _id: show._id },
          { $set: { posterUrl: url } }
        );
        return { title: show.title, url };
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        uploaded++;
      } else {
        failed++;
        console.error(`  ✗ ${result.reason?.message || 'Unknown error'}`);
      }
    }

    if ((i + CONCURRENCY) % 100 < CONCURRENCY) {
      console.log(`  Progress: ${uploaded}/${deduped.length} uploaded, ${failed} failed`);
    }
  }

  console.log(`\nDone. Uploaded: ${uploaded}, Failed: ${failed}`);
  await mongoose.disconnect();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
