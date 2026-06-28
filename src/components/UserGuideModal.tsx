import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, BookOpen, ShieldAlert, Award, FileText, CheckSquare, Play, HelpCircle } from 'lucide-react';

interface UserGuideModalProps {
    isOpen: boolean;
    onClose: () => void;
    role: string;
}

export default function UserGuideModal({ isOpen, onClose, role }: UserGuideModalProps) {
    const { t, i18n } = useTranslation();

    if (!isOpen) return null;

    const isLeader = role === 'super_admin' || role === 'sd' || role === 'sm' || role === 'tl';
    const isAr = i18n.language === 'ar';

    // Chinese content
    const zhContent = {
        title: "MECC 平台使用说明书",
        subtitle: isLeader ? "主管与管理员专属版本" : "普通销售/顾问 (CC) 版本",
        badge: isLeader ? "主管版 (Leader)" : "员工版 (User)",
        sections: isLeader ? [
            {
                icon: <Award className="w-5 h-5 text-desert-gold" />,
                title: "1. 实时查看团队学习进度",
                desc: "您可以在“学习广场”的录音卡片上点击“查看团队进度” (用户图标) 按钮，实时追踪团队情况：",
                bullets: [
                    "组织架构穿透：系统会自动根据您的级别（总监/经理/组长）折叠/展开对应的下属团队进度。",
                    "已学与未学追踪：可以清晰查看已完成打卡的人员名单，以及未学习组员当前的听课百分比。",
                    "一键加急催办：对于未学完的组员，可点击“一键催办”发送实时的 App 手机系统推送通知。"
                ]
            },
            {
                icon: <CheckSquare className="w-5 h-5 text-desert-gold" />,
                title: "2. 新建并指派团队学习任务",
                desc: "前往“团队任务”页面，点击“新建任务”，即可对团队指派强制限时任务：",
                bullets: [
                    "指派录音：从录音库选择一门或多门录音文件。",
                    "指派范围：一键全选或单独勾选您管辖范围内的普通组员或下级组长。",
                    "设定截止日期 (Deadline)：设置任务结束的年月日与具体时间点。",
                    "App 提醒：发布后，系统会自动通过 FCM 推送通知，提醒组员在截止时间前按时打卡。"
                ]
            },
            {
                icon: <FileText className="w-5 h-5 text-desert-gold" />,
                title: "3. 发布与追踪专项通关挑战",
                desc: "在任务管理界面切换到“专属挑战”，可以发布进阶通关计划并自动颁发荣誉证书：",
                bullets: [
                    "关联多音频：打包多门经典录音（如：First Call 5大经典音频）作为通关条件。",
                    "设定受众：按部门或身份限定挑战受众（如仅限 CC Sales 参与）。",
                    "证书定制预览：在发布弹窗中，可自定义证书文字、印章和背景，右侧会实时使用 Canvas 渲染出最终证书图片以供预览。",
                    "挑战达标追踪：达标看板可实时监控通关人数、生成证书，并通过进度条（如 2/5）监控进行中员工的完成缺口。"
                ]
            },
            {
                icon: <Play className="w-5 h-5 text-desert-gold" />,
                title: "4. 录音上传与 AI 音频字幕编辑器",
                desc: "如果您拥有 `manageRecordings` 权限，即可在管理后台上传音频文件，系统会通过 AI 自动处理：",
                bullets: [
                    "AI 语音转写：自动转写为阿拉伯语原始对话，并自动生成平行对照的中文及英文翻译。",
                    "在线字幕编辑器：若 AI 转写或翻译有个别偏差，可以在录音管理后台点击“编辑字幕”进行实时修改对齐，客户端即时生效。"
                ]
            },
            {
                icon: <ShieldAlert className="w-5 h-5 text-desert-gold" />,
                title: "5. 人力架构同步与自动关联机制",
                desc: "为了保证团队穿透数据的准确性，系统集成了批量与联动保护：",
                bullets: [
                    "Excel 批量导入：支持上传 GCC HC 或 KSAKID HC 表格，系统自动将 CC 绑定给 TL，TL 绑定给 SM，SM 绑定给 SD。",
                    "后台手动录入（双向联动）：在“用户管理”后台，当修改用户的 TL 时，系统会自动刷新并同步修改其所属的 Team Name、SM 和 SD；修改 Team Name 时也会自动联动回填对应的 TL，杜绝手动输入错误。"
                ]
            }
        ] : [
            {
                icon: <Play className="w-5 h-5 text-desert-gold" />,
                title: "1. 学习广场与 AI 交互播放器",
                desc: "在“学习广场”，您可以查阅公司精选的金牌通话案例录音：",
                bullets: [
                    "分类过滤器：通过“今日推荐”、“未学习”、“进行中”等过滤标签，快速找到适合的学习内容。",
                    "三语字幕对照：收听录音时，系统会展示由 AI 自动切分的阿拉伯语（原音）、中文及英文平行字幕。",
                    "点击字幕跳转播放：您可以直接点击字幕文本中的任意一行，播放器会自动精准跳跃到那句话的原音时刻播放。非常适合跟读与模仿。"
                ]
            },
            {
                icon: <Award className="w-5 h-5 text-desert-gold" />,
                title: "2. 学习心得打卡与保存荣誉证书",
                desc: "在您认真听完录音后，需要进行打卡并领取结业证书：",
                bullets: [
                    "听满打卡：进度条走满 100% 后，必须在输入框中填写学习心得或笔记反馈。",
                    "提交打卡：点击“提交心得并打卡”完成学习记录。",
                    "保存证书：打卡完成后系统自动颁发带有您名字、日期 and 专属印章的结业证书。支持一键渲染为高清图片保存至手机相册。"
                ]
            },
            {
                icon: <CheckSquare className="w-5 h-5 text-desert-gold" />,
                title: "3. 团队指派任务与通关挑战",
                desc: "您需要按时完成上级指派的内容：",
                bullets: [
                    "限时任务：查看主管向您指派的必修录音学习，包含任务标题和截止倒计时，请在截止前完成心得打卡。",
                    "专项挑战：查看发布的通关挑战（如：破冰挑战），完成挑战包里的全部指定录音后，将解锁更为高级的专项荣誉证书。"
                ]
            },
            {
                icon: <FileText className="w-5 h-5 text-desert-gold" />,
                title: "4. 政策基本法与离线下载",
                desc: "轻松掌握公司最新政策：",
                bullets: [
                    "基本法在线看：在“政策与激励”板块，支持在线高清阅读最新的基本法和提成方案 PDF，支持手势缩放。",
                    "App 安装：在下载页面扫码下载 Android APK 或 iOS 配置文件，安装后支持更好的后台音频播放和 FCM 推送通知。"
                ]
            }
        ]
    };

    // English content
    const enContent = {
        title: "MECC User Guide",
        subtitle: isLeader ? "Exclusive Version for Leaders & Admins" : "Version for Sales / Advisors (CC)",
        badge: isLeader ? "Leader Edition" : "User Edition",
        sections: isLeader ? [
            {
                icon: <Award className="w-5 h-5 text-desert-gold" />,
                title: "1. Monitor Real-Time Team Progress",
                desc: "Click the 'View Team Progress' (Users icon) on any recording card to track learning records:",
                bullets: [
                    "Hierarchical Scoping: The progress tree dynamically expands (SD -> SM -> TL -> User) according to your level.",
                    "Completion Status: View completed users with check-in details, and listen progress bars for uncompleted users.",
                    "FCM Reminders: Click 'Send Reminder' next to any uncompleted user to push an urgent notification to their mobile App instantly."
                ]
            },
            {
                icon: <CheckSquare className="w-5 h-5 text-desert-gold" />,
                title: "2. Create & Assign Team Tasks",
                desc: "Go to the 'Team Tasks' tab and click 'New Task' to assign deadline-driven learning requirements:",
                bullets: [
                    "Recordings Selection: Select one or more recordings from the database.",
                    "Assignees: Select specific sub-leaders or direct sales agents in your organization.",
                    "Deadline Setting: Configure exact deadline date and time in the future.",
                    "FCM Pushes: Upon creation, system automatically triggers app push notifications to all assignees."
                ]
            },
            {
                icon: <FileText className="w-5 h-5 text-desert-gold" />,
                title: "3. Publish & Track Challenge Campaigns",
                desc: "Switch to 'Exclusive Challenges' in task page to deploy structured curriculums with medals and certificates:",
                bullets: [
                    "Recordings Bundling: Set multiple recordings (e.g. First Call Essentials) as prerequisite criteria.",
                    "Targeting Scope: Restrict audience to specific departments (e.g. CC Sales) or positions.",
                    "Certificate Customization: Customize certificates with live canvas previewing of text, badges, and seals.",
                    "Campaign Dashboard: Track completion status, generate certificates for qualifiers, and monitor progress bars of in-progress agents."
                ]
            },
            {
                icon: <Play className="w-5 h-5 text-desert-gold" />,
                title: "4. Audio Upload & AI Subtitle Micro-Editing",
                desc: "Users with `manageRecordings` permission can manage learning assets in the admin dashboard:",
                bullets: [
                    "AI Transcription & Translation: Automatically converts Arabic speech to time-coded scripts and generates Chinese/English translations.",
                    "Subtitle Editor: Micro-edit AI transcription errors or translation lines inside admin console, synchronized to clients instantly."
                ]
            },
            {
                icon: <ShieldAlert className="w-5 h-5 text-desert-gold" />,
                title: "5. Directory Sync & Cascading Auto-Linkage",
                desc: "Designed to keep organizational tree data clean and prevent manual input mistakes:",
                bullets: [
                    "Excel Import: Upload GCC HC or KSAKID HC spreadsheets to auto-map hierarchy links.",
                    "Cascading Selectors: When manually adding or editing a user, selecting a TL automatically updates their Team, SM, and SD. Selecting a Team Name automatically maps its TL and upper managers."
                ]
            }
        ] : [
            {
                icon: <Play className="w-5 h-5 text-desert-gold" />,
                title: "1. Learning Hub & Interactive AI Player",
                desc: "Browse excellent sales call records inside the Learning Hub:",
                bullets: [
                    "Category Filtering: Filter by tags like 'Today Recommend', 'Uncompleted', 'In Progress' to find proper contents.",
                    "Three-language Transcripts: Shows parallel time-coded subtitles in Arabic (source audio), Chinese, and English.",
                    "Interactive Subtitles: Click any subtitle line to jump the audio player directly to that timestamp. Extremely useful for mimicry and training."
                ]
            },
            {
                icon: <Award className="w-5 h-5 text-desert-gold" />,
                title: "2. Study Check-in & Graduation Certificates",
                desc: "Obtain digital certifications upon completing recording studies:",
                bullets: [
                    "Study Requirement: Reach 100% audio progress and enter your notes / feedback.",
                    "Submit Check-in: Click 'Submit & Check-in' to record your learning log.",
                    "Download Certificate: System generates a personalized certificate with your name, date, and seal. Save it as a high-definition image to your photo gallery."
                ]
            },
            {
                icon: <CheckSquare className="w-5 h-5 text-desert-gold" />,
                title: "3. Assigned Tasks & Challenge Campaigns",
                desc: "Participate in learning assignments assigned by your managers:",
                bullets: [
                    "Team Tasks: Review deadline-driven tasks with countdowns. Complete studies and submit notes before deadlines.",
                    "Challenge Campaigns: Enter special challenge packs. Complete all specified recordings to unlock senior challenge certifications."
                ]
            },
            {
                icon: <FileText className="w-5 h-5 text-desert-gold" />,
                title: "4. Operation Policies & App Downloads",
                desc: "Review company rules and download mobile clients:",
                bullets: [
                    "Policies Showcase: Review the latest basic compensation rules (基本法) and commission PDFs with pinch-to-zoom.",
                    "App Download: Scan the QR code to install the APK (Android) or TestFlight configuration (iOS) for background playing and notification pushes."
                ]
            }
        ]
    };

    // Arabic content
    const arContent = {
        title: "دليل مستخدم المنصة",
        subtitle: isLeader ? "النسخة الخاصة بالمشرفين والمديرين" : "النسخة الخاصة بالموظفين ومستشاري المبيعات (CC)",
        badge: isLeader ? "نسخة المشرف (Leader)" : "نسخة الموظف (User)",
        sections: isLeader ? [
            {
                icon: <Award className="w-5 h-5 text-desert-gold" />,
                title: "1. متابعة تقدم الفريق في الوقت الفعلي",
                desc: "انقر على زر 'متابعة تقدم الفريق' (أيقونة المستخدمين) في أي بطاقة تسجيل لمتابعة التعلم:",
                bullets: [
                    "التدرج الهيكلي: يتم توسيع شجرة المتابعة تلقائياً (SD -> SM -> TL -> User) بناءً على مستواك الإداري.",
                    "حالة الاكتمال: عرض قائمة الأعضاء المكتملين وتفاصيل حضورهم، ونسبة الاستماع للأعضاء غير المكتملين.",
                    "تذكيرات FCM: انقر على زر 'إرسال تذكير' لإرسال إشعار فوري وعاجل إلى تطبيق الهاتف الخاص بالموظف."
                ]
            },
            {
                icon: <CheckSquare className="w-5 h-5 text-desert-gold" />,
                title: "2. إنشاء وتعيين مهام الفريق",
                desc: "انتقل إلى علامة التبويب 'مهام الفريق' وانقر على 'مهمة جديدة' لتعيين متطلبات تعلم محددة بوقت:",
                bullets: [
                    "اختيار التسجيلات: اختر تسجيلاً واحداً أو أكثر من قاعدة البيانات.",
                    "المستهدفون: حدد قادة المجموعات الفرعيين أو وكلاء المبيعات المباشرين الخاضعين لإدارتك.",
                    "تحديد الموعد النهائي: حدد تاريخ ووقت الموعد النهائي في المستقبل بدقة.",
                    "إشعارات التطبيق: بمجرد الإنشاء، يرسل النظام إشعارات فورية للتطبيق لجميع المعينين."
                ]
            },
            {
                icon: <FileText className="w-5 h-5 text-desert-gold" />,
                title: "3. نشر ومتابعة حملات التحدي",
                desc: "انتقل إلى 'التحديات الحصرية' في صفحة المهام لنشر برامج تدريبية متكاملة بشهادات مخصصة:",
                bullets: [
                    "حزمة التسجيلات: حدد عدة تسجيلات كشروط مسبقة لاجتياز التحدي.",
                    "نطاق الاستهداف: قيد الجمهور المستهدف بأقسام معينة (مثل CC Sales) أو مناصب محددة.",
                    "تخصيص الشهادة: صمم الشهادة مع معاينة فورية للنصوص والأوسمة والأختام عبر شاشة المعاينة.",
                    "لوحة تحكم التحدي: تابع حالة الاجتياز، وصدر الشهادات للناجحين، وراقب أشرطة تقدم الموظفين قيد الإنجاز."
                ]
            },
            {
                icon: <Play className="w-5 h-5 text-desert-gold" />,
                title: "4. رفع الصوت وتعديل الترجمة بالذكاء الاصطناعي",
                desc: "يمكن للمستخدمين الحاصلين على صلاحية `manageRecordings` إدارة أصول التعلم في لوحة التحكم الإدارية:",
                bullets: [
                    "النسخ والترجمة الآلية: يحول كلام التسجيل باللغة العربية إلى نصوص مكتوبة ويولد ترجمة متوازية بالصينية والإنجليزية.",
                    "محرر النصوص: عدل أخطاء النسخ أو الترجمة مباشرة داخل لوحة الإدارة لتنعكس على المستخدمين فوراً."
                ]
            },
            {
                icon: <ShieldAlert className="w-5 h-5 text-desert-gold" />,
                title: "5. مزامنة الدليل والربط التلقائي المتتالي",
                desc: "مصمم للحفاظ على نظافة شجرة البيانات الإدارية ومنع أخطاء الإدخال اليدوي:",
                bullets: [
                    "استيراد إكسل: ارفع جداول GCC HC أو KSAKID HC لربط الهيكل الإداري تلقائياً.",
                    "قوائم الاختيار المتتالية: عند إضافة أو تعديل مستخدم يدوياً، فإن اختيار قائد الفريق (TL) يحدث تلقائياً فريقه (Team) ومديره (SM) ومدير المبيعات (SD)."
                ]
            }
        ] : [
            {
                icon: <Play className="w-5 h-5 text-desert-gold" />,
                title: "1. ساحة التعلم ومشغل الذكاء الاصطناعي التفاعلي",
                desc: "تصفح تسجيلات المكالمات المتميزة داخل ساحة التعلم:",
                bullets: [
                    "تصفية الفئات: فرز المحتوى حسب تصنيفات مثل 'موصى به اليوم'، 'غير مكتمل'، 'قيد الدراسة' للعثور على المحتوى المناسب.",
                    "ترجمة النصوص بثلاث لغات: يعرض نصوصاً متزامنة مع الصوت باللغة العربية والإنجليزية والصينية.",
                    "الترجمة التفاعلية: انقر على أي سطر نصي للانتقال بالصوت مباشرة إلى ذلك التوقيت. ممتاز لمحاكاة المكالمات والتدريب."
                ]
            },
            {
                icon: <Award className="w-5 h-5 text-desert-gold" />,
                title: "2. تسجيل حضور التعلم وحفظ شهادة التخرج",
                desc: "احصل على شهادات رقمية عند إتمام دراسة التسجيلات:",
                bullets: [
                    "شروط التعلم: استمع للصوت بنسبة 100% ثم ادخل ملاحظاتك وملاحظاتك الدراسية.",
                    "تسجيل الحضور: انقر على زر 'إرسال وتسجيل الحضور' لحفظ سجل التعلم الخاص بك.",
                    "تحميل الشهادة: يولد النظام شهادة تخرج تحمل اسمك وتاريخ اليوم والختم. احفظها كصورة عالية الدقة في جهازك."
                ]
            },
            {
                icon: <CheckSquare className="w-5 h-5 text-desert-gold" />,
                title: "3. المهام المعينة وحملات التحدي",
                desc: "شارك في التعيينات التدريبية المرسلة من قبل مدرائك:",
                bullets: [
                    "مهام الفريق: راجع المهام المحددة بمواعيد نهائية مع العد التنازلي. أكمل الدراسة وقدم الملاحظات قبل انتهاء الموعد.",
                    "حملات التحدي: ادخل حزم التحديات الخاصة. أكمل جميع التسجيلات المطلوبة لفتح شهادات التحدي المتقدمة."
                ]
            },
            {
                icon: <FileText className="w-5 h-5 text-desert-gold" />,
                title: "4. السياسات واللوائح وتحميل التطبيق",
                desc: "راجع قواعد الشركة وحمل تطبيق الهاتف المحمول:",
                bullets: [
                    "اللوائح والسياسات: راجع أحدث لوائح الرواتب والعمولات بصيغة PDF مع إمكانية التكبير والتصغير.",
                    "تحميل التطبيق: امسح رمز الاستجابة السريعة (QR) لتحميل التطبيق لنظام Android أو iOS للاستماع في الخلفية وتلقي إشعارات المهام."
                ]
            }
        ]
    };

    const content = i18n.language === 'zh' ? zhContent : (isAr ? arContent : enContent);

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex justify-center items-center p-4 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col my-8 max-h-[85vh] border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className={`flex justify-between items-center p-6 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 ${isAr ? 'flex-row-reverse' : ''}`}>
                    <div className={`flex items-center gap-3 ${isAr ? 'flex-row-reverse text-right' : ''}`}>
                        <div className="p-3 bg-deep-teal/10 rounded-2xl text-deep-teal shrink-0">
                            <BookOpen className="w-6 h-6 text-desert-gold" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">{content.title}</h3>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-0.5">{content.subtitle}</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
                    
                    {/* Role Chip */}
                    <div className={`flex ${isAr ? 'justify-end' : 'justify-start'}`}>
                        <span className="text-[10px] font-black text-desert-gold uppercase bg-desert-gold/10 px-3 py-1 rounded-full border border-desert-gold/20 tracking-wider">
                            🛡️ {content.badge}
                        </span>
                    </div>

                    {/* Sections */}
                    <div className="space-y-6">
                        {content.sections.map((section, idx) => (
                            <div 
                                key={idx} 
                                className={`p-5 rounded-2xl bg-gray-50/40 dark:bg-slate-850 border border-gray-100 dark:border-slate-800 flex gap-4 transition-all hover:shadow-sm ${
                                    isAr ? 'flex-row-reverse text-right' : ''
                                }`}
                            >
                                <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-sm self-start shrink-0 text-desert-gold">
                                    {section.icon}
                                </div>
                                <div className="space-y-2 flex-1 min-w-0">
                                    <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-base">{section.title}</h4>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">{section.desc}</p>
                                    <ul className={`space-y-1.5 list-none pl-0 mt-2 text-xs font-semibold text-slate-600 dark:text-slate-400 leading-relaxed`}>
                                        {section.bullets.map((bullet, bIdx) => (
                                            <li 
                                                key={bIdx} 
                                                className={`flex gap-2 items-start ${isAr ? 'flex-row-reverse text-right' : ''}`}
                                            >
                                                <span className="text-desert-gold shrink-0 mt-0.5">▪</span>
                                                <span className="flex-1 min-w-0">{bullet}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className={`p-5 border-t border-gray-100 dark:border-slate-800 bg-gray-50/30 dark:bg-slate-900/30 flex justify-end`}>
                    <button 
                        onClick={onClose}
                        className="px-6 py-2.5 bg-deep-teal hover:bg-teal-700 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer"
                    >
                        {t('common.cancel', 'Close')}
                    </button>
                </div>
            </div>
        </div>
    );
}
