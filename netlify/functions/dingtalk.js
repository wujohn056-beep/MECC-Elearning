const admin = require('firebase-admin');

// Initialize Firebase Admin if Service Account is configured
if (!admin.apps.length) {
    try {
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log("Firebase Admin successfully initialized in DingTalk function.");
        } else {
            console.warn("FIREBASE_SERVICE_ACCOUNT env var not found. Running in mockup fallback mode.");
        }
    } catch (error) {
        console.error("Firebase Admin Initialization Error in DingTalk function:", error);
    }
}

const CUSTOM_DINGTALK_EMAIL_MAP = {
    'serdah': 'mohserdah@51talk.com'
};

function getDingTalkEmail(crmId) {
    const key = crmId.trim().toLowerCase().replace(/\s+/g, '');
    if (CUSTOM_DINGTALK_EMAIL_MAP[key]) {
        return CUSTOM_DINGTALK_EMAIL_MAP[key];
    }
    return `${key}@51talk.com`;
}

exports.handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { action } = body;

        const appKey = process.env.DINGTALK_APP_KEY;
        const appSecret = process.env.DINGTALK_APP_SECRET;
        const agentId = process.env.DINGTALK_AGENT_ID;
        const webhookUrl = process.env.DINGTALK_WEBHOOK_URL;

        const isMockDingTalk = !appKey || !appSecret || appKey.includes('your_') || appSecret.includes('your_');
        const isMockFirebase = !admin.apps.length;

        // ==========================================
        // ACTION: SYNC (Phase 1 Automated Matching)
        // ==========================================
        if (action === 'sync') {
            const logs = [];
            let linkedCount = 0;

            if (isMockDingTalk) {
                logs.push({ msg: "⚠️ [未配置凭证] 钉钉 AppKey/AppSecret 未在环境变量中配置，系统正在运行在【高级模拟(Mock)测试环境】中...", type: 'error' });
            }

            let users = [];
            if (!isMockFirebase) {
                try {
                    const db = admin.firestore();
                    const snapshot = await db.collection('users').get();
                    snapshot.forEach(doc => {
                        users.push({ id: doc.id, ...doc.data() });
                    });
                    logs.push({ msg: `📂 [数据库连接成功] 自 Firestore 读取到共 ${users.length} 个系统账户。`, type: 'success' });
                } catch (fsErr) {
                    console.error("Firestore read error:", fsErr);
                    logs.push({ msg: `❌ [数据库故障] 读取 Firestore 用户表失败，进入完全模拟测试：${fsErr.message}`, type: 'error' });
                    users = getMockUserRecords();
                }
            } else {
                logs.push({ msg: "ℹ️ [无数据库服务] 正在以本地内存 Mock 数据集模拟用户列表进行同步...", type: 'success' });
                users = getMockUserRecords();
            }

            const targetUsers = users.filter(u => u.role !== 'super_admin');
            logs.push({ msg: `🔄 [开始同步] 筛选出 ${targetUsers.length} 个非超级管理员账户开展钉钉匹配...`, type: 'success' });

            let accessToken = null;
            if (!isMockDingTalk) {
                try {
                    logs.push({ msg: "🔐 [鉴权] 正在请求钉钉官方 Token...", type: 'success' });
                    const tokenRes = await fetch(`https://oapi.dingtalk.com/gettoken?appkey=${appKey.trim()}&appsecret=${appSecret.trim()}`);
                    const tokenData = await tokenRes.json();
                    if (tokenData.errcode === 0) {
                        accessToken = tokenData.access_token;
                        logs.push({ msg: "🔓 [鉴权成功] 钉钉 Access Token 获取成功，已建立安全信道。", type: 'success' });
                    } else {
                        logs.push({ msg: `❌ [鉴权失败] 钉钉返回错误: [${tokenData.errcode}] ${tokenData.errmsg}。降级为模拟匹配模式...`, type: 'error' });
                    }
                } catch (authErr) {
                    console.error("DingTalk Auth Error:", authErr);
                    logs.push({ msg: `❌ [鉴权故障] 连接钉钉服务器超时，降级为模拟匹配模式: ${authErr.message}`, type: 'error' });
                }
            }

            for (const user of targetUsers) {
                const crmId = user.crmId || user.id;
                const email = getDingTalkEmail(crmId);
                let ddUserId = null;
                let alreadyLinked = !!user.dingtalkUserId;

                if (alreadyLinked) {
                    ddUserId = user.dingtalkUserId;
                    logs.push({ msg: `🔗 [跳过] 销售 [${crmId}] (${email}) 已手动或历史关联钉钉 ID: ${ddUserId}，无需重复同步。`, type: 'success' });
                    linkedCount++;
                    continue;
                }

                if (!isMockDingTalk && accessToken) {
                    try {
                        const queryUrl = `https://oapi.dingtalk.com/topapi/v2/user/getbyemail?access_token=${accessToken}`;
                        const queryRes = await fetch(queryUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: email })
                        });
                        const queryData = await queryRes.json();

                        if (queryData.errcode === 0 && queryData.result && queryData.result.userid) {
                            ddUserId = queryData.result.userid;
                            logs.push({ msg: `✅ [匹配成功] 销售 [${crmId}] (${email}) 成功匹配，对应钉钉 ID: ${ddUserId}`, type: 'success' });
                        } else if (queryData.errcode === 60121 || queryData.errcode === 60114) {
                            logs.push({ msg: `ℹ️ [未匹配] 销售 [${crmId}] (${email}) 在您的企业钉钉通讯录中未找到（邮箱不一致或未加入企业）。`, type: 'error' });
                        } else {
                            logs.push({ msg: `⚠️ [API 错误] 销售 [${crmId}] 查询失败: [${queryData.errcode}] ${queryData.errmsg}`, type: 'error' });
                        }
                    } catch (apiErr) {
                        console.error("DingTalk API query error for user:", crmId, apiErr);
                        logs.push({ msg: `⚠️ [网络故障] 销售 [${crmId}] 接口查询异常: ${apiErr.message}`, type: 'error' });
                    }
                } else {
                    ddUserId = `dd_mock_${crmId.replace(/[^a-zA-Z0-9]/g, '') || Math.floor(Math.random() * 100000)}`;
                    logs.push({ msg: `✨ [Mock 关联] 销售 [${crmId}] (${email}) 成功模拟匹配，自动关联测试 ID: ${ddUserId}`, type: 'success' });
                }

                if (ddUserId) {
                    linkedCount++;
                    const syncTime = new Date().toISOString();

                    if (!isMockFirebase) {
                        try {
                            const db = admin.firestore();
                            await db.collection('users').doc(user.id).update({
                                dingtalkUserId: ddUserId,
                                dingtalkSyncedAt: syncTime
                            });
                        } catch (dbErr) {
                            console.error("Failed to write sync to Firestore for user:", user.id, dbErr);
                            logs.push({ msg: `❌ [数据库写入失败] 销售 [${crmId}] 的匹配结果未能持久化: ${dbErr.message}`, type: 'error' });
                        }
                    } else {
                        user.dingtalkUserId = ddUserId;
                        user.dingtalkSyncedAt = syncTime;
                    }
                }
            }

            logs.push({ msg: `🎉 [同步完成] 结束本次钉钉关联，成功将 ${linkedCount} / ${targetUsers.length} 个销售账户绑定至钉钉。`, type: 'success' });

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: true,
                    linkedCount: linkedCount,
                    logs: logs.reverse()
                })
            };
        }

        // ==========================================
        // ACTION: LOGIN (Phase 2 Single Sign-On SSO)
        // ==========================================
        if (action === 'login') {
            const { code } = body;
            if (!code) {
                return { statusCode: 400, body: JSON.stringify({ error: 'Missing code' }) };
            }

            let resolvedCrmId = null;
            let resolvedUserId = null;

            // Handle local Mock Login test code
            if (code.startsWith('mock_auth_code_')) {
                resolvedCrmId = code.replace('mock_auth_code_', '');
                console.log(`[Mock SSO Login] Simulating OAuth login for crmId: ${resolvedCrmId}`);

                // Try to find the user in Firebase first
                if (!isMockFirebase) {
                    try {
                        const db = admin.firestore();
                        const snapshot = await db.collection('users').where('crmId', '==', resolvedCrmId).limit(1).get();
                        if (!snapshot.empty) {
                            resolvedUserId = snapshot.docs[0].id;
                        }
                    } catch (dbErr) {
                        console.error("Firebase read error during mock login:", dbErr);
                    }
                }

                // If not found in database or database is missing, fallback to mock user ID
                if (!resolvedUserId) {
                    resolvedUserId = `mock_uid_${resolvedCrmId}`;
                    // In mock environment, if database is running, let's create a placeholder user in Firestore
                    if (!isMockFirebase) {
                        try {
                            const db = admin.firestore();
                            await db.collection('users').doc(resolvedUserId).set({
                                crmId: resolvedCrmId,
                                role: 'user',
                                team: 'Mock-Team',
                                dep: 'CC',
                                permissions: { manageCategories: false, manageRecordings: false, manageUsers: false, manageDashboard: false, manageTasks: false }
                            }, { merge: true });
                        } catch (createErr) {
                            console.error("Failed to create mock user doc in Firestore:", createErr);
                        }
                    }
                }
            } else {
                // Real OAuth login via DingTalk OpenAPI
                if (isMockDingTalk) {
                    return {
                        statusCode: 400,
                        body: JSON.stringify({ error: 'DingTalk AppKey/Secret are not configured. Cannot perform real SSO. Please use account and password, or click the mock test button.' })
                    };
                }

                try {
                    // 1. Get access token
                    const tokenRes = await fetch(`https://oapi.dingtalk.com/gettoken?appkey=${appKey.trim()}&appsecret=${appSecret.trim()}`);
                    const tokenData = await tokenRes.json();
                    if (tokenData.errcode !== 0) {
                        return { statusCode: 500, body: JSON.stringify({ error: `DingTalk auth token exchange failed: ${tokenData.errmsg}` }) };
                    }
                    const token = tokenData.access_token;

                    // 2. Exchange authorization code for DingTalk userid
                    const userInfoRes = await fetch(`https://oapi.dingtalk.com/topapi/v2/user/getuserinfo?access_token=${token}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code: code })
                    });
                    const userInfoData = await userInfoRes.json();

                    if (userInfoData.errcode !== 0 || !userInfoData.result || !userInfoData.result.userid) {
                        return { statusCode: 400, body: JSON.stringify({ error: `DingTalk SSO authentication failed: ${userInfoData.errmsg}` }) };
                    }
                    const ddUserId = userInfoData.result.userid;

                    // 3. Find matched user in Firestore
                    if (isMockFirebase) {
                        return {
                            statusCode: 500,
                            body: JSON.stringify({ error: 'Database service account is not configured. Real SSO cannot match accounts. Please contact admin.' })
                        };
                    }

                    const db = admin.firestore();
                    const snapshot = await db.collection('users').where('dingtalkUserId', '==', ddUserId).limit(1).get();
                    if (snapshot.empty) {
                        return {
                            statusCode: 400,
                            body: JSON.stringify({ error: '您当前的钉钉账号未与云学堂绑定，请联系管理员或使用账号密码登录！' })
                        };
                    }

                    resolvedUserId = snapshot.docs[0].id;
                    resolvedCrmId = snapshot.docs[0].data().crmId;
                } catch (oauthErr) {
                    console.error("SSO Login Error:", oauthErr);
                    return { statusCode: 500, body: JSON.stringify({ error: `SSO login connection error: ${oauthErr.message}` }) };
                }
            }

            // 4. Create Firebase custom token for auto-login
            if (isMockFirebase) {
                // If running local test without Firebase service account, return success with a mockup session token
                console.log(`[Mock Firebase Admin] Simulating Firebase Auth Token generation for user: ${resolvedUserId}`);
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        success: true,
                        customToken: `mock_firebase_token_for_${resolvedUserId}`,
                        username: resolvedCrmId
                    })
                };
            }

            try {
                const customToken = await admin.auth().createCustomToken(resolvedUserId);
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        success: true,
                        customToken: customToken,
                        username: resolvedCrmId
                    })
                };
            } catch (tokenErr) {
                console.error("Auth Token generation error:", tokenErr);
                return { statusCode: 500, body: JSON.stringify({ error: `Failed to create secure auth session: ${tokenErr.message}` }) };
            }
        }

        // ==========================================
        // ACTION: NOTIFY TASK (Phase 2 Task Pushes)
        // ==========================================
        if (action === 'notifyTask') {
            const { title, assignerName, assigneeIds, deadline } = body;
            if (!assigneeIds || !Array.isArray(assigneeIds)) {
                return { statusCode: 400, body: JSON.stringify({ error: 'Missing assigneeIds' }) };
            }

            const recipients = [];
            // Fetch users to retrieve their dingtalkUserIds
            if (!isMockFirebase) {
                try {
                    const db = admin.firestore();
                    for (const uid of assigneeIds) {
                        const doc = await db.collection('users').doc(uid).get();
                        if (doc.exists && doc.data().dingtalkUserId) {
                            recipients.push(doc.data().dingtalkUserId);
                        }
                    }
                } catch (err) {
                    console.error("Failed to query assignees dingtalkUserIds:", err);
                }
            } else {
                // Mock Recipients
                assigneeIds.forEach(id => {
                    recipients.push(`dd_mock_id_${id}`);
                });
            }

            const messageMarkdown = `### 📚 **收到新的云学堂学习任务** \n\n **任务名称**：${title} \n **截止日期**：${deadline || '-'} \n **指派导师**：${assignerName} \n\n 优秀的销售录音复盘，能助推专业成长，请及时在截止日期前听完相关录音并提交心得感悟。 \n\n [👉 点击立即开始学习](dingtalk://dingtalkclient/page/link?url=https%3A%2F%2Fme-elearning.netlify.app%2Fhub)`;

            let sentSuccess = false;
            let mockPayload = null;

            if (!isMockDingTalk && recipients.length > 0 && agentId) {
                try {
                    // Get Token
                    const tokenRes = await fetch(`https://oapi.dingtalk.com/gettoken?appkey=${appKey.trim()}&appsecret=${appSecret.trim()}`);
                    const tokenData = await tokenRes.json();
                    if (tokenData.errcode === 0) {
                        const token = tokenData.access_token;
                        // POST async work notification
                        const notifyUrl = `https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2?access_token=${token}`;
                        const notifyRes = await fetch(notifyUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                agent_id: parseInt(agentId),
                                userid_list: recipients.join(','),
                                msg: {
                                    msgtype: "markdown",
                                    markdown: {
                                        title: "📚 新学习任务指派",
                                        text: messageMarkdown
                                    }
                                }
                            })
                        });
                        const notifyData = await notifyRes.json();
                        sentSuccess = notifyData.errcode === 0;
                        if (!sentSuccess) {
                            console.error("DingTalk Notification API failed:", notifyData);
                        }
                    }
                } catch (notifyErr) {
                    console.error("DingTalk Notification connection error:", notifyErr);
                }
            } else {
                // Mock Mode: Print and return mock payload
                sentSuccess = true;
                mockPayload = {
                    recipientIds: recipients,
                    markdown: messageMarkdown,
                    note: "System is running in Mock Mode. Message simulated successfully."
                };
                console.log("[Mock Notification sent]", mockPayload);
            }

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: sentSuccess,
                    recipientsCount: recipients.length,
                    mockPayload: mockPayload
                })
            };
        }

        // ==========================================
        // ACTION: NOTIFY MATERIAL (Phase 2 Material Updates)
        // ==========================================
        if (action === 'notifyMaterial') {
            const { recordingId, title, displayId, lecturerName, categoryName, description } = body;
            if (!recordingId || !title) {
                return { statusCode: 400, body: JSON.stringify({ error: 'Missing material recordingId or title' }) };
            }

            const markdownText = `![cover](https://me-elearning.netlify.app/images/share-preview.png) \n\n ### **🔥 ME云学堂新增精品录音素材** \n\n **素材编号**：[${displayId || recordingId}] \n **录音标题**：${title} \n **主讲人**：${lecturerName || '系统导师'} \n **分类线**：${categoryName || '精品推荐'} \n\n **课程介绍**：${description || '导师倾情推荐！欢迎大家点击链接立即收听实战复盘。'} \n\n 欢迎收听！`;

            let sentSuccess = false;
            let pushType = 'none';
            let mockPayload = null;

            if (webhookUrl && !webhookUrl.includes('your_')) {
                // Group Webhook push (Plan C custom bot)
                try {
                    pushType = 'webhook';
                    const webhookRes = await fetch(webhookUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            msgtype: "actionCard",
                            actionCard: {
                                title: "🔥 ME云学堂精品录音发布",
                                text: markdownText,
                                btnOrientation: "0",
                                btns: [
                                    {
                                        title: "🎧 立即在线收听",
                                        actionURL: `dingtalk://dingtalkclient/page/link?url=https%3A%2F%2Fme-elearning.netlify.app%2Fhub%3FrecordingId%3D${recordingId}`
                                    }
                                ]
                            }
                        })
                    });
                    const resText = await webhookRes.text();
                    sentSuccess = resText.includes('"errcode":0') || webhookRes.ok;
                } catch (webErr) {
                    console.error("DingTalk Webhook Push Error:", webErr);
                }
            } else {
                // Broadcast to all linked sales users via Work Notification
                pushType = 'broadcast';
                const recipients = [];

                if (!isMockFirebase) {
                    try {
                        const db = admin.firestore();
                        const snapshot = await db.collection('users').where('role', '!=', 'super_admin').get();
                        snapshot.forEach(doc => {
                            if (doc.data().dingtalkUserId) {
                                recipients.push(doc.data().dingtalkUserId);
                            }
                        });
                    } catch (err) {
                        console.error("Failed to query linked user ids:", err);
                    }
                } else {
                    recipients.push('dd_mock_sales1', 'dd_mock_sales2');
                }

                if (!isMockDingTalk && recipients.length > 0 && agentId) {
                    try {
                        const tokenRes = await fetch(`https://oapi.dingtalk.com/gettoken?appkey=${appKey.trim()}&appsecret=${appSecret.trim()}`);
                        const tokenData = await tokenRes.json();
                        if (tokenData.errcode === 0) {
                            const token = tokenData.access_token;
                            const notifyRes = await fetch(`https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2?access_token=${token}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    agent_id: parseInt(agentId),
                                    userid_list: recipients.join(','),
                                    msg: {
                                        msgtype: "actionCard",
                                        actionCard: {
                                            title: "🔥 精品录音发布",
                                            text: markdownText,
                                            btnOrientation: "0",
                                            btns: [
                                                {
                                                    title: "🎧 立即在线收听",
                                                    actionURL: `dingtalk://dingtalkclient/page/link?url=https%3A%2F%2Fme-elearning.netlify.app%2Fhub%3FrecordingId%3D${recordingId}`
                                                }
                                            ]
                                        }
                                    }
                                })
                            });
                            const notifyData = await notifyRes.json();
                            sentSuccess = notifyData.errcode === 0;
                        }
                    } catch (broadcastErr) {
                        console.error("DingTalk broadcast error:", broadcastErr);
                    }
                } else {
                    sentSuccess = true;
                    mockPayload = {
                        recipientIds: recipients,
                        pushType: webhookUrl ? 'webhook' : 'broadcast_simulated',
                        markdown: markdownText,
                        actionUrl: `dingtalk://dingtalkclient/page/link?url=https%3A%2F%2Fme-elearning.netlify.app%2Fhub%3FrecordingId%3D${recordingId}`
                    };
                    console.log("[Mock Material Push sent]", mockPayload);
                }
            }

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: sentSuccess,
                    pushType: pushType,
                    mockPayload: mockPayload
                })
            };
        }

        return { statusCode: 400, body: JSON.stringify({ error: 'Unsupported action' }) };

    } catch (error) {
        console.error('DingTalk Handler Error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};

// Helper mock users list for testing in pure-mock environments
function getMockUserRecords() {
    return [
        { id: "mock_id_1", crmId: "wuchuan", role: "user", team: "SS-Team1", dep: "SS" },
        { id: "mock_id_2", crmId: "bader", role: "user", team: "CC-Team2", dep: "CC" },
        { id: "mock_id_3", crmId: "ahmed", role: "user", team: "CC-Team1", dep: "CC" },
        { id: "mock_id_4", crmId: "lecturer", role: "sd", team: "Management", dep: "functional" },
        { id: "mock_id_5", crmId: "Serdah", role: "user", team: "SS-Team2", dep: "SS" }
    ];
}
