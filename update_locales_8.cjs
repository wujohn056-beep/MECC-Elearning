const fs = require('fs');

const updates = {
    zh: {
        user_manager: {
            search_placeholder: "搜索 CRM, Team, SD...",
            add_account: "新增账号",
            edit_account: "编辑",
            delete_account: "删除",
            reset_password: "重置密码",
            confirm_delete: "确定要删除该账号吗？此操作不可恢复。",
            confirm_reset: "确定将此账号的密码重置为 123456 吗？",
            add_modal_title: "新增系统账号",
            edit_modal_title: "编辑账号信息",
            label_crm: "CRM 账号 (字母小写)",
            label_role: "系统角色",
            label_sd: "Sales Director (SD)",
            label_sm: "Sales Manager (SM)",
            label_team: "Team 名称",
            btn_cancel: "取消",
            btn_save: "保存",
            save_success: "操作成功！",
            delete_success: "账号已删除！",
            reset_success: "密码已重置！",
            backend_error: "服务端操作失败，请检查服务配置"
        }
    },
    en: {
        user_manager: {
            search_placeholder: "Search CRM, Team, SD...",
            add_account: "Add Account",
            edit_account: "Edit",
            delete_account: "Delete",
            reset_password: "Reset Password",
            confirm_delete: "Are you sure you want to delete this account? This action cannot be undone.",
            confirm_reset: "Are you sure you want to reset this account's password to 123456?",
            add_modal_title: "Add System Account",
            edit_modal_title: "Edit Account Info",
            label_crm: "CRM ID (lowercase)",
            label_role: "System Role",
            label_sd: "Sales Director (SD)",
            label_sm: "Sales Manager (SM)",
            label_team: "Team Name",
            btn_cancel: "Cancel",
            btn_save: "Save",
            save_success: "Operation successful!",
            delete_success: "Account deleted!",
            reset_success: "Password reset successfully!",
            backend_error: "Backend operation failed, please check configuration"
        }
    },
    ar: {
        user_manager: {
            search_placeholder: "ابحث عن CRM، Team، SD...",
            add_account: "إضافة حساب",
            edit_account: "تعديل",
            delete_account: "حذف",
            reset_password: "إعادة تعيين كلمة المرور",
            confirm_delete: "هل أنت متأكد أنك تريد حذف هذا الحساب؟ لا يمكن التراجع عن هذا الإجراء.",
            confirm_reset: "هل أنت متأكد أنك تريد إعادة تعيين كلمة مرور هذا الحساب إلى 123456؟",
            add_modal_title: "إضافة حساب نظام",
            edit_modal_title: "تعديل معلومات الحساب",
            label_crm: "معرف CRM (أحرف صغيرة)",
            label_role: "دور النظام",
            label_sd: "مدير المبيعات (SD)",
            label_sm: "مدير المبيعات (SM)",
            label_team: "اسم الفريق",
            btn_cancel: "إلغاء",
            btn_save: "حفظ",
            save_success: "تمت العملية بنجاح!",
            delete_success: "تم حذف الحساب!",
            reset_success: "تمت إعادة تعيين كلمة المرور بنجاح!",
            backend_error: "فشلت عملية الخادم، يرجى التحقق من التكوين"
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

console.log("Translations 8 updated.");
