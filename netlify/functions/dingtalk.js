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

let dbInstance = null;

function getFirestoreDb() {
    if (dbInstance) return dbInstance;
    
    if (!admin.apps.length) {
        throw new Error("Firebase Admin not initialized. Check FIREBASE_SERVICE_ACCOUNT env var.");
    }
    
    try {
        const { getFirestore } = require('firebase-admin/firestore');
        dbInstance = getFirestore(admin.apps[0], 'default');
        console.log("Firestore initialized successfully using getFirestore(app, 'default').");
    } catch (e) {
        console.warn("Failed to load getFirestore from firebase-admin/firestore, falling back to legacy settings():", e);
        const db = admin.firestore();
        try {
            db.settings({ databaseId: 'default' });
        } catch (settingsErr) {
            console.log("Database settings already applied or failed to apply:", settingsErr.message);
        }
        dbInstance = db;
    }
    
    return dbInstance;
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

function isUserChineseSpeaker(userData) {
    if (!userData) return false;
    const role = String(userData.role || '').trim().toLowerCase();
    const crmId = String(userData.crmId || '').trim().toLowerCase();
    
    // "SD职级以上全部中文" (SD rank and above all in Chinese)
    // SD levels and above include 'sd', 'admin', 'super_admin'
    const isSdOrAbove = role === 'sd' || role === 'admin' || role === 'super_admin';
    
    // Also crmId === 'wuchuan' who is a Chinese tester/manager
    const isWuchuan = crmId === 'wuchuan';
    
    return isSdOrAbove || isWuchuan;
}

async function searchDingTalkUser(accessToken, queryWord, logs) {
    try {
        const res = await fetch(`https://api.dingtalk.com/v1.0/contact/users/search`, {
            method: 'POST',
            headers: {
                'x-acs-dingtalk-access-token': accessToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                queryWord: queryWord,
                offset: 0,
                size: 20
            })
        });
        const data = await res.json();
        if (data && data.code) {
            logs.push({ msg: `⚠️ [检索接口异常] 搜索词 [${queryWord}] 接口返回错误: [${data.code}] ${data.message}。请前往钉钉开发者后台->权限管理->通讯录管理中，申请并开通【搜索企业通讯录的权限】！`, type: 'error' });
            return [];
        }
        if (data && Array.isArray(data.list)) {
            return data.list;
        }
        return [];
    } catch (err) {
        console.error(`Search failed for query "${queryWord}":`, err);
        logs.push({ msg: `⚠️ [检索网络异常] 搜索词 [${queryWord}] 接口请求失败: ${err.message}`, type: 'error' });
        return [];
    }
}

