import 'dotenv/config';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "default");

async function checkJocc27() {
    try {
        const snapshot = await getDocs(collection(db, 'users'));
        const users = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (
                (data.crmId && data.crmId.toLowerCase() === 'jocc-ahmadzoubi') ||
                (data.crmId && data.crmId.toLowerCase() === 'jocc-yusranasr') ||
                (data.crmId && data.crmId.toLowerCase() === 'jocc-zeyadaldajeh') ||
                (data.crmId && data.crmId.toLowerCase() === 'jocc-obadaaljabari')
            ) {
                users.push({ id: doc.id, ...data });
            }
        });
        console.log("Users:", JSON.stringify(users, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkJocc27();
