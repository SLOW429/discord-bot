const { EmbedBuilder } = require('discord.js');
const Guild = require('../models/Guild');

const checkers = {
  kick: require('./streams/kick'),
  youtube: require('./streams/youtube'),
  tiktok: require('./streams/tiktok')
};
const META = {
  kick:    { name: 'Kick',    color: 0x53fc18 },
  youtube: { name: 'YouTube', color: 0xff0000 },
  tiktok:  { name: 'TikTok',  color: 0x25f4ee }
};
const INTERVAL = 2 * 60 * 1000; // فحص كل دقيقتين
let running = false;

// يرسل إشعار البث في القناة المحددة من الداشبورد
async function notify(client, g, s, res) {
  const channel = await client.channels.fetch(g.stream.channelId).catch(() => null);
  if (!channel) return;
  const meta = META[s.platform];
  const text = (g.stream.message || '').replace('{streamer}', s.username).replace('{platform}', meta.name);

  const embed = new EmbedBuilder().setColor(meta.color)
    .setTitle(res.title || `${s.username} بث مباشر الآن`).setURL(res.url)
    .setDescription(`🔴 **${s.username}** يبث الآن على **${meta.name}**\n[اضغط للمشاهدة](${res.url})`)
    .setTimestamp();
  if (res.thumbnail) embed.setImage(`${res.thumbnail}${res.thumbnail.includes('?') ? '&' : '?'}t=${Date.now()}`); // كسر الكاش

  const role = g.stream.mentionRoleId ? `<@&${g.stream.mentionRoleId}> ` : '';
  await channel.send({
    content: `${role}${text}`, embeds: [embed],
    allowedMentions: { roles: g.stream.mentionRoleId ? [g.stream.mentionRoleId] : [] }
  }).catch(err => console.error('notify failed:', err.message));
}

async function runCheck(client) {
  if (running) return;
  running = true;
  try {
    const guilds = await Guild.find({ 'streamers.0': { $exists: true }, 'stream.channelId': { $ne: null } });
    const cache = new Map(); // نفس الحساب في عدة سيرفرات = طلب واحد فقط لكل دورة

    const status = (s) => {
      const key = `${s.platform}:${s.username.toLowerCase()}`;
      if (!cache.has(key)) cache.set(key, checkers[s.platform](s.username, s).catch(e => {
        console.error(`[streams] ${key}:`, e.message); return null;
      }));
      return cache.get(key);
    };

    for (const g of guilds) {
      let changed = false;
      for (const s of g.streamers) {
        const res = await status(s);
        if (!res) continue; // فشل الفحص: لا نغيّر الحالة
        if (res.externalId && s.externalId !== res.externalId) { s.externalId = res.externalId; changed = true; }
        if (res.isLive && !s.isLive) await notify(client, g, s, res); // انتقال من غير مباشر → مباشر فقط
        if (res.isLive !== s.isLive) { s.isLive = res.isLive; changed = true; }
      }
      if (changed) await g.save();
    }
  } catch (err) {
    console.error('[streams] run failed:', err);
  } finally { running = false; }
}

function startStreamChecker(client) {
  runCheck(client);
  setInterval(() => runCheck(client), INTERVAL);
  console.log('📡 Stream checker started');
}

module.exports = { startStreamChecker };
