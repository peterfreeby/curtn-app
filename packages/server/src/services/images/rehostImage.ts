import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import crypto from 'crypto'
import type { CsvRowInput } from '../importEngine'

// Rehost a scraped image into our own R2 bucket. Some venues (e.g. St. Ann's
// Warehouse) hotlink-protect their images — the URL works when their own site
// requests it but renders broken cross-origin on Curtn. For sources flagged
// `rehostImages`, we download the image once and serve our own copy.
//
// Reuses the same R2 bucket/config as packages/app's /api/upload route.
// On ANY failure (fetch error, non-image, R2 error) we return null so the
// caller drops the field rather than persist a broken hotlink — "downloaded
// or not included."

const MAX_BYTES = 8 * 1024 * 1024
const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
}

let _s3: S3Client | null = null
function r2(): S3Client | null {
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    return null
  }
  if (!_s3) {
    _s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    })
  }
  return _s3
}

const memo = new Map<string, string | null>() // srcUrl -> rehosted (idempotent within a run)

export async function rehostImage(srcUrl: string, keyPrefix: string): Promise<string | null> {
  if (!srcUrl || !/^https?:\/\//i.test(srcUrl)) return null
  // already on our bucket? leave as-is.
  if (process.env.R2_PUBLIC_URL && srcUrl.startsWith(process.env.R2_PUBLIC_URL)) return srcUrl
  if (memo.has(srcUrl)) return memo.get(srcUrl)!

  const s3 = r2()
  if (!s3 || !process.env.R2_BUCKET_NAME) return null

  let result: string | null = null
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 20_000)
    let res: Response
    try {
      res = await fetch(srcUrl, {
        headers: { 'User-Agent': 'CurtnBot/1.0 (+https://curtn.app)' },
        signal: ctrl.signal,
      })
    } finally {
      clearTimeout(timer)
    }
    if (!res.ok) throw new Error(`fetch ${res.status}`)
    const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    const ext = EXT_BY_TYPE[type]
    if (!ext) throw new Error(`not an image: ${type}`)
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length === 0 || buf.length > MAX_BYTES) throw new Error(`bad size ${buf.length}`)

    const hash = crypto.createHash('sha1').update(srcUrl).digest('hex').slice(0, 16)
    const key = `scraped/${keyPrefix}/${hash}.${ext}`
    await s3.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: buf,
      ContentType: type,
      CacheControl: 'public, max-age=31536000',
    }))
    result = process.env.R2_PUBLIC_URL ? `${process.env.R2_PUBLIC_URL}/${key}` : key
  } catch (err) {
    console.warn(`[rehostImage] ${srcUrl.slice(0, 80)} → ${(err as Error).message}`)
    result = null
  }
  memo.set(srcUrl, result)
  return result
}

const IMAGE_FIELDS = [
  'showImageUrl', 'showPosterUrl', 'runImageUrl', 'runPosterUrl',
  'performanceImageUrl', 'venueImageUrl',
] as const

// Rehost every external image field on each row in place. A field whose rehost
// fails is deleted (drop, don't keep a broken hotlink).
export async function rehostRowImages(rows: CsvRowInput[], keyPrefix: string): Promise<number> {
  let rehosted = 0
  for (const row of rows) {
    const r = row as unknown as Record<string, unknown>
    for (const field of IMAGE_FIELDS) {
      const val = r[field]
      if (typeof val !== 'string' || !/^https?:\/\//i.test(val)) continue
      const newUrl = await rehostImage(val, keyPrefix)
      if (newUrl) { r[field] = newUrl; if (newUrl !== val) rehosted++ }
      else delete r[field]
    }
  }
  return rehosted
}
