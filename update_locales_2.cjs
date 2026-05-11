const fs = require('fs');

const updates = {
    zh: {
        notifications: {
            urgent_alert: "您有 {{count}} 个学习任务将在 3 小时内截止！",
            critical_alert: "您有 {{count}} 个学习任务将在 1 小时内截止，请尽快完成！",
            modal_title: "新任务提醒",
            modal_desc: "您有 {{count}} 个未读的学习任务",
            modal_subdesc: "请及时查看并完成您的任务目标，点击下方按钮前往任务列表。",
            view_later: "稍后查看",
            view_now: "立即查看"
        }
    },
    en: {
        notifications: {
            urgent_alert: "You have {{count}} learning tasks due in 3 hours!",
            critical_alert: "You have {{count}} learning tasks due in 1 hour, please complete them ASAP!",
            modal_title: "New Task Alert",
            modal_desc: "You have {{count}} unread learning tasks",
            modal_subdesc: "Please review and complete your task goals in time. Click the button below to go to the task list.",
            view_later: "View Later",
            view_now: "View Now"
        }
    },
    ar: {
        notifications: {
            urgent_alert: "لديك {{count}} مهام تعليمية مستحقة خلال 3 ساعات!",
            critical_alert: "لديك {{count}} مهام تعليمية مستحقة خلال ساعة واحدة، يرجى إكمالها في أسرع وقت ممكن!",
            modal_title: "تنبيه مهمة جديدة",
            modal_desc: "لديك {{count}} مهام تعليمية غير مقروءة",
            modal_subdesc: "يرجى مراجعة أهداف مهمتك وإكمالها في الوقت المناسب. انقر فوق الزر أدناه للانتقال إلى قائمة المهام.",
            view_later: "عرض لاحقاً",
            view_now: "عرض الآن"
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

console.log("Translations 2 updated.");
