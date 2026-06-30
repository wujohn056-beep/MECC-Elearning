import admin from 'firebase-admin';

if (!admin.apps.length) {
    try {
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log("Firebase Admin successfully initialized in debug-db function.");
        } else {
            console.warn("FIREBASE_SERVICE_ACCOUNT env var not found in debug-db function.");
        }
    } catch (error) {
        console.error("Firebase Admin Initialization Error in debug-db function:", error);
    }
}

let dbInstance = null;
function getFirestoreDb() {
    if (dbInstance) return dbInstance;
    if (!admin.apps.length) {
        throw new Error("Firebase Admin not initialized.");
    }
    dbInstance = admin.firestore();
    try {
        dbInstance.settings({ databaseId: 'default' });
    } catch (settingsErr) {
        console.log("Database settings already applied:", settingsErr.message);
    }
    return dbInstance;
}

export const handler = async (event, context) => {
    try {
        if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: "Missing FIREBASE_SERVICE_ACCOUNT env var." })
            };
        }

        const db = getFirestoreDb();
        const collections = ['categories', 'recordings', 'users', 'policies'];
        const result = {};

        for (const coll of collections) {
            const snap = await db.collection(coll).get();
            const docs = [];
            snap.forEach(doc => {
                docs.push({ id: doc.id, ...doc.data() });
            });
            result[coll] = {
                count: snap.size,
                docs: docs.slice(0, 10) // return first 10 docs
            };
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: true, data: result })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message, stack: error.stack })
        };
    }
};
