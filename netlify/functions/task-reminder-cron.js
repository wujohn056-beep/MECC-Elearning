import { schedule } from '@netlify/functions';
import admin from 'firebase-admin';
import fetch from 'node-fetch';

// Initialize Firebase Admin if Service Account is configured
if (!admin.apps.length) {
    try {
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log("Firebase Admin successfully initialized in Task Reminder function.");
        } else {
            console.warn("FIREBASE_SERVICE_ACCOUNT env var not found. Running in mockup fallback mode.");
        }
    } catch (error) {
        console.error("Firebase Admin Initialization Error in Task Reminder function:", error);
    }
}

let dbInstance = null;

function getFirestoreDb() {
    if (dbInstance) return dbInstance;
    
    if (!admin.apps.length) {
        throw new Error("Firebase Admin not initialized. Check FIREBASE_SERVICE_ACCOUNT env var.");
    }
    
    dbInstance = admin.firestore();
    try {
        dbInstance.settings({ databaseId: 'default' });
    } catch (settingsErr) {
        console.log("Database settings already applied or failed to apply:", settingsErr.message);
    }
    
    return dbInstance;
}

const getReminderMarkdown = (taskTitle, assignerName, startTimeStr, deadlineStr, timeLabel) => {
    return `### ⚠️ **ME Cloud Academy**\n**Learning Task Deadline Approaching!**\n\n---\n\n**🚨 Time Remaining:** **${timeLabel}**\n\n**📋 Task Details:**\n* 🏷️ **Task Name:** ${taskTitle}\n* 👤 **Assigner:** ${assignerName}\n* 📅 **Start Time:** ${startTimeStr}\n* ⏰ **Final Deadline:** ${deadlineStr}\n\n---\n\n> 💡 *This is a friendly reminder that you have not yet completed your learning reflections for this task. Please listen to the assigned recordings and submit your reflections before the deadline to ensure your progress is recorded.*\n\n[👉 Click Here to Resume Learning](dingtalk://dingtalkclient/page/link?url=https%3A%2F%2Flearning.mecloudhub.com%2Fteam-tasks)`;
};

