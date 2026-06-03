import { initializeApp } from 'firebase/app';
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Capacitor } from '@capacitor/core';

export const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

console.log("ACTUAL FIREBASE CONFIG:", firebaseConfig);

// Only initialize Firebase if we have config
export let app: any = null;
export let auth: any = null;
export let db: any = null;
export let storage: any = null;

if (firebaseConfig.apiKey && firebaseConfig.apiKey !== 'your_api_key') {
    app = initializeApp(firebaseConfig);
    
    // Use indexedDBLocalPersistence on native mobile platforms, with browserLocalPersistence as fallback
    if (Capacitor.isNativePlatform()) {
        auth = initializeAuth(app, {
            persistence: [indexedDBLocalPersistence, browserLocalPersistence]
        });
    } else {
        auth = initializeAuth(app, {
            persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence]
        });
    }
    
    db = getFirestore(app, "default");
    storage = getStorage(app);
} else {
    console.warn("Firebase config is missing. Running with mocked Firebase services.");
}
