import * as admin from 'firebase-admin'
import path from 'path'

let initialized = false

function getFirebaseAuth() {
  if (!initialized) {
    // Support two modes:
    // 1. FIREBASE_SERVICE_ACCOUNT — JSON string (for Vercel/production)
    // 2. FIREBASE_SERVICE_ACCOUNT_PATH — file path (for local dev)
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH

    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson)
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      })
    } else if (serviceAccountPath) {
      admin.initializeApp({
        credential: admin.credential.cert(path.resolve(process.cwd(), serviceAccountPath))
      })
    } else {
      throw new Error('FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_PATH environment variable is required')
    }

    initialized = true
  }

  return admin.auth()
}

export const firebaseAuth = {
  verifyIdToken: (token: string) => getFirebaseAuth().verifyIdToken(token)
}
