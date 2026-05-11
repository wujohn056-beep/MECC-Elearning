import 'dotenv/config';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
    try {
        console.log("1. Testing read on", firebaseConfig.projectId, "...");
        const snapshot = await getDocs(collection(db, 'categories'));
        console.log("Read success! Docs:", snapshot.size);

        console.log("2. Testing write...");
        const docRef = await addDoc(collection(db, 'categories'), {
            name: "Test from Node",
            createdAt: serverTimestamp()
        });
        console.log("Write success! ID:", docRef.id);
        process.exit(0);
    } catch(e) {
        console.error("Error:", e);
        process.exit(1);
    }
}
test();
