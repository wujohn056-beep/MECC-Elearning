import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs } from 'firebase/firestore';

const app = initializeApp({
  apiKey: "AIzaSyCZfuCjkb765SUCAm0l7ArvQ7L9PhmvxbY",
  authDomain: "mecc-elearning-usa.firebaseapp.com",
  projectId: "mecc-elearning-usa",
  storageBucket: "mecc-elearning-usa.firebasestorage.app",
  messagingSenderId: "832448649388",
  appId: "1:832448649388:web:c43613eca75134ef8ee709",
  measurementId: "G-10DQBYNN9N"
});

// Pass "default" as the explicit database ID
const db = getFirestore(app, "default");

async function runTest() {
  console.log("Testing mecc-elearning-usa with dbId='default'...");
  try {
    const snap = await getDocs(collection(db, "categories"));
    console.log("Read success. Docs:", snap.size);
  } catch (e) {
    console.error("Test failed:", e.message);
  }
}
runTest();
