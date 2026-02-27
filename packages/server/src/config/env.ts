import dotenv from 'dotenv'
import path from 'path'

if (!process.env.VERCEL) {
  // Try loading .env from server package root (works regardless of CWD)
  dotenv.config({ path: path.resolve(__dirname, '../../.env') })
  // Fallback: also try CWD-relative .env
  dotenv.config()
}

export function getEnvironmentVariables() {
  const PORT = Number(process.env.PORT)
  const { MONGODB_URL, DB_NAME, ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET, TMDB_API_KEY } = process.env

  const envArray = [
    PORT,
    MONGODB_URL,
    DB_NAME,
    TMDB_API_KEY,
    ACCESS_TOKEN_SECRET,
    REFRESH_TOKEN_SECRET
  ]

  for (const key of envArray) {
    if (key === '') {
      throw new Error('One or more environment variables are missing')
    }
  }

  return { PORT, MONGODB_URL, DB_NAME, ACCESS_TOKEN_SECRET, TMDB_API_KEY, REFRESH_TOKEN_SECRET }
}