export const myHandler = async (event, context) => {
    console.log("[Task Reminder Cron] Job triggered at:", new Date().toISOString());
    
    const appKey = process.env.DINGTALK_APP_KEY;
    const appSecret = process.env.DINGTALK_APP_SECRET;
    const agentId = process.env.DINGTALK_AGENT_ID;
    
    const isMockDingTalk = !appKey || !appSecret || appKey.includes('your_') || appSecret.includes('your_');
    const isMockFirebase = !admin.apps.length;

    const diagnostics = {
        timestamp: new Date().toISOString(),
        isMockFirebase,
        isMockDingTalk,
        scannedTasks: [],
        errors: []
    };

    let db;
    try {
        db = getFirestoreDb();
    } catch (dbErr) {
        console.warn("[Task Reminder Cron] Firestore connection unavailable. Skipping reminder scan:", dbErr.message);
        diagnostics.errors.push("Firebase Admin is not configured: " + dbErr.message);
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, diagnostics })
        };
    }

    try {
        // Exchange token with DingTalk OpenAPI if real credentials exist
        let accessToken = null;
        if (!isMockDingTalk) {
            try {
                const tokenRes = await fetch(`https://oapi.dingtalk.com/gettoken?appkey=${appKey.trim()}&appsecret=${appSecret.trim()}`);
                const tokenData = await tokenRes.json();
                if (tokenData.errcode === 0) {
                    accessToken = tokenData.access_token;
                } else {
                    console.error("[Task Reminder Cron] Failed to exchange DingTalk token:", tokenData.errmsg);
                    diagnostics.errors.push(`DingTalk token exchange error: [${tokenData.errcode}] ${tokenData.errmsg}`);
                }
            } catch (tokenErr) {
                console.error("[Task Reminder Cron] DingTalk token request network error:", tokenErr.message);
                diagnostics.errors.push("DingTalk token request network error: " + tokenErr.message);
            }
        }

        const now = admin.firestore.Timestamp.now();
        // Fetch all active learning tasks where the deadline is in the future
        const snapshot = await db.collection('learning_tasks')
            .where('deadline', '>', now)
            .get();
        
        console.log(`[Task Reminder Cron] Scanning ${snapshot.size} active learning tasks...`);
        
        for (const doc of snapshot.docs) {
            const task = { id: doc.id, ...doc.data() };
            
            if (!task.deadline) {
                diagnostics.scannedTasks.push({
                    id: task.id,
                    title: task.title || 'Untitled',
                    error: "Task has no deadline field."
                });
                continue;
            }
            
            // Robust defensive parsing of task.deadline (can be Timestamp, Date object, or serialised objects)
            let deadlineDate;
            try {
                if (typeof task.deadline.toDate === 'function') {
                    deadlineDate = task.deadline.toDate();
                } else if (task.deadline instanceof Date) {
                    deadlineDate = task.deadline;
                } else if (task.deadline.seconds) {
                    deadlineDate = new Date(task.deadline.seconds * 1000);
                } else if (task.deadline._seconds) {
                    deadlineDate = new Date(task.deadline._seconds * 1000);
                } else {
                    deadlineDate = new Date(task.deadline);
                }
            } catch (parseErr) {
                console.error(`[Task Reminder Cron] Failed to parse deadline for task ID ${task.id}:`, parseErr.message);
                diagnostics.scannedTasks.push({
                    id: task.id,
                    title: task.title || 'Untitled',
                    error: "Failed to parse deadline: " + parseErr.message
                });
                continue;
            }
            
            const msRemaining = deadlineDate.getTime() - Date.now();
            const minsRemaining = Math.floor(msRemaining / (60 * 1000));
            
            let triggerReminder = null; // '1h' or '30m'
            let reminderField = null;   // 'reminder1hSent' or 'reminder30mSent'
            let timeLabel = null;       // '1 Hour' or '30 Minutes'
            
            if (minsRemaining <= 30 && minsRemaining > 0 && !task.reminder30mSent) {
                triggerReminder = '30m';
                reminderField = 'reminder30mSent';
                timeLabel = '30 Minutes';
            } else if (minsRemaining <= 60 && minsRemaining > 30 && !task.reminder1hSent) {
                triggerReminder = '1h';
                reminderField = 'reminder1hSent';
                timeLabel = '1 Hour';
            }
            
            const taskDiagnostic = {
                id: task.id,
                title: task.title,
                deadline: deadlineDate.toISOString(),
                minsRemaining,
                reminder1hSent: !!task.reminder1hSent,
                reminder30mSent: !!task.reminder30mSent,
                triggerReminder,
                timeLabel
            };
            
            if (!triggerReminder) {
                taskDiagnostic.action = "No warning window triggered. Remaining minutes: " + minsRemaining;
                diagnostics.scannedTasks.push(taskDiagnostic);
                continue;
            }
            
            console.log(`[Task Reminder Cron] Task "${task.title}" (ID: ${task.id}) is due for ${timeLabel} warning (Deadline: ${deadlineDate.toLocaleString()}).`);
            
            // Filter only assignees who are still 'pending'
            const pendingAssigneeIds = Object.entries(task.assignees || {})
                .filter(([_, a]) => a.status === 'pending')
                .map(([uid, _]) => uid);
                
            taskDiagnostic.pendingAssignees = pendingAssigneeIds;
            
            if (pendingAssigneeIds.length === 0) {
                console.log(`[Task Reminder Cron] All assignees have completed Task "${task.title}". Marking ${reminderField} as true.`);
                taskDiagnostic.action = "All assignees completed. Marked reminder as sent.";
                await db.collection('learning_tasks').doc(task.id).update({
                    [reminderField]: true
                });
                diagnostics.scannedTasks.push(taskDiagnostic);
                continue;
            }
            
            // Gather DingTalk User IDs
            const dingtalkUserIds = [];
            for (const uid of pendingAssigneeIds) {
                const userDoc = await db.collection('users').doc(uid).get();
                if (userDoc.exists && userDoc.data().dingtalkUserId) {
                    dingtalkUserIds.push(userDoc.data().dingtalkUserId);
                }
            }
            
            taskDiagnostic.dingtalkUserIds = dingtalkUserIds;
            
            if (dingtalkUserIds.length === 0) {
                console.log(`[Task Reminder Cron] No linked DingTalk User IDs found for pending assignees of Task "${task.title}". Marking ${reminderField} as true.`);
                taskDiagnostic.action = "No linked DingTalk User IDs found. Marked reminder as sent.";
                await db.collection('learning_tasks').doc(task.id).update({
                    [reminderField]: true
                });
                diagnostics.scannedTasks.push(taskDiagnostic);
                continue;
            }
            
            // Defensive parsing of task.createdAt
            let startTimeStr = '-';
            if (task.createdAt) {
                try {
                    let createdDate;
                    if (typeof task.createdAt.toDate === 'function') {
                        createdDate = task.createdAt.toDate();
                    } else if (task.createdAt instanceof Date) {
                        createdDate = task.createdAt;
                    } else if (task.createdAt.seconds) {
                        createdDate = new Date(task.createdAt.seconds * 1000);
                    } else if (task.createdAt._seconds) {
                        createdDate = new Date(task.createdAt._seconds * 1000);
                    } else {
                        createdDate = new Date(task.createdAt);
                    }
                    startTimeStr = createdDate.toLocaleString();
                } catch (e) {
                    console.warn("Failed to parse task.createdAt:", e.message);
                }
            }

            const markdownText = getReminderMarkdown(
                task.title,
                task.assignerName || 'Leader',
                startTimeStr,
                deadlineDate.toLocaleString(),
                timeLabel
            );
            
            let sentSuccess = false;
            let apiErrMessage = null;
            
            if (accessToken && agentId) {
                try {
                    const notifyUrl = `https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2?access_token=${accessToken}`;
                    const response = await fetch(notifyUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            agent_id: parseInt(agentId),
                            userid_list: dingtalkUserIds.join(','),
                            msg: {
                                msgtype: "markdown",
                                markdown: {
                                    title: `⚠️ Task Deadline Reminder`,
                                    text: markdownText
                                }
                            }
                        })
                    });
                    const notifyData = await response.json();
                    if (notifyData.errcode === 0) {
                        sentSuccess = true;
                        console.log(`[Task Reminder Cron] DingTalk Corp Message sent successfully for Task "${task.title}" to: ${dingtalkUserIds.join(',')}`);
                        taskDiagnostic.action = `Notification sent successfully to ${dingtalkUserIds.join(',')}`;
                    } else {
                        console.error(`[Task Reminder Cron] DingTalk message send failed: [${notifyData.errcode}] ${notifyData.errmsg}`);
                        apiErrMessage = `DingTalk send failed: [${notifyData.errcode}] ${notifyData.errmsg}`;
                        taskDiagnostic.action = `Error: ${apiErrMessage}`;
                    }
                } catch (err) {
                    console.error(`[Task Reminder Cron] DingTalk message API query network exception:`, err.message);
                    apiErrMessage = `DingTalk API Exception: ${err.message}`;
                    taskDiagnostic.action = `Error: ${apiErrMessage}`;
                }
            } else {
                // Mock notification mode
                sentSuccess = true;
                console.log(`[Mock Task Reminder Cron] Triggered ${timeLabel} warning for Task "${task.title}" (Mock recipients: ${dingtalkUserIds.join(',')})`);
                taskDiagnostic.action = `Mock notification completed for ${dingtalkUserIds.join(',')}`;
            }
            
            taskDiagnostic.sentSuccess = sentSuccess;
            if (apiErrMessage) {
                taskDiagnostic.apiError = apiErrMessage;
                diagnostics.errors.push(`Task "${task.title}": ${apiErrMessage}`);
            }
            
            if (sentSuccess) {
                await db.collection('learning_tasks').doc(task.id).update({
                    [reminderField]: true
                });
            }
            
            diagnostics.scannedTasks.push(taskDiagnostic);
        }

        // ----------------------------------------------------
        // Auto-bump play counts for newly uploaded recordings
        // ----------------------------------------------------
        try {
            const recordingsSnapshot = await db.collection('recordings').get();
            const nowMs = Date.now();
            const tenMinutes = 10 * 60 * 1000;
            diagnostics.scannedRecordings = [];

            for (const doc of recordingsSnapshot.docs) {
                const data = doc.data();
                if (!data.initialPlayCountBumped) {
                    const createdAt = data.createdAt ? data.createdAt.toDate() : null;
                    if (createdAt) {
                        const ageMs = nowMs - createdAt.getTime();
                        if (ageMs >= tenMinutes) {
                            const randomBump = Math.floor(Math.random() * 20) + 1; // 1 to 20 plays
                            await doc.ref.update({
                                playCount: (data.playCount || 0) + randomBump,
                                initialPlayCountBumped: true
                            });
                            console.log(`[Task Reminder Cron] Seeding play count for new recording "${data.title}" by +${randomBump}.`);
                            diagnostics.scannedRecordings.push({
                                id: doc.id,
                                title: data.title,
                                bump: randomBump
                            });
                        }
                    } else {
                        // Fallback for legacy recordings that missed the bump and have no createdAt
                        const randomBump = Math.floor(Math.random() * 20) + 1;
                        await doc.ref.update({
                            playCount: (data.playCount || 0) + randomBump,
                            initialPlayCountBumped: true
                        });
                        console.log(`[Task Reminder Cron] Seeding play count for new recording "${data.title}" (no createdAt) by +${randomBump}.`);
                        diagnostics.scannedRecordings.push({
                            id: doc.id,
                            title: data.title,
                            bump: randomBump
                        });
                    }
                }
            }
        } catch (recErr) {
            console.error("[Task Reminder Cron] Failed during recordings play count auto-bump:", recErr);
            diagnostics.errors.push("Recordings play count auto-bump error: " + recErr.message);
        }
    } catch (err) {
        console.error("[Task Reminder Cron] Job encountered error:", err);
        diagnostics.errors.push("Job general error: " + err.message);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, diagnostics })
        };
    }

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, diagnostics })
    };
};

export const handler = schedule('*/5 * * * *', myHandler);
