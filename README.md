#  Discord Bot + Dashboard

بوت ديسكورد شامل مع لوحة تحكم ويب، مبني بـ **Discord.js v14** و**Express** و**MongoDB**.
البوت والداشبورد يعملان معاً في عملية واحدة (`src/index.js`).

## ✨ المميزات

| القسم | الوصف |
|---|---|
|  الإدارة | `ban` `kick` `timeout` `clear` `warn` + Anti-Spam + سجل إجراءات في قناة محددة |
|  الاقتصاد والألعاب | `balance` `daily` `coinflip` `top` `8ball` |
|  الموسيقى | `play` و `music` (skip / stop / queue / loop) عبر DisTube، مع دعم YouTube و Spotify |
|  إشعارات البث | متابعة حسابات **Kick** و **YouTube** و **TikTok** وإرسال إشعار تلقائي عند بدء البث |
|  الداشبورد | تسجيل دخول Discord OAuth2، وإعدادات مستقلة لكل سيرفر |

### ما يمكن تعديله من الداشبورد (لكل سيرفر)
- قناة سجل الإدارة
- تفعيل Anti-Spam وحدّه
- قناة إشعارات البث والرتبة التي يتم منشنها ونص الإشعار
- تفعيل وتعطيل أي أمر
- إضافة وحذف حسابات Kick / YouTube / TikTok

##  هيكل المشروع

```
src/
├── index.js               نقطة التشغيل (البوت + الداشبورد)
├── config/database.js     اتصال MongoDB
├── models/                Guild, User, Warn
├── commands/              moderation / economy / music
├── events/                ready, interactionCreate, messageCreate
├── handlers/              تحميل الأوامر والأحداث تلقائياً
├── music/distube.js       إعداد DisTube
├── services/              streamChecker + kick / youtube / tiktok
├── utils/                 getGuild (كاش), modLog, economy
└── dashboard/             server.js + views (EJS) + public
```

## 🚀 التشغيل المحلي

المتطلبات: **Node.js 20 أو أحدث** (يفضّل 22 LTS) وحساب MongoDB Atlas.

```bash
npm install
cp .env.example .env     # على Windows: copy .env.example .env
# املأ القيم في .env
npm start
```

للتجربة المحلية اجعل `BASE_URL=http://localhost:3000` وأضف
`http://localhost:3000/callback` في Discord Developer Portal ← OAuth2 ← Redirects.

##  المتغيرات (`.env`)

| المتغير | مطلوب | الوصف |
|---|---|---|
| `DISCORD_TOKEN` |  | توكن البوت (Bot ← Reset Token) |
| `CLIENT_ID` |  | Application ID |
| `CLIENT_SECRET` |  | OAuth2 ← Client Secret |
| `MONGODB_URI` |  | رابط MongoDB Atlas مع اسم القاعدة |
| `SESSION_SECRET` |  | نص عشوائي طويل لتأمين الجلسات |
| `BASE_URL` |  | رابط الداشبورد بدون `/` في النهاية |
| `NODE_ENV` |  | اجعله `production` على الاستضافة |
| `PORT` |  | لا تحدده على Render، فهو يحدده تلقائياً |
| `KICK_CLIENT_ID` / `KICK_CLIENT_SECRET` |  | مطلوبان لإشعارات Kick |
| `YOUTUBE_API_KEY` |  | مطلوب لإشعارات YouTube |

>  لا ترفع ملف `.env` إلى GitHub أبداً، وإن تسرّب أي توكن فاعمل له Reset فوراً.

##  الرفع على Render (مجاني)

1. **Web Service** مربوط بهذا الريبو، Branch: `main`.
2. **Build Command**: `npm install`
3. **Start Command**: `npm start`
4. أضف المتغيرات أعلاه في Environment، مع `NODE_VERSION=22`.
5. بعد النشر ضع رابط الخدمة في `BASE_URL`، وأضف `<BASE_URL>/callback` في Discord Redirects.
6. لمنع النوم: أضف Monitor في UptimeRobot على `<BASE_URL>/health` كل 5 دقائق.

### دومين مخصص
أضف `dashboard.yourdomain.com` في Render ← Custom Domains، وأنشئ سجل `CNAME`
بالاسم `dashboard` يشير إلى `xxxx.onrender.com`، ثم حدّث `BASE_URL` ورابط Redirect.

##  ربط إشعارات البث

- **Kick**: أنشئ تطبيقاً في Kick Developer وضع المفتاحين في Environment.
- **YouTube**: فعّل YouTube Data API v3 من Google Cloud وضع المفتاح. أدخل الحساب كـ `@handle` أو Channel ID.
- **TikTok**: لا يوجد API رسمي، فالفحص يعتمد على مكتبة غير رسمية وقد يتعطل أو يُحجب.
- الفحص يتم كل دقيقتين، والإشعار يُرسل مرة واحدة عند بدء كل بث.

##  ملاحظات

- **الموسيقى** على الاستضافات المجانية قد تكون غير مستقرة، لأن YouTube يحجب عناوين مراكز البيانات.
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
