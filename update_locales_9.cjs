const fs = require('fs');

const updates = {
    zh: {
        user_manager: {
            label_tl: "Team Leader (TL)"
        }
    },
    en: {
        user_manager: {
            label_tl: "Team Leader (TL)"
        }
    },
    ar: {
        user_manager: {
            label_tl: "قائد الفريق (TL)"
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

console.log("Translations 9 updated.");
