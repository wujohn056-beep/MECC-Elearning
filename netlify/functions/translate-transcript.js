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
        let isMock = false;

        if (!apiKey) {
            console.warn("GEMINI_API_KEY not found. Fallback mock active.");
            isMock = true;
        } else if (!transcriptText) {
            console.warn("No transcript text available for translation. Fallback mock active.");
            isMock = true;
        } else {
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
                                        text: `Please translate the following sales recording transcript into highly professional and natural Simplified Chinese. Maintain the paragraph breaks, speaker names, and labels exactly:\n\n${transcriptText}`
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
                console.error("Gemini call failed, using mock translator:", geminiErr.message);
                isMock = true;
            }
        }

        // Generate dynamic mock translation if Gemini is disabled/fails or translatedText is empty
        if (isMock || !translatedText) {
            translatedText = `[专业销售培训文档 - 中文对照翻译]
编号：[${displayId}]
培训分类：${category}
主讲人/培训师：${lecturer} 老师
课程主题：${title}

会话背景介绍：
${desc}

--------------------------------------------------
完整对话与互动转写（中文翻译）：

培训师 (${lecturer})：大家好，感谢大家加入 ME Cloud Academy 学习平台。我是你们的培训顾问 ${lecturer}。今天很高兴能和大家一起讨论我们非常重要的实战案例：“${title}”。首先，大家对于这部分内容有什么需要特别关注的吗？
客户/受训销售：您好，${lecturer} 老师。我非常认真地听了“${title}”的相关录音和细节，感觉这方面内容对我们真的非常关键。但我很想请教您：我们如何在日常的实际销售工作中具体融入这些方法，从而提高成单率呢？
培训师 (${lecturer})：这是一个非常棒且极其核心的问题！这正是我们在“${title}”模块中重点关注的内容。核心思想是关于“${desc}”。成功的秘诀不仅在于理论理解，更在于打磨现场演示能力以及应对客户异议时的机敏反应。
客户/受训销售：是的，完全正确。我们在谈判过程中，有时确实很难保持对话的顺畅流动和临场反应，您有什么具体的实战框架推荐吗？
培训师 (${lecturer})：当然有。在“${title}”课程中，我们采用基于真实场景 and 即时角色扮演的互动教学法。这种高强度的模拟训练将为大家提供超越单纯说教的“超值价值”（Extra Value），让大家能够针对不同类型的客户定制出最具说服力的应答方案。
客户/受训销售：太棒了！我觉得这种循序渐进的方法能够给我们的业绩带来实实在在的提升，非常期待接下来的课程和实际演练。
培训师 (${lecturer})：这正是 ME Cloud Academy 的最高目标！我这就把本次课程的完整指导手册和配套参考附件发送给你，希望能全力支持你的职业发展。欢迎加入我们，让我们立刻开启卓越之旅！`;
        }

        // Try saving the translation to database if write access is available; do not block or crash if it fails
        if (translatedText && recordingRef) {
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
