const fs = require('fs');

const updates = {
    zh: {
        account: {
            empty_fav_title: "暂无收藏",
            empty_fav_desc: "在学习中心点击红心收藏喜欢的录音吧",
            empty_hist_title: "暂无学习记录",
            empty_hist_desc: "快去听听录音吧！",
            empty_tasks_title: "暂无指派任务",
            empty_tasks_desc: "您目前没有待完成的学习任务",
            hide_reflection: "收起心得"
        },
        team_tasks: {
            title: "团队任务",
            desc: "指派学习任务并追踪团队成员进度",
            new_task: "+ 新建指派任务",
            empty_state: "您还没有指派过任何任务，点击右上角新建一个吧！",
            expired: "已截止",
            deadline: "截止时间",
            recordings_count: "{{count}} 个录音",
            members_count: "{{count}} 个成员",
            progress: "完成进度",
            member_status: "成员状态与心得",
            reflection: "学习心得",
            status_completed: "已完成",
            status_pending: "进行中",
            status_unread: "未查看",
            modal_title: "新建学习任务",
            task_title_label: "任务标题",
            task_title_placeholder: "例如：本周必听优秀录音",
            assign_to_label: "指派给谁？",
            select_all: "全选成员",
            no_subordinates: "没有可指派的下属成员",
            select_recordings: "选择录音",
            deadline_date: "截止日期",
            deadline_time: "截止时间",
            cancel: "取消",
            confirm: "确认指派"
        }
    },
    en: {
        account: {
            empty_fav_title: "No favorites yet",
            empty_fav_desc: "Click the heart icon in the Learning Hub to save your favorite recordings",
            empty_hist_title: "No learning history",
            empty_hist_desc: "Go listen to some recordings!",
            empty_tasks_title: "No assigned tasks",
            empty_tasks_desc: "You have no pending learning tasks at the moment",
            hide_reflection: "Hide reflection"
        },
        team_tasks: {
            title: "Team Tasks",
            desc: "Assign learning tasks and track team progress",
            new_task: "+ New Task",
            empty_state: "You haven't assigned any tasks yet. Click the button to create one!",
            expired: "Expired",
            deadline: "Deadline",
            recordings_count: "{{count}} recordings",
            members_count: "{{count}} members",
            progress: "Progress",
            member_status: "Member Status & Reflection",
            reflection: "Reflection",
            status_completed: "Completed",
            status_pending: "In Progress",
            status_unread: "Unread",
            modal_title: "New Learning Task",
            task_title_label: "Task Title",
            task_title_placeholder: "e.g., Required recordings for this week",
            assign_to_label: "Assign to",
            select_all: "Select All",
            no_subordinates: "No subordinates to assign tasks to",
            select_recordings: "Select Recordings",
            deadline_date: "Deadline Date",
            deadline_time: "Deadline Time",
            cancel: "Cancel",
            confirm: "Assign Task"
        }
    },
    ar: {
        account: {
            empty_fav_title: "لا توجد مفضلات بعد",
            empty_fav_desc: "انقر على أيقونة القلب في مركز التعلم لحفظ تسجيلاتك المفضلة",
            empty_hist_title: "لا يوجد سجل تعلم",
            empty_hist_desc: "اذهب واستمع لبعض التسجيلات!",
            empty_tasks_title: "لا توجد مهام معينة",
            empty_tasks_desc: "ليس لديك أي مهام تعليمية معلقة في الوقت الحالي",
            hide_reflection: "إخفاء التأمل"
        },
        team_tasks: {
            title: "مهام الفريق",
            desc: "تعيين مهام التعلم وتتبع تقدم الفريق",
            new_task: "+ مهمة جديدة",
            empty_state: "لم تقم بتعيين أي مهام بعد. انقر على الزر لإنشاء واحدة!",
            expired: "منتهية",
            deadline: "الموعد النهائي",
            recordings_count: "{{count}} تسجيلات",
            members_count: "{{count}} أعضاء",
            progress: "التقدم",
            member_status: "حالة العضو والتأملات",
            reflection: "تأملات",
            status_completed: "مكتمل",
            status_pending: "قيد التنفيذ",
            status_unread: "غير مقروء",
            modal_title: "مهمة تعليمية جديدة",
            task_title_label: "عنوان المهمة",
            task_title_placeholder: "مثال: التسجيلات المطلوبة لهذا الأسبوع",
            assign_to_label: "تعيين إلى",
            select_all: "تحديد الكل",
            no_subordinates: "لا يوجد مرؤوسين لتعيين المهام إليهم",
            select_recordings: "تحديد التسجيلات",
            deadline_date: "تاريخ الموعد النهائي",
            deadline_time: "وقت الموعد النهائي",
            cancel: "إلغاء",
            confirm: "تعيين المهمة"
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

console.log("Translations 3 updated.");
