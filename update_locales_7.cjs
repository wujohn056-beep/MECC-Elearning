const fs = require('fs');

const updates = {
    zh: {
        learning_hub: {
            task_submission: "提交学习任务",
            task_submission_desc: "请听完所有分配的录音，并为每条录音撰写心得后即可提交任务。",
            complete_all_requirements: "请完成所有要求"
        }
    },
    en: {
        learning_hub: {
            task_submission: "Submit Learning Task",
            task_submission_desc: "Please listen to all assigned recordings and write a reflection for each recording before submitting the task.",
            complete_all_requirements: "Complete all requirements"
        }
    },
    ar: {
        learning_hub: {
            task_submission: "إرسال مهمة التعلم",
            task_submission_desc: "يرجى الاستماع إلى جميع التسجيلات المعينة وكتابة تأمل لكل تسجيل قبل إرسال المهمة.",
            complete_all_requirements: "أكمل جميع المتطلبات"
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

console.log("Translations 7 updated.");
