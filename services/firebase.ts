import { initializeApp } from "firebase/app";
import { CoupleData } from '../types';
import { 
  getDatabase, 
  ref, 
  set, 
  get,
  onValue, 
  update 
} from "firebase/database";

import { 
  getStorage, 
  ref as storageRef, 
  uploadBytes, 
  getDownloadURL 
} from "firebase/storage";

import { 
  getAuth, 
  signInAnonymously 
} from "firebase/auth";

// Access environment variables safely
const env = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_PROJECT.firebaseapp.com",
  databaseURL: env.VITE_FIREBASE_DB_URL || "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_PROJECT.appspot.com",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "SENDER_ID",
  appId: env.VITE_FIREBASE_APP_ID || "APP_ID"
};

let db: any = null;
let storage: any = null;
let auth: any = null;

try {
  if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
    const app = initializeApp(firebaseConfig);

    db = getDatabase(app);
    storage = getStorage(app);
    auth = getAuth(app);

    // 🔐 Silent Anonymous Login
    signInAnonymously(auth)
      .then(() => {
        console.log("Anonymous login successful");
      })
      .catch((error) => {
        console.error("Anonymous login failed:", error);
      });
  }
} catch (e) {
  console.warn("Firebase not initialized. Real-time features will simulate.");
}

export { storage, auth };


// ===============================
// REAL-TIME SESSION CONTROL
// ===============================

export const unlockSession = (sessionId: string) => {
  if (!db) return;
  set(ref(db, 'sessions/' + sessionId + '/status'), 'unlocked');
};

export const listenToSessionStatus = (
  sessionId: string, 
  callback: (status: string) => void
) => {
  if (!db) return () => {};
  const statusRef = ref(db, 'sessions/' + sessionId + '/status');
  const unsubscribe = onValue(statusRef, (snapshot) => {
    const data = snapshot.val();
    callback(data || 'locked');
  });
  return unsubscribe;
};

export const updateSyncState = (
  sessionId: string, 
  role: 'sender' | 'receiver', 
  isActive: boolean
) => {
  if (!db) return;
  update(ref(db, 'sessions/' + sessionId + '/sync'), {
    [role]: isActive
  });
};

export const listenToSyncState = (
  sessionId: string, 
  callback: (data: { sender: boolean; receiver: boolean }) => void
) => {
  if (!db) return () => {};
  const syncRef = ref(db, 'sessions/' + sessionId + '/sync');
  const unsubscribe = onValue(syncRef, (snapshot) => {
    const data = snapshot.val();
    callback(data || { sender: false, receiver: false });
  });
  return unsubscribe;
};


// ===============================
// SECURE MEDIA UPLOAD
// ===============================

export const uploadMemoryPhoto = async (
  sessionId: string,
  file: File
): Promise<string> => {

  if (!storage) {
    // Dev fallback (no Firebase configured)
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }

  // Match your Storage Rules path: uploads/{sessionId}/{fileName}
  const fileRef = storageRef(
    storage,
    `uploads/${sessionId}/${Date.now()}_${file.name}`
  );

  await uploadBytes(fileRef, file);
  return await getDownloadURL(fileRef);
};


// ===============================
// SESSION PERSISTENCE (Clean URLs)
// ===============================

/**
 * Slugify a name for URL display.
 * "Ajmal Fahad" → "ajmal-fahad"
 * Exported for SharePackage to build pretty URLs.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 30);
}

/**
 * Generate a short random ID (8 chars, alphanumeric).
 * Uses crypto.getRandomValues for proper randomness.
 */
function generateShortId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  for (let i = 0; i < 8; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}

/**
 * Save full CoupleData to Firebase RTDB under an opaque key.
 * Checks for collision before writing.
 * Returns the opaque key (not a slug — slug is built in the UI layer).
 */
export async function saveSession(data: CoupleData): Promise<string> {
  if (!db) {
    throw new Error('Firebase not initialized. Cannot save session.');
  }

  // Generate key with collision check (max 5 attempts)
  let key: string = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    key = generateShortId();
    const existing = await get(ref(db, `shared/${key}`));
    if (!existing.exists()) break;
    if (attempt === 4) {
      throw new Error('Failed to generate unique session key after 5 attempts.');
    }
  }

  await set(ref(db, `shared/${key}`), {
    ...data,
    createdAt: new Date().toISOString(),
  });

  console.log(`[Session] Saved under key: ${key}`);
  return key;
}

/**
 * Load CoupleData from Firebase RTDB by key.
 * Accepts either:
 *   - opaque key directly: "k8f2x9m1"
 *   - full slug from URL: "ajmal-saniya-k8f2x9m1" (extracts last segment)
 * Returns null if not found.
 */
export async function loadSession(key: string): Promise<CoupleData | null> {
  if (!db) {
    throw new Error('Firebase not initialized. Cannot load session.');
  }

  // Extract opaque key from slug if needed
  // "ajmal-saniya-k8f2x9m1" → last 8 chars = "k8f2x9m1"
  const parts = key.split('-');
  const opaqueKey = parts.length > 1 ? parts[parts.length - 1] : key;

  const snapshot = await get(ref(db, `shared/${opaqueKey}`));

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.val() as CoupleData;
}