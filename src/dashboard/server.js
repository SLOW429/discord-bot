const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, PermissionFlagsBits
} = require('discord.js');
const Guild = require('../models/Guild');
const GuildAnalytics = require('../models/GuildAnalytics');
const Warn = require('../models/Warn');
const { getGuild, invalidate } = require('../utils/getGuild');
const modLog = require('../utils/modLog');

const DISCORD = 'https://discord.com/api/v10';
const PLATFORMS = ['kick', 'youtube', 'tiktok'];
const AUDIO_FILTERS = new Set(['bassboost', 'nightcore', '3d', 'karaoke', 'vaporwave']);
const asyncHandler = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const guildPermissionCache = new Map();
const GUILD_PERMISSION_TTL = 30_000;

module.exports = function startDashboard(client) {
  const app = express();
  const { BASE_URL, CLIENT_ID, CLIENT_SECRET, SESSION_SECRET, MONGODB_URI } = process.env;
  const isProd = process.env.NODE_ENV === 'production' || BASE_URL?.startsWith('https');

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.set('trust proxy', 1); // Render/Railway خلف Proxy (ضروري لـ cookie آمن)
  app.use(express.urlencoded({ extended: false, limit: '20kb' }));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(session({
    secret: SESSION_SECRET, resave: false, saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: MONGODB_URI }),     // الجلسات تبقى بعد إعادة التشغيل
    cookie: { httpOnly: true, secure: isProd, sameSite: 'lax', maxAge: 7 * 86400_000 }
  }));

  // رمز CSRF لكل جلسة + تمرير المستخدم للقوالب
  app.use((req, res, next) => {
    if (req.path === '/health') return next();
    req.session.csrf ||= crypto.randomBytes(24).toString('hex');
    res.locals.csrf = req.session.csrf;
    res.locals.user = req.session.user || null;
    if (req.method === 'POST' && req.body._csrf !== req.session.csrf)
      return res.status(403).render('error', { message: 'رمز الحماية غير صالح، أعد تحميل الصفحة.' });
    next();
  });

  const requireLogin = (req, res, next) => (req.session.user ? next() : res.redirect('/login'));

  // يتحقق أن المستخدم يدير السيرفر وأن البوت موجود فيه
  const guildAccess = asyncHandler(async (req, res, next) => {
    const g = req.session.guilds?.find(x => x.id === req.params.guildId);
    if (!g) return res.status(403).render('error', { message: 'ليس لديك صلاحية على هذا السيرفر.' });
    const guild = client.guilds.cache.get(g.id);
    if (!guild) return res.redirect('/dashboard');
    const cacheKey = `${guild.id}:${req.session.user.id}`;
    let hasPermission = guildPermissionCache.get(cacheKey);
    if (!hasPermission || hasPermission.expiresAt <= Date.now()) {
      const member = await guild.members.fetch(req.session.user.id).catch(error => {
        if (error.code === 10007) return null;
        throw error;
      });
      hasPermission = {
        allowed: Boolean(member && (
          guild.ownerId === member.id ||
          member.permissions.has(PermissionFlagsBits.Administrator) ||
          member.permissions.has(PermissionFlagsBits.ManageGuild)
        )),
        expiresAt: Date.now() + GUILD_PERMISSION_TTL
      };
      guildPermissionCache.set(cacheKey, hasPermission);
      if (guildPermissionCache.size > 10_000)
        guildPermissionCache.delete(guildPermissionCache.keys().next().value);
    }
    if (!hasPermission.allowed)
      return res.status(403).render('error', { message: 'لم تعد تملك صلاحية إدارة هذا السيرفر.' });
    req.guild = guild;
    next();
  });

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
        }),
        signal: AbortSignal.timeout(10_000)
      });
      if (!tokenRes.ok) throw new Error('token exchange failed');
      const { access_token } = await tokenRes.json();
      const headers = { Authorization: `Bearer ${access_token}` };
      const [me, guilds] = await Promise.all([
        fetch(`${DISCORD}/users/@me`, { headers, signal: AbortSignal.timeout(10_000) })
          .then(r => { if (!r.ok) throw new Error('Discord profile request failed'); return r.json(); }),
        fetch(`${DISCORD}/users/@me/guilds`, { headers, signal: AbortSignal.timeout(10_000) })
          .then(r => { if (!r.ok) throw new Error('Discord guild request failed'); return r.json(); })
      ]);
      if (!me?.id || !Array.isArray(guilds)) throw new Error('Invalid Discord profile response');
      // نحتفظ فقط بالسيرفرات التي يملك فيها Manage Server (0x20) أو Administrator (0x8)
      const manageable = guilds.filter(g => g.owner || (BigInt(g.permissions) & 0x28n) !== 0n)
        .map(g => ({ id: g.id, name: g.name, icon: g.icon }));
      req.session.regenerate(err => { // منع Session Fixation
        if (err) {
          console.error('OAuth session regeneration failed:', err);
          return res.status(500).render('error', { message: 'تعذر إنشاء جلسة آمنة.' });
        }
        req.session.user = { id: me.id, username: me.global_name || me.username, avatar: me.avatar };
        req.session.guilds = manageable;
        res.redirect('/dashboard');
      });
    } catch (err) {
      console.error('OAuth error:', err.message);
      res.status(400).render('error', { message: 'فشل تسجيل الدخول.' });
    }
  });

  app.post('/logout', (req, res) => req.session.destroy(err => {
    if (err) {
      console.error('Session logout failed:', err);
      return res.status(500).render('error', { message: 'تعذر تسجيل الخروج.' });
    }
    res.clearCookie('connect.sid');
    res.redirect('/');
  }));

  // ---------- Dashboard ----------
  app.get('/dashboard', requireLogin, (req, res) => {
    const guilds = req.session.guilds.map(g => ({
      ...g, botIn: client.guilds.cache.has(g.id),
      invite: `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&scope=bot%20applications.commands&permissions=1099514883158&guild_id=${g.id}`
    }));
    res.render('dashboard', { guilds });
  });

  app.get('/dashboard/:guildId', requireLogin, guildAccess, asyncHandler(async (req, res) => {
    const { guild } = req;
    const settings = await getGuild(guild.id);
    const queue = client.music.getQueue(guild.id);
    const analyticsDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCDate(date.getUTCDate() - (6 - index));
      return date.toISOString().slice(0, 10);
    });
    const analyticsRows = await GuildAnalytics.find({
      guildId: guild.id,
      day: { $in: analyticsDays }
    }).lean();
    const analyticsByDay = new Map(analyticsRows.map(row => [row.day, row]));
    const analytics = analyticsDays.map(day => ({
      day,
      ...(analyticsByDay.get(day) || { messages: 0, commands: 0, joins: 0, leaves: 0 })
    }));
    res.render('guild', {
      guild, s: settings, saved: req.query.saved === '1',
      channels: guild.channels.cache.filter(c => c.type === ChannelType.GuildText).map(c => ({ id: c.id, name: c.name })),
      categories: guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).map(c => ({ id: c.id, name: c.name })),
      roles: guild.roles.cache.filter(r => r.id !== guild.id && !r.managed).map(r => ({ id: r.id, name: r.name })),
      commands: [...client.commands.values()].map(c => ({ name: c.data.name, category: c.category, description: c.data.description })),
      platforms: PLATFORMS,
      queue,
      analytics
    });
  }));

  // حفظ الإعدادات العامة
  app.post('/dashboard/:guildId', requireLogin, guildAccess, asyncHandler(async (req, res) => {
    const { guild, body: b } = req;
    // نتأكد أن القناة/الرتبة المختارة تنتمي فعلاً لهذا السيرفر
    const ch = id => (guild.channels.cache.get(id)?.type === ChannelType.GuildText ? id : null);
    const role = id => (guild.roles.cache.has(id) ? id : null);
    const enabled = [].concat(b.enabled || []);
    const imageUrl = validImageUrl(b.welcomeImageUrl) ? b.welcomeImageUrl.trim() : null;
    await Guild.findOneAndUpdate({ guildId: guild.id }, { $set: {
      modLogChannelId: ch(b.modLogChannelId),
      'antiSpam.enabled': b.antiSpamEnabled === 'on',
      'antiSpam.maxMessages': Math.min(Math.max(parseInt(b.antiSpamMax) || 5, 3), 20),
      disabledCommands: [...client.commands.keys()].filter(n => !enabled.includes(n)),
      'stream.channelId': ch(b.streamChannelId),
      'stream.mentionRoleId': role(b.mentionRoleId),
      'stream.message': String(b.streamMessage || '').slice(0, 300) || '{streamer} بدأ البث على {platform}!',
      'welcome.enabled': b.welcomeEnabled === 'on',
      'welcome.channelId': ch(b.welcomeChannelId),
      'welcome.message': String(b.welcomeMessage || '').slice(0, 500) || 'أهلاً {user} في {server}!',
      'welcome.imageUrl': imageUrl,
      'welcome.leaveEnabled': b.leaveEnabled === 'on',
      'welcome.leaveMessage': String(b.leaveMessage || '').slice(0, 500) || 'غادر {user} السيرفر.',
      'welcome.autoRoleId': role(b.autoRoleId),
      'antiRaid.enabled': b.antiRaidEnabled === 'on',
      'antiRaid.joinThreshold': Math.min(Math.max(parseInt(b.raidThreshold, 10) || 8, 3), 50),
      'antiRaid.windowSec': Math.min(Math.max(parseInt(b.raidWindow, 10) || 10, 3), 60),
      'antiRaid.timeoutMinutes': Math.min(Math.max(parseInt(b.raidTimeout, 10) || 10, 1), 40320),
      'security.antiLinks': b.antiLinksEnabled === 'on',
      'security.antiMassMention': b.antiMassMentionEnabled === 'on',
      'security.mentionThreshold': Math.min(Math.max(parseInt(b.mentionThreshold, 10) || 5, 2), 20),
      'security.antiNuke': b.antiNukeEnabled === 'on',
      'security.nukeThreshold': Math.min(Math.max(parseInt(b.nukeThreshold, 10) || 3, 2), 10),
      'security.nukeWindowSec': Math.min(Math.max(parseInt(b.nukeWindowSec, 10) || 10, 3), 60),
      'ticketing.panelChannelId': ch(b.ticketPanelChannelId),
      'ticketing.categoryId': guild.channels.cache.get(b.ticketCategoryId)?.type === ChannelType.GuildCategory ? b.ticketCategoryId : null,
      'ticketing.staffRoleId': role(b.ticketStaffRoleId),
      'ticketing.logChannelId': ch(b.ticketLogChannelId)
    } }, { upsert: true });
    invalidate(guild.id);
    res.redirect(`/dashboard/${guild.id}?saved=1`);
  }));

  app.post('/dashboard/:guildId/tickets/panel', requireLogin, guildAccess, asyncHandler(async (req, res) => {
    const settings = await getGuild(req.guild.id);
    const channel = settings.ticketing?.panelChannelId && req.guild.channels.cache.get(settings.ticketing.panelChannelId);
    if (!channel?.isTextBased() || !settings.ticketing.staffRoleId || !settings.ticketing.logChannelId)
      return res.status(400).json({ error: 'احفظ قناة اللوحة ورتبة الدعم وقناة السجلات أولاً.' });
    await channel.send({
      embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('Support')
        .setDescription('Press the button to open a private support ticket.')],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket:create').setLabel('Open a support ticket').setStyle(ButtonStyle.Primary)
      )]
    });
    res.json({ ok: true, message: 'تم نشر لوحة التذاكر.' });
  }));

  app.post('/dashboard/:guildId/moderation', requireLogin, guildAccess, asyncHandler(async (req, res) => {
    const { guild, body } = req;
    const action = String(body.action || '');
    const targetId = String(body.userId || '').trim();
    const reason = String(body.reason || '').trim().slice(0, 500) || 'غير محدد';
    const rawMinutes = String(body.minutes || '').trim();
    const minutes = Number(rawMinutes);
    if (!['ban', 'kick', 'timeout', 'warn'].includes(action) || !/^\d{17,20}$/.test(targetId))
      return res.status(400).json({ error: 'بيانات الإجراء غير صالحة.' });
    if (action === 'timeout' && (!/^\d+$/.test(rawMinutes) || !Number.isInteger(minutes) || minutes < 0 || minutes > 40320))
      return res.status(400).json({ error: 'مدة الكتم يجب أن تكون من 0 إلى 40320 دقيقة.' });

    const actor = await guild.members.fetch(req.session.user.id);
    const permission = {
      ban: PermissionFlagsBits.BanMembers,
      kick: PermissionFlagsBits.KickMembers,
      timeout: PermissionFlagsBits.ModerateMembers,
      warn: PermissionFlagsBits.ModerateMembers
    }[action];
    const actorIsOwner = guild.ownerId === actor.id;
    const actorIsAdmin = actor.permissions.has(PermissionFlagsBits.Administrator);
    if (!actorIsOwner && !actorIsAdmin && !actor.permissions.has(permission))
      return res.status(403).json({ error: 'لا تملك صلاحية تنفيذ هذا الإجراء.' });

    let target = null;
    try {
      target = await guild.members.fetch(targetId);
    } catch (error) {
      if (error.code !== 10007) throw error;
    }
    if (action !== 'ban' && !target)
      return res.status(404).json({ error: 'العضو غير موجود في هذا السيرفر.' });
    const targetUser = target?.user || await client.users.fetch(targetId);
    if (target && target.id === actor.id)
      return res.status(400).json({ error: 'لا يمكنك تنفيذ هذا الإجراء على نفسك.' });
    if (target && !actorIsOwner && target.roles.highest.position >= actor.roles.highest.position)
      return res.status(403).json({ error: 'رتبة العضو المستهدف أعلى من رتبتك أو مساوية لها.' });

    switch (action) {
      case 'ban':
        if (target && !target.bannable)
          return res.status(403).json({ error: 'لا يستطيع البوت حظر هذا العضو بسبب صلاحياته أو ترتيب الرتب.' });
        await guild.members.ban(targetId, { reason: `${actor.user.tag}: ${reason}` });
        break;
      case 'kick':
        if (!target || !target.kickable)
          return res.status(403).json({ error: 'لا يستطيع البوت طرد هذا العضو.' });
        await target.kick(`${actor.user.tag}: ${reason}`);
        break;
      case 'timeout':
        if (!target || !target.moderatable)
          return res.status(403).json({ error: 'لا يستطيع البوت كتم هذا العضو.' });
        await target.timeout(minutes ? minutes * 60_000 : null, `${actor.user.tag}: ${reason}`);
        break;
      case 'warn':
        await Warn.create({ guildId: guild.id, userId: targetId, moderatorId: actor.id, reason });
        break;
    }

    await modLog(guild, `${action[0].toUpperCase()}${action.slice(1)}`, targetUser, actor.user, reason);
    res.json({ ok: true, message: 'تم تنفيذ الإجراء بنجاح.' });
  }));

  // إضافة حساب بث
  app.post('/dashboard/:guildId/streamers', requireLogin, guildAccess, asyncHandler(async (req, res) => {
    const { platform, username } = req.body;
    const name = String(username || '').trim();
    if (!PLATFORMS.includes(platform) || !/^@?[\w.-]{2,50}$/.test(name))
      return res.status(400).render('error', { message: 'بيانات غير صالحة.' });
    const doc = await Guild.findOneAndUpdate({ guildId: req.guild.id }, { $setOnInsert: { guildId: req.guild.id } }, { upsert: true, new: true });
    const dup = doc.streamers.some(s => s.platform === platform && s.username.toLowerCase() === name.toLowerCase());
    if (!dup && doc.streamers.length < 10) { doc.streamers.push({ platform, username: name }); await doc.save(); }
    invalidate(req.guild.id);
    res.redirect(`/dashboard/${req.guild.id}?saved=1`);
  }));

  // حذف حساب بث
  app.post('/dashboard/:guildId/streamers/:id/delete', requireLogin, guildAccess, asyncHandler(async (req, res) => {
    await Guild.updateOne({ guildId: req.guild.id }, { $pull: { streamers: { _id: req.params.id } } });
    invalidate(req.guild.id);
    res.redirect(`/dashboard/${req.guild.id}?saved=1`);
  }));

  app.get('/dashboard/:guildId/music/state', requireLogin, guildAccess, (req, res) => {
    const queue = client.music.getQueue(req.guild.id);
    if (!queue) return res.json({ playing: false, songs: [] });
    res.json({
      playing: true,
      paused: queue.paused,
      volume: queue.volume,
      repeatMode: queue.repeatMode,
      filters: queue.filters,
      songs: queue.songs.slice(0, 10).map(song => ({
        name: song.name,
        url: song.url,
        duration: song.formattedDuration
      }))
    });
  });

  app.post('/dashboard/:guildId/music/:action', requireLogin, guildAccess, asyncHandler(async (req, res) => {
    const queue = client.music.getQueue(req.guild.id);
    if (!queue) return res.status(409).json({ error: 'لا يوجد تشغيل حالياً.' });
    switch (req.params.action) {
      case 'pause':
        if (!queue.paused) await client.music.setPaused(req.guild.id, true);
        break;
      case 'resume':
        if (queue.paused) await client.music.setPaused(req.guild.id, false);
        break;
      case 'skip':
        await client.music.skip(req.guild.id);
        break;
      case 'stop':
        await client.music.stop(req.guild.id);
        break;
      case 'volume': {
        const volume = Number(req.body.volume);
        if (!Number.isInteger(volume) || volume < 0 || volume > 100)
          return res.status(400).json({ error: 'مستوى الصوت يجب أن يكون بين 0 و100.' });
        await client.music.setVolume(req.guild.id, volume);
        break;
      }
      case 'filter': {
        const filter = String(req.body.filter || '');
        if (filter !== 'off' && !AUDIO_FILTERS.has(filter))
          return res.status(400).json({ error: 'مؤثر صوت غير مدعوم.' });
        await client.music.setFilter(req.guild.id, filter);
        break;
      }
      default:
        return res.status(404).json({ error: 'إجراء غير معروف.' });
    }
    res.json({ ok: true });
  }));

  app.post('/dashboard/:guildId/custom-commands', requireLogin, guildAccess, asyncHandler(async (req, res) => {
    const trigger = String(req.body.trigger || '').trim().toLowerCase();
    const response = String(req.body.response || '').trim();
    if (!/^[a-z0-9_-]{1,32}$/.test(trigger) || !response || response.length > 1000)
      return res.status(400).render('error', { message: 'اسم الأمر أو الرد غير صالح.' });
    const doc = await Guild.findOneAndUpdate({ guildId: req.guild.id },
      { $setOnInsert: { guildId: req.guild.id } }, { upsert: true, new: true });
    if (doc.customCommands.length >= 50)
      return res.status(400).render('error', { message: 'تم الوصول إلى الحد الأقصى وهو 50 أمراً.' });
    if (doc.customCommands.some(command => command.trigger === trigger))
      return res.status(400).render('error', { message: 'هذا الأمر موجود بالفعل.' });
    doc.customCommands.push({ trigger, response });
    await doc.save();
    invalidate(req.guild.id);
    res.redirect(`/dashboard/${req.guild.id}#custom`);
  }));

  app.post('/dashboard/:guildId/custom-commands/:id/delete', requireLogin, guildAccess, asyncHandler(async (req, res) => {
    await Guild.updateOne({ guildId: req.guild.id }, { $pull: { customCommands: { _id: req.params.id } } });
    invalidate(req.guild.id);
    res.redirect(`/dashboard/${req.guild.id}#custom`);
  }));

  const port = process.env.PORT || 3000;
  app.use((err, req, res, next) => {
    console.error('Dashboard request failed:', err);
    if (res.headersSent) return next(err);
    if (req.accepts('json')) return res.status(500).json({ error: 'حدث خطأ داخلي. حاول مرة أخرى لاحقاً.' });
    res.status(500).render('error', { message: 'حدث خطأ داخلي. حاول مرة أخرى لاحقاً.' });
  });
  app.listen(port, () => console.log(`Dashboard listening on port ${port}`));
};

function validImageUrl(value) {
  if (typeof value !== 'string' || value.length > 500) return false;
  try {
    return new URL(value.trim()).protocol === 'https:';
  } catch {
    return false;
  }
}
