import { FETCH_TIMEOUT_MS, MAX_RESPONSE_BYTES, USER_AGENT } from '../feedParser/shared'

export async function fetchPage(url: string): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  const response = await fetch(url, {
    signal: controller.signal,
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5'
    }
  }).finally(() => clearTimeout(timeoutId))

  if (!response.ok) {
    throw new Error(`Page fetch failed: HTTP ${response.status} ${response.statusText}`)
  }

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    throw new Error(`Unexpected content type: ${contentType} (expected HTML)`)
  }

  const contentLength = response.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
    throw new Error(`Page too large: ${contentLength} bytes (max ${MAX_RESPONSE_BYTES})`)
  }

  const text = await response.text()
  if (text.length > MAX_RESPONSE_BYTES) {
    throw new Error(`Page too large: ${text.length} bytes (max ${MAX_RESPONSE_BYTES})`)
  }

  return text
}
