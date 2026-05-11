const fs = require('fs');

const updates = {
    zh: {
        navbar: {
            personal_center: "个人学习中心",
            team_tasks: "团队任务"
        },
        common: {
            team: "小组",
            change_password: "修改密码",
            logout: "退出登录",
            new_password: "新密码",
            confirm_password: "确认新密码",
            password_mismatch: "密码不一致",
            password_length: "密码长度至少为6个字符",
            reauth_needed: "出于安全原因，您需要重新登录才能修改密码",
            update_password: "更新密码",
            password_success: "密码修改成功！",
            times: "次",
            mins: "分钟"
        },
        learning_hub: {
            latest_uploads: "✨ 最新上传",
            latest_desc: "新近补充的学习资源",
            popular_recordings: "🔥 热门录音",
            popular_desc: "按播放次数排行",
            leaderboard: "🏆 风云榜单",
            most_favorited: "最多收藏",
            most_liked: "最多点赞",
            task_exclusive: "任务专属录音",
            task_need_listen: "您需要听完以下录音以完成任务：",
            back_to_courses: "← 返回全部课程",
            my_favorite_learning: "我的收藏学习",
            play_favorites_desc: "您可以直接在这里播放和学习您收藏的录音。",
            learning_reflection: "学习心得",
            reflection_desc: "请在完整听完相关录音后，记录下您的学习心得（不少于100字，鼓励越多越好）。提交后即代表完成任务。",
            reflection_placeholder: "写下您的实战感悟、需要改进的地方...",
            current_words: "当前字数:",
            words_needed: "(还差 {{count}} 字)",
            listen_first: "请先完整听完任意一首任务录音",
            submit_task: "提交心得并完成任务",
            submit_success: "提交成功！任务已完成。",
            submit_fail: "提交失败，请重试。"
        },
        account: {
            title: "个人学习中心",
            desc: "追踪您的学习足迹与任务进度",
            listened_recordings: "已听录音",
            lessons: "节",
            total_time: "学习总时长",
            duration_ranking: "时长排名",
            rank: "第 {{rank}} 名",
            surpassed: "超越了 {{percent}}% 的同事，继续加油！",
            my_favorites: "我的收藏夹",
            learning_milestones: "学习里程碑",
            my_tasks: "我的学习任务",
            completed: "已完成",
            pending: "待完成",
            from: "来自",
            due: "截止:",
            view_reflection: "查看我的学习心得",
            task_recordings: "任务录音：",
            write_reflection: "撰写心得并提交任务",
            task: "任务",
            my_reflection: "我的心得:"
        },
        notifications: {
            title: "任务与通知",
            pending_count: "{{count}} 待完成",
            no_new: "暂无新通知",
            from: "来自 {{assigner}}"
        }
    },
    en: {
        navbar: {
            personal_center: "Personal Center",
            team_tasks: "Team Tasks"
        },
        common: {
            team: "Team",
            change_password: "Change Password",
            logout: "Log Out",
            new_password: "New Password",
            confirm_password: "Confirm New Password",
            password_mismatch: "Passwords do not match",
            password_length: "Password must be at least 6 characters",
            reauth_needed: "For security reasons, please log out and log in again",
            update_password: "Update Password",
            password_success: "Password changed successfully!",
            times: " plays",
            mins: "mins"
        },
        learning_hub: {
            latest_uploads: "✨ Latest Uploads",
            latest_desc: "Recently added learning resources",
            popular_recordings: "🔥 Popular Recordings",
            popular_desc: "Ranked by play count",
            leaderboard: "🏆 Leaderboard",
            most_favorited: "Most Favorited",
            most_liked: "Most Liked",
            task_exclusive: "Task Exclusive Recordings",
            task_need_listen: "You need to finish listening to the following recordings to complete the task:",
            back_to_courses: "← Back to all courses",
            my_favorite_learning: "My Favorite Learning",
            play_favorites_desc: "You can directly play and learn from your favorited recordings here.",
            learning_reflection: "Learning Reflection",
            reflection_desc: "Please write down your learning reflection after listening to the complete recording (at least 100 words, more is encouraged). Submitting it will complete the task.",
            reflection_placeholder: "Write down your practical insights, areas for improvement...",
            current_words: "Current word count:",
            words_needed: "(Needs {{count}} more words)",
            listen_first: "Please finish listening to at least one task recording first",
            submit_task: "Submit reflection and complete task",
            submit_success: "Submission successful! Task completed.",
            submit_fail: "Submission failed, please try again."
        },
        account: {
            title: "Personal Learning Center",
            desc: "Track your learning footprint and task progress",
            listened_recordings: "Listened Recordings",
            lessons: "lessons",
            total_time: "Total Learning Time",
            duration_ranking: "Duration Ranking",
            rank: "Rank {{rank}}",
            surpassed: "Surpassed {{percent}}% of colleagues, keep it up!",
            my_favorites: "My Favorites",
            learning_milestones: "Learning Milestones",
            my_tasks: "My Learning Tasks",
            completed: "Completed",
            pending: "Pending",
            from: "From",
            due: "Due:",
            view_reflection: "View my learning reflection",
            task_recordings: "Task Recordings:",
            write_reflection: "Write reflection and submit task",
            task: "Task",
            my_reflection: "My reflection:"
        },
        notifications: {
            title: "Tasks & Notifications",
            pending_count: "{{count}} Pending",
            no_new: "No new notifications",
            from: "From {{assigner}}"
        }
    },
    ar: {
        navbar: {
            personal_center: "المركز الشخصي",
            team_tasks: "مهام الفريق"
        },
        common: {
            team: "فريق",
            change_password: "تغيير كلمة المرور",
            logout: "تسجيل الخروج",
            new_password: "كلمة المرور الجديدة",
            confirm_password: "تأكيد كلمة المرور",
            password_mismatch: "كلمات المرور غير متطابقة",
            password_length: "يجب أن تكون كلمة المرور 6 أحرف على الأقل",
            reauth_needed: "لأسباب أمنية، يرجى تسجيل الخروج وتسجيل الدخول مرة أخرى",
            update_password: "تحديث كلمة المرور",
            password_success: "تم تغيير كلمة المرور بنجاح!",
            times: " مرات",
            mins: "دقيقة"
        },
        learning_hub: {
            latest_uploads: "✨ أحدث التحميلات",
            latest_desc: "موارد تعليمية مضافة حديثًا",
            popular_recordings: "🔥 التسجيلات الشائعة",
            popular_desc: "مرتبة حسب عدد مرات التشغيل",
            leaderboard: "🏆 لوحة الصدارة",
            most_favorited: "الأكثر تفضيلاً",
            most_liked: "الأكثر إعجاباً",
            task_exclusive: "تسجيلات حصرية للمهام",
            task_need_listen: "تحتاج إلى الاستماع إلى التسجيلات التالية لإكمال المهمة:",
            back_to_courses: "← العودة لجميع الدورات",
            my_favorite_learning: "تعلمي المفضل",
            play_favorites_desc: "يمكنك تشغيل وتعلم تسجيلاتك المفضلة هنا مباشرة.",
            learning_reflection: "تأملات التعلم",
            reflection_desc: "يرجى تدوين تأملات التعلم بعد الاستماع للتسجيل بالكامل (ما لا يقل عن 100 كلمة). تقديمها يكمل المهمة.",
            reflection_placeholder: "اكتب أفكارك العملية ومجالات التحسين...",
            current_words: "عدد الكلمات الحالي:",
            words_needed: "(ينقص {{count}} كلمة)",
            listen_first: "يرجى الانتهاء من الاستماع لتسجيل واحد على الأقل أولاً",
            submit_task: "إرسال التأمل وإكمال المهمة",
            submit_success: "تم التقديم بنجاح! اكتملت المهمة.",
            submit_fail: "فشل التقديم، يرجى المحاولة مرة أخرى."
        },
        account: {
            title: "مركز التعلم الشخصي",
            desc: "تتبع تقدمك في التعلم",
            listened_recordings: "التسجيلات المستمعة",
            lessons: "دروس",
            total_time: "إجمالي وقت التعلم",
            duration_ranking: "ترتيب المدة",
            rank: "المركز {{rank}}",
            surpassed: "تجاوزت {{percent}}% من الزملاء، استمر!",
            my_favorites: "مفضلتي",
            learning_milestones: "معالم التعلم",
            my_tasks: "مهام التعلم الخاصة بي",
            completed: "مكتمل",
            pending: "قيد الانتظار",
            from: "من",
            due: "مستحق:",
            view_reflection: "عرض تأملات التعلم الخاصة بي",
            task_recordings: "تسجيلات المهام:",
            write_reflection: "اكتب التأمل وأرسل المهمة",
            task: "مهمة",
            my_reflection: "تأملاتي:"
        },
        notifications: {
            title: "المهام والإشعارات",
            pending_count: "{{count}} قيد الانتظار",
            no_new: "لا توجد إشعارات جديدة",
            from: "من {{assigner}}"
        }
    }
};

const localesPath = './src/locales/';
const langs = ['zh', 'en', 'ar'];

langs.forEach(lang => {
    const filePath = `${localesPath}${lang}.json`;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Deep merge
    for (const key in updates[lang]) {
        if (!data[key]) {
            data[key] = {};
        }
        for (const subKey in updates[lang][key]) {
            data[key][subKey] = updates[lang][key][subKey];
        }
    }
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
});

console.log("Translations updated.");
