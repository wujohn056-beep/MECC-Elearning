const fs = require('fs');

const updates = {
    zh: {
        common: {
            select_all: "全选本组",
            deselect_all: "取消全选"
        },
        team_tasks: {
            unassigned_team: "未分组"
        }
    },
    en: {
        common: {
            select_all: "Select Group",
            deselect_all: "Deselect Group"
        },
        team_tasks: {
            unassigned_team: "Unassigned"
        }
    },
    ar: {
        common: {
            select_all: "تحديد المجموعة",
            deselect_all: "إلغاء تحديد المجموعة"
        },
        team_tasks: {
            unassigned_team: "غير معين"
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

console.log("Translations 11 updated.");
