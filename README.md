#  Discord Bot + Dashboard

بوت ديسكورد شامل مع لوحة تحكم ويب، مبني بـ **Discord.js v14** و**Express** و**MongoDB**.
البوت والداشبورد يعملان معاً في عملية واحدة (`src/index.js`).

## ✨ المميزات

| القسم | الوصف |
|---|---|
|  الإدارة | `ban` `kick` `timeout` `clear` `warn` + Anti-Spam و Anti-Raid ومرشحات الروابط والإشارات + رصد الحظر/حذف القنوات الجماعي |
|  الاقتصاد والتقدم | `balance` `bank` `daily` `coinflip` `top` `rank` `8ball` مع المحفظة والبنك والتحويل والعمل وخبرة الرسائل |
|  الدعم | `/tickets` لإعداد لوحة تذاكر خاصة مع رتبة دعم وسجل نصي عند الإغلاق |
|  الموسيقى | `/play` و`/music` عبر Lavalink/Shoukaku (skip / stop / pause / resume / queue / loop / volume / filter) مع حفظ القائمة واتصال صوتي مستقر |
|  إشعارات البث | متابعة حسابات **Kick** و **YouTube** و **TikTok** وإرسال إشعار تلقائي عند بدء البث |
|  الترحيب | رسائل دخول ومغادرة مضمّنة، صورة HTTPS اختيارية، ورتبة تلقائية |
|  الداشبورد | OAuth2، إعدادات مستقلة لكل سيرفر، تحكم موسيقى مباشر، وإحصاءات نشاط |

يعرض البوت حالة **Playing slow community** باستمرار. يمكن للمشرفين تنفيذ التحذير والكتم والطرد والحظر من لوحة التحكم، مع التحقق من صلاحيات المستخدم والبوت وترتيب الرتب.

### ما يمكن تعديله من الداشبورد (لكل سيرفر)
- قناة سجل الإدارة
- Anti-Spam و Anti-Raid وحدودهما
- رسائل الترحيب والمغادرة، صورة الترحيب، والرتبة التلقائية
- قناة إشعارات البث والرتبة التي يتم منشنها ونص الإشعار
- تحكم بقائمة الموسيقى النشطة، مستوى الصوت والمؤثرات الصوتية
- إعداد مرشحات الروابط والإشارات وعتبات رصد بعض إجراءات الحذف والحظر الجماعي
- إعداد قنوات التذاكر وفريق الدعم ونشر لوحة إنشاء التذاكر
- إنشاء أوامر نصية مخصصة بصيغة `!اسم_الأمر`
- تفعيل وتعطيل أي أمر
- إضافة وحذف حسابات Kick / YouTube / TikTok
- إحصاءات الرسائل وأوامر السلاش والانضمام والمغادرة يومياً

##  هيكل المشروع

```
src/
├── index.js               نقطة التشغيل (البوت + الداشبورد)
├── config/database.js     اتصال MongoDB
├── models/                Guild, User, Warn, Ticket, GuildAnalytics
├── commands/              moderation / economy / music
├── events/                ready, interactionCreate, messageCreate, guild members, audit events
├── handlers/              تحميل الأوامر والأحداث تلقائياً
├── music/lavalink.js      إدارة عقد Lavalink والطوابير ومشغلات الصوت
├── services/              streamChecker + kick / youtube / tiktok
├── utils/                 getGuild (كاش), modLog, economy, analytics
└── dashboard/             server.js + views (EJS) + public
```

## 🚀 التشغيل المحلي

المتطلبات: Node.js ضمن الإصدارات في `package.json`، وخادم Lavalink v4 متاح عبر الشبكة، وحساب MongoDB Atlas. Render يشغّل البوت والداشبورد لكنه لا يشغّل Lavalink؛ استخدم خادماً منفصلاً أو مزود Lavalink موثوقاً.

```bash
npm install
cp .env.example .env     # على Windows: copy .env.example .env
# املأ القيم في .env
npm start
```

عيّن `LAVALINK_NODES` إلى مصفوفة JSON لعقد Lavalink، مثلاً:

```json
[{"name":"main","url":"lavalink.example.net:443","auth":"your-node-password","secure":true}]
```

