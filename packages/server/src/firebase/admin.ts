import * as admin from 'firebase-admin'
import path from 'path'

let initialized = false

function getFirebaseAuth() {
  if (!initialized) {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH

    if (!serviceAccountPath) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH environment variable is required')
    }

    admin.initializeApp({
      credential: admin.credential.cert(path.resolve(process.cwd(), serviceAccountPath))
    })

    initialized = true
  }

  return admin.auth()
}

export const firebaseAuth = {
  verifyIdToken: (token: string) => getFirebaseAuth().verifyIdToken(token)
}
