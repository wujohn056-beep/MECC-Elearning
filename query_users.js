const admin = require("firebase-admin");
const serviceAccount = require("/Users/john/Downloads/mecc-elearning-usa-firebase-adminsdk-fbsvc-5ab992b8c2.json");

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkUsers() {
    const snapshot = await db.collection('users').get();
    let bahaUsers = [];
    let irisUsers = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.crmId && data.crmId.toLowerCase() === 'jocc-baha') {
            bahaUsers.push({ id: doc.id, ...data });
        }
        if (data.crmId && data.crmId.toLowerCase() === 'iris') {
            irisUsers.push({ id: doc.id, ...data });
        }
    });
    console.log("JOCC-Baha users:", JSON.stringify(bahaUsers, null, 2));
    console.log("Iris users:", JSON.stringify(irisUsers, null, 2));
}

checkUsers().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
