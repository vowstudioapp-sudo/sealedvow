import { initializeApp } from "firebase/app";
import { 
  getDatabase, 
  ref, 
  set, 
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