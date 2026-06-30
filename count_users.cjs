const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const serviceAccount = require("/Users/john/Downloads/mecc-elearning-usa-firebase-adminsdk-fbsvc-2767dc5936.json");

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = getFirestore(admin.app(), "default");

async function checkLeaders() {
    const snapshot = await db.collection('users').get();
    const leaders = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.role === 'sd' || data.role === 'sm' || data.role === 'tl') {
            leaders.push({ id: doc.id, crmId: data.crmId, role: data.role, email: data.email });
        }
    });
    console.log("Leaders in DB:", JSON.stringify(leaders, null, 2));
}

checkLeaders().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
