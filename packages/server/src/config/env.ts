import dotenv from 'dotenv'

// Load .env files — try multiple paths to handle both standalone server
// and webpack-bundled (Next.js) environments
if (!process.env.VERCEL && !process.env.MONGODB_URL) {
  try {
    const path = require('path')
    // When running from packages/server/ directly
    dotenv.config({ path: path.resolve(process.cwd(), '.env') })
    // When running from packages/app/ (Next.js dev)
    dotenv.config({ path: path.resolve(process.cwd(), '../server/.env') })
  } catch {
    dotenv.config()
  }
}

export function getEnvironmentVariables() {
  const PORT = Number(process.env.PORT)
  const { MONGODB_URL, DB_NAME, TMDB_API_KEY, FIREBASE_SERVICE_ACCOUNT_PATH } = process.env

  const envArray = [
    PORT,
    MONGODB_URL,
    DB_NAME,
    TMDB_API_KEY,
    FIREBASE_SERVICE_ACCOUNT_PATH
  ]

  for (const key of envArray) {
    if (key === '') {
      throw new Error('One or more environment variables are missing')
    }
  }

  return { PORT, MONGODB_URL, DB_NAME, TMDB_API_KEY, FIREBASE_SERVICE_ACCOUNT_PATH }
}
