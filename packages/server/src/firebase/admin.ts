import * as admin from 'firebase-admin'
import path from 'path'

function getFirebaseAuth() {
  // Guard against firebase-admin's GLOBAL app registry, not a module-local
  // flag: under hot-reload / repeated imports the module re-evaluates (a local
  // `initialized` boolean resets) while the underlying [DEFAULT] app persists,
  // so a second initializeApp throws "Firebase app already exists". Reuse the
  // existing app instead.
  if (admin.apps.length === 0) {
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
  }

  return admin.auth()
}

export const firebaseAuth = {
  verifyIdToken: (token: string) => getFirebaseAuth().verifyIdToken(token)
}