`url` هو `host:port` من دون `http://` أو `https://`، و`secure` يحدد استخدام TLS. أضف عقداً أخرى إلى المصفوفة لاستخدام pool. فعّل في إعداد Lavalink فقط مصادر الصوت التي تملك حق استخدامها، واضبط إعدادات Lavalink الإضافية وفق توثيقه الرسمي. يجب أن يطابق عنوان العقدة وكلمة مرورها إعداد خادم Lavalink.

مثال أساسي لخادم Lavalink v4 (`application.yml`):

```yaml
server:
  port: 2333
  address: 0.0.0.0
lavalink:
  server:
    password: "replace-with-a-long-random-password"
    sources:
      youtube: false
      bandcamp: true
      soundcloud: true
      twitch: true
      vimeo: true
      http: false
      local: false
    youtubeSearchEnabled: false
    soundcloudSearchEnabled: true
```

لا تعرّض منفذ العقدة مباشرةً للإنترنت دون TLS وتقييد الوصول. وثائق التشغيل والإعداد: [Lavalink Getting Started](https://lavalink.dev/getting-started/) و[Config File](https://lavalink.dev/configuration/config/file/)، و[Shoukaku Getting Started](https://guide.shoukaku.shipgirl.moe/guides/1-getting-started/).

للتجربة المحلية اجعل `BASE_URL=http://localhost:3000` وأضف
`http://localhost:3000/callback` في Discord Developer Portal ← OAuth2 ← Redirects.

من Discord Developer Portal ← Bot ← Privileged Gateway Intents فعّل **Server Members Intent**
و**Message Content Intent**. يحتاجهما البوت لأحداث الأعضاء وميزات الترحيب والأوامر المخصصة واحتساب XP.

##  المتغيرات (`.env`)

| المتغير | مطلوب | الوصف |
|---|---|---|
| `DISCORD_TOKEN` |  | توكن البوت (Bot ← Reset Token) |
| `CLIENT_ID` |  | Application ID |
| `CLIENT_SECRET` |  | OAuth2 ← Client Secret |
| `MONGODB_URI` |  | رابط MongoDB Atlas مع اسم القاعدة |
| `SESSION_SECRET` |  | سر جلسات عشوائي بطول 32 محرفاً على الأقل |
| `BASE_URL` |  | رابط الداشبورد بدون `/` في النهاية |
| `NODE_ENV` |  | اجعله `production` على الاستضافة |
| `PORT` |  | لا تحدده على Render، فهو يحدده تلقائياً |
| `KICK_CLIENT_ID` / `KICK_CLIENT_SECRET` |  | مطلوبان لإشعارات Kick |
| `YOUTUBE_API_KEY` |  | مطلوب لإشعارات YouTube |
| `STREAM_CHECK_INTERVAL_SECONDS` |  | تكرار فحص Kick/TikTok بالثواني (افتراضي 60، حد أدنى 30) |
| `YOUTUBE_POLL_INTERVAL_MINUTES` |  | تكرار فحص YouTube بالدقائق (افتراضي 15، حد أدنى 5) |

> لا ترفع ملف `.env` إلى GitHub أبداً، وإن تسرّب أي توكن فاعمل له Reset فوراً.

## صلاحيات وقيود ميزات الأمان والدعم

- فعّل **View Audit Log** للبوت حتى يعمل رصد الحظر الجماعي وحذف القنوات. الاستجابة الحالية توقف المنفذ مؤقتاً بعد تجاوز العتبة؛ وهي ليست استعادة تلقائية للقنوات أو الأدوار ولا تغطي كل أنواع أحداث Discord.
- مرشح الروابط بسيط ويطبق على الرسائل التي يراها البوت. يمكن استثناء أصحاب `Manage Messages` من قواعد الرسائل.
- نظام التذاكر يحتاج صلاحيات **Manage Channels** و**Manage Roles** و**View Channel** و**Send Messages** للبوت، ويؤرشف آخر 100 رسالة كنص عند الإغلاق. الروابط إلى الملفات المرفقة تحفظ، لكن لا يتم تنزيل المرفقات نفسها.
- تحويل العملات يستخدم معاملات MongoDB؛ استخدم MongoDB Atlas أو Replica Set يدعم المعاملات.
- ميزات CAPTCHA، ألعاب تعدد اللاعبين، المتجر/العناصر والأسهم، توليد بطاقة رتبة كصورة، وخبرة القنوات الصوتية ليست ضمن التنفيذ الحالي. كذلك لا تدّعي هذه الإضافات تغطية كل إعدادات البوت من لوحة التحكم.

##  الرفع على Render (مجاني)

1. **Web Service** مربوط بهذا الريبو، Branch: `main`.
2. **Build Command**: `npm install`
3. **Start Command**: `npm start`
4. فعّل **Server Members Intent** و**Message Content Intent** في Discord Developer Portal.
5. أضف المتغيرات أعلاه في Environment، مع `NODE_VERSION=22.22.2` و`SESSION_SECRET` عشوائي بطول 32 محرفاً على الأقل.
6. بعد النشر ضع رابط الخدمة في `BASE_URL`، وأضف `<BASE_URL>/callback` في Discord Redirects.
7. لمنع النوم: أضف Monitor في UptimeRobot على `<BASE_URL>/health` كل 5 دقائق.

### دومين مخصص
أضف `dashboard.yourdomain.com` في Render ← Custom Domains، وأنشئ سجل `CNAME`
بالاسم `dashboard` يشير إلى `xxxx.onrender.com`، ثم حدّث `BASE_URL` ورابط Redirect.

##  ربط إشعارات البث

- **Kick**: أنشئ تطبيقاً في Kick Developer وضع المفتاحين في Environment.
- **YouTube**: فعّل YouTube Data API v3 من Google Cloud وضع المفتاح. أدخل الحساب كـ `@handle` أو Channel ID.
- **TikTok**: لا يوجد API رسمي، فالفحص يعتمد على مكتبة غير رسمية وقد يتعطل أو يُحجب.
- يفحص Kick وTikTok كل `STREAM_CHECK_INTERVAL_SECONDS` (افتراضياً كل دقيقة). يستخدم YouTube Live Search API لاكتشاف البث النشط؛ يفحص الحساب الفريد كل `YOUTUBE_POLL_INTERVAL_MINUTES` (افتراضياً كل 15 دقيقة) لتقليل استهلاك الحصة. طلب YouTube Search قد يستهلك حصة أكبر من طلبات القنوات والفيديوهات؛ راقب حصة مشروع Google Cloud عند متابعة عدة حسابات.
- تُعاد محاولة إرسال إشعار البث إذا فشل الإرسال إلى قناة Discord، بدلاً من حفظ الحالة كمباشر قبل وصول الإشعار.

##  ملاحظات

- يبدأ تشغيل الموسيقى عبر `/play` من روم صوتي. يستخدم Shoukaku عقد Lavalink، ويدعم البحث الافتراضي عبر SoundCloud (`scsearch:`) وروابط Bandcamp وSoundCloud وTwitch وVimeo. الداشبورد يتحكم في قائمة التشغيل النشطة.
- تُحفظ حتى 100 مقطع مشفر من Lavalink، مع مستوى الصوت والتكرار والفلاتر، في MongoDB وتُستعاد بعد إعادة تشغيل البوت إذا بقيت العقد والقنوات متاحة. يبدأ المقطع الحالي من بدايته عند الاستعادة، وقد لا تبقى روابط البث المؤقتة صالحة.
- لا يشغّل هذا النظام روابط YouTube ولا يحاول تجاوز متطلبات تسجيل الدخول أو كشف البوتات. كما لا يحوّل روابط Spotify إلى مصدر آخر؛ Spotify رابط بيانات وليس تدفقاً صوتياً. استخدم مزوداً مرخصاً أو تدفقاً تملك حق بثه.
- صورة الترحيب تُقبل كرابط HTTPS؛ لا توجد خدمة خارجية لتوليد الصور تلقائياً.
- إحصاءات النشاط تُجمع في الذاكرة ثم تُحفظ كل 30 ثانية، وتُحتفظ باليوميات 90 يوماً. قد تفقد آخر دفعة غير محفوظة عند إيقاف قسري.
- يمكن استخدام الإيموجي في ملفات المشروع ورسائل البوت والسجلات والواجهات؛ لا توجد سياسة تمنعها.
- **Render المجاني** ينام بعد 15 دقيقة بلا زيارات، فاستخدم UptimeRobot.
- أوامر السلاش قد تتأخر حتى ساعة في الظهور أول مرة بعد التسجيل العالمي.

##  تطوير وإضافة أوامر

أنشئ ملفاً في `src/commands/<category>/` بالشكل التالي، وسيُحمَّل تلقائياً:

```js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Pong'),
  async execute(interaction, client) {
    await interaction.reply('Pong!');
  }
};
```
