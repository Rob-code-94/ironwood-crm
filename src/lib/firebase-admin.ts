import { cert, getApps, initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

function normalizePrivateKey(value: string) {
  return value.replace(/\\n/g, "\n")
}

function readServiceAccountFromEnv() {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY

  if (!projectId || !clientEmail || !privateKey) {
    return null
  }

  return {
    projectId,
    clientEmail,
    privateKey: normalizePrivateKey(privateKey),
  }
}

export function getFirebaseAdminFirestore() {
  const existingApp = getApps()[0]
  if (existingApp) {
    return getFirestore(existingApp)
  }

  const serviceAccount = readServiceAccountFromEnv()
  if (!serviceAccount) {
    return null
  }

  const app = initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.projectId,
  })

  return getFirestore(app)
}
