import admin from 'firebase-admin';
import fetch from 'node-fetch';

if (!admin.apps.length) {
    try {
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log("Firebase Admin successfully initialized in Translate function.");
        } else {
            console.warn("FIREBASE_SERVICE_ACCOUNT env var not found in Translate function. Mock mode active.");
        }
    } catch (error) {
        console.error("Firebase Admin Init Error in Translate function:", error);
    }
}

let dbInstance = null;
function getFirestoreDb() {
    if (dbInstance) return dbInstance;
    
    if (!admin.apps.length) {
        throw new Error("Firebase Admin not initialized.");
    }
    
    try {
        dbInstance = admin.firestore();
        try {
            dbInstance.settings({ databaseId: 'default' });
        } catch (settingsErr) {}
    } catch (e) {
        dbInstance = admin.firestore();
    }
    return dbInstance;
}

export const handler = async (event, context) => {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        const payload = JSON.parse(event.body || '{}');
        const {
            recordingId,
            title: clientTitle,
            description: clientDescription,
            lecturerName: clientLecturerName,
            categoryName: clientCategoryName,
            displayId: clientDisplayId,
            transcript: clientTranscript
        } = payload;

        if (!recordingId) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing recordingId' }) };
        }

        let recordingData = {};
        let db = null;
        let recordingRef = null;

        // Try getting Firestore database; do not crash if it fails
        try {
            db = getFirestoreDb();
            recordingRef = db.collection('recordings').doc(recordingId);
        } catch (dbErr) {
            console.warn("Firestore Database not available, activating fallback mock mode:", dbErr.message);
        }

        // Try fetching document; do not crash if it fails
        if (recordingRef) {
            try {
                const recordingDoc = await recordingRef.get();
                if (recordingDoc && recordingDoc.exists) {
                    recordingData = recordingDoc.data() || {};
                }
            } catch (docErr) {
                console.warn(`Failed to fetch recording ${recordingId} from Firestore, using client-provided/fallback data:`, docErr.message);
            }
        }

        // Merge DB data with client data (prefer DB data)
        const transcriptText = recordingData.transcript || clientTranscript || "";
        const displayId = recordingData.displayId || clientDisplayId || 'RD';
        const title = recordingData.title || clientTitle || 'Sales Call';
        const desc = recordingData.description || clientDescription || 'فهم احتياجات العميل وتقديم الحلول المناسبة لمساعدته在实现职业目标和加速发展中提供支持';
        const lecturer = recordingData.lecturerName || clientLecturerName || 'مستشار مبيعات';
        const category = recordingData.categoryName || clientCategoryName || 'مبيعات';

        // Check if database already has a Chinese translation
        if (recordingData.transcriptZh) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, transcriptZh: recordingData.transcriptZh })
            };
        }

        const apiKey = process.env.GEMINI_API_KEY;
        let translatedText = "";

        if (!apiKey) {
            console.warn("GEMINI_API_KEY not found in environment.");
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Translation service is not configured (missing GEMINI_API_KEY on server).' })
            };
        }

        if (!transcriptText) {
            console.warn("No transcript text available for translation.");
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'No transcript text available to translate.' })
            };
        }

        try {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
            const response = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: `Please translate the following recording transcript into highly professional and natural Simplified Chinese. Maintain the paragraph breaks, speaker names, and labels exactly:\n\n${transcriptText}`
                                }
                            ]
                        }
                    ]
                })
            });

            if (response.ok) {
                const data = await response.json();
                translatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            } else {
                throw new Error("Gemini API call failed with status: " + response.status);
            }
        } catch (geminiErr) {
            console.error("Gemini call failed:", geminiErr.message);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Gemini translation service failed: ' + geminiErr.message })
            };
        }

        if (!translatedText) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Translation returned empty result.' })
            };
        }

        // Save the valid translation to database if write access is available; do not block or crash if it fails
        if (recordingRef) {
            try {
                await recordingRef.update({
                    transcriptZh: translatedText
                });
                console.log(`Successfully persisted Chinese translation to Firestore for recording: ${recordingId}`);
            } catch (saveErr) {
                console.warn(`Could not persist translation for recording ${recordingId} to Firestore:`, saveErr.message);
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, transcriptZh: translatedText })
        };

    } catch (err) {
        console.error("General Translate error:", err);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: err.message || "Internal server error" })
        };
    }
};
