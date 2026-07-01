import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
    X, BookOpen, ShieldAlert, Award, FileText, CheckSquare, 
    Play, Users, Sparkles, Share2, Smartphone, Search, Database, Lock, Shield 
} from 'lucide-react';

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
                title: "1. 团队进度穿透追踪折叠树与一键催办",
                desc: "在“学习广场”的任意录音卡片上，点击“查看团队进度” (Users 图标) 按钮：",
                bullets: [
                    "多级组织下钻折叠树：系统根据您的行政级别（总监/经理/组长）自动展示下级树状汇报线（SD → SM → TL → CC）。支持多级展开与折叠，层层透视。",
                    "精确学习进度：列表清晰划分为“已学”（展示打卡心得、时间及证书）与“未学”（显示精确到个位数的当前收听百分比，如已听 78%）。",
                    "一键加急催办 (FCM Push)：针对未学完的员工，主管点击人名旁的“催办”图标，即可瞬间向组员的手机 App 推送一条加急横幅系统通知，实现精准督促。"
                ]
            },
            {
                icon: <CheckSquare className="w-5 h-5 text-desert-gold" />,
                title: "2. 任务中心与新CC专区指派（含智能全选与极速通知）",
                desc: "主管拥有指派限时任务的权限，支持普通任务与新CC专区任务：",
                bullets: [
                    "任务类型双轨制：支持发布“普通学习任务”及“新人专区学习任务” (New CC Zone)。",
                    "智能一键全选：指派新人专区任务时，系统支持按分类或全部一键自动勾选对应的所有新人专区录音，免去逐个勾选的繁琐操作。",
                    "推送与消息联动：设定截止日期后，系统会自动向组员发送通知，并在截止前 2 小时通过 FCM 推送补课提醒；发布新人任务时还会自动提醒新人学员。",
                    "毕业证书联动：学员在完成新人专区指派的任务后，系统会自动为该学员解锁专属的新CC毕业证书，学员可直接下载和分享。"
                ]
            },
            {
                icon: <Award className="w-5 h-5 text-desert-gold" />,
                title: "3. 专属挑战包部署与 Canvas 证书在线实时定制",
                desc: "在“团队任务”页面切换至“专属挑战”，可以针对特定受众发布打包系列课程挑战包：",
                bullets: [
                    "打包特训课程：将多门性质类似的金牌案例（如 5 门破冰录音）打包为一个通关挑战，设定为结业门槛。",
                    "Live 证书定制面板 (Live Canvas Certificate Previewer)：独家集成在线 Canvas 证书定制。您可以自定义修改证书的主标题（如‘First Call 通关先锋’）、副标题、结业寄语，并右侧实时渲染 Canvas 证书图像，实现所见即所得的证书制作。",
                    "挑战状态大盘监控：通关看板实时呈现已通关名单，以及未通关顾问的动态收听进度条（如已通关 3/5 门课），便于主管逐一精准帮扶。"
                ]
            },
            {
                icon: <Sparkles className="w-5 h-5 text-desert-gold" />,
                title: "4. 领航学员双重身份（主管带头学习 PK 榜）",
                desc: "主管在平台中作为“领航学员”带头垂范学习，同样参与激励活动：",
                bullets: [
                    "主管模范学习：支持组长、经理与总监在线学习并打卡，同样积累个人的每日咖啡连击、学时与 Najah 结业证书。",
                    "领航大盘排行榜：在后台管理面板中，所有主管的个人学习时长和每日打卡连击将进行公开 PK 排行，供总监与高层评估主管带头垂范学习的效果。"
                ]
            },
            {
                icon: <Shield className="w-5 h-5 text-desert-gold" />,
                title: "5. 团队专属 Team Hub 自主运营权",
                desc: "销售经理 (SM) 可以对本组专属的学习空间进行精细化自主运营：",
                bullets: [
                    "团队资料独立隔离：SM 可在后台为本组 Team Hub 定向上传只供组内可见的客户金牌录音及培训文档，不同 SM 团队间相互隔离，确保敏感商业话术不泄露。",
                    "独立 Banner 位配置：SM 可以在后台上传团队专属的 Banner 轮播图，用以推送小组活动或金牌录音，实现对小组培训任务的流量汇聚。"
                ]
            },
            {
                icon: <Play className="w-5 h-5 text-desert-gold" />,
                title: "6. 录音管理与 AI 字幕时间轴微调编辑器",
                desc: "管理员可在后台高效维护音频资产，微调 AI 生成内容：",
                bullets: [
                    "AI 自动转写与翻译：支持上传 MP3/WAV 格式音频，系统云服务自动转写阿语发音，并生成阿、中、英三语平行字幕。",
                    "时间轴微调编辑器 (Subtitle Editor)：提供以表格行展示的字幕编辑器，管理员可随时手动修改 AI 转写中因中东口音或专业术语导致的偏差。保存后，全网学员端立即同步生效。"
                ]
            },
            {
                icon: <Database className="w-5 h-5 text-desert-gold" />,
                title: "7. 组织架构级联联动互锁安全机制",
                desc: "为防止手动输入错误导致汇报关系错乱，系统对组织架构数据实施联动保障：",
                bullets: [
                    "Excel 批量同步：支持管理员批量导入 GCC HC 或 KSAKID HC 标准组织架构表，系统自动解析并重组汇报线。",
                    "双向级联联动互锁 (Cascade Lock)：手动新增/修改用户时，选择 TL 会自动抓取其上级并自动填入并锁定 Team、SM 和 SD；修改 Team Name 也会自动联动回填 TL 及经理，严防脏数据。"
                ]
            },
            {
                icon: <Lock className="w-5 h-5 text-desert-gold" />,
                title: "8. RBAC 细粒度后台管理权限分配",
                desc: "避免过度授权，超级管理员可以通过后台对普通主管分配单项管理权限：",
                bullets: [
                    "管理标签化：包含 `manageUsers`（用户列表管理）、`manageTasks`（任务指派）、`manageReferrals`（内推管理）、`manageBanners`（轮播图配置）等标签。",
                    "权限最小化原则：仅允许授权经理操作特定管理板块，非授权板块直接隐藏，防止敏感操作外泄。"
                ]
            }
        ] : [
            {
                icon: <Smartphone className="w-5 h-5 text-desert-gold" />,
                title: "1. 登录域名智能补全与多语言 RTL 适配",
                desc: "为了简化您的操作并提供极致的本地化体验：",
                bullets: [
                    "免输入邮箱后缀：只需在登录界面输入您的 CRM 账号名（如 `serdah` 或 `wuchuan`），点击登录时系统将自动在后台补全为官方邮箱格式并安全认证，无需手动输入复杂的域名后缀。",
                    "多语言与自适应排版 (RTL)：支持中、英、阿三语一键热切换。当选择阿拉伯语时，系统将通过 Document 引擎将整个界面的排版方向转为从右向左（RTL）。文字、侧边菜单、输入框位置和动作方向都将自动完美调换，提供符合中东本地化使用习惯的操作界面。"
                ]
            },
            {
                icon: <Play className="w-5 h-5 text-desert-gold" />,
                title: "2. 学习广场与 AI 交互播放器（字幕点击跳跃）",
                desc: "查阅公司金牌销售案例，体验高科技三语对照播放：",
                bullets: [
                    "多语字幕对照：提供 AI 智能切分的阿拉伯语（原音）、中文及英文对照字幕，支持高亮和行内字幕文本检索。",
                    "字幕点击跳转 (Interactive Subtitles)：这是平台的最核心学习黑科技。点击任意一行字幕文本，音频播放器会自动**毫秒级精准跳跃到对应时间点**进行播放。非常适合跟读和模仿黄金话术。",
                    "学习状态四重过滤：支持“全部”、“未学习”、“进行中”、“已完成”快速切换，精准整理您的听课进度。"
                ]
            },
            {
                icon: <FileText className="w-5 h-5 text-desert-gold" />,
                title: "3. 配套讲义课件推送与双栏对照预览",
                desc: "听课的同时无缝阅读配套资料，无需跳转或额外下载：",
                bullets: [
                    "含课件徽章：在学习广场中，带有课件的录音文件均标有高亮“含课件”徽章（支持 PDF, PPT, Word, Excel, ZIP 等格式，最大 50MB）。",
                    "双栏分栏对照布局：进入播放详情页时，右侧会自动嵌入配套课件渲染器。您可以在线滑动、手势缩放阅读 PDF/PPT 讲义，实现“听录音、看课件”双栏对照学习，支持一键下载。"
                ]
            },
            {
                icon: <Award className="w-5 h-5 text-desert-gold" />,
                title: "4. 宝藏猎人荣誉机制（每日连击与沙海寻宝）",
                desc: "深度游戏化寻宝机制，获取 51Talk Najah 学院官方结业证书：",
                bullets: [
                    "每日咖啡连击 (Coffee Streak)：每天收听任意音频打卡，可累计 1 次连击（显示最多 7 天连击咖啡杯），中断学习则连击重置。",
                    "沙海寻宝里程碑：自动累计您的有效学习时长（分钟），在佩特拉古城寻宝路线中进阶（寻宝新手 → 沙漠追踪者 → 佩特拉开拓者 → 精英猎人 → 宝库传奇）。",
                    "官方结业证书：达成各称号后，点击可生成 Canvas 电子结业证书。证书自动融合您的 CRM 姓名、称号、日期与 Najah 官方红色实体钢印印章。支持一键保存至相册及 WhatsApp / WeChat 分享。"
                ]
            },
            {
                icon: <Users className="w-5 h-5 text-desert-gold" />,
                title: "5. 团队专属平台与 Team Hub (👥)",
                desc: "在学习广场，切换至“团队专属 (👥)”选项卡，即可进入您所属部门的专属学习空间：",
                bullets: [
                    "SM 定制学习空间：每个 SM (销售经理) 都可以拥有自己独立的空间来上传课程分类、定向推送专有材料及运营专属的轮播 Banner，打造团队独立的微型学习平台。",
                    "定向资料隔离：在该空间内，只能查阅和学习您所在的 SM 团队定向推送的课程、录音案例以及团队层级的激励政策，不受公共库干扰。"
                ]
            },
            {
                icon: <CheckSquare className="w-5 h-5 text-desert-gold" />,
                title: "6. 限时必修任务、新CC专区训练营与毕业证书联动",
                desc: "紧跟学习进度，挑战自我上限并获得毕业资格：",
                bullets: [
                    "必修任务红色倒计时：列表展示主管下发的高急迫必修课，带有截止日期倒计时，临期前 2 小时自动报警。常规任务要求收听 100% 音频并撰写不少于 100 字心得，通过后方可打卡。",
                    "新CC专区任务（50字低门槛）：新人学员被指派的“新人专区学习任务” (New CC Zone) 仅需撰写不少于 50 字的心得，降低新人起步门槛。",
                    "新CC毕业证书解锁：当您完成新人专区学习任务的所有录音并提交心得后，系统会亮起金色的“查看毕业证书”按钮，点击即可查看、定制并下载官方颁发的 New CC 毕业证书。",
                    "专属通关挑战 (Campaigns)：展示打包的主题通关包（如首单冲刺三部曲），学员能直观查看当前进度，全部完成后颁发专属挑战包结业证书。"
                ]
            },
            {
                icon: <Share2 className="w-5 h-5 text-desert-gold" />,
                title: "7. 政策激励与内推推广素材库 (Referral 共享中心)",
                desc: "随时查阅提成并进行内推分享，获取高额佣金：",
                bullets: [
                    "政策基本法：在“政策与激励”以及“品牌专栏”中，支持在线阅读提成制度和运营基本法 PDF 文档。",
                    "内推素材一键分享：内推专栏提供多级树状目录（福利介绍、佣金宣导等），支持一键复制文案话术、下载内推海报与音视频，通过 WhatsApp / WeChat 快速推荐新人加入团队。"
                ]
            },
            {
                icon: <Smartphone className="w-5 h-5 text-desert-gold" />,
                title: "8. 移动端 App 下载与 FCM 消息即时通知",
                desc: "多端体验，消息不延误：",
                bullets: [
                    "移动端 App 安装：扫码下载 Android APK 或加入 TestFlight 安装 1.0.6+ 版本 App，体验更流畅的原生操作。",
                    "Google FCM 即时推送：任务分派、任务即将过期（提前 2 小时）、挑战包发布、主管加急催办均会即时在手机系统状态栏弹出通知，确保重要信息不遗漏。"
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
                title: "1. Cascading Team Progress Deep-Dive Tree & One-Click Pushes",
                desc: "Click 'View Team Progress' (Users icon) on any recording card in the Plaza:",
                bullets: [
                    "Cascading Org Hierarchy: Automatically expands the tree (SD → SM → TL → CC) based on your reporting tier. Supports expanding/collapsing at all levels.",
                    "Precise Learning States: Clear division into 'Completed' (showing log feedback, timing, and certificate) and 'Uncompleted' (showing real-time listening progress, e.g., 78%).",
                    "FCM Instant Reminder: For uncompleted members, click the buzz button to instantly trigger a system alert banner on their mobile app, driving immediate execution."
                ]
            },
            {
                icon: <CheckSquare className="w-5 h-5 text-desert-gold" />,
                title: "2. Task Center & New CC Zone Assignment (with Smart Select-All)",
                desc: "Managers can distribute mandatory study tasks and assign New CC Bootcamp courses:",
                bullets: [
                    "Dual Task Types: Easily switch between 'General Study Task' and 'New CC Zone Task' depending on onboarding requirements.",
                    "Smart Select-All Recordings: In New CC Zone tasks, selecting a category or using default-all will automatically check and assign all matching newcomer recordings in one tap.",
                    "Push Notifications & Deadline Alerts: Tasks show active count-downs on user layouts and auto-trigger FCM notifications, including warning alerts 2 hours prior to expiration.",
                    "Graduation Linkage: Once an advisor completes all recordings in a New CC task, they instantly unlock their official New CC Graduation Certificate."
                ]
            },
            {
                icon: <Award className="w-5 h-5 text-desert-gold" />,
                title: "3. Publish Campaigns & Customize Canvas Certificates Online",
                desc: "In the 'Exclusive Challenges' tab, deploy themed progressive challenges for target members:",
                bullets: [
                    "Bundled Challenge Criteria: Group multiple key call audios (e.g., First Call Essentials) into a single campaign that requires 100% completion.",
                    "Live Canvas Certificate Designer: Modify titles (e.g., 'Conversion Pioneer'), subtitles, and endorsements online. The Canvas renderer displays a real-time layout preview on the right.",
                    "Qualifying Dashboard: Track qualifiers and pending members with progressive count bars (e.g., 3/5 completed) to easily monitor group completion rates."
                ]
            },
            {
                icon: <Sparkles className="w-5 h-5 text-desert-gold" />,
                title: "4. Leader Academy & Leadership Learning Leaderboard",
                desc: "Leaders actively participate in studies to set gold standards for their teams:",
                bullets: [
                    "Model Learning: Leaders listen to recordings, write feedback logs, and maintain daily coffee streaks like normal students.",
                    "Leadership Board: Provides a dedicated board in the admin dashboard showing studies among managers to evaluate the academic index."
                ]
            },
            {
                icon: <Shield className="w-5 h-5 text-desert-gold" />,
                title: "5. Dedicated Team Hub Portal Management",
                desc: "Sales Managers (SMs) can customize and operate their private group portal:",
                bullets: [
                    "Targeted Material Isolation: SMs upload team-only recordings and categories. Different SM groups are strictly isolated, protecting sensitive commercial talk assets.",
                    "Exclusive Team Banners: Upload custom team banners, attach link actions (redirecting to specific audios or challenges) to drive internal traffic."
                ]
            },
            {
                icon: <Play className="w-5 h-5 text-desert-gold" />,
                title: "6. Audio Asset Upload & AI Subtitle Timeline Editor",
                desc: "Upload and optimize learning audio files in the admin dashboard:",
                bullets: [
                    "AI Transcription & Translation: Automatically transcribes Arabic voice clips and generates matching EN/ZH translations.",
                    "Timeline Subtitle Editor: Modify time-coded subtitle lines in a tabular editor to correct accent misinterpretations. Saves sync globally instantly."
                ]
            },
            {
                icon: <Database className="w-5 h-5 text-desert-gold" />,
                title: "7. Directory Sync & Mutual Cascade Lock",
                desc: "Designed to keep organizational tree data clean and prevent database mistakes:",
                bullets: [
                    "Excel Sync: Upload GCC HC or KSAKID HC spreadsheets to auto-map reporting relations.",
                    "Mutual Constraint (Cascade Lock): Manual user updates enforce linkage: choosing a TL auto-populates and locks their Team, SM, and SD; choosing a Team Name auto-fills its TL and upper managers to prevent database errors."
                ]
            },
            {
                icon: <Lock className="w-5 h-5 text-desert-gold" />,
                title: "8. RBAC Fine-Grained Permission Mapping",
                desc: "Designed to enforce data separation and prevent over-authorization:",
                bullets: [
                    "Permission Tags: Manage permissions based on tags like `manageUsers` (Users), `manageTasks` (Tasks), `manageReferrals` (Referrals), `manageBanners` (Banners), etc.",
                    "Access Control: Show or hide specific administrative panels according to manager roles to protect sensitive options."
                ]
            }
        ] : [
            {
                icon: <Smartphone className="w-5 h-5 text-desert-gold" />,
                title: "1. Smart Domain Auto-Complete & Multi-Language RTL Layout",
                desc: "Simplifying your login process and delivering localized interface layouts:",
                bullets: [
                    "Login Convenience: Simply enter your CRM username (e.g. `serdah` or `wuchuan`). The system automatically appends `@51talk.com` in the background and authenticates securely.",
                    "Arabic RTL Adapter: Toggle between English (EN), Chinese (ZH), and Arabic (AR). Selecting Arabic automatically mirrors the entire layout, navigation, menus, and text to RTL (Right-to-Left)."
                ]
            },
            {
                icon: <Play className="w-5 h-5 text-desert-gold" />,
                title: "2. Learning Hub & Interactive AI Player (Subtitle Click-to-Jump)",
                desc: "Listen to gold standard calls with time-synced scripts:",
                bullets: [
                    "Multi-language Scripts: Shows time-synced transcripts in Arabic (audio), Chinese, and English.",
                    "Interactive Jump: Click any subtitle line to jump the audio player directly to that timestamp. Great for verbal mimicking and training.",
                    "4-Tier Learning Filter: Toggle between 'All', 'Unlearned', 'In Progress', and 'Completed' to organize your learning dashboard."
                ]
            },
            {
                icon: <FileText className="w-5 h-5 text-desert-gold" />,
                title: "3. Supplementary Material Push & Side-by-Side Slides",
                desc: "Review accompanying slides without leaving the player:",
                bullets: [
                    "Attachments Badge: Cards with the 'Slides Included' label contain slides (PPT, PDF, ZIP up to 50MB).",
                    "Dual-Pane Screen Layout: The player embeds an inline document renderer on the right. Slide through pages or zoom in on PPT/PDF sheets directly."
                ]
            },
            {
                icon: <Award className="w-5 h-5 text-desert-gold" />,
                title: "4. Treasure Hunter Incentive Scheme (Streaks & Levels)",
                desc: "Gamified learning journey with 51Talk Najah certifications:",
                bullets: [
                    "Daily Coffee Streak: Complete daily studies to build streak numbers (up to 7 days). Missing a day resets the streak.",
                    "Caravan Journey Progress: Accumulate study minutes to advance along a desert map. Unlock titles: Apprentice → Voyager → Knight → Falcon → Guardian.",
                    "Personal Certificates: Lock in titles to claim certificates. Renders as a PNG photo with your name and the Najah Academy seal. Share to WhatsApp/WeChat with one click."
                ]
            },
            {
                icon: <Users className="w-5 h-5 text-desert-gold" />,
                title: "5. Team Learning Hub (Team Hub)",
                desc: "Switch to 'Team Scope (👥)' in Learning Hub to enter your department's dedicated space:",
                bullets: [
                    "SM-Owned Custom Space: Every SM (Sales Manager) has their own space to upload custom categories, distribute target materials, and run exclusive banner promotions, creating a micro learning platform for their team.",
                    "Targeted Material Isolation: Within this scope, you only view and study courses, call recordings, and incentive policies targeted specifically for your SM team."
                ]
            },
            {
                icon: <CheckSquare className="w-5 h-5 text-desert-gold" />,
                title: "6. Assigned Tasks, New CC Bootcamp & Graduation Certificate",
                desc: "Follow mandatory study requirements, complete assignments, and graduate:",
                bullets: [
                    "General Task Requirements: Listen to 100% of the assigned audio and write a reflection log of at least 100 words to submit.",
                    "New CC Zone Tasks (50-word Limit): Newcomer bootcamp tasks have a lower entry barrier, requiring only 50 words minimum per recording reflection.",
                    "Claim Graduation Certificate: Completing all recordings in an assigned New CC Task unlocks a gold 'View Graduation Certificate' button. Click to view, customize, and save your official New CC Bootcamp diploma.",
                    "Themed Campaigns: Progress through themed campaign bundles (e.g., Ice-breaking Trilogy) and claim dedicated campaign-specific theme certificates."
                ]
            },
            {
                icon: <Share2 className="w-5 h-5 text-desert-gold" />,
                title: "7. Policies & Shareable Referrals Showcase",
                desc: "Access compensation rules and recruitment assets easily:",
                bullets: [
                    "Policies & Brands: Access and review commission rules or compensation basic PDFs with pinch-to-zoom.",
                    "One-Click Referral Sharing: Browse tree-categorized recruiting resources (benefits, bonus plans, posters). Download files or copy text templates to share on WhatsApp/WeChat."
                ]
            },
            {
                icon: <Smartphone className="w-5 h-5 text-desert-gold" />,
                title: "8. Mobile App Companion & FCM Notifications",
                desc: "Stay updated with push notifications:",
                bullets: [
                    "Mobile App Installation: Scan QR code to download Android APK or join iOS TestFlight 1.0.6+.",
                    "FCM Instant Alerts: Receive instant push banners on your phone for task assignments, task warnings (2 hours before deadline), campaign releases, or manager buzzes."
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
                title: "1. شجرة المتابعة المتتالية لمراقبة تقدم الفريق والتذكير بـ FCM",
                desc: "انقر على زر 'متابعة تقدم الفريق' (أيقونة المستخدمين) في أي بطاقة تسجيل لمتابعة التعلم:",
                bullets: [
                    "التدرج الهيكلي المتتالي: يتم توسيع شجرة المتابعة تلقائياً (SD → SM → TL → CC) بناءً على مستواك الإداري. يدعم الطي والتوسيع في جميع المستويات.",
                    "حالة الاكتمال بدقة: عرض قائمة المكتملين مع الملاحظات والشهادات، والمستمعين قيد الدراسة مع تحديد نسب استماعهم بدقة (مثال: 78%).",
                    "التذكير الفوري بـ FCM: انقر على زر التذكير لإرسال إشعار فوري وعاجل إلى هاتف الموظف قيد الانتظار لتنبيهه بمواصلة الدراسة."
                ]
            },
            {
                icon: <CheckSquare className="w-5 h-5 text-desert-gold" />,
                title: "2. مركز المهام وتعيين منطقة CC الجديدة (مع ميزة التحديد الذكي الكل)",
                desc: "يمكن للمشرفين والمديرين تعيين مهام دراسية إلزامية بالإضافة إلى مهام منطقة الموظفين الجدد (New CC Zone):",
                bullets: [
                    "ثنائية المهام: سهولة الاختيار بين 'مهمة تعلم عامة' و'مهمة منطقة CC الجديدة' لتلبية متطلبات تهيئة الموظفين الجدد.",
                    "التحديد الذكي لجميع التسجيلات: في مهام منطقة CC الجديدة، يؤدي اختيار فئة أو استخدام 'الكل الافتراضي' إلى تحديد جميع تسجيلات الموظفين الجدد تلقائيًا وتعيينها بنقرة واحدة.",
                    "التذكيرات الفورية والإنذارات: يتم تفعيل العد التنازلي لدى الموظفين وإرسال إشعارات FCM تلقائياً، مع إنذار قبل ساعتين من الموعد النهائي.",
                    "ربط شهادة التخرج: بمجرد إتمام الموظف لجميع متطلبات مهمة منطقة CC الجديدة، يتم فتح شهادة تخرج الموظفين الجدد الرسمية له فوراً."
                ]
            },
            {
                icon: <Award className="w-5 h-5 text-desert-gold" />,
                title: "3. نشر حملات التحدي وتخصيص شهادات Canvas فورياً",
                desc: "في علامة التبويب 'التحديات الحصرية'، انشر برامج تدريبية متكاملة بشهادات مخصصة:",
                bullets: [
                    "حزمة التسجيلات المجمعة: حدد عدة تسجيلات (مثل مكالمات كسر الجليد) كشروط مسبقة لاجتياز التحدي.",
                    "محرر شهادات Canvas التفاعلي: عدل العناوين (مثل 'رائد مكالمات كسر الجليد')، النصوص، والأختام مع عرض فوري للشهادة على اليمين.",
                    "لوحة تقدم التحدي: راقب شريط تقدم الموظفين قيد الإنجاز (مثل: 3/5) لمساعدتهم في إتمام التحدي."
                ]
            },
            {
                icon: <Sparkles className="w-5 h-5 text-desert-gold" />,
                title: "4. أكاديمية المشرفين ولوحة صدارة المدراء",
                desc: "المشرفون يدرسون كالموظفين لتقديم قدوة التعلم للجميع:",
                bullets: [
                    "التعلم النموذجي للمشرفين: يستمع المشرفون للتسجيلات، ويكتبون ملاحظاتهم الدراسية، ويبنون سلسلة استمرار القهوة اليومية كالموظفين تماماً.",
                    "لوحة صدارة القادة: توفر لوحة خاصة في لوحة التحكم الإدارية لمتابعة دراسات المدراء وتقييم النشاط التدريبي."
                ]
            },
            {
                icon: <Shield className="w-5 h-5 text-desert-gold" />,
                title: "5. إدارة منصة Team Hub الحصرية للقسم",
                desc: "يمكن لمدير المبيعات (SM) تخصيص وإدارة مساحة فريقه المستقلة:",
                bullets: [
                    "عزل وحماية الملفات: يرفع المدراء المكالمات والملفات الخاصة بفرعهم الإداري بشكل معزول تماماً عن بقية المجموعات لحماية المحتوى.",
                    "إدارة البنرات: رفع بنرات فريق مخصصة وربطها بإجراءات انتقال (لصوتيات أو تحديات معينة) لزيادة زيارات الموظفين."
                ]
            },
            {
                icon: <Play className="w-5 h-5 text-desert-gold" />,
                title: "6. رفع الأصول الصوتية ومحرر نصوص الترجمة بالذكاء الاصطناعي",
                desc: "يمكن للمستخدمين الحاصلين على صلاحية إدارة التسجيلات إدارة أصول التعلم في لوحة الإدارة:",
                bullets: [
                    "النسخ والترجمة الآلية: يحول كلام التسجيل باللغة العربية إلى نصوص مكتوبة ويولد ترجمة متوازية بالصينية والإنجليزية.",
                    "محرر ترجمة الجدول: عدل سطور الترجمة في محرر جدول لتصحيح اللهجات وتنعكس التعديلات على المستخدمين فوراً."
                ]
            },
            {
                icon: <Database className="w-5 h-5 text-desert-gold" />,
                title: "7. مزامنة الدليل والربط المتتالي للأعضاء (Cascade Lock)",
                desc: "مصمم للحفاظ على نظافة شجرة البيانات الإدارية ومنع أخطاء الإدخال اليدوي:",
                bullets: [
                    "مزامنة إكسل التلقائية: استورد جداول GCC HC أو KSAKID HC لبناء شجرة العلاقات الإدارية تلقائياً.",
                    "قيد الترابط المتتالي (Cascade Lock): عند تعديل مستخدم يدوياً، فإن اختيار TL يملأ ويقفل تلقائياً الفريق (Team) وSM وSD؛ واختيار Team Name يملأ تلقائياً TL والمدراء الأعلى لمنع الأخطاء."
                ]
            },
            {
                icon: <Lock className="w-5 h-5 text-desert-gold" />,
                title: "8. تحديد صلاحيات الإدارة الدقيقة (RBAC)",
                desc: "منع الإفراط في الصلاحيات لضمان أمن البيانات الحساسة:",
                bullets: [
                    "وسوم الصلاحيات: إدارة الصلاحيات بناءً على وسوم مثل `manageUsers` و`manageTasks` و`manageReferrals` و`manageBanners` إلخ.",
                    "الحد الأدنى من الصلاحيات: إظهار أو إخفاء لوحات الإدارة المحددة وفقاً لدور كل مدير لحماية الإجراءات الحساسة."
                ]
            }
        ] : [
            {
                icon: <Smartphone className="w-5 h-5 text-desert-gold" />,
                title: "1. الإكمال التلقائي لاسم المستخدم وملاءمة اتجاه الواجهة (RTL)",
                desc: "تسهيل تسجيل الدخول وتقديم واجهة مستخدم محلية فائدة السلاسة:",
                bullets: [
                    "تسجيل دخول مبسط: أدخل اسم المستخدم الخاص بك في CRM فقط (مثل `serdah` أو `wuchuan`)، وسيكمل النظام تلقائياً البريد الإلكتروني `@51talk.com` في الخلفية.",
                    "ملاءمة اتجاه الواجهة (RTL): عند اختيار اللغة العربية، تنعكس عناصر الواجهة، شريط التنقل، القوائم، والنصوص لتصبح من اليمين إلى اليسار تلقائياً لتناسب عادات القراءة في الشرق الأوسط."
                ]
            },
            {
                icon: <Play className="w-5 h-5 text-desert-gold" />,
                title: "2. ساحة التعلم ومشغل الذكاء الاصطناعي التفاعلي",
                desc: "تصفح تسجيلات المكالمات المتميزة مع نصوص متزامنة بثلاث لغات:",
                bullets: [
                    "ترجمة النصوص بثلاث لغات: يعرض نصوصاً متزامنة مع الصوت باللغة العربية والإنجليزية والصينية.",
                    "الانتقال التفاعلي بالنقر على النص: انقر على أي سطر في الترجمة لينتقل الصوت فوراً إلى هذا التوقيت بالملي ثانية. ممتاز لمحاكاة المكالمات والتدريب.",
                    "تصفية بـ 4 حالات: تصفية المهام حسب 'الكل'، 'غير مستمع'، 'قيد الاستماع'، و'مكتمل' لمتابعة تقدمك."
                ]
            },
            {
                icon: <FileText className="w-5 h-5 text-desert-gold" />,
                title: "3. المرفقات الدراسية وعرض الشرائح المتوازي",
                desc: "راجع الشرائح والملاحظات المصاحبة للصوت دون مغادرة المشغل:",
                bullets: [
                    "شارة المرفقات: المكالمات التي تحتوي على ملفات دراسية تحمل شارة 'تتضمن كورس' (PDF, PPT, Word, Excel, ZIP حتى 50 ميجابايت).",
                    "عارض الشاشة المزدوجة: تنقسم الشاشة إلى عمودين. على اليسار مشغل الصوت، وعلى اليمين عارض ملفات تفاعلي لتصفح مستندات الـ PDF أو شرائح الـ PPT مباشرة دون الحاجة لتحميلها."
                ]
            },
            {
                icon: <Award className="w-5 h-5 text-desert-gold" />,
                title: "4. نظام مكافآت صائدي الكنز (الاستمرار والمستويات)",
                desc: "رحلة تعلم ممتعة بشهادات معتمدة من أكاديمية Najah التابعة لـ 51Talk:",
                bullets: [
                    "سلسلة استمرار القهوة اليومية: استمع لأي مكالمة يومياً لبناء سلسلة الاستمرار (تظهر حتى 7 أكواب قهوة). عدم الاستماع ليوم واحد يعيد السلسلة للصفر.",
                    "خارطة طريق قافلة الصحراء: احسب دقائق استماعك الفعلي لتتقدم في مسار صحراء البتراء وتفتح الألقاب التالية (مبتدئ → مستكشف → فارس → صقر → حارس الكنز).",
                    "شهادات شخصية: احصل على شهادة تخرج مصممة بـ Canvas تحمل اسمك وختم أكاديمية Najah الأحمر الرسمي. حملها لجهازك أو شاركها عبر WhatsApp/WeChat بنقرة واحدة."
                ]
            },
            {
                icon: <Users className="w-5 h-5 text-desert-gold" />,
                title: "5. المنصة الخاصة بالفريق (Team Hub 👥)",
                desc: "تصفح مكالماتك ومناهجك التدريبية في مساحة خاصة بفريقك:",
                bullets: [
                    "مساحة مخصصة لكل SM: يمكن لكل مدير مبيعات (SM) الحصول على مساحته الخاصة لرفع فئات الكورسات، وتوزيع المواد المخصصة لفريقه، وإدارة بنرات الترويج الحصرية.",
                    "عزل المواد المستهدفة: داخل هذا النطاق، يمكنك فقط الاطلاع ودراسة الكورسات، وتسجيلات المكالمات، وسياسات العمولات المخصصة حصرياً لفريقك دون تداخل مع المكتبة العامة."
                ]
            },
            {
                icon: <CheckSquare className="w-5 h-5 text-desert-gold" />,
                title: "6. المهام المعينة، معسكر تدريب CC الجديد، وربط شهادة التخرج",
                desc: "تابع متطلبات التعلم الإلزامية، وأكمل الواجبات، وتخرج بنجاح:",
                bullets: [
                    "شروط المهام العامة: استمع إلى 100% من الصوت المخصص واكتب تأملاً لا يقل عن 100 كلمة لتتمكن من التقديم.",
                    "مهام منطقة CC الجديدة (حد أدنى 50 كلمة): لتبسيط البداية للموظفين الجدد، تتطلب تسجيلات معسكر تدريب منطقة CC الجديدة كتابة تأمل لا يقل عن 50 كلمة فقط.",
                    "الحصول على شهادة التخرج: يفتح إكمال جميع تسجيلات مهمة منطقة CC الجديدة زراً ذهبياً باسم 'عرض شهادة التخرج'، انقر فوقه لعرض وتخصيص وتنزيل شهادة تخرج معسكر تدريب New CC الرسمية.",
                    "حملات التحدي المجمعة: تتبع تحديات مجمعة (مثل ثلاثية كسر الجليد) واكسب شهادة التحدي المخصصة."
                ]
            },
            {
                icon: <Share2 className="w-5 h-5 text-desert-gold" />,
                title: "7. اللوائح وسياسات العمولات ومركز مواد الترشيح (Referrals)",
                desc: "راجع اللوائح وشارك مواد التوظيف للحصول على مكافآت:",
                bullets: [
                    "اللوائح والسياسات: راجع أحدث لوائح الرواتب والعمولات بصيغة PDF مع إمكانية التكبير والتصغير.",
                    "مشاركة مواد الترشيح: تصفح مجلدات مواد التوظيف والترشيح (الميزات، العمولات، البوسترات). حمل الملفات أو انسخ قوالب النصوص للمشاركة عبر WhatsApp/WeChat."
                ]
            },
            {
                icon: <Smartphone className="w-5 h-5 text-desert-gold" />,
                title: "8. تطبيق الهاتف الجوال وإشعارات FCM الفورية",
                desc: "تلقي الإشعارات الفورية على هاتفك المحمول:",
                bullets: [
                    "تطبيق الهاتف الجوال: امسح رمز QR لتحميل تطبيق الأندرويد APK أو الانضمام لـ TestFlight (النسخة 1.0.6+) لتجربة استخدام أسرع.",
                    "إشعارات FCM الفورية: استقبل إشعارات منبثقة على هاتفك عند تعيين مهام جديدة، اقتراب موعد التسليم (قبل ساعتين)، نشر حملة تحدي، أو تذكير عاجل من مديرك."
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
