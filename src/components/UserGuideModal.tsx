import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, BookOpen, ShieldAlert, Award, FileText, CheckSquare, Play, HelpCircle, Users, Sparkles, Share2 } from 'lucide-react';

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
        title: "MECC 平台完整使用说明书",
        subtitle: isLeader ? "主管与领航学员专属版" : "普通销售顾问 (CC) 版",
        badge: isLeader ? "主管版 (Leader)" : "员工版 (User)",
        sections: isLeader ? [
            {
                icon: <Users className="w-5 h-5 text-desert-gold" />,
                title: "1. 团队进度穿透追踪与一键催办",
                desc: "您可以在“学习广场”的任意录音卡片上，点击“查看团队进度” (Users 图标) 按钮：",
                bullets: [
                    "组织架构下钻：系统会根据您的行政级别（总监/经理/组长）自动展开对应的下属树状结构，支持多层折叠与展开。",
                    "已学与未学分类：清晰显示已打卡组员名单、心得字数，以及未学组员的当前收听百分比（如已听 85%）。",
                    "一键加急催办：点击未学组员旁的“一键催办”，可瞬间触发 FCM 云消息推送通知至组员的手机 App，实现精准督促。"
                ]
            },
            {
                icon: <CheckSquare className="w-5 h-5 text-desert-gold" />,
                title: "2. 新建、编辑与指派限时学习任务",
                desc: "前往“团队任务”页面，点击“新建任务”，即可对管辖团队分发强制限时学习：",
                bullets: [
                    "自由打包录音：支持从录音库选择一门或多门录音文件作为任务内容。",
                    "选定指派对象：在您的管辖范围内，一键全选或多选普通组员及下级主管。",
                    "设定精准截止时间 (Deadline)：指派后系统将开启倒计时，并在临近截止前通过 App 消息对组员发送补课提醒。"
                ]
            },
            {
                icon: <Award className="w-5 h-5 text-desert-gold" />,
                title: "3. 专属挑战包发布与证书模板在线定制",
                desc: "在任务页面切换至“专属挑战”，可以针对特定受众发布系列课程挑战包：",
                bullets: [
                    "多音频打包：打包多门核心案例录音（如 First Call 五大经典音频）作为通关门槛。",
                    "证书 Canvas 实时预览：独家集成了在线证书定制面板。在发布弹窗中，您可以编辑证书标题、寄语，并自由选择印章和挂件，右侧会实时通过 Canvas 渲染出最终证书图片供您预览。",
                    "通关大盘监控：达标看板可实时展示已通关名单，以及未通关组员的动态学习进度条（如已学 2/5），便于主管开展补课跟进。"
                ]
            },
            {
                icon: <Sparkles className="w-5 h-5 text-desert-gold" />,
                title: "4. 领航学员双重身份（主管模范学习）",
                desc: "主管也是学员！在平台中，您作为“领航学员”也深度参与学习：",
                bullets: [
                    "主管模范学习：支持组长、经理与总监在线学习金牌案例并提交打卡，积累个人的学时与连击。",
                    "领航大盘排行榜：在管理后台提供主管专属排行榜，展示不同小组主管之间的学习热度，供高层评估带头学习效果。"
                ]
            },
            {
                icon: <Play className="w-5 h-5 text-desert-gold" />,
                title: "5. 录音上传与 AI 字幕编辑器",
                desc: "如果您拥有录音管理权限，可以在后台管理平台音频资产：",
                bullets: [
                    "AI 语音转写翻译：支持上传 MP3/WAV 格式，AI 会自动识别阿语语音并生成中文、英文平行字幕。",
                    "字幕微调编辑器：若 AI 翻译有个别语境偏差，可点击“编辑字幕”打开时间轴编辑器直接修改，全网学员端即刻同步生效。"
                ]
            },
            {
                icon: <ShieldAlert className="w-5 h-5 text-desert-gold" />,
                title: "6. 人力架构同步与级联锁定机制",
                desc: "保障组织架构数据准确，杜绝输入失误：",
                bullets: [
                    "Excel 批量同步：支持管理员批量导入 GCC HC 或 KSAKID HC 人员表，系统自动解析并重组汇报线。",
                    "级联联动互锁：在手动添加/修改用户时，选择 TL 会自动更新并锁定其所属的 Team、SM 和 SD；选择 Team Name 也会自动联动回填对应的 TL 及经理，杜绝脏数据。"
                ]
            }
        ] : [
            {
                icon: <Play className="w-5 h-5 text-desert-gold" />,
                title: "1. 学习广场与 AI 交互播放器",
                desc: "查阅公司金牌销售案例，体验三语对照播放：",
                bullets: [
                    "多语字幕对照：提供 AI 智能切分的阿拉伯语（原音）、中文及英文对照字幕，支持高亮和行内字幕内检索。",
                    "字幕点击跳转 (Interactive Subtitles)：点击任意一行字幕文本，音频播放器会**自动跳转到该句原音时刻**进行播放。非常适合跟读和模仿黄金话术。"
                ]
            },
            {
                icon: <FileText className="w-5 h-5 text-desert-gold" />,
                title: "2. 配套讲义课件推送与双栏对照预览",
                desc: "除听音外，您还可以无缝学习配套素材：",
                bullets: [
                    "含课件标志：带有“含课件”的录音文件，包含由培训部门上传的配套讲义课件（支持 PDF, PPT, Doc, ZIP，上限 50MB）。",
                    "分栏对照阅读：进入播放详情页时，右侧会自动嵌入配套课件渲染器。您可以在线滑动、手势缩放阅读 PDF/PPT 讲义，实现“听录音、看课件”双栏对照学习。"
                ]
            },
            {
                icon: <Award className="w-5 h-5 text-desert-gold" />,
                title: "3. 宝藏猎人荣誉机制（每日连击与沙海寻宝）",
                desc: "深度游戏化寻宝机制，获取 51Talk 官方结业认证：",
                bullets: [
                    "每日咖啡连击：每天收听任一音频打卡即可连击今日打卡，最高积累 7 天咖啡连击。",
                    "沙海寻宝路线：自动计算您的累计学习时长（分钟），推进您的沙漠寻宝进度。打卡率和学时达标即可解锁更高称号（寻宝新手 $\rightarrow$ 沙漠追踪者 $\rightarrow$ 佩特拉开拓者 $\rightarrow$ 精英猎人 $\rightarrow$ 宝库传奇）。",
                    "官方结业证书：达成等级即可点击领取证书，支持一键渲染为带有您 CRM 名字和 Najah 学院印章的高清图片保存至相册。"
                ]
            },
            {
                icon: <Users className="w-5 h-5 text-desert-gold" />,
                title: "4. 团队学习大盘 (Team Hub)",
                desc: "在您的个人中心下方，集成有同伴学习大盘 (Team Hub)：",
                bullets: [
                    "组内竞争排行：实时展示您所在小组内部所有组员的咖啡连击天数、当前荣誉等级和累计学时排行。",
                    "激发学习热情：通过同伴榜样作用，激发大家追赶超越的自发学习热情。"
                ]
            },
            {
                icon: <CheckSquare className="w-5 h-5 text-desert-gold" />,
                title: "5. 指派任务、专项挑战与基本法查阅",
                desc: "跟进必学内容，查阅最新政策：",
                bullets: [
                    "必修任务与倒计时：在列表查阅主管下发的限时必修任务，请在截止倒计时结束前听完并提交打卡心得。",
                    "政策基本法：在“政策与激励”以及“品牌专栏”中，支持在线阅读提成制度和运营基本法 PDF 文档。"
                ]
            },
            {
                icon: <Share2 className="w-5 h-5 text-desert-gold" />,
                title: "6. 内推推广与共享素材中心 (Referrals)",
                desc: "专为推荐人（CC 推荐新员工）开发的话术与海报中心：",
                bullets: [
                    "物料多级分类：提供多级目录，涵盖“高额奖励佣金”、“公司介绍”、“福利合集”等主题。",
                    "一键复制与预览：支持在线收听宣导音频、播放宣导视频、下载海报图片，并可一键复制文案话术，方便您分享至微信或 WhatsApp 发送给受众。"
                ]
            }
        ]
    };

    // English content
    const enContent = {
        title: "MECC Complete Product User Guide",
        subtitle: isLeader ? "Exclusive Version for Leaders & Navigators" : "Version for Sales Advisors (CC)",
        badge: isLeader ? "Leader Edition" : "User Edition",
        sections: isLeader ? [
            {
                icon: <Users className="w-5 h-5 text-desert-gold" />,
                title: "1. Cascading Team Progress & One-Click FCM Reminders",
                desc: "Click 'View Team Progress' (Users icon) on any recording card in the Plaza:",
                bullets: [
                    "Organizational Deep-Dive: Automatically expands the member list (SD -> SM -> TL -> CC) according to your authority tier.",
                    "Status Classification: View completed users with check-in details and uncompleted users with real-time listening progress (e.g. 85%).",
                    "FCM Pushes: Click 'Send Reminder' to instantly trigger an push alert to the user's mobile app."
                ]
            },
            {
                icon: <CheckSquare className="w-5 h-5 text-desert-gold" />,
                title: "2. Create, Edit & Assign Team Tasks",
                desc: "Go to the 'Team Tasks' tab and click 'New Task' to assign learning requirements:",
                bullets: [
                    "Recordings Selection: Select one or multiple recordings as task contents.",
                    "Assignees: Bulk check or single check members within your organizational jurisdiction.",
                    "Deadline Tracking: Set deadline date/time. The system initiates a countdown and pushes warning alerts before expiry."
                ]
            },
            {
                icon: <Award className="w-5 h-5 text-desert-gold" />,
                title: "3. Publish Campaigns & Customize Canvas Certificates",
                desc: "Switch to 'Exclusive Challenges' to deploy advanced campaigns for target users:",
                bullets: [
                    "Bundled Prerequisite: Combine multiple target recordings (e.g., First Call Essentials) as clearance criteria.",
                    "Live Certificate Previewer: Features a built-in Canvas editor. Modify titles, slogans, badges, and seals with a real-time layout preview on the right.",
                    "Progress Monitor: Track qualifiers and review pending users with progressive completion bars (e.g. 2/5)."
                ]
            },
            {
                icon: <Sparkles className="w-5 h-5 text-desert-gold" />,
                title: "4. Leader Academy & Leadership Learning Leaderboard",
                desc: "Leaders are students too! Leaders actively participate in studies to set examples:",
                bullets: [
                    "Model Learning: Leaders listen to recordings, write feedback logs, and maintain daily coffee streaks.",
                    "Leadership Board: Provides a dedicated board in the admin dashboard showing studies among managers to evaluate the academic index."
                ]
            },
            {
                icon: <Play className="w-5 h-5 text-desert-gold" />,
                title: "5. Audio Upload & AI Subtitle Micro-Editing",
                desc: "Upload and optimize learning audio files in the admin dashboard:",
                bullets: [
                    "AI Transcription & Translation: Automatically transcribes Arabic voice clips and generates matching EN/ZH translations.",
                    "Micro-Editor: Edit time-coded transcript lines directly inside the admin panel. Updates are synchronized globally instantly."
                ]
            },
            {
                icon: <ShieldAlert className="w-5 h-5 text-desert-gold" />,
                title: "6. Directory Sync & Cascading Auto-Linkage",
                desc: "Designed to keep organizational tree data clean and prevent database mistakes:",
                bullets: [
                    "Excel Sync: Upload GCC HC or KSAKID HC spreadsheets to auto-map reporting relations.",
                    "Mutual Constraint: Selecting a TL updates and locks their Team, SM, and SD. Selecting a Team Name auto-fills its TL and upper managers."
                ]
            }
        ] : [
            {
                icon: <Play className="w-5 h-5 text-desert-gold" />,
                title: "1. Learning Hub & Interactive AI Player",
                desc: "Listen to gold standard calls with time-synced scripts:",
                bullets: [
                    "Multi-language Scripts: Shows time-synced transcripts in Arabic (audio), Chinese, and English.",
                    "Interactive Jump: Click any subtitle line to jump the audio player directly to that timestamp. Great for verbal mimicking and training."
                ]
            },
            {
                icon: <FileText className="w-5 h-5 text-desert-gold" />,
                title: "2. Supplementary Material Push & Side-by-Side Slides",
                desc: "Review accompanying slides without leaving the player:",
                bullets: [
                    "Attachments Badge: Cards with the 'Slides Included' label contain slides (PPT, PDF, ZIP up to 50MB).",
                    "Dual-Screen Layout: The player embeds an inline document renderer on the right. Slide through pages or zoom in on PPT/PDF sheets directly."
                ]
            },
            {
                icon: <Award className="w-5 h-5 text-desert-gold" />,
                title: "3. Treasure Hunter Incentive Scheme (Streaks & Levels)",
                desc: "Gamified learning journey with 51Talk Najah certifications:",
                bullets: [
                    "Daily Coffee Streak: Complete daily studies to build streak numbers (up to 7 days).",
                    "Caravan Journey Progress: Accumulate study minutes to advance along a desert map. Unlock titles: Apprentice -> Voyager -> Knight -> Falcon -> Guardian.",
                    "Personal Certificates: Lock in titles to claim certificates. Renders as a PNG photo with your name and the Najah Academy seal."
                ]
            },
            {
                icon: <Users className="w-5 h-5 text-desert-gold" />,
                title: "4. Team Learning Hub (Team Hub)",
                desc: "Review mutual study statuses under Team Hub section in your Account page:",
                bullets: [
                    "Intra-group Leaderboard: Displays coffee streaks, hunter levels, and cumulative study minutes of members in your group.",
                    "Social Competition: Motivates self-learning through peer comparison and visibility."
                ]
            },
            {
                icon: <CheckSquare className="w-5 h-5 text-desert-gold" />,
                title: "5. Task Check-ins, Campaigns & Policy basic rules",
                desc: "Follow mandatory learning requirements and review policy documents:",
                bullets: [
                    "Assigned Tasks: Track tasks with deadline count-downs. Complete studies and submit check-ins before expiry.",
                    "Policies & Brands: Access and review commission rules or compensation basic PDFs with pinch-to-zoom."
                ]
            },
            {
                icon: <Share2 className="w-5 h-5 text-desert-gold" />,
                title: "6. Referrals Promotion & Sharing Materials Library",
                desc: "A sharing asset center designed to support CCs in recruiting new team members:",
                bullets: [
                    "Categorized Resources: Browse categorized folders like 'Bonus Schemes', '福利介绍', '员工故事'.",
                    "Copy-paste & Preview: Listen to audios, play videos, preview images, and copy preset text templates to share to WeChat/WhatsApp."
                ]
            }
        ]
    };

    // Arabic content
    const arContent = {
        title: "دليل مستخدم منصة MECC الشامل",
        subtitle: isLeader ? "النسخة الخاصة بالمشرفين والمديرين" : "النسخة الخاصة بالموظفين ومستشاري المبيعات (CC)",
        badge: isLeader ? "نسخة المشرف (Leader)" : "نسخة الموظف (User)",
        sections: isLeader ? [
            {
                icon: <Users className="w-5 h-5 text-desert-gold" />,
                title: "1. متابعة تقدم الفريق وإرسال إشعارات التذكير الفورية",
                desc: "انقر على زر 'متابعة تقدم الفريق' (أيقونة المستخدمين) في أي بطاقة تسجيل لمتابعة التعلم:",
                bullets: [
                    "التدرج الهيكلي: يتم توسيع شجرة المتابعة تلقائياً (SD -> SM -> TL -> CC) بناءً على مستواك الإداري.",
                    "حالة الاكتمال: عرض قائمة الأعضاء المكتملين وتفاصيل حضورهم، ونسبة الاستماع للأعضاء غير المكتملين (مثال: 85%).",
                    "تذكيرات FCM: انقر على زر 'إرسال تذكير' لإرسال إشعار فوري وعاجل إلى تطبيق الهاتف الخاص بالموظف."
                ]
            },
            {
                icon: <CheckSquare className="w-5 h-5 text-desert-gold" />,
                title: "2. إنشاء وتعيين مهام الفريق وتعديلها",
                desc: "انتقل إلى علامة التبويب 'مهام الفريق' وانقر على 'مهمة جديدة' لتعيين متطلبات تعلم محددة بوقت:",
                bullets: [
                    "اختيار التسجيلات: اختر تسجيلاً واحداً أو أكثر كشروط مسبقة للتعلم.",
                    "المستهدفون: حدد قادة المجموعات الفرعيين أو وكلاء المبيعات المباشرين الخاضعين لإدارتك.",
                    "تحديد الموعد النهائي: حدد تاريخ ووقت الموعد النهائي. سيبدأ النظام بالعد التنازلي وإرسال تذكيرات قبل انتهاء الوقت."
                ]
            },
            {
                icon: <Award className="w-5 h-5 text-desert-gold" />,
                title: "3. نشر حملات التحدي وتخصيص الشهادات التفاعلية",
                desc: "انتقل إلى 'التحديات الحصرية' في صفحة المهام لنشر برامج تدريبية متكاملة بشهادات مخصصة:",
                bullets: [
                    "حزمة التسجيلات: حدد عدة تسجيلات كشروط مسبقة لاجتياز التحدي.",
                    "معاينة الشهادة فورياً: مصمم بمحرر ذكي مدمج عبر Canvas. عدل العناوين والشعارات والأختام مع عرض فوري للشهادة على اليمين.",
                    "لوحة تحكم التحدي: تابع حالة الاجتياز، وصدر الشهادات للناجحين، وراقب أشرطة تقدم الموظفين قيد الإنجاز (مثل: 2/5)."
                ]
            },
            {
                icon: <Sparkles className="w-5 h-5 text-desert-gold" />,
                title: "4. أكاديمية المشرفين ولوحة صدارة المدراء",
                desc: "المشرفون هم طلاب أيضاً! يشاركون بفعالية في عمليات التعلم لتقديم نموذج يحتذى به:",
                bullets: [
                    "التعلم النموذجي: يستمع المشرفون للتسجيلات، ويكتبون ملاحظاتهم الدراسية، ويحافظون على连击 القهوة اليومية.",
                    "لوحة الصدارة للمدراء: توفر لوحة خاصة في لوحة التحكم الإدارية لمتابعة دراسات المدراء وتقييم النشاط التدريبي."
                ]
            },
            {
                icon: <Play className="w-5 h-5 text-desert-gold" />,
                title: "5. رفع الصوت وتعديل الترجمة بالذكاء الاصطناعي",
                desc: "يمكن للمستخدمين الحاصلين على صلاحية إدارة التسجيلات إدارة أصول التعلم في لوحة التحكم الإدارية:",
                bullets: [
                    "النسخ والترجمة الآلية: يحول كلام التسجيل باللغة العربية إلى نصوص مكتوبة ويولد ترجمة متوازية بالصينية والإنجليزية.",
                    "محرر النصوص: عدل أخطاء النسخ أو الترجمة مباشرة داخل لوحة الإدارة لتنعكس على المستخدمين فوراً."
                ]
            },
            {
                icon: <ShieldAlert className="w-5 h-5 text-desert-gold" />,
                title: "6. مزامنة الدليل والربط التلقائي المتتالي",
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
                    "ترجمة النصوص بثلاث لغات: يعرض نصوصاً متزامنة مع الصوت باللغة العربية والإنجليزية والصينية.",
                    "الترجمة التفاعلية: انقر على أي سطر نصي للانتقال بالصوت مباشرة إلى ذلك التوقيت. ممتاز لمحاكاة المكالمات والتدريب."
                ]
            },
            {
                icon: <FileText className="w-5 h-5 text-desert-gold" />,
                title: "2. المرفقات الدراسية وعرض الشرائح المتوازي",
                desc: "راجع الشرائح والملاحظات المصاحبة للصوت دون مغادرة المشغل:",
                bullets: [
                    "شارة المرفقات: البطاقات التي تحمل شارة 'تتضمن كورس' تحتوي على ملفات تكميلية (PDF, PPT, ZIP حتى 50 ميجابايت).",
                    "تصميم شاشة مزدوجة: يتضمن المشغل قارئ مستندات مدمج على اليمين لتصفح مستندات الـ PDF أو شرائح الـ PPT مباشرة."
                ]
            },
            {
                icon: <Award className="w-5 h-5 text-desert-gold" />,
                title: "3. نظام مكافآت صائدي الكنز (الاستمرار والمستويات)",
                desc: "رحلة تعلم ممتعة بشهادات معتمدة من أكاديمية Najah التابعة لـ 51Talk:",
                bullets: [
                    "الاستمرار اليومي بالقهوة: استمع يومياً لبناء سلسلة استمرار (حتى 7 أيام).",
                    "رحلة صيد الكنز: يحسب دقائق دراستك لتقدمك على خارطة الصحراء. افتح ألقاباً: مبتدئ -> مستكشف -> فارس -> قناص النخبة -> أسطورة الخزنة.",
                    "شهادات شخصية: احصل على شهادة التخرج وقم بتحميلها كصورة عالية الدقة PNG تحمل اسمك وختم الأكاديمية."
                ]
            },
            {
                icon: <Users className="w-5 h-5 text-desert-gold" />,
                title: "4. لوحة مكافآت الفريق (Team Hub)",
                desc: "راجع حالة التعلم لأعضاء فريقك عبر قسم Team Hub في صفحتك الشخصية:",
                bullets: [
                    "لوحة صدارة المجموعة: تعرض الاستمرار اليومي، ومستويات الصيد، ودقائق الدراسة التراكمية لأعضاء مجموعتك.",
                    "المنافسة الاجتماعية: تحفيز التعلم الذاتي من خلال مقارنة النشاط مع الزملاء بوضوح."
                ]
            },
            {
                icon: <CheckSquare className="w-5 h-5 text-desert-gold" />,
                title: "5. المهام التدريبية وحملات التحدي ولوائح السياسات",
                desc: "تابع متطلبات التعلم الإلزامية وراجع وثائق السياسات واللوائح:",
                bullets: [
                    "المهام المعينة: راجع المهام المحددة بمواعيد نهائية مع العد التنازلي. أكمل الدراسة وقدم الملاحظات قبل انتهاء الموعد.",
                    "اللوائح والسياسات: راجع أحدث لوائح الرواتب والعمولات بصيغة PDF مع إمكانية التكبير والتصغير."
                ]
            },
            {
                icon: <Share2 className="w-5 h-5 text-desert-gold" />,
                title: "6. الترويج الداخلي ومركز مواد المشاركة (Referrals)",
                desc: "مركز لمواد المشاركة تم تصميمه لدعم موظفي المبيعات في ترشيح موظفين جدد:",
                bullets: [
                    "المواد المصنفة: تصفح مجلدات مثل 'لوائح العمولات'، 'مزايا الشركة'، 'قصص النجاح'.",
                    "نسخ وعرض المواد: استمع للصوت، شغل الفيديو، اعاين الصور، وانسخ قوالب النصوص للمشاركة عبر الـ WhatsApp."
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
