const fs = require('fs');

const updates = {
    zh: {
        team_tasks: {
            search_recording_placeholder: "搜索录音名称或ID..."
        }
    },
    en: {
        team_tasks: {
            search_recording_placeholder: "Search recording name or ID..."
        }
    },
    ar: {
        team_tasks: {
            search_recording_placeholder: "ابحث عن اسم التسجيل أو المعرف..."
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

console.log("Translations 4 updated.");
