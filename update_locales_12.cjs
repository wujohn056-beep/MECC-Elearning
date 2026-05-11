const fs = require('fs');

const updates = {
    zh: {
        dashboard: {
            title: "仪表盘总览",
            desc: "查看各级架构学习时长与任务完成情况",
            today: "今天",
            this_week: "本周",
            this_month: "本月",
            all_time: "全部时间",
            download_report: "导出报表",
            total_users: "范围内总人数",
            total_hours: "总学习时长",
            avg_hours: "人均时长",
            avg_completion: "平均任务完成率",
            hours: "小时",
            team_duration_ranking: "各团队总学习时长排行",
            team_avg_ranking: "各团队人均学习时长排行",
            user_duration_ranking: "个人学习时长排行榜 (Top 50)",
            total_duration: "总时长",
            completion_rate: "任务完成率",
            sd_duration_ranking: "SD架构学习时长排行",
            export_failed: "导出失败，请重试。"
        }
    },
    en: {
        dashboard: {
            title: "Dashboard Overview",
            desc: "View learning duration and task completion by organizational structure",
            today: "Today",
            this_week: "This Week",
            this_month: "This Month",
            all_time: "All Time",
            download_report: "Download Report",
            total_users: "Total Users in Scope",
            total_hours: "Total Learning Hours",
            avg_hours: "Avg. Hours per User",
            avg_completion: "Avg. Task Completion Rate",
            hours: "hours",
            team_duration_ranking: "Total Learning Duration by Team",
            team_avg_ranking: "Average Learning Duration by Team",
            user_duration_ranking: "Individual Learning Duration Ranking (Top 50)",
            total_duration: "Total Duration",
            completion_rate: "Completion Rate",
            sd_duration_ranking: "SD Level Learning Duration Ranking",
            export_failed: "Export failed, please try again."
        }
    },
    ar: {
        dashboard: {
            title: "نظرة عامة على لوحة القيادة",
            desc: "عرض مدة التعلم وإنجاز المهام حسب الهيكل التنظيمي",
            today: "اليوم",
            this_week: "هذا الأسبوع",
            this_month: "هذا الشهر",
            all_time: "كل الوقت",
            download_report: "تنزيل التقرير",
            total_users: "إجمالي المستخدمين",
            total_hours: "إجمالي ساعات التعلم",
            avg_hours: "متوسط الساعات لكل مستخدم",
            avg_completion: "متوسط معدل إنجاز المهام",
            hours: "ساعات",
            team_duration_ranking: "إجمالي مدة التعلم حسب الفريق",
            team_avg_ranking: "متوسط مدة التعلم حسب الفريق",
            user_duration_ranking: "ترتيب مدة التعلم الفردية (أفضل 50)",
            total_duration: "المدة الإجمالية",
            completion_rate: "معدل الإنجاز",
            sd_duration_ranking: "ترتيب مدة التعلم على مستوى SD",
            export_failed: "فشل التصدير، يرجى المحاولة مرة أخرى."
        }
    }
};

const localesPath = './src/locales/';
const langs = ['zh', 'en', 'ar'];

langs.forEach(lang => {
    const filePath = `${localesPath}${lang}.json`;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    for (const key in updates[lang]) {
        if (!data[key]) data[key] = {};
        for (const subKey in updates[lang][key]) {
            data[key][subKey] = updates[lang][key][subKey];
        }
    }
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
});

console.log("Translations 12 updated.");
