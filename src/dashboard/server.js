const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const { ChannelType } = require('discord.js');
const Guild = require('../models/Guild');
const { getGuild, invalidate } = require('../utils/getGuild');

const DISCORD = 'https://discord.com/api/v10';
const PLATFORMS = ['kick', 'youtube', 'tiktok'];

module.exports = function startDashboard(client) {
  const app = express();
  const { BASE_URL, CLIENT_ID, CLIENT_SECRET, SESSION_SECRET, MONGODB_URI } = process.env;
  const isProd = process.env.NODE_ENV === 'production' || BASE_URL?.startsWith('https');

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.set('trust proxy', 1); // Render/Railway خلف Proxy (ضروري لـ cookie آمن)
  app.use(express.urlencoded({ extended: false }));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(session({
    secret: SESSION_SECRET, resave: false, saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: MONGODB_URI }),     // الجلسات تبقى بعد إعادة التشغيل
    cookie: { httpOnly: true, secure: isProd, sameSite: 'lax', maxAge: 7 * 86400_000 }
  }));

  // رمز CSRF لكل جلسة + تمرير المستخدم للقوالب
  app.use((req, res, next) => {
    req.session.csrf ||= crypto.randomBytes(24).toString('hex');
    res.locals.csrf = req.session.csrf;
    res.locals.user = req.session.user || null;
    if (req.method === 'POST' && req.body._csrf !== req.session.csrf)
      return res.status(403).render('error', { message: 'رمز الحماية غير صالح، أعد تحميل الصفحة.' });
    next();
  });

  const requireLogin = (req, res, next) => (req.session.user ? next() : res.redirect('/login'));

  // يتحقق أن المستخدم يدير السيرفر وأن البوت موجود فيه
  const guildAccess = (req, res, next) => {
    const g = req.session.guilds?.find(x => x.id === req.params.guildId);
    if (!g) return res.status(403).render('error', { message: 'ليس لديك صلاحية على هذا السيرفر.' });
    const guild = client.guilds.cache.get(g.id);
    if (!guild) return res.redirect('/dashboard');
    req.guild = guild;
    next();
  };

  app.get('/health', (req, res) => res.send('ok')); // لـ Render health check / UptimeRobot
  app.get('/', (req, res) => res.render('index'));

  // ---------- Discord OAuth2 ----------
  app.get('/login', (req, res) => {
    req.session.oauthState = crypto.randomBytes(16).toString('hex');
    const q = new URLSearchParams({
      client_id: CLIENT_ID, redirect_uri: `${BASE_URL}/callback`, response_type: 'code',
      scope: 'identify guilds', state: req.session.oauthState, prompt: 'none'
    });
    res.redirect(`https://discord.com/oauth2/authorize?${q}`);
  });

  app.get('/callback', async (req, res) => {
    try {
      const { code, state } = req.query;
      if (!code || state !== req.session.oauthState) throw new Error('bad state');
      const tokenRes = await fetch(`${DISCORD}/oauth2/token`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'authorization_code',
          code, redirect_uri: `${BASE_URL}/callback`
        })
      });
      if (!tokenRes.ok) throw new Error('token exchange failed');
      const { access_token } = await tokenRes.json();
      const headers = { Authorization: `Bearer ${access_token}` };
      const [me, guilds] = await Promise.all([
        fetch(`${DISCORD}/users/@me`, { headers }).then(r => r.json()),
        fetch(`${DISCORD}/users/@me/guilds`, { headers }).then(r => r.json())
      ]);
      // نحتفظ فقط بالسيرفرات التي يملك فيها Manage Server (0x20) أو Administrator (0x8)
      const manageable = guilds.filter(g => g.owner || (BigInt(g.permissions) & 0x28n) !== 0n)
        .map(g => ({ id: g.id, name: g.name, icon: g.icon }));
      req.session.regenerate(err => { // منع Session Fixation
        if (err) throw err;
        req.session.user = { id: me.id, username: me.global_name || me.username, avatar: me.avatar };
        req.session.guilds = manageable;
        res.redirect('/dashboard');
      });
    } catch (err) {
      console.error('OAuth error:', err.message);
      res.status(400).render('error', { message: 'فشل تسجيل الدخول.' });
    }
  });

  app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

  // ---------- Dashboard ----------
  app.get('/dashboard', requireLogin, (req, res) => {
    const guilds = req.session.guilds.map(g => ({
      ...g, botIn: client.guilds.cache.has(g.id),
      invite: `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&scope=bot%20applications.commands&permissions=1099514883158&guild_id=${g.id}`
    }));
    res.render('dashboard', { guilds });
  });

  app.get('/dashboard/:guildId', requireLogin, guildAccess, async (req, res) => {
    const { guild } = req;
    res.render('guild', {
      guild, s: await getGuild(guild.id), saved: req.query.saved === '1',
      channels: guild.channels.cache.filter(c => c.type === ChannelType.GuildText).map(c => ({ id: c.id, name: c.name })),
      roles: guild.roles.cache.filter(r => r.id !== guild.id && !r.managed).map(r => ({ id: r.id, name: r.name })),
      commands: [...client.commands.values()].map(c => ({ name: c.data.name, category: c.category })),
      platforms: PLATFORMS
    });
  });

  // حفظ الإعدادات العامة
  app.post('/dashboard/:guildId', requireLogin, guildAccess, async (req, res) => {
    const { guild, body: b } = req;
    // نتأكد أن القناة/الرتبة المختارة تنتمي فعلاً لهذا السيرفر
    const ch = id => (guild.channels.cache.get(id)?.type === ChannelType.GuildText ? id : null);
    const role = id => (guild.roles.cache.has(id) ? id : null);
    const enabled = [].concat(b.enabled || []);
    await Guild.findOneAndUpdate({ guildId: guild.id }, { $set: {
      modLogChannelId: ch(b.modLogChannelId),
      'antiSpam.enabled': b.antiSpamEnabled === 'on',
      'antiSpam.maxMessages': Math.min(Math.max(parseInt(b.antiSpamMax) || 5, 3), 20),
      disabledCommands: [...client.commands.keys()].filter(n => !enabled.includes(n)),
      'stream.channelId': ch(b.streamChannelId),
      'stream.mentionRoleId': role(b.mentionRoleId),
      'stream.message': String(b.streamMessage || '').slice(0, 300) || '🔴 {streamer} بدأ البث على {platform}!'
    } }, { upsert: true });
    invalidate(guild.id);
    res.redirect(`/dashboard/${guild.id}?saved=1`);
  });

  // إضافة حساب بث
  app.post('/dashboard/:guildId/streamers', requireLogin, guildAccess, async (req, res) => {
    const { platform, username } = req.body;
    const name = String(username || '').trim();
    if (!PLATFORMS.includes(platform) || !/^@?[\w.-]{2,50}$/.test(name))
      return res.status(400).render('error', { message: 'بيانات غير صالحة.' });
    const doc = await Guild.findOneAndUpdate({ guildId: req.guild.id }, { $setOnInsert: { guildId: req.guild.id } }, { upsert: true, new: true });
    const dup = doc.streamers.some(s => s.platform === platform && s.username.toLowerCase() === name.toLowerCase());
    if (!dup && doc.streamers.length < 10) { doc.streamers.push({ platform, username: name }); await doc.save(); }
    invalidate(req.guild.id);
    res.redirect(`/dashboard/${req.guild.id}?saved=1`);
  });

  // حذف حساب بث
  app.post('/dashboard/:guildId/streamers/:id/delete', requireLogin, guildAccess, async (req, res) => {
    await Guild.updateOne({ guildId: req.guild.id }, { $pull: { streamers: { _id: req.params.id } } });
    invalidate(req.guild.id);
    res.redirect(`/dashboard/${req.guild.id}?saved=1`);
  });

  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`🌐 Dashboard on port ${port}`));
};
