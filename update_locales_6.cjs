const fs = require('fs');

const updates = {
    zh: {
        learning_hub: {
            listen_first: "请先完整听完本条录音"
        }
    },
    en: {
        learning_hub: {
            listen_first: "Please finish listening to this recording first"
        }
    },
    ar: {
        learning_hub: {
            listen_first: "يرجى الانتهاء من الاستماع إلى هذا التسجيل أولاً"
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

console.log("Translations 6 updated.");
