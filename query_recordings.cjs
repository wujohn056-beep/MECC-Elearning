const admin = require("firebase-admin");
const serviceAccount = require("/Users/john/Downloads/mecc-elearning-usa-firebase-adminsdk-fbsvc-5ab992b8c2.json");

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkRecordings() {
    const snapshot = await db.collection('recordings').orderBy('createdAt', 'desc').limit(5).get();
    snapshot.forEach(doc => {
        console.log(`Document ID: ${doc.id}`);
        console.log(JSON.stringify(doc.data(), null, 2));
        console.log("-----------------------------------------");
    });
}

checkRecordings().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
