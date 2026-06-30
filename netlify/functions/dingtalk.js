import admin from 'firebase-admin';

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
    
    dbInstance = admin.firestore();
    try {
        dbInstance.settings({ databaseId: 'default' });
    } catch (settingsErr) {
        console.log("Database settings already applied or failed to apply:", settingsErr.message);
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

export const handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { action } = body;

        // Custom action to bootstrap super admin users in Firebase Auth & Firestore
        if (action === 'bootstrapSuperAdmin') {
            const logs = [];
            if (!admin.apps.length) {
                return {
                    statusCode: 500,
                    body: JSON.stringify({ error: "Firebase Admin not initialized." })
                };
            }
            const db = getFirestoreDb();
            
            // 1. Bootstrap wuchuan@51talk.com
            let wuchuanUid = '';
            try {
                const userRec = await admin.auth().getUserByEmail("wuchuan@51talk.com");
                wuchuanUid = userRec.uid;
                logs.push(`wuchuan@51talk.com exists in Auth, UID: ${wuchuanUid}`);
            } catch (authErr) {
                if (authErr.code === 'auth/user-not-found') {
                    const userRec = await admin.auth().createUser({
                        email: "wuchuan@51talk.com",
                        password: "123456"
                    });
                    wuchuanUid = userRec.uid;
                    logs.push(`wuchuan@51talk.com created in Auth, UID: ${wuchuanUid}`);
                } else {
                    throw authErr;
                }
            }
            
            await db.collection('users').doc(wuchuanUid).set({
                crmId: "wuchuan",
                email: "wuchuan@51talk.com",
                role: "super_admin",
                dep: "functional",
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            logs.push(`wuchuan Firestore doc updated.`);

            // 2. Bootstrap mohserdah@51talk.com
            let serdahUid = '';
            try {
                const userRec = await admin.auth().getUserByEmail("mohserdah@51talk.com");
                serdahUid = userRec.uid;
                logs.push(`mohserdah@51talk.com exists in Auth, UID: ${serdahUid}`);
            } catch (authErr) {
                if (authErr.code === 'auth/user-not-found') {
                    const userRec = await admin.auth().createUser({
                        email: "mohserdah@51talk.com",
                        password: "123456"
                    });
                    serdahUid = userRec.uid;
                    logs.push(`mohserdah@51talk.com created in Auth, UID: ${serdahUid}`);
                } else {
                    throw authErr;
                }
            }
            
            await db.collection('users').doc(serdahUid).set({
                crmId: "Serdah",
                email: "mohserdah@51talk.com",
                role: "super_admin",
                dep: "CC",
                sd: "JOHN",
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            logs.push(`Serdah Firestore doc updated.`);

            return {
                statusCode: 200,
                headers: { 
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ success: true, logs })
            };
        }

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
        // ACTION: NOTIFY LOGIN (Security Login Alerts)
        // ==========================================
        if (action === 'notifyLogin') {
            const { crmId, loginType } = body;
            if (!crmId) {
                return { statusCode: 400, body: JSON.stringify({ error: 'Missing crmId' }) };
            }

            let sentSuccess = false;
            let mockPayload = null;
            let errorMessage = null;
            let dingtalkApiResponse = null;

            let userData = null;
            if (!isMockFirebase) {
                try {
                    const db = getFirestoreDb();
                    const snapshot = await db.collection('users')
                        .where('crmId', '==', crmId)
                        .limit(1)
                        .get();
                    if (!snapshot.empty) {
                        userData = snapshot.docs[0].data();
                    } else {
                        errorMessage = `User profile not found in database for CRM ID: ${crmId}`;
                    }
                } catch (dbErr) {
                    console.error("Firestore user lookup error in notifyLogin:", dbErr);
                    errorMessage = `Firestore lookup error: ${dbErr.message}`;
                }
            } else {
                userData = {
                    crmId,
                    dingtalkUserId: 'mock_user_userid',
                    role: 'user'
                };
            }

            if (userData && userData.dingtalkUserId) {
                const targetUserId = userData.dingtalkUserId;
                const isChinese = isUserChineseSpeaker(userData);

                const getMsgTitle = () => {
                    return isChinese ? "🔒 安全登录提醒" : "🔒 Secure Login Alert";
                };

                const getMsgMarkdown = () => {
                    const timeStr = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
                    const methodStr = loginType === 'sso' ? (isChinese ? '钉钉免登' : 'DingTalk SSO') : (isChinese ? '账号密码' : 'Password');
                    if (isChinese) {
                        return `### 🔒 **安全登录提醒**\n\n---\n\n您的账号已成功登录 **ME 云学堂** APP。\n\n**📋 登录详情：**\n* 👤 **登录账号：** \`${crmId}\`\n* ⏰ **登录时间：** ${timeStr} (北京时间)\n* 🔑 **登录方式：** ${methodStr}\n\n---\n\n> 💡 *若此操作非您本人发起，请立即联系管理员并修改密码。*`;
                    }
                    return `### 🔒 **Secure Login Alert**\n\n---\n\nYour account has successfully logged into **ME Cloud Academy** APP.\n\n**📋 Login Details:**\n* 👤 **Account:** \`${crmId}\`\n* ⏰ **Time:** ${timeStr} (Beijing Time)\n* 🔑 **Method:** ${methodStr}\n\n---\n\n> 💡 *If this was not you, please contact the administrator and change your password immediately.*`;
                };

                if (!isMockDingTalk && !isMockFirebase) {
                    try {
                        const token = await getDingTalkToken();
                        const notifyUrl = `https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2?access_token=${token}`;
                        const notifyRes = await fetch(notifyUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                agent_id: parseInt(agentId),
                                userid_list: targetUserId,
                                msg: {
                                    msgtype: "markdown",
                                    markdown: {
                                        title: getMsgTitle(),
                                        text: getMsgMarkdown()
                                    }
                                }
                            })
                        });
                        const notifyData = await notifyRes.json();
                        dingtalkApiResponse = notifyData;
                        sentSuccess = (notifyData.errcode === 0);
                        if (!sentSuccess) {
                            errorMessage = `DingTalk API returned errcode ${notifyData.errcode}: ${notifyData.errmsg}`;
                        }
                    } catch (pushErr) {
                        console.error("DingTalk push error in notifyLogin:", pushErr);
                        errorMessage = pushErr.message;
                    }
                } else {
                    sentSuccess = true;
                    mockPayload = {
                        targetUserId,
                        title: getMsgTitle(),
                        markdown: getMsgMarkdown()
                    };
                    console.log("[Mock Login Notification sent]", mockPayload);
                }
            } else if (userData && !userData.dingtalkUserId) {
                errorMessage = `User profile exists, but dingtalkUserId is missing.`;
            }

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: sentSuccess,
                    error: errorMessage,
                    mockPayload,
                    dingtalkApiResponse
                })
            };
        }

        // ==========================================
        // ACTION: NOTIFY TASK (Phase 2 Task Pushes)
        // ==========================================
        if (action === 'notifyTask') {
            const { title, assignerName, assigneeIds, deadline, startTime, taskId } = body;
            if (!assigneeIds || !Array.isArray(assigneeIds)) {
                return { statusCode: 400, body: JSON.stringify({ error: 'Missing assigneeIds' }) };
            }

            const finalStartTime = startTime || new Date().toLocaleString();

            const recipientsZh = [];
            const recipientsEn = [];
            const fcmTokens = [];
            let dbError = null;
            const queryLogs = [];

            // Fetch users to retrieve their dingtalkUserIds and deviceTokens
            if (!isMockFirebase) {
                try {
                    const db = getFirestoreDb();
                    for (const uid of assigneeIds) {
                        const doc = await db.collection('users').doc(uid).get();
                        if (doc.exists) {
                            const data = doc.data();
                            
                            // Collect DingTalk User ID
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

                            // Collect device tokens for FCM push
                            if (Array.isArray(data.deviceTokens) && data.deviceTokens.length > 0) {
                                data.deviceTokens.forEach(t => {
                                    if (t && typeof t === 'string') {
                                        fcmTokens.push(t);
                                    }
                                });
                            }
                        } else {
                            queryLogs.push({ uid, found: false, msg: "User document not found in Firestore users collection" });
                        }
                    }
                } catch (err) {
                    console.error("Failed to query assignees dingtalkUserIds and tokens:", err);
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
                fcmTokens.push('mock_fcm_token_1', 'mock_fcm_token_2');
            }

            const getMsgMarkdown = (lang) => {
                const taskLearningUrl = taskId
                    ? `https://learning.mecloudhub.com/hub?taskId=${encodeURIComponent(taskId)}`
                    : 'https://learning.mecloudhub.com/hub';
                const dingTalkLearningLink = `dingtalk://dingtalkclient/page/link?url=${encodeURIComponent(taskLearningUrl)}`;
                if (lang === 'en') {
                    return `### 📚 **ME Cloud Academy**\n**New Learning Task Assigned**\n\n---\n\n**📋 Task Details:**\n* 🏷️ **Task Name:** ${title}\n* 📅 **Start Time:** ${finalStartTime}\n* ⏰ **Deadline:** ${deadline || '-'}\n* 👤 **Assigner:** ${assignerName}\n\n---\n\n> 💡 *Reviewing sales recordings is vital for professional growth. Please listen to the assigned recordings and submit your reflections before the deadline.*\n\n[👉 Click Here to Start Learning](${dingTalkLearningLink})`;
                }
                return `### 📚 **ME 云学堂**\n**收到新的学习任务**\n\n---\n\n**📋 任务详情：**\n* 🏷️ **任务名称**：${title}\n* 📅 **开始时间**：${finalStartTime}\n* ⏰ **截止时间**：${deadline || '-'}\n* 👤 **指派导师**：${assignerName}\n\n---\n\n> 💡 *优秀的销售录音复盘，能助推专业成长。请及时在截止日期前听完相关录音并提交心得感悟。*\n\n[👉 点击立即开始学习](${dingTalkLearningLink})`;
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

            // FCM App System Push
            let fcmSentSuccess = false;
            let fcmError = null;
            let fcmSuccessCount = 0;
            let fcmFailureCount = 0;
            const uniqueFcmTokens = Array.from(new Set(fcmTokens));

            if (uniqueFcmTokens.length > 0) {
                if (!isMockFirebase) {
                    try {
                        const fcmPayload = {
                            notification: {
                                title: `📋 收到新的学习任务`,
                                body: `${title} (指派人: ${assignerName || '导师'})`
                            },
                            data: {
                                title: title,
                                type: 'task',
                                deadline: deadline || '',
                                assignerName: assignerName || '',
                                taskId: taskId || ''
                            },
                            apns: {
                                payload: {
                                    aps: {
                                        sound: 'default',
                                        badge: 1
                                    }
                                }
                            }
                        };

                        const tokenChunks = [];
                        for (let i = 0; i < uniqueFcmTokens.length; i += 500) {
                            tokenChunks.push(uniqueFcmTokens.slice(i, i + 500));
                        }

                        const messaging = admin.messaging();
                        const sendMethod = typeof messaging.sendEachForMulticast === 'function' 
                            ? messaging.sendEachForMulticast.bind(messaging) 
                            : messaging.sendMulticast.bind(messaging);

                        const fcmErrors = [];
                        for (const chunk of tokenChunks) {
                            const response = await sendMethod({
                                tokens: chunk,
                                ...fcmPayload
                            });
                            fcmSuccessCount += response.successCount;
                            fcmFailureCount += response.failureCount;
                            if (response.responses) {
                                response.responses.forEach((res, idx) => {
                                    if (!res.success && res.error) {
                                        console.error(`[FCM Task Push] Token index ${idx} failed:`, res.error);
                                        fcmErrors.push(`${res.error.code || 'unknown'}: ${res.error.message}`);
                                    }
                                });
                            }
                        }
                        
                        fcmSentSuccess = fcmSuccessCount > 0 || fcmFailureCount === 0;
                        console.log(`[FCM Task Push] Success: ${fcmSuccessCount}, Fail: ${fcmFailureCount}`);
                        if (fcmFailureCount > 0) {
                            fcmError = `FCM sent completed. Success: ${fcmSuccessCount}, Failures: ${fcmFailureCount}. Details: ${fcmErrors.slice(0, 3).join('; ')}`;
                        }
                    } catch (fcmErr) {
                        console.error("FCM task push error:", fcmErr);
                        fcmError = fcmErr.message;
                    }
                } else {
                    fcmSentSuccess = true;
                    console.log("[Mock FCM Task Push sent]", {
                        tokens: uniqueFcmTokens,
                        title: `📋 收到新的学习任务`,
                        body: `${title} (指派人: ${assignerName || '导师'})`
                    });
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
                    dingtalkApiResponse: dingtalkApiResponse,
                    fcmPush: {
                        success: fcmSentSuccess,
                        error: fcmError,
                        successCount: fcmSuccessCount,
                        failureCount: fcmFailureCount,
                        tokensCount: uniqueFcmTokens.length
                    }
                })
            };
        }

        // ==========================================
        // ACTION: NOTIFY CAMPAIGN (Custom Certificate Challenge Alerts)
        // ==========================================
        if (action === 'notifyCampaign') {
            const { title, bannerTitle, creatorName, endDate, assigneeIds } = body;
            if (!assigneeIds || !Array.isArray(assigneeIds)) {
                return { statusCode: 400, body: JSON.stringify({ error: 'Missing assigneeIds' }) };
            }

            const recipientsZh = [];
            const recipientsEn = [];
            const fcmTokens = [];
            let dbError = null;
            const queryLogs = [];

            // Fetch users to retrieve their dingtalkUserIds and deviceTokens
            if (!isMockFirebase) {
                try {
                    const db = getFirestoreDb();
                    for (const uid of assigneeIds) {
                        const doc = await db.collection('users').doc(uid).get();
                        if (doc.exists) {
                            const data = doc.data();
                            
                            // Collect DingTalk User ID
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

                            // Collect device tokens for FCM push
                            if (Array.isArray(data.deviceTokens) && data.deviceTokens.length > 0) {
                                data.deviceTokens.forEach(t => {
                                    if (t && typeof t === 'string') {
                                        fcmTokens.push(t);
                                    }
                                });
                            }
                        } else {
                            queryLogs.push({ uid, found: false, msg: "User document not found in Firestore users collection" });
                        }
                    }
                } catch (err) {
                    console.error("Failed to query campaign assignees dingtalkUserIds and tokens:", err);
                    dbError = err.message;
                }
            } else {
                // Mock Recipients
                assigneeIds.forEach(id => {
                    const mockId = `dd_mock_id_${id}`;
                    if (id.toLowerCase().includes('wuchuan')) {
                        recipientsZh.push(mockId);
                    } else {
                        recipientsEn.push(mockId);
                    }
                    queryLogs.push({ uid: id, found: true, dingtalkUserId: mockId, msg: "mocked" });
                });
                fcmTokens.push('mock_fcm_token_1', 'mock_fcm_token_2');
            }

            const getMsgMarkdown = (lang) => {
                if (lang === 'en') {
                    return `### 🏆 **ME Cloud Academy**\n**New Certificate Challenge Assigned**\n\n---\n\n**📋 Challenge Details:**\n* 🏷️ **Challenge Title:** ${title}\n* 🎖️ **Target Honor:** ${bannerTitle}\n* ⏰ **Deadline:** ${endDate || '-'}\n* 👤 **Manager:** ${creatorName}\n\n---\n\n> 💡 *After completing the required learning hours or tasks, you will unlock an official electronic certificate of achievement! Keep up the great work!*\n\n[👉 Click Here to Start Challenge](dingtalk://dingtalkclient/page/link?url=https%3A%2F%2Flearning.mecloudhub.com%2Fhub)`;
                }
                return `### 🏆 **ME 云学堂**\n**收到新的荣誉证书挑战**\n\n---\n\n**📋 挑战详情：**\n* 🏷️ **挑战名称**：${title}\n* 🎖️ **目标荣誉**：${bannerTitle}\n* ⏰ **截止时间**：${endDate || '-'}\n* 👤 **发布主管**：${creatorName}\n\n---\n\n> 💡 *达成挑战要求的学时或学习任务后，您将获得官方认证的专属电子荣誉证书，可下载并分享！加油！*\n\n[👉 点击立即开启挑战](dingtalk://dingtalkclient/page/link?url=https%3A%2F%2Flearning.mecloudhub.com%2Fhub)`;
            };

            const getMsgTitle = (lang) => {
                return lang === 'en' ? "🏆 ME Cloud Academy - New Challenge" : "🏆 ME 云学堂 - 专属证书挑战指派";
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
                    errorMessage = "No matched assignees with bound DingTalk accounts found.";
                }
            }

            // FCM App System Push
            let fcmSentSuccess = false;
            let fcmError = null;
            let fcmSuccessCount = 0;
            let fcmFailureCount = 0;
            const uniqueFcmTokens = Array.from(new Set(fcmTokens));

            if (uniqueFcmTokens.length > 0) {
                if (!isMockFirebase) {
                    try {
                        const fcmPayload = {
                            notification: {
                                title: `🏆 收到新的专属证书挑战`,
                                body: `${title} (指派人: ${creatorName || '主管'})`
                            },
                            data: {
                                title: title,
                                type: 'campaign',
                                bannerTitle: bannerTitle || '',
                                creatorName: creatorName || '',
                                endDate: endDate || ''
                            },
                            apns: {
                                payload: {
                                    aps: {
                                        sound: 'default',
                                        badge: 1
                                    }
                                }
                            }
                        };

                        const tokenChunks = [];
                        for (let i = 0; i < uniqueFcmTokens.length; i += 500) {
                            tokenChunks.push(uniqueFcmTokens.slice(i, i + 500));
                        }

                        const messaging = admin.messaging();
                        const sendMethod = typeof messaging.sendEachForMulticast === 'function' 
                            ? messaging.sendEachForMulticast.bind(messaging) 
                            : messaging.sendMulticast.bind(messaging);

                        const fcmErrors = [];
                        for (const chunk of tokenChunks) {
                            const response = await sendMethod({
                                tokens: chunk,
                                ...fcmPayload
                            });
                            fcmSuccessCount += response.successCount;
                            fcmFailureCount += response.failureCount;
                            if (response.responses) {
                                response.responses.forEach((res, idx) => {
                                    if (!res.success && res.error) {
                                        console.error(`[FCM Campaign Push] Token index ${idx} failed:`, res.error);
                                        fcmErrors.push(`${res.error.code || 'unknown'}: ${res.error.message}`);
                                    }
                                });
                            }
                        }
                        
                        fcmSentSuccess = fcmSuccessCount > 0 || fcmFailureCount === 0;
                        console.log(`[FCM Campaign Push] Success: ${fcmSuccessCount}, Fail: ${fcmFailureCount}`);
                        if (fcmFailureCount > 0) {
                            fcmError = `FCM sent completed. Success: ${fcmSuccessCount}, Failures: ${fcmFailureCount}. Details: ${fcmErrors.slice(0, 3).join('; ')}`;
                        }
                    } catch (fcmErr) {
                        console.error("FCM campaign push error:", fcmErr);
                        fcmError = fcmErr.message;
                    }
                } else {
                    fcmSentSuccess = true;
                    console.log("[Mock FCM Campaign Push sent]", {
                        tokens: uniqueFcmTokens,
                        title: `🏆 收到新的专属证书挑战`,
                        body: `${title} (指派人: ${creatorName || '主管'})`
                    });
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
                    dingtalkApiResponse: dingtalkApiResponse,
                    fcmPush: {
                        success: fcmSentSuccess,
                        error: fcmError,
                        successCount: fcmSuccessCount,
                        failureCount: fcmFailureCount,
                        tokensCount: uniqueFcmTokens.length
                    }
                })
            };
        }

        // ==========================================
        // ACTION: NOTIFY COMMENT (Material Comment Alerts)
        // ==========================================
        if (action === 'notifyComment') {
            const { materialTitle, uploaderCrmId, commenterName, commentText, recordingId } = body;
            if (!uploaderCrmId || !materialTitle) {
                return { statusCode: 400, body: JSON.stringify({ error: 'Missing uploaderCrmId or materialTitle' }) };
            }

            let sentSuccess = false;
            let mockPayload = null;
            let errorMessage = null;
            let dingtalkApiResponse = null;

            let uploaderData = null;
            if (!isMockFirebase) {
                try {
                    const db = getFirestoreDb();
                    const snapshot = await db.collection('users')
                        .where('crmId', '==', uploaderCrmId)
                        .limit(1)
                        .get();
                    if (!snapshot.empty) {
                        uploaderData = snapshot.docs[0].data();
                    } else {
                        errorMessage = `Uploader user profile not found in database for CRM ID: ${uploaderCrmId}`;
                    }
                } catch (dbErr) {
                    console.error("Firestore user lookup error in notifyComment:", dbErr);
                    errorMessage = `Firestore lookup error: ${dbErr.message}`;
                }
            } else {
                uploaderData = {
                    crmId: uploaderCrmId,
                    dingtalkUserId: 'mock_uploader_userid',
                    role: 'user'
                };
            }

            if (uploaderData) {
                const isChinese = isUserChineseSpeaker(uploaderData);
                const hasDingTalk = !!uploaderData.dingtalkUserId;
                const fcmTokens = Array.isArray(uploaderData.deviceTokens) ? uploaderData.deviceTokens.filter(Boolean) : [];
                
                let ddSuccess = !hasDingTalk;
                let fcmSuccess = (fcmTokens.length === 0);

                // 1. DINGTALK NOTIFICATION
                if (hasDingTalk) {
                    const targetUserId = uploaderData.dingtalkUserId;
                    const getMsgTitle = () => {
                        return isChinese ? "💬 您的素材有新评论！" : "💬 New Comment on Your Recording!";
                    };

                    const getMsgMarkdown = () => {
                        if (isChinese) {
                            return `### 💬 **您的录音素材有新的评论！**\n\n---\n\n**📋 详情信息：**\n* 🎬 **录音素材：** ${materialTitle}\n* 👤 **评论用户：** \`${commenterName}\`\n* 💬 **评论内容：** \n> ${commentText}\n\n---\n\n*请点击下方按钮立即查看详情并进行回复互动。*`;
                        }
                        return `### 💬 **New Comment on Your Recording!**\n\n---\n\n**📋 Details:**\n* 🎬 **Recording:** ${materialTitle}\n* 👤 **Commenter:** \`${commenterName}\`\n* 💬 **Comment:** \n> ${commentText}\n\n---\n\n*Click the button below to view details and reply.*`;
                    };

                    const getMsgBtnText = () => {
                        return isChinese ? "立即在线查看评论" : "View Comment Online";
                    };

                    if (!isMockDingTalk && !isMockFirebase) {
                        try {
                            const token = await getDingTalkToken();
                            const notifyUrl = `https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2?access_token=${token}`;
                            const notifyRes = await fetch(notifyUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    agent_id: parseInt(agentId),
                                    userid_list: targetUserId,
                                    msg: {
                                        msgtype: "action_card",
                                        action_card: {
                                            title: getMsgTitle(),
                                            markdown: getMsgMarkdown(),
                                            single_title: getMsgBtnText(),
                                            single_url: `dingtalk://dingtalkclient/page/link?url=https%3A%2F%2Flearning.mecloudhub.com%2Fhub%3FrecordingId%3D${recordingId}`
                                        }
                                    }
                                })
                            });
                            const notifyData = await notifyRes.json();
                            dingtalkApiResponse = notifyData;
                            ddSuccess = (notifyData.errcode === 0);
                            if (!ddSuccess) {
                                errorMessage = `DingTalk API returned errcode ${notifyData.errcode}: ${notifyData.errmsg}`;
                            }
                        } catch (pushErr) {
                            console.error("DingTalk push error in notifyComment:", pushErr);
                            errorMessage = pushErr.message;
                        }
                    } else {
                        ddSuccess = true;
                        mockPayload = {
                            targetUserId,
                            title: getMsgTitle(),
                            markdown: getMsgMarkdown(),
                            btnText: getMsgBtnText(),
                            url: `dingtalk://dingtalkclient/page/link?url=https%3A%2F%2Flearning.mecloudhub.com%2Fhub%3FrecordingId%3D${recordingId}`
                        };
                        console.log("[Mock Comment Notification sent]", mockPayload);
                    }
                }

                // 2. FCM PUSH NOTIFICATION
                if (fcmTokens.length > 0) {
                    const fcmTitle = isChinese ? `💬 您的素材有新评论！` : `💬 New Comment on Your Recording!`;
                    const fcmBody = isChinese
                        ? `“${commenterName}”评论了您的素材《${materialTitle}》：“${commentText.slice(0, 50)}...”`
                        : `"${commenterName}" commented on your recording "${materialTitle}": "${commentText.slice(0, 50)}..."`;

                    if (!isMockFirebase) {
                        try {
                            const messaging = admin.messaging();
                            const sendMethod = typeof messaging.sendEachForMulticast === 'function'
                                ? messaging.sendEachForMulticast.bind(messaging)
                                : messaging.sendMulticast.bind(messaging);

                            const fcmPayload = {
                                notification: {
                                    title: fcmTitle,
                                    body: fcmBody
                                },
                                data: {
                                    recordingId: recordingId || '',
                                    type: 'comment'
                                },
                                apns: {
                                    payload: {
                                        aps: {
                                            sound: 'default',
                                            badge: 1
                                        }
                                    }
                                }
                            };

                            const tokenChunks = [];
                            for (let i = 0; i < fcmTokens.length; i += 500) {
                                tokenChunks.push(fcmTokens.slice(i, i + 500));
                            }

                            let successCount = 0;
                            for (const chunk of tokenChunks) {
                                const response = await sendMethod({
                                    tokens: chunk,
                                    ...fcmPayload
                                });
                                successCount += response.successCount;
                            }
                            fcmSuccess = successCount > 0;
                            console.log(`[FCM Push] Sent comment notification to author device tokens. Success count: ${successCount}`);
                        } catch (fcmErr) {
                            console.error("FCM comment push error in notifyComment:", fcmErr);
                            fcmSuccess = false;
                        }
                    } else {
                        fcmSuccess = true;
                        if (!mockPayload) mockPayload = {};
                        mockPayload.fcm = {
                            tokens: fcmTokens,
                            title: fcmTitle,
                            body: fcmBody,
                            data: {
                                recordingId: recordingId || '',
                                type: 'comment'
                            }
                        };
                        console.log("[Mock FCM Comment Push sent]", mockPayload.fcm);
                    }
                }

                sentSuccess = ddSuccess && fcmSuccess;
            } else {
                errorMessage = `Author profile exists, but uploaderData is missing.`;
            }

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: sentSuccess,
                    error: errorMessage,
                    mockPayload,
                    dingtalkApiResponse
                })
            };
        }

        // ==========================================
        // ACTION: NOTIFY MATERIAL (Phase 2 Material Updates)
        // ==========================================
        if (action === 'notifyMaterial') {
            const { recordingId, title, displayId, lecturerName, categoryName, description, targetType, selectedSds, webhookLang } = body;
            if (!recordingId || !title) {
                return { statusCode: 400, body: JSON.stringify({ error: 'Missing material recordingId or title' }) };
            }

            const markdownBilingual = `![cover](https://learning.mecloudhub.com/images/share-preview.png) \n\n ### **🔥 ME 云学堂新增精品素材 / ME Cloud Academy - New Premium Recording Released** \n\n ---\n\n **📋 Material Details / 素材详情：**\n* 🏷️ **ID / 素材编号：** [${displayId || recordingId}]\n* 🎬 **Title / 录音标题：** ${title}\n* 👤 **Lecturer / 主讲人：** ${lecturerName || '系统导师 / Mentor'}\n* 📂 **Category / 分类线：** ${categoryName || '精品推荐 / Featured'}\n\n ---\n\n > 💡 **Introduction / 课程介绍：**\n> ${description || '导师倾情推荐！欢迎大家点击下方链接立即收听实战复盘。 / Highly recommended! Click the link below to listen to the recording.'}\n\n 欢迎收听！ / Happy listening!`;

            const getMsgMarkdown = (lang) => {
                if (lang === 'en') {
                    return `![cover](https://learning.mecloudhub.com/images/share-preview.png)\n\n### **🔥 ME Cloud Academy - New Premium Recording Released**\n\n---\n\n**📋 Material Details:**\n* 🏷️ **ID:** [${displayId || recordingId}]\n* 🎬 **Title:** ${title}\n* 👤 **Lecturer:** ${lecturerName || 'Mentor'}\n* 📂 **Category:** ${categoryName || 'Featured'}\n\n---\n\n> 💡 **Introduction:**\n> ${description || 'Highly recommended! Click the link below to listen to the recording.'}\n\nHappy listening!`;
                }
                return `![cover](https://learning.mecloudhub.com/images/share-preview.png)\n\n### **🔥 ME 云学堂新增精品录音素材**\n\n---\n\n**📋 素材详情：**\n* 🏷️ **素材编号：** [${displayId || recordingId}]\n* 🎬 **录音标题：** ${title}\n* 👤 **主讲人：** ${lecturerName || '系统导师'}\n* 📂 **分类线：** ${categoryName || '精品推荐'}\n\n---\n\n> 💡 **课程介绍：**\n> ${description || '导师倾情推荐！欢迎大家点击下方链接立即收听实战复盘。'}\n\n欢迎收听！`;
            };

            const getMsgBtnText = (lang) => {
                return lang === 'en' ? "Listen Online Now" : "立即在线收听";
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
                        // Support multiple group bots in parallel separated by commas!
                        const urls = webhookUrl.split(',').map(url => url.trim()).filter(Boolean);
                        
                        // Select target language based on selection
                        let webhookTitle = "🔥 ME 云学堂精品录音发布 / ME Cloud Academy - New Premium Recording Released";
                        let webhookText = markdownBilingual;
                        let webhookBtnText = "🎧 立即收听 / Listen Now";
                        
                        if (webhookLang === 'en') {
                            webhookTitle = "🔥 ME Cloud Academy - New Premium Recording Released";
                            webhookText = getMsgMarkdown('en');
                            webhookBtnText = "🎧 Listen Now";
                        } else if (webhookLang === 'zh') {
                            webhookTitle = "🔥 ME 云学堂新增精品录音素材";
                            webhookText = getMsgMarkdown('zh');
                            webhookBtnText = "🎧 立即收听";
                        }

                        const pushPromises = urls.map(async (url) => {
                            const webhookRes = await fetch(url, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    msgtype: "actionCard",
                                    actionCard: {
                                        title: webhookTitle,
                                        text: webhookText,
                                        btnOrientation: "0",
                                        btns: [
                                            {
                                                title: webhookBtnText,
                                                actionURL: `dingtalk://dingtalkclient/page/link?url=https%3A%2F%2Flearning.mecloudhub.com%2Fhub%3FrecordingId%3D${recordingId}`
                                            }
                                        ]
                                    }
                                })
                            });
                            const resText = await webhookRes.text();
                            let parsed;
                            try {
                                parsed = JSON.parse(resText);
                            } catch (e) {
                                parsed = { errcode: webhookRes.ok ? 0 : -1, errmsg: resText };
                            }
                            return parsed;
                        });

                        const results = await Promise.all(pushPromises);
                        const failed = results.filter(r => r.errcode !== 0);
                        
                        if (failed.length === 0) {
                            sentSuccess = true;
                        } else {
                            errorMessage = `Pushed to ${results.length} bots. ${failed.length} failed. Sample Error: ${JSON.stringify(failed[0])}`;
                        }
                    } catch (webErr) {
                        console.error("DingTalk Webhook Push Error:", webErr);
                        errorMessage = `Webhook connection error: ${webErr.message}`;
                    }
                } else {
                    errorMessage = "DingTalk Group Webhook URL (DINGTALK_WEBHOOK_URL) is not configured in Netlify environment variables.";
                }
            } else if (targetType === 'app') {
                // FCM App System Push
                pushType = 'app_push';
                const tokens = [];
                const queryLogs = [];
                if (!isMockFirebase) {
                    try {
                        const db = getFirestoreDb();
                        const snapshot = await db.collection('users').get();
                        snapshot.forEach(doc => {
                            const data = doc.data();
                            if (data.role !== 'blocked') {
                                let isMatched = true;
                                if (Array.isArray(selectedSds) && selectedSds.length > 0) {
                                    const sdFilters = selectedSds.map(s => {
                                        const str = String(s);
                                        if (str.startsWith('sd:')) return str.substring(3);
                                        if (str.startsWith('sm:') || str.startsWith('tl:') || str.startsWith('cc:') || str.startsWith('dep:') || str.startsWith('role:')) return null;
                                        return str;
                                    }).filter(Boolean).map(x => x.trim().toLowerCase());

                                    const smFilters = selectedSds.filter(s => String(s).startsWith('sm:')).map(s => String(s).substring(3).trim().toLowerCase());
                                    const tlFilters = selectedSds.filter(s => String(s).startsWith('tl:')).map(s => String(s).substring(3).trim().toLowerCase());
                                    const ccFilters = selectedSds.filter(s => String(s).startsWith('cc:')).map(s => String(s).substring(3).trim().toLowerCase());
                                    const depFilters = selectedSds.filter(s => String(s).startsWith('dep:')).map(s => String(s).substring(4).trim().toLowerCase());
                                    const roleFilters = selectedSds.filter(s => String(s).startsWith('role:')).map(s => String(s).substring(5).trim().toLowerCase());

                                    const userSd = String(data.sd || '').trim().toLowerCase();
                                    const userCrmId = String(data.crmId || '').trim().toLowerCase();
                                    const sdMatched = sdFilters.some(sd => sd === userSd || (data.role === 'sd' && sd === userCrmId));

                                    const userSm = String(data.sm || '').trim().toLowerCase();
                                    const smMatched = smFilters.some(sm => sm === userSm || (data.role === 'sm' && sm === userCrmId));

                                    const userTl = String(data.tl || '').trim().toLowerCase();
                                    const tlMatched = tlFilters.some(tl => tl === userTl || (data.role === 'tl' && tl === userCrmId));

                                    const ccMatched = ccFilters.includes(userCrmId);

                                    const userDep = String(data.dep || '').trim().toLowerCase();
                                    const userTeam = String(data.team || '').trim().toLowerCase();
                                    const hasSd = !!data.sd;
                                    const isSd = data.role === 'sd';
                                    const depMatched = !hasSd && !isSd && (depFilters.includes(userDep) || depFilters.includes(userTeam));

                                    const userDepUpper = String(data.dep || '').trim().toUpperCase();
                                    const userRoleLower = String(data.role || '').trim().toLowerCase();
                                    let roleMatched = false;
                                    if (roleFilters.includes('cctl') && userDepUpper === 'CC' && userRoleLower === 'tl') roleMatched = true;
                                    if (roleFilters.includes('ccsm') && userDepUpper === 'CC' && userRoleLower === 'sm') roleMatched = true;
                                    if (roleFilters.includes('ccsd') && userDepUpper === 'CC' && userRoleLower === 'sd') roleMatched = true;
                                    if (roleFilters.includes('sstl') && userDepUpper === 'SS' && userRoleLower === 'tl') roleMatched = true;
                                    if (roleFilters.includes('sssm') && userDepUpper === 'SS' && userRoleLower === 'sm') roleMatched = true;
                                    if (roleFilters.includes('sssd') && userDepUpper === 'SS' && userRoleLower === 'sd') roleMatched = true;

                                    isMatched = sdMatched || smMatched || tlMatched || ccMatched || depMatched || roleMatched;
                                }

                                if (isMatched && Array.isArray(data.deviceTokens) && data.deviceTokens.length > 0) {
                                    data.deviceTokens.forEach(t => {
                                        if (t && typeof t === 'string') tokens.push(t);
                                    });
                                    queryLogs.push({ uid: doc.id, crmId: data.crmId, matched: true, tokensCount: data.deviceTokens.length });
                                }
                            }
                        });
                    } catch (err) {
                        console.error("Failed to query device tokens for material app push:", err);
                        errorMessage = `Database query failed: ${err.message}`;
                    }
                } else {
                    tokens.push('mock_fcm_token_1', 'mock_fcm_token_2');
                }

                const uniqueTokens = Array.from(new Set(tokens));

                if (uniqueTokens.length > 0) {
                    if (!isMockFirebase) {
                        try {
                            const payload = {
                                notification: {
                                    title: `🔥 ME云学堂发布了新录音`,
                                    body: `${title}${lecturerName ? ' (主讲: ' + lecturerName + ')' : ''}`
                                },
                                data: {
                                    recordingId: recordingId,
                                    displayId: displayId || '',
                                    title: title,
                                    type: 'recording'
                                },
                                apns: {
                                    payload: {
                                        aps: {
                                            sound: 'default',
                                            badge: 1
                                        }
                                    }
                                }
                            };

                            const tokenChunks = [];
                            for (let i = 0; i < uniqueTokens.length; i += 500) {
                                tokenChunks.push(uniqueTokens.slice(i, i + 500));
                            }
                            
                            let successCount = 0;
                            let failureCount = 0;
                            const fcmErrors = [];
                            const messaging = admin.messaging();
                            const sendMethod = typeof messaging.sendEachForMulticast === 'function' 
                                ? messaging.sendEachForMulticast.bind(messaging) 
                                : messaging.sendMulticast.bind(messaging);

                            for (const chunk of tokenChunks) {
                                const response = await sendMethod({
                                    tokens: chunk,
                                    ...payload
                                });
                                successCount += response.successCount;
                                failureCount += response.failureCount;
                                if (response.responses) {
                                    response.responses.forEach((res, idx) => {
                                        if (!res.success && res.error) {
                                            console.error(`[FCM Push] Token index ${idx} failed:`, res.error);
                                            fcmErrors.push(`${res.error.code || 'unknown'}: ${res.error.message}`);
                                        }
                                    });
                                }
                            }
                            
                            sentSuccess = successCount > 0 || failureCount === 0;
                            console.log(`[FCM Push] Sent material. Success: ${successCount}, Fail: ${failureCount}`);
                            if (failureCount > 0) {
                                errorMessage = `FCM sent completed. Success: ${successCount}, Failures: ${failureCount}. Details: ${fcmErrors.slice(0, 3).join('; ')}`;
                            }
                        } catch (fcmErr) {
                            console.error("FCM broadcast error:", fcmErr);
                            errorMessage = `FCM send failed: ${fcmErr.message}`;
                            sentSuccess = false;
                        }
                    } else {
                        sentSuccess = true;
                        mockPayload = {
                            tokens: uniqueTokens,
                            title: `🔥 ME云学堂发布了新录音`,
                            body: `${title}${lecturerName ? ' (主讲: ' + lecturerName + ')' : ''}`,
                            data: {
                                recordingId: recordingId,
                                displayId: displayId || '',
                                title: title,
                                type: 'recording'
                            },
                            queryLogs
                        };
                        console.log("[Mock FCM Push sent]", mockPayload);
                    }
                } else {
                    sentSuccess = true;
                    errorMessage = "未在匹配的目标成员中找到任何注册的 App 推送设备 (FCM Token)。请确保员工已下载并开启通知。 / No active App devices (FCM tokens) found for the selected team members.";
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
                                    // Parse prefixed selection list to resolve SD filters and Non-Sales Department filters
                                    const sdFilters = selectedSds.map(s => {
                                        const str = String(s);
                                        if (str.startsWith('sd:')) return str.substring(3);
                                        if (str.startsWith('sm:') || str.startsWith('tl:') || str.startsWith('cc:') || str.startsWith('dep:') || str.startsWith('role:')) return null;
                                        return str; // Legacy fallback
                                    }).filter(Boolean).map(x => x.trim().toLowerCase());

                                    const smFilters = selectedSds.filter(s => String(s).startsWith('sm:')).map(s => String(s).substring(3).trim().toLowerCase());
                                    const tlFilters = selectedSds.filter(s => String(s).startsWith('tl:')).map(s => String(s).substring(3).trim().toLowerCase());
                                    const ccFilters = selectedSds.filter(s => String(s).startsWith('cc:')).map(s => String(s).substring(3).trim().toLowerCase());
                                    const depFilters = selectedSds.filter(s => String(s).startsWith('dep:')).map(s => String(s).substring(4).trim().toLowerCase());
                                    const roleFilters = selectedSds.filter(s => String(s).startsWith('role:')).map(s => String(s).substring(5).trim().toLowerCase());

                                    // Match Sales Director teams
                                    const userSd = String(data.sd || '').trim().toLowerCase();
                                    const userCrmId = String(data.crmId || '').trim().toLowerCase();
                                    const sdMatched = sdFilters.some(sd => sd === userSd || (data.role === 'sd' && sd === userCrmId));

                                    // Match Sales Manager teams
                                    const userSm = String(data.sm || '').trim().toLowerCase();
                                    const smMatched = smFilters.some(sm => sm === userSm || (data.role === 'sm' && sm === userCrmId));

                                    // Match Team Leader teams
                                    const userTl = String(data.tl || '').trim().toLowerCase();
                                    const tlMatched = tlFilters.some(tl => tl === userTl || (data.role === 'tl' && tl === userCrmId));

                                    // Match individual CCs/users directly
                                    const ccMatched = ccFilters.includes(userCrmId);

                                    // Match Non-Sales Department groups (only users without SD assignment who are not SDs themselves)
                                    const userDep = String(data.dep || '').trim().toLowerCase();
                                    const userTeam = String(data.team || '').trim().toLowerCase();
                                    const hasSd = !!data.sd;
                                    const isSd = data.role === 'sd';
                                    const depMatched = !hasSd && !isSd && (depFilters.includes(userDep) || depFilters.includes(userTeam));

                                    // Match custom role + department combinations (CCTL, CCSM, CCSD, SSTL, SSSM, SSSD)
                                    const userDepUpper = String(data.dep || '').trim().toUpperCase();
                                    const userRoleLower = String(data.role || '').trim().toLowerCase();
                                    let roleMatched = false;
                                    if (roleFilters.includes('cctl') && userDepUpper === 'CC' && userRoleLower === 'tl') roleMatched = true;
                                    if (roleFilters.includes('ccsm') && userDepUpper === 'CC' && userRoleLower === 'sm') roleMatched = true;
                                    if (roleFilters.includes('ccsd') && userDepUpper === 'CC' && userRoleLower === 'sd') roleMatched = true;
                                    if (roleFilters.includes('sstl') && userDepUpper === 'SS' && userRoleLower === 'tl') roleMatched = true;
                                    if (roleFilters.includes('sssm') && userDepUpper === 'SS' && userRoleLower === 'sm') roleMatched = true;
                                    if (roleFilters.includes('sssd') && userDepUpper === 'SS' && userRoleLower === 'sd') roleMatched = true;

                                    const isMatched = sdMatched || smMatched || tlMatched || ccMatched || depMatched || roleMatched;

                                    if (isMatched) {
                                        if (isEnglishSpeaker) {
                                            recipientsEn.push(data.dingtalkUserId);
                                        } else {
                                            recipientsZh.push(data.dingtalkUserId);
                                        }
                                        queryLogs.push({ uid: doc.id, crmId: data.crmId, sd: data.sd, dep: data.dep, matched: true, lang: isEnglishSpeaker ? 'en' : 'zh' });
                                    } else {
                                        queryLogs.push({ uid: doc.id, crmId: data.crmId, sd: data.sd, dep: data.dep, matched: false });
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
                                                        action_url: `dingtalk://dingtalkclient/page/link?url=https%3A%2F%2Flearning.mecloudhub.com%2Fhub%3FrecordingId%3D${recordingId}`
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
                            actionUrl: `dingtalk://dingtalkclient/page/link?url=https%3A%2F%2Flearning.mecloudhub.com%2Fhub%3FrecordingId%3D${recordingId}`,
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
        // ACTION: NOTIFY POLICY (Policy Pushes)
        // ==========================================
        if (action === 'notifyPolicy') {
            const { policyId, title, description, type, targetTeam, targetType, selectedSds, webhookLang, section } = body;
            if (!policyId || !title) {
                return { statusCode: 400, body: JSON.stringify({ error: 'Missing policyId or title' }) };
            }

            const isBrand = section === 'brand';
            const pagePath = isBrand ? 'brands' : 'policies';
            const encodedPagePath = isBrand ? 'brands' : 'policies';

            const getMsgMarkdown = (lang) => {
                let typeStr = '';
                if (isBrand) {
                    typeStr = type === 'document' 
                        ? (lang === 'zh' ? '📄 品牌文档' : '📄 Brand Document') 
                        : type === 'poster' 
                            ? (lang === 'zh' ? '🖼️ 品牌海报' : '🖼️ Brand Poster') 
                            : (lang === 'zh' ? '🎥 宣导视频' : '🎥 Brand Video');
                } else {
                    typeStr = type === 'document' 
                        ? (lang === 'zh' ? '📄 文档政策' : '📄 Document Policy') 
                        : type === 'poster' 
                            ? (lang === 'zh' ? '🖼️ 激励海报' : '🖼️ Incentive Poster') 
                            : (lang === 'zh' ? '🎥 宣导视频' : '🎥 Promo Video');
                }
                
                const audienceStr = targetTeam === 'all'
                    ? (lang === 'zh' ? '🌍 全部业务线' : '🌍 All Business Lines')
                    : (lang === 'zh' ? `${targetTeam} 团队专属` : `${targetTeam} Team Exclusive`);

                if (isBrand) {
                    if (lang === 'en') {
                        return `### 🎨 **ME Cloud Academy**\n**New Brand Material / Poster Published**\n\n---\n\n**📋 Material Details:**\n* 🎬 **Title:** ${title}\n* 📂 **Type:** ${typeStr}\n* 👥 **Audience:** ${audienceStr}\n\n---\n\n> 💡 **Description:**\n> ${description || 'New brand promotion material or poster released. Please review immediately.'}\n\n[👉 Click Here to View Brand Materials](dingtalk://dingtalkclient/page/link?url=https%3A%2F%2Flearning.mecloudhub.com%2Fbrands%3FpolicyId%3D${policyId})`;
                    }
                    return `### 🎨 **ME 云学堂**\n**发布了新的品牌物料/宣导海报**\n\n---\n\n**📋 物料详情：**\n* 🎬 **物料标题**：${title}\n* 📂 **展示类型**：${typeStr}\n* 👥 **受众团队**：${audienceStr}\n\n---\n\n> 💡 **内容简介：**\n> ${description || '设计/运营团队发布了最新的宣传海报或品牌宣导视频，请及时查看下载。'}\n\n[👉 点击立即前往查看](dingtalk://dingtalkclient/page/link?url=https%3A%2F%2Flearning.mecloudhub.com%2Fbrands%3FpolicyId%3D${policyId})`;
                } else {
                    if (lang === 'en') {
                        return `### 📢 **ME Cloud Academy**\n**New Operations Policy / Incentive Published**\n\n---\n\n**📋 Policy Details:**\n* 🎬 **Title:** ${title}\n* 📂 **Type:** ${typeStr}\n* 👥 **Audience:** ${audienceStr}\n\n---\n\n> 💡 **Description:**\n> ${description || 'New operations policy or incentive scheme released. Please review immediately.'}\n\n[👉 Click Here to View Policy](dingtalk://dingtalkclient/page/link?url=https%3A%2F%2Flearning.mecloudhub.com%2Fpolicies%3FpolicyId%3D${policyId})`;
                    }
                    return `### 📢 **ME 云学堂**\n**发布了新的运营政策/激励方案**\n\n---\n\n**📋 政策详情：**\n* 🎬 **政策标题**：${title}\n* 📂 **展示类型**：${typeStr}\n* 👥 **受众团队**：${audienceStr}\n\n---\n\n> 💡 **内容简介：**\n> ${description || '运营团队发布了最新的提成激励或运营政策，请及时查看并研读。'}\n\n[👉 点击立即前往查看](dingtalk://dingtalkclient/page/link?url=https%3A%2F%2Flearning.mecloudhub.com%2Fpolicies%3FpolicyId%3D${policyId})`;
                }
            };

            const getMsgBtnText = (lang) => {
                if (isBrand) {
                    return lang === 'en' ? "View Brand Material" : "立即查看品牌物料";
                }
                return lang === 'en' ? "View Policy Online" : "立即查看政策";
            };

            const getMsgTitle = (lang) => {
                if (isBrand) {
                    return lang === 'en' ? "🎨 ME Cloud Academy - New Brand Material" : "🎨 ME 云学堂新品牌物料发布";
                }
                return lang === 'en' ? "📢 ME Cloud Academy - New Policy" : "📢 ME 云学堂新政策发布";
            };

            let sentSuccess = false;
            let pushType = 'none';
            let mockPayload = null;
            let errorMessage = null;

            const isPushToGroup = !targetType || targetType === 'group';

            if (isPushToGroup) {
                // Group Webhook push
                if (webhookUrl && !webhookUrl.includes('your_')) {
                    try {
                        pushType = 'webhook';
                        const urls = webhookUrl.split(',').map(url => url.trim()).filter(Boolean);
                        
                        let webhookTitle = isBrand
                            ? "🎨 ME 云学堂新品牌物料发布 / ME Cloud Academy - New Brand Material Published"
                            : "📢 ME 云学堂新政策发布 / ME Cloud Academy - New Operations Policy Published";
                        
                        let webhookText = "";
                        if (isBrand) {
                            webhookText = `### **🎨 ME 云学堂新增品牌物料 / ME Cloud Academy - New Brand Material Released** \n\n ---\n\n **📋 Details / 物料详情：**\n* 🎬 **Title / 物料标题：** ${title}\n* 📂 **Type / 展示类型：** ${type === 'document' ? '📄 品牌文档' : type === 'poster' ? '🖼️ 品牌海报' : '🎥 宣导视频'}\n* 👥 **Audience / 团队：** ${targetTeam === 'all' ? '全部可见' : targetTeam + ' 团队专属'}\n\n ---\n\n > 💡 **Introduction / 内容介绍：**\n> ${description || 'New brand promotion material or poster released. Please review immediately.'}`;
                        } else {
                            webhookText = `### **📢 ME 云学堂新增运营政策 / ME Cloud Academy - New Policy Released** \n\n ---\n\n **📋 Details / 政策详情：**\n* 🎬 **Title / 政策标题：** ${title}\n* 📂 **Type / 展示类型：** ${type === 'document' ? '📄 文档政策' : type === 'poster' ? '🖼️ 激励海报' : '🎥 宣导视频'}\n* 👥 **Audience / 团队：** ${targetTeam === 'all' ? '全部可见' : targetTeam + ' 团队专属'}\n\n ---\n\n > 💡 **Introduction / 内容介绍：**\n> ${description || 'New operations policy or incentive scheme released. Please review immediately.'}`;
                        }
                        
                        let webhookBtnText = isBrand ? "🎨 查看物料 / View Material" : "📢 查看政策 / View Policy";
                        
                        if (webhookLang === 'en') {
                            webhookTitle = isBrand ? "🎨 ME Cloud Academy - New Brand Material Released" : "📢 ME Cloud Academy - New Policy Released";
                            webhookText = getMsgMarkdown('en');
                            webhookBtnText = isBrand ? "🎨 View Material" : "📢 View Policy";
                        } else if (webhookLang === 'zh') {
                            webhookTitle = isBrand ? "🎨 ME 云学堂新品牌物料发布" : "📢 ME 云学堂新政策发布";
                            webhookText = getMsgMarkdown('zh');
                            webhookBtnText = isBrand ? "🎨 立即查看品牌物料" : "📢 立即查看政策";
                        }

                        const pushPromises = urls.map(async (url) => {
                            const webhookRes = await fetch(url, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    msgtype: "actionCard",
                                    actionCard: {
                                        title: webhookTitle,
                                        text: webhookText,
                                        btnOrientation: "0",
                                        btns: [
                                            {
                                                title: webhookBtnText,
                                                actionURL: `dingtalk://dingtalkclient/page/link?url=https%3A%2F%2Flearning.mecloudhub.com%2F${encodedPagePath}%3FpolicyId%3D${policyId}`
                                            }
                                        ]
                                    }
                                })
                            });
                            const resText = await webhookRes.text();
                            let parsed;
                            try {
                                parsed = JSON.parse(resText);
                            } catch (e) {
                                parsed = { errcode: webhookRes.ok ? 0 : -1, errmsg: resText };
                            }
                            return parsed;
                        });

                        const results = await Promise.all(pushPromises);
                        const failed = results.filter(r => r.errcode !== 0);
                        
                        if (failed.length === 0) {
                            sentSuccess = true;
                        } else {
                            errorMessage = `Pushed to ${results.length} bots. ${failed.length} failed. Sample Error: ${JSON.stringify(failed[0])}`;
                        }
                    } catch (webErr) {
                        console.error("DingTalk Webhook Policy Push Error:", webErr);
                        errorMessage = `Webhook connection error: ${webErr.message}`;
                    }
                } else {
                    errorMessage = "DingTalk Group Webhook URL (DINGTALK_WEBHOOK_URL) is not configured in Netlify environment variables.";
                }
            } else if (targetType === 'app') {
                // FCM App System Push
                pushType = 'app_push';
                const tokens = [];
                const queryLogs = [];
                if (!isMockFirebase) {
                    try {
                        const db = getFirestoreDb();
                        const snapshot = await db.collection('users').get();
                        snapshot.forEach(doc => {
                            const data = doc.data();
                            if (data.role !== 'blocked') {
                                let isMatched = true;
                                if (Array.isArray(selectedSds) && selectedSds.length > 0) {
                                    const sdFilters = selectedSds.map(s => {
                                        const str = String(s);
                                        if (str.startsWith('sd:')) return str.substring(3);
                                        if (str.startsWith('sm:') || str.startsWith('tl:') || str.startsWith('cc:') || str.startsWith('dep:') || str.startsWith('role:')) return null;
                                        return str;
                                    }).filter(Boolean).map(x => x.trim().toLowerCase());

                                    const smFilters = selectedSds.filter(s => String(s).startsWith('sm:')).map(s => String(s).substring(3).trim().toLowerCase());
                                    const tlFilters = selectedSds.filter(s => String(s).startsWith('tl:')).map(s => String(s).substring(3).trim().toLowerCase());
                                    const ccFilters = selectedSds.filter(s => String(s).startsWith('cc:')).map(s => String(s).substring(3).trim().toLowerCase());
                                    const depFilters = selectedSds.filter(s => String(s).startsWith('dep:')).map(s => String(s).substring(4).trim().toLowerCase());
                                    const roleFilters = selectedSds.filter(s => String(s).startsWith('role:')).map(s => String(s).substring(5).trim().toLowerCase());

                                    const userSd = String(data.sd || '').trim().toLowerCase();
                                    const userCrmId = String(data.crmId || '').trim().toLowerCase();
                                    const sdMatched = sdFilters.some(sd => sd === userSd || (data.role === 'sd' && sd === userCrmId));

                                    const userSm = String(data.sm || '').trim().toLowerCase();
                                    const smMatched = smFilters.some(sm => sm === userSm || (data.role === 'sm' && sm === userCrmId));

                                    const userTl = String(data.tl || '').trim().toLowerCase();
                                    const tlMatched = tlFilters.some(tl => tl === userTl || (data.role === 'tl' && tl === userCrmId));

                                    const ccMatched = ccFilters.includes(userCrmId);

                                    const userDep = String(data.dep || '').trim().toLowerCase();
                                    const userTeam = String(data.team || '').trim().toLowerCase();
                                    const hasSd = !!data.sd;
                                    const isSd = data.role === 'sd';
                                    const depMatched = !hasSd && !isSd && (depFilters.includes(userDep) || depFilters.includes(userTeam));

                                    const userDepUpper = String(data.dep || '').trim().toUpperCase();
                                    const userRoleLower = String(data.role || '').trim().toLowerCase();
                                    let roleMatched = false;
                                    if (roleFilters.includes('cctl') && userDepUpper === 'CC' && userRoleLower === 'tl') roleMatched = true;
                                    if (roleFilters.includes('ccsm') && userDepUpper === 'CC' && userRoleLower === 'sm') roleMatched = true;
                                    if (roleFilters.includes('ccsd') && userDepUpper === 'CC' && userRoleLower === 'sd') roleMatched = true;
                                    if (roleFilters.includes('sstl') && userDepUpper === 'SS' && userRoleLower === 'tl') roleMatched = true;
                                    if (roleFilters.includes('sssm') && userDepUpper === 'SS' && userRoleLower === 'sm') roleMatched = true;
                                    if (roleFilters.includes('sssd') && userDepUpper === 'SS' && userRoleLower === 'sd') roleMatched = true;

                                    isMatched = sdMatched || smMatched || tlMatched || ccMatched || depMatched || roleMatched;
                                } else if (targetTeam && targetTeam !== 'all') {
                                    const normalizedTeam = String(targetTeam).toUpperCase();
                                    const userDepUpper = String(data.dep || '').trim().toUpperCase();
                                    const userSdUpper = String(data.sd || '').trim().toUpperCase();
                                    
                                    let matchesTeam = false;
                                    const identity = String(data.identity || '');
                                    if (identity === normalizedTeam || identity === `${normalizedTeam} Operation` || (normalizedTeam === 'ADULT' && (identity === 'ACC' || identity === 'ACC Operation'))) {
                                        matchesTeam = true;
                                    } else {
                                        if (normalizedTeam === 'KCC' && userDepUpper === 'CC' && (userSdUpper === 'JOHN' || userSdUpper === 'NIKI')) matchesTeam = true;
                                        else if (normalizedTeam === 'GCC' && userDepUpper === 'CC' && userSdUpper === 'IRIS') matchesTeam = true;
                                        else if (normalizedTeam === 'ADULT' && (userSdUpper === 'ALAN' || userSdUpper === 'CHASE')) matchesTeam = true;
                                        else if (normalizedTeam === 'SS' && userSdUpper === 'LILY') matchesTeam = true;
                                    }
                                    isMatched = matchesTeam;
                                }

                                if (isMatched && Array.isArray(data.deviceTokens) && data.deviceTokens.length > 0) {
                                    data.deviceTokens.forEach(t => {
                                        if (t && typeof t === 'string') tokens.push(t);
                                    });
                                    queryLogs.push({ uid: doc.id, crmId: data.crmId, matched: true, tokensCount: data.deviceTokens.length });
                                }
                            }
                        });
                    } catch (err) {
                        console.error("Failed to query device tokens for policy app push:", err);
                        errorMessage = `Database query failed: ${err.message}`;
                    }
                } else {
                    tokens.push('mock_fcm_token_1', 'mock_fcm_token_2');
                }

                const uniqueTokens = Array.from(new Set(tokens));

                if (uniqueTokens.length > 0) {
                    if (!isMockFirebase) {
                        try {
                            const isBrand = section === 'brand';
                            const payload = {
                                notification: {
                                    title: isBrand ? `🎨 ME云学堂发布了新品牌物料` : `📢 ME云学堂发布了新运营政策`,
                                    body: title
                                },
                                data: {
                                    policyId: policyId,
                                    title: title,
                                    type: isBrand ? 'brand' : 'policy'
                                },
                                apns: {
                                    payload: {
                                        aps: {
                                            sound: 'default',
                                            badge: 1
                                        }
                                    }
                                }
                            };

                            const tokenChunks = [];
                            for (let i = 0; i < uniqueTokens.length; i += 500) {
                                tokenChunks.push(uniqueTokens.slice(i, i + 500));
                            }
                            
                            let successCount = 0;
                            let failureCount = 0;
                            const fcmErrors = [];
                            const messaging = admin.messaging();
                            const sendMethod = typeof messaging.sendEachForMulticast === 'function' 
                                ? messaging.sendEachForMulticast.bind(messaging) 
                                : messaging.sendMulticast.bind(messaging);

                            for (const chunk of tokenChunks) {
                                const response = await sendMethod({
                                    tokens: chunk,
                                    ...payload
                                });
                                successCount += response.successCount;
                                failureCount += response.failureCount;
                                if (response.responses) {
                                    response.responses.forEach((res, idx) => {
                                        if (!res.success && res.error) {
                                            console.error(`[FCM Push] Token index ${idx} failed:`, res.error);
                                            fcmErrors.push(`${res.error.code || 'unknown'}: ${res.error.message}`);
                                        }
                                    });
                                }
                             }
                             
                             sentSuccess = successCount > 0 || failureCount === 0;
                             console.log(`[FCM Push] Sent policy. Success: ${successCount}, Fail: ${failureCount}`);
                             if (failureCount > 0) {
                                 errorMessage = `FCM sent completed. Success: ${successCount}, Failures: ${failureCount}. Details: ${fcmErrors.slice(0, 3).join('; ')}`;
                             }
                        } catch (fcmErr) {
                            console.error("FCM policy push error:", fcmErr);
                            errorMessage = `FCM send failed: ${fcmErr.message}`;
                            sentSuccess = false;
                        }
                    } else {
                        sentSuccess = true;
                        const isBrand = section === 'brand';
                        mockPayload = {
                            tokens: uniqueTokens,
                            title: isBrand ? `🎨 ME云学堂发布了新品牌物料` : `📢 ME云学堂发布了新运营政策`,
                            body: title,
                            data: {
                                policyId: policyId,
                                title: title,
                                type: isBrand ? 'brand' : 'policy'
                            },
                            queryLogs
                        };
                        console.log("[Mock FCM Policy Push sent]", mockPayload);
                    }
                } else {
                    sentSuccess = true;
                    errorMessage = "未在匹配的目标成员中找到任何注册App 推送设备 (FCM Token)。请确保员工已下载并开启通知。 / No active App devices (FCM tokens) found for the selected team members.";
                }
            } else {
                // Broadcast/Targeted Push via Work Notification
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
                                    const sdFilters = selectedSds.map(s => {
                                        const str = String(s);
                                        if (str.startsWith('sd:')) return str.substring(3);
                                        if (str.startsWith('sm:') || str.startsWith('tl:') || str.startsWith('cc:') || str.startsWith('dep:') || str.startsWith('role:')) return null;
                                        return str;
                                    }).filter(Boolean).map(x => x.trim().toLowerCase());

                                    const smFilters = selectedSds.filter(s => String(s).startsWith('sm:')).map(s => String(s).substring(3).trim().toLowerCase());
                                    const tlFilters = selectedSds.filter(s => String(s).startsWith('tl:')).map(s => String(s).substring(3).trim().toLowerCase());
                                    const ccFilters = selectedSds.filter(s => String(s).startsWith('cc:')).map(s => String(s).substring(3).trim().toLowerCase());
                                    const depFilters = selectedSds.filter(s => String(s).startsWith('dep:')).map(s => String(s).substring(4).trim().toLowerCase());
                                    const roleFilters = selectedSds.filter(s => String(s).startsWith('role:')).map(s => String(s).substring(5).trim().toLowerCase());

                                    const userSd = String(data.sd || '').trim().toLowerCase();
                                    const userCrmId = String(data.crmId || '').trim().toLowerCase();
                                    const sdMatched = sdFilters.some(sd => sd === userSd || (data.role === 'sd' && sd === userCrmId));

                                    const userSm = String(data.sm || '').trim().toLowerCase();
                                    const smMatched = smFilters.some(sm => sm === userSm || (data.role === 'sm' && sm === userCrmId));

                                    const userTl = String(data.tl || '').trim().toLowerCase();
                                    const tlMatched = tlFilters.some(tl => tl === userTl || (data.role === 'tl' && tl === userCrmId));

                                    const ccMatched = ccFilters.includes(userCrmId);

                                    const userDep = String(data.dep || '').trim().toLowerCase();
                                    const userTeam = String(data.team || '').trim().toLowerCase();
                                    const hasSd = !!data.sd;
                                    const isSd = data.role === 'sd';
                                    const depMatched = !hasSd && !isSd && (depFilters.includes(userDep) || depFilters.includes(userTeam));

                                    const userDepUpper = String(data.dep || '').trim().toUpperCase();
                                    const userRoleLower = String(data.role || '').trim().toLowerCase();
                                    let roleMatched = false;
                                    if (roleFilters.includes('cctl') && userDepUpper === 'CC' && userRoleLower === 'tl') roleMatched = true;
                                    if (roleFilters.includes('ccsm') && userDepUpper === 'CC' && userRoleLower === 'sm') roleMatched = true;
                                    if (roleFilters.includes('ccsd') && userDepUpper === 'CC' && userRoleLower === 'sd') roleMatched = true;
                                    if (roleFilters.includes('sstl') && userDepUpper === 'SS' && userRoleLower === 'tl') roleMatched = true;
                                    if (roleFilters.includes('sssm') && userDepUpper === 'SS' && userRoleLower === 'sm') roleMatched = true;
                                    if (roleFilters.includes('sssd') && userDepUpper === 'SS' && userRoleLower === 'sd') roleMatched = true;

                                    const isMatched = sdMatched || smMatched || tlMatched || ccMatched || depMatched || roleMatched;

                                    if (isMatched) {
                                        if (isEnglishSpeaker) {
                                            recipientsEn.push(data.dingtalkUserId);
                                        } else {
                                            recipientsZh.push(data.dingtalkUserId);
                                        }
                                        queryLogs.push({ uid: doc.id, crmId: data.crmId, matched: true, lang: isEnglishSpeaker ? 'en' : 'zh' });
                                    } else {
                                        queryLogs.push({ uid: doc.id, crmId: data.crmId, matched: false });
                                    }
                                } else {
                                    // Broadcast to all linked non-admin users
                                    if (isEnglishSpeaker) {
                                        recipientsEn.push(data.dingtalkUserId);
                                    } else {
                                        recipientsZh.push(data.dingtalkUserId);
                                    }
                                    queryLogs.push({ uid: doc.id, crmId: data.crmId, matched: true, lang: isEnglishSpeaker ? 'en' : 'zh' });
                                }
                            }
                        });
                        console.log(`[Policy Push] Recipients: ZH=${recipientsZh.length}, EN=${recipientsEn.length}. TargetType: ${targetType}. Filters: ${JSON.stringify(selectedSds)}`);
                    } catch (err) {
                        console.error("Failed to query linked user ids for policy push:", err);
                    }
                } else {
                    recipientsEn.push('dd_mock_sales1');
                    recipientsZh.push('dd_mock_sales2');
                }

                const uniqueRecipientsZh = Array.from(new Set(recipientsZh));
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
                                                        action_url: `dingtalk://dingtalkclient/page/link?url=https%3A%2F%2Flearning.mecloudhub.com%2F${encodedPagePath}%3FpolicyId%3D${policyId}`
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
                        console.error("DingTalk policy broadcast error:", broadcastErr);
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
                            actionUrl: `dingtalk://dingtalkclient/page/link?url=https%3A%2F%2Flearning.mecloudhub.com%2F${encodedPagePath}%3FpolicyId%3D${policyId}`,
                            queryLogs: queryLogs
                        };
                        console.log("[Mock Policy Push sent]", mockPayload);
                    } else if (!agentId) {
                        errorMessage = "DingTalk Agent ID (DINGTALK_AGENT_ID) is not configured in Netlify environment variables.";
                    } else if (recipientsZh.length === 0 && recipientsEn.length === 0) {
                        errorMessage = "No team members in the selected teams have bound their DingTalk accounts.";
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
