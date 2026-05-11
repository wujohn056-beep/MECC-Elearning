const fs = require('fs');

const updates = {
    zh: {
        team_tasks: {
            max_recordings_limit: "一次最多只能同时指派2个录音！"
        }
    },
    en: {
        team_tasks: {
            max_recordings_limit: "You can only assign a maximum of 2 recordings at a time!"
        }
    },
    ar: {
        team_tasks: {
            max_recordings_limit: "يمكنك تعيين بحد أقصى 2 تسجيلات في المرة الواحدة!"
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

console.log("Translations 5 updated.");
