import admin from 'firebase-admin';

if (!admin.apps.length) {
    try {
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }
    } catch (error) {
        console.error("Firebase Admin Initialization Error:", error);
    }
}

export const handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        if (!admin.apps.length) {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Firebase Admin not initialized. Check FIREBASE_SERVICE_ACCOUNT env var in Netlify.' })
            };
        }

        const body = JSON.parse(event.body);
        const { action, uid, newPassword } = body;

        if (action !== 'batchDelete' && !uid) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing uid' }) };
        }

        if (action === 'delete') {
            await admin.auth().deleteUser(uid);
            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'User deleted successfully from Auth' })
            };
        } else if (action === 'batchDelete') {
            const { uids } = body;
            if (!Array.isArray(uids) || uids.length === 0) {
                return { statusCode: 400, body: JSON.stringify({ error: 'Missing uids array' }) };
            }
            const deleteResult = await admin.auth().deleteUsers(uids);
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'Batch delete completed from Auth',
                    successCount: deleteResult.successCount,
                    failureCount: deleteResult.failureCount,
                    errors: deleteResult.errors.map(e => ({ index: e.index, error: e.error.message }))
                })
            };
        } else if (action === 'resetPassword') {
            const passwordToSet = newPassword || '123456';
            await admin.auth().updateUser(uid, {
                password: passwordToSet
            });
            return {
                statusCode: 200,
                body: JSON.stringify({ message: `Password reset successfully to ${passwordToSet}` })
            };
        } else {
            return { statusCode: 400, body: JSON.stringify({ error: 'Invalid action' }) };
        }

    } catch (error) {
        console.error('manageUser error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
