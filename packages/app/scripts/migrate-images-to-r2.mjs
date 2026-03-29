import { config } from 'dotenv';
import mongoose from 'mongoose';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Load env files
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

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;
const BUCKET = process.env.R2_BUCKET_NAME;
const VERCEL_PREFIX = 'blob.vercel-storage.com';

async function migrateUrl(oldUrl) {
  if (!oldUrl || !oldUrl.includes(VERCEL_PREFIX)) return null;

  // Extract the path after /curtn/
  const match = oldUrl.match(/\/curtn\/(.+)$/);
  if (!match) {
    console.warn('  ⚠ Could not parse path from:', oldUrl.substring(0, 80));
    return null;
  }
  const key = match[1];

  // Download from Vercel Blob (with auth token)
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  const res = await fetch(oldUrl, {
    headers: blobToken ? { Authorization: `Bearer ${blobToken}` } : {},
  });
  if (!res.ok) {
    console.warn(`  ⚠ Failed to download (${res.status}):`, oldUrl.substring(0, 80));
    return null;
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') || 'image/jpeg';

  // Upload to R2
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000',
  }));

  return `${R2_PUBLIC_URL}/${key}`;
}

async function migrateCollection(db, collectionName, imageFields) {
  const col = db.collection(collectionName);
  const orQuery = imageFields.map(f => ({ [f]: { $regex: VERCEL_PREFIX } }));
  const docs = await col.find({ $or: orQuery }).toArray();

  if (docs.length === 0) {
    console.log(`${collectionName}: no Vercel Blob URLs, skipping`);
    return { migrated: 0, failed: 0 };
  }

  console.log(`${collectionName}: ${docs.length} docs to migrate`);
  let migrated = 0;
  let failed = 0;

  for (const doc of docs) {
    const updates = {};
    let docOk = true;

    for (const field of imageFields) {
      const oldUrl = doc[field];
      if (!oldUrl || !oldUrl.includes(VERCEL_PREFIX)) continue;

      try {
        const newUrl = await migrateUrl(oldUrl);
        if (newUrl) {
          updates[field] = newUrl;
          console.log(`  ✓ ${collectionName}/${doc._id} ${field}`);
        } else {
          docOk = false;
        }
      } catch (err) {
        console.error(`  ✗ ${collectionName}/${doc._id} ${field}: ${err.message}`);
        docOk = false;
      }
    }

    if (Object.keys(updates).length > 0) {
      await col.updateOne({ _id: doc._id }, { $set: updates });
      migrated++;
    }
    if (!docOk) failed++;
  }

  return { migrated, failed };
}

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URL);
  const db = mongoose.connection.db;
  console.log('Connected.\n');

  const collections = [
    { name: 'shows', fields: ['imageUrl', 'posterUrl'] },
    { name: 'runs', fields: ['imageUrl', 'posterUrl'] },
    { name: 'venues', fields: ['imageUrl'] },
    { name: 'people', fields: ['headshotUrl'] },
    { name: 'users', fields: ['avatarUrl'] },
  ];

  let totalMigrated = 0;
  let totalFailed = 0;

  for (const { name, fields } of collections) {
    const { migrated, failed } = await migrateCollection(db, name, fields);
    totalMigrated += migrated;
    totalFailed += failed;
    console.log();
  }

  console.log('---');
  console.log(`Done. Migrated: ${totalMigrated}, Failed: ${totalFailed}`);

  await mongoose.disconnect();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