async function getDingTalkUserDetails(accessToken, userId) {
    try {
        const res = await fetch(`https://oapi.dingtalk.com/topapi/v2/user/get?access_token=${accessToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userid: userId })
        });
        const data = await res.json();
        if (data.errcode === 0 && data.result) {
            return data.result;
        }
        return null;
    } catch (err) {
        console.error(`Failed to get details for userid "${userId}":`, err);
        return null;
    }
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

            const userIdsToSync = body.userIds;
            let users = [];
            if (!isMockFirebase) {
                try {
                    const db = getFirestoreDb();
                    if (userIdsToSync && Array.isArray(userIdsToSync) && userIdsToSync.length > 0) {
                        for (const uid of userIdsToSync) {
                            const doc = await db.collection('users').doc(uid).get();
                            if (doc.exists) {
                                users.push({ id: doc.id, ...doc.data() });
                            }
                        }
                        logs.push({ msg: `📂 [数据库连接成功] 已定位批次内 ${users.length} 个账号档案。`, type: 'success' });
                    } else {
                        const snapshot = await db.collection('users').get();
                        snapshot.forEach(doc => {
                            users.push({ id: doc.id, ...doc.data() });
                        });
                        logs.push({ msg: `📂 [数据库连接成功] 自 Firestore 读取到共 ${users.length} 个系统账户。`, type: 'success' });
                    }
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
                        logs.push({ msg: "🔓 [鉴权成功] 钉钉 Access Token 获取成功，已建立安全信道并开启【精确定向查询通道】。", type: 'success' });
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
                const email = (user.email || getDingTalkEmail(crmId)).trim().toLowerCase();
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
                        const emailPrefix = email.split('@')[0];
                        const nameSegment = crmId.split('-').pop();
                        
                        // Generate specific search terms to avoid short generic prefixes matching massive lists
                        const searchTerms = Array.from(new Set([
                            crmId,
                            emailPrefix,
                            nameSegment,
                            emailPrefix.length >= 5 ? emailPrefix.substring(0, 5) : null,
                            nameSegment.length >= 5 ? nameSegment.substring(0, 5) : null,
                            emailPrefix.toLowerCase().startsWith('moh') ? 'mohammad' : null,
                            emailPrefix.toLowerCase().startsWith('moh') ? 'mohammed' : null
                        ])).filter(Boolean);
                        
                        logs.push({ msg: `🔍 [精准匹配] 正在针对销售 [${crmId}] (${email}) 的个人特征，启动多重通讯录定向检索...`, type: 'success' });
                        
                        let matched = false;
                        for (const term of searchTerms) {
                            if (matched) break;
                            
                            const foundUserIds = await searchDingTalkUser(accessToken, term, logs);
                            if (foundUserIds && foundUserIds.length > 0) {
                                // Query all candidate details in parallel to completely eliminate N+1 latency spikes!
                                const detailsList = await Promise.all(
                                    foundUserIds.map(uid => getDingTalkUserDetails(accessToken, uid))
                                );
                                
                                for (const details of detailsList) {
                                    if (details) {
                                        const ddEmail = (details.email || '').trim().toLowerCase();
                                        const ddOrgEmail = (details.org_email || '').trim().toLowerCase();
                                        const ddName = (details.name || '').trim().toLowerCase();
                                        const ddUserid = (details.userid || '').trim().toLowerCase();
                                        
                                        // Match by email or org_email or name / userid
                                        if (ddEmail === email || ddOrgEmail === email || ddName === crmId.toLowerCase() || ddUserid === emailPrefix) {
                                            ddUserId = details.userid;
                                            matched = true;
                                            logs.push({ msg: `✅ [匹配成功] 成功在通讯录中精准识别到销售 [${crmId}] 关联的钉钉用户 [${details.name}]，匹配工号: ${ddUserId}`, type: 'success' });
                                            break;
                                        } else {
                                            logs.push({ msg: `ℹ️ [特征比对] 找到同名/工号匹配候选人 [${details.name}] (工号: ${details.userid})，但其钉钉绑定邮箱为 [主: ${details.email || '未公开/未配置'}] / [企业: ${details.org_email || '未公开/未配置'}]，与目标 [${email}] 不一致，匹配失败。`, type: 'error' });
                                        }
                                    }
                                }
                            }
                        }
                        
                        if (!matched) {
                            logs.push({ msg: `ℹ️ [未匹配] 销售 [${crmId}] (${email}) 在您的企业钉钉通讯录中未找到（请确保该成员已加入企业且邮箱一致）。`, type: 'error' });
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
                            const db = getFirestoreDb();
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
                        const db = getFirestoreDb();
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
                            const db = getFirestoreDb();
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

                    const db = getFirestoreDb();
                    const snapshot = await db.collection('users').where('dingtalkUserId', '==', ddUserId).limit(1).get();
                    if (snapshot.empty) {
                        return {
                            statusCode: 400,
                            body: JSON.stringify({ error: '您当前的钉钉账号未与 ME 云学堂绑定，请联系管理员或使用账号密码登录！ / Your DingTalk account is not bound to ME Cloud Academy. Please contact administrator or login with account & password.' })
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

            const recipientsZh = [];
            const recipientsEn = [];
            let dbError = null;
            const queryLogs = [];

            // Fetch users to retrieve their dingtalkUserIds
            if (!isMockFirebase) {
                try {
                    const db = getFirestoreDb();
                    for (const uid of assigneeIds) {
                        const doc = await db.collection('users').doc(uid).get();
                        if (doc.exists) {
                            const data = doc.data();
                            if (data.dingtalkUserId) {
                                const isEnglishSpeaker = !isUserChineseSpeaker(data);
                                if (isEnglishSpeaker) {
                                    recipientsEn.push(data.dingtalkUserId);
                                } else {
                                    recipientsZh.push(data.dingtalkUserId);
                                }
                                queryLogs.push({ uid, found: true, dingtalkUserId: data.dingtalkUserId, crmId: data.crmId, lang: isEnglishSpeaker ? 'en' : 'zh' });
                            } else {
                                queryLogs.push({ uid, found: true, dingtalkUserId: null, crmId: data.crmId, msg: "dingtalkUserId is missing in database profile" });
                            }
                        } else {
                            queryLogs.push({ uid, found: false, msg: "User document not found in Firestore users collection" });
                        }
                    }
                } catch (err) {
                    console.error("Failed to query assignees dingtalkUserIds:", err);
                    dbError = err.message;
                }
            } else {
                // Mock Recipients: wuchuan receives Chinese, others English
                assigneeIds.forEach(id => {
                    const mockId = `dd_mock_id_${id}`;
                    if (id.toLowerCase().includes('wuchuan')) {
                        recipientsZh.push(mockId);
                    } else {
                        recipientsEn.push(mockId);
                    }
                    queryLogs.push({ uid: id, found: true, dingtalkUserId: mockId, msg: "mocked" });
                });
            }

            const getMsgMarkdown = (lang) => {
                if (lang === 'en') {
                    return `### 📚 **ME Cloud Academy - New Learning Task Assigned** \n\n **Task Name**: ${title} \n **Deadline**: ${deadline || '-'} \n **Assigner**: ${assignerName} \n\n Reviewing sales recordings is vital for professional growth. Please listen to the assigned recordings and submit your reflections before the deadline. \n\n [👉 Click Here to Start Learning](dingtalk://dingtalkclient/page/link?url=https%3A%2F%2Fme-elearning.netlify.app%2Fteam-tasks)`;
                }
                return `### 📚 **收到新的 ME 云学堂学习任务** \n\n **任务名称**：${title} \n **截止日期**：${deadline || '-'} \n **指派导师**：${assignerName} \n\n 优秀的销售录音复盘，能助推专业成长，请及时在截止日期前听完相关录音并提交心得感悟。 \n\n [👉 点击立即开始学习](dingtalk://dingtalkclient/page/link?url=https%3A%2F%2Fme-elearning.netlify.app%2Fteam-tasks)`;
            };

            const getMsgTitle = (lang) => {
                return lang === 'en' ? "📚 ME Cloud Academy - New Task" : "📚 ME 云学堂 - 新学习任务指派";
            };

            let sentSuccess = false;
            let mockPayload = null;
            let dingtalkApiResponse = [];
            let errorMessage = null;

            if (!isMockDingTalk && agentId && (recipientsZh.length > 0 || recipientsEn.length > 0)) {
                try {
                    // Get Token
                    const tokenRes = await fetch(`https://oapi.dingtalk.com/gettoken?appkey=${appKey.trim()}&appsecret=${appSecret.trim()}`);
                    const tokenData = await tokenRes.json();
                    if (tokenData.errcode === 0) {
                        const token = tokenData.access_token;
                        
                        const sendNotification = async (recipientsList, lang) => {
                            if (recipientsList.length === 0) return { success: true };
                            
                            const notifyUrl = `https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2?access_token=${token}`;
                            const notifyRes = await fetch(notifyUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    agent_id: parseInt(agentId),
                                    userid_list: recipientsList.join(','),
                                    msg: {
                                        msgtype: "markdown",
                                        markdown: {
                                            title: getMsgTitle(lang),
                                            text: getMsgMarkdown(lang)
                                        }
                                    }
                                })
                            });
                            const notifyData = await notifyRes.json();
                            dingtalkApiResponse.push({ lang, data: notifyData });
                            
                            if (notifyData.errcode === 0) {
                                return { success: true };
                            } else {
                                return { success: false, error: `DingTalk API returned errcode ${notifyData.errcode}: ${notifyData.errmsg}` };
                            }
                        };

                        const enResult = await sendNotification(recipientsEn, 'en');
                        const zhResult = await sendNotification(recipientsZh, 'zh');
                        
                        sentSuccess = enResult.success && zhResult.success;
                        if (!sentSuccess) {
                            errorMessage = [
                                !enResult.success ? `English Push: ${enResult.error}` : null,
                                !zhResult.success ? `Chinese Push: ${zhResult.error}` : null
                            ].filter(Boolean).join(" | ");
                        }
                    } else {
                        errorMessage = `DingTalk Token exchange failed: [${tokenData.errcode}] ${tokenData.errmsg}`;
                        dingtalkApiResponse.push({ error: "Token fail", detail: tokenData });
                    }
                } catch (notifyErr) {
                    console.error("DingTalk Notification connection error:", notifyErr);
                    errorMessage = `Connection to DingTalk failed: ${notifyErr.message}`;
                    dingtalkApiResponse.push({ error: notifyErr.message });
                }
            } else {
                if (isMockDingTalk) {
                    sentSuccess = true;
                    mockPayload = {
                        recipientsZh,
                        recipientsEn,
                        markdownZh: getMsgMarkdown('zh'),
                        markdownEn: getMsgMarkdown('en'),
                        note: "System is running in Mock Mode. Message simulated successfully.",
                        isMockDingTalk,
                        hasAgentId: !!agentId
                    };
                    console.log("[Mock Notification sent]", mockPayload);
                } else if (!agentId) {
                    errorMessage = "DingTalk Agent ID (DINGTALK_AGENT_ID) is not configured in Netlify environment variables.";
                } else if (recipientsZh.length === 0 && recipientsEn.length === 0) {
                    errorMessage = "未找到任何匹配且关联了钉钉账号的指派学员。请确保目标学员在用户管理中已同步钉钉，或管理员已手动绑定其工号。 / No matched assignees with bound DingTalk accounts found. Please ensure target users have synced their DingTalk profiles or their UserID is manually bound.";
                }
            }

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: sentSuccess,
                    error: errorMessage,
                    recipientsZhCount: recipientsZh.length,
                    recipientsEnCount: recipientsEn.length,
                    mockPayload: mockPayload,
                    dbError: dbError,
                    queryLogs: queryLogs,
                    isMockFirebase: isMockFirebase,
                    isMockDingTalk: isMockDingTalk,
                    dingtalkApiResponse: dingtalkApiResponse
                })
            };
        }

        // ==========================================
        // ACTION: NOTIFY MATERIAL (Phase 2 Material Updates)
        // ==========================================
        if (action === 'notifyMaterial') {
            const { recordingId, title, displayId, lecturerName, categoryName, description, targetType, selectedSds } = body;
            if (!recordingId || !title) {
                return { statusCode: 400, body: JSON.stringify({ error: 'Missing material recordingId or title' }) };
            }

            const markdownBilingual = `![cover](https://me-elearning.netlify.app/images/share-preview.png) \n\n ### **🔥 ME 云学堂新增精品录音素材 / ME Cloud Academy - New Premium Recording Released** \n\n **素材编号 / ID**：[${displayId || recordingId}] \n **录音标题 / Title**：${title} \n **主讲人 / Lecturer**：${lecturerName || '系统导师 / Mentor'} \n **分类线 / Category**：${categoryName || '精品推荐 / Featured'} \n\n **课程介绍 / Introduction**：\n ${description || '导师倾情推荐！欢迎大家点击链接立即收听实战复盘。 / Highly recommended! Click the link below to listen.'} \n\n 欢迎收听！ / Happy listening!`;

            const getMsgMarkdown = (lang) => {
                if (lang === 'en') {
                    return `![cover](https://me-elearning.netlify.app/images/share-preview.png) \n\n ### **🔥 ME Cloud Academy - New Premium Recording Released** \n\n **ID**: [${displayId || recordingId}] \n **Title**: ${title} \n **Lecturer**: ${lecturerName || 'Mentor'} \n **Category**: ${categoryName || 'Featured'} \n\n **Introduction**: \n ${description || 'Highly recommended! Click the link below to listen to the recording.'} \n\n Happy listening!`;
                }
                return `![cover](https://me-elearning.netlify.app/images/share-preview.png) \n\n ### **🔥 ME 云学堂新增精品录音素材** \n\n **素材编号**：[${displayId || recordingId}] \n **录音标题**：${title} \n **主讲人**：${lecturerName || '系统导师'} \n **分类线**：${categoryName || '精品推荐'} \n\n **课程介绍**：\n ${description || '导师倾情推荐！欢迎大家点击链接立即收听实战复盘。'} \n\n 欢迎收听！`;
            };

            const getMsgBtnText = (lang) => {
                return lang === 'en' ? "🎧 Listen Online Now" : "🎧 立即在线收听";
            };

            const getMsgTitle = (lang) => {
                return lang === 'en' ? "🔥 ME Cloud Academy - New Material" : "🔥 ME 云学堂精品录音发布";
            };

            let sentSuccess = false;
            let pushType = 'none';
            let mockPayload = null;
            let errorMessage = null;

            const isPushToGroup = !targetType || targetType === 'group';

            if (isPushToGroup) {
                // Group Webhook push (Plan C custom bot)
                if (webhookUrl && !webhookUrl.includes('your_')) {
                    try {
                        pushType = 'webhook';
                        const webhookRes = await fetch(webhookUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                msgtype: "actionCard",
                                actionCard: {
                                    title: "🔥 ME 云学堂精品录音发布 / ME Cloud Academy - New Premium Recording Released",
                                    text: markdownBilingual,
                                    btnOrientation: "0",
                                    btns: [
                                        {
                                            title: "🎧 立即收听 / Listen Now",
                                            actionURL: `dingtalk://dingtalkclient/page/link?url=https%3A%2F%2Fme-elearning.netlify.app%2Fhub%3FrecordingId%3D${recordingId}`
                                        }
                                    ]
                                }
                            })
                        });
                        const resText = await webhookRes.text();
                        let parsed;
                        try {
                            parsed = JSON.parse(resText);
                        } catch (pe) {
                            parsed = { errcode: webhookRes.ok ? 0 : -1, errmsg: resText };
                        }
                        if (parsed.errcode === 0) {
                            sentSuccess = true;
                        } else {
                            errorMessage = `DingTalk Webhook Bot returned errcode ${parsed.errcode}: ${parsed.errmsg || resText}`;
                        }
                    } catch (webErr) {
                        console.error("DingTalk Webhook Push Error:", webErr);
                        errorMessage = `Webhook connection error: ${webErr.message}`;
                    }
                } else {
                    errorMessage = "DingTalk Group Webhook URL (DINGTALK_WEBHOOK_URL) is not configured in Netlify environment variables.";
                }
            } else {
                // Broadcast/Targeted Push via Work Notification partitioned by language
                pushType = targetType === 'individuals' ? 'targeted_broadcast' : 'broadcast';
                const recipientsZh = [];
                const recipientsEn = [];
                const queryLogs = [];

                if (!isMockFirebase) {
                    try {
                        const db = getFirestoreDb();
                        const snapshot = await db.collection('users').where('role', '!=', 'super_admin').get();
                        snapshot.forEach(doc => {
                            const data = doc.data();
                            if (data.dingtalkUserId) {
                                const isEnglishSpeaker = !isUserChineseSpeaker(data);
                                
                                if (targetType === 'individuals' && Array.isArray(selectedSds)) {
                                    // Segmented push strictly by selected SDs (case insensitive comparison)
                                    const userSd = String(data.sd || '').trim().toLowerCase();
                                    const userCrmId = String(data.crmId || '').trim().toLowerCase();
                                    const sdMatched = selectedSds.some(sd => {
                                        const sdLower = String(sd).trim().toLowerCase();
                                        return sdLower === userSd || (data.role === 'sd' && sdLower === userCrmId);
                                    });
                                    if (sdMatched) {
                                        if (isEnglishSpeaker) {
                                            recipientsEn.push(data.dingtalkUserId);
                                        } else {
                                            recipientsZh.push(data.dingtalkUserId);
                                        }
                                        queryLogs.push({ uid: doc.id, crmId: data.crmId, sd: data.sd, matched: true, lang: isEnglishSpeaker ? 'en' : 'zh' });
                                    } else {
                                        queryLogs.push({ uid: doc.id, crmId: data.crmId, sd: data.sd, matched: false });
                                    }
                                } else {
                                    // Broadcast to all linked non-admin users
                                    if (isEnglishSpeaker) {
                                        recipientsEn.push(data.dingtalkUserId);
                                    } else {
                                        recipientsZh.push(data.dingtalkUserId);
                                    }
                                    queryLogs.push({ uid: doc.id, crmId: data.crmId, sd: data.sd, matched: true, lang: isEnglishSpeaker ? 'en' : 'zh' });
                                }
                            }
                        });
                        console.log(`[Material Push] Recipients: ZH=${recipientsZh.length}, EN=${recipientsEn.length}. TargetType: ${targetType}. SD filters: ${JSON.stringify(selectedSds)}`);
                    } catch (err) {
                        console.error("Failed to query linked user ids:", err);
                    }
                } else {
                    recipientsEn.push('dd_mock_sales1');
                    recipientsZh.push('dd_mock_sales2');
                }

                // Deduplicate lists to prevent duplicate messages when a user occupies multiple roles (e.g. Iris as SM and IRIS as SD sharing same DingTalk account)
                const uniqueRecipientsZh = Array.from(new Set(recipientsZh));
                // If a user qualifies for Chinese (SD/Admin level), exclude them from English to avoid duplicate push notifications in different languages
                const uniqueRecipientsEn = Array.from(new Set(recipientsEn)).filter(uid => !uniqueRecipientsZh.includes(uid));

                if (!isMockDingTalk && (uniqueRecipientsZh.length > 0 || uniqueRecipientsEn.length > 0) && agentId) {
                    try {
                        const tokenRes = await fetch(`https://oapi.dingtalk.com/gettoken?appkey=${appKey.trim()}&appsecret=${appSecret.trim()}`);
                        const tokenData = await tokenRes.json();
                        if (tokenData.errcode === 0) {
                            const token = tokenData.access_token;
                            
                            const sendNotification = async (recipientsList, lang) => {
                                if (recipientsList.length === 0) return { success: true };
                                
                                const notifyRes = await fetch(`https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2?access_token=${token}`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        agent_id: parseInt(agentId),
                                        userid_list: recipientsList.join(','),
                                        msg: {
                                            msgtype: "action_card",
                                            action_card: {
                                                title: getMsgTitle(lang),
                                                markdown: getMsgMarkdown(lang),
                                                btn_orientation: "0",
                                                btn_json_list: [
                                                    {
                                                        title: getMsgBtnText(lang),
                                                        action_url: `dingtalk://dingtalkclient/page/link?url=https%3A%2F%2Fme-elearning.netlify.app%2Fhub%3FrecordingId%3D${recordingId}`
                                                    }
                                                ]
                                            }
                                        }
                                    })
                                });
                                const notifyData = await notifyRes.json();
                                if (notifyData.errcode === 0) {
                                    return { success: true };
                                } else {
                                    return { success: false, error: `DingTalk API returned errcode ${notifyData.errcode}: ${notifyData.errmsg}` };
                                }
                            };

                            const enResult = await sendNotification(uniqueRecipientsEn, 'en');
                            const zhResult = await sendNotification(uniqueRecipientsZh, 'zh');
                            
                            sentSuccess = enResult.success && zhResult.success;
                            if (!sentSuccess) {
                                errorMessage = [
                                    !enResult.success ? `English Push: ${enResult.error}` : null,
                                    !zhResult.success ? `Chinese Push: ${zhResult.error}` : null
                                ].filter(Boolean).join(" | ");
                            }
                        } else {
                            errorMessage = `DingTalk Token exchange failed: [${tokenData.errcode}] ${tokenData.errmsg}`;
                        }
                    } catch (broadcastErr) {
                        console.error("DingTalk broadcast error:", broadcastErr);
                        errorMessage = `DingTalk Broadcast connection failed: ${broadcastErr.message}`;
                    }
                } else {
                    if (isMockDingTalk) {
                        sentSuccess = true;
                        mockPayload = {
                            recipientsZh: uniqueRecipientsZh,
                            recipientsEn: uniqueRecipientsEn,
                            pushType: pushType,
                            markdownZh: getMsgMarkdown('zh'),
                            markdownEn: getMsgMarkdown('en'),
                            actionUrl: `dingtalk://dingtalkclient/page/link?url=https%3A%2F%2Fme-elearning.netlify.app%2Fhub%3FrecordingId%3D${recordingId}`,
                            queryLogs: queryLogs
                        };
                        console.log("[Mock Material Push sent]", mockPayload);
                    } else if (!agentId) {
                        errorMessage = "DingTalk Agent ID (DINGTALK_AGENT_ID) is not configured in Netlify environment variables.";
                    } else if (recipientsZh.length === 0 && recipientsEn.length === 0) {
                        errorMessage = "您选择的接收部门（按 SD 维度）中，没有任何成员关联了钉钉账号。请确保团队成员已完成账号同步，或管理员已手动绑定其工号。 / No team members in the selected teams have bound their DingTalk accounts. Please ensure members have synced their profiles or their UserID is manually bound.";
                    }
                }
            }

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: sentSuccess,
                    error: errorMessage,
                    pushType: pushType,
                    mockPayload: mockPayload
                })
            };
        }

        // ==========================================
        // ACTION: CHECK PROGRESS (Diagnostic Action)
        // ==========================================
        if (action === 'checkProgress') {
            const { taskId } = body;
            if (!taskId) {
                return { statusCode: 400, body: JSON.stringify({ error: 'Missing taskId' }) };
            }

            if (isMockDingTalk) {
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        success: true,
                        note: "Running in mock mode. Simulated progress: 100%."
                    })
                };
            }

            try {
                // Get Token
                const tokenRes = await fetch(`https://oapi.dingtalk.com/gettoken?appkey=${appKey.trim()}&appsecret=${appSecret.trim()}`);
                const tokenData = await tokenRes.json();
                if (tokenData.errcode !== 0) {
                    return { statusCode: 500, body: JSON.stringify({ error: `Token exchange failed: ${tokenData.errmsg}` }) };
                }
                const token = tokenData.access_token;

                const parsedAgentId = agentId ? parseInt(agentId.trim()) : null;
                const parsedTaskId = typeof taskId === 'number' ? taskId : parseInt(String(taskId).trim());

                // 1. Get Progress
                const progressRes = await fetch(`https://oapi.dingtalk.com/topapi/message/corpconversation/getsendprogress?access_token=${token}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        agent_id: parsedAgentId,
                        task_id: parsedTaskId
                    })
                });
                const progressData = await progressRes.json();

                // 2. Get Result
                const resultRes = await fetch(`https://oapi.dingtalk.com/topapi/message/corpconversation/getsendresult?access_token=${token}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        agent_id: parsedAgentId,
                        task_id: parsedTaskId
                    })
                });
                const resultData = await resultRes.json();

                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        success: true,
                        debug: {
                            agentIdRaw: agentId,
                            agentIdParsed: parsedAgentId,
                            taskIdRaw: taskId,
                            taskIdParsed: parsedTaskId,
                            isMockDingTalk: isMockDingTalk,
                            isMockFirebase: isMockFirebase
                        },
                        progress: progressData,
                        result: resultData
                    })
                };
            } catch (err) {
                return {
                    statusCode: 500,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        success: false,
                        error: err.message
                    })
                };
            }
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
