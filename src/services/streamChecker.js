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
const INTERVAL = Math.max(30, Math.min(Number(process.env.STREAM_CHECK_INTERVAL_SECONDS) || 60, 900)) * 1000;
const YOUTUBE_INTERVAL = Math.max(5, Math.min(Number(process.env.YOUTUBE_POLL_INTERVAL_MINUTES) || 15, 1440)) * 60 * 1000;
const MAX_YOUTUBE_CACHE = 5_000;
let running = false;
let timer = null;
const youtubeCache = new Map();

// يرسل إشعار البث في القناة المحددة من الداشبورد
async function notify(client, g, s, res) {
  const channel = await client.channels.fetch(g.stream.channelId).catch(err => {
    console.error(`[streams] Could not fetch notification channel ${g.stream.channelId}:`, err.message);
    return null;
  });
  if (!channel?.isTextBased() || !res.url) return false;
  const meta = META[s.platform];
  if (!meta) return false;
  const text = (g.stream.message || '').replace('{streamer}', s.username).replace('{platform}', meta.name);

  const embed = new EmbedBuilder().setColor(meta.color)
    .setTitle(`🔴 ${String(res.title || `${s.username} بث مباشر الآن`).slice(0, 250)}`).setURL(res.url)
    .setDescription(`**${s.username}** يبث الآن على **${meta.name}**\n[اضغط للمشاهدة](${res.url})`)
    .setTimestamp();
  if (res.thumbnail) embed.setImage(`${res.thumbnail}${res.thumbnail.includes('?') ? '&' : '?'}t=${Date.now()}`); // كسر الكاش

  const role = g.stream.mentionRoleId ? `<@&${g.stream.mentionRoleId}> ` : '';
  try {
    await channel.send({
      content: `${role}${text}`, embeds: [embed],
      allowedMentions: { roles: g.stream.mentionRoleId ? [g.stream.mentionRoleId] : [] }
    });
    return true;
  } catch (error) {
    console.error(`[streams] Could not send ${s.platform} live notification to guild ${g.guildId}:`, error);
    return false;
  }
}

async function getStatus(s, cycleCache) {
  const key = `${s.platform}:${s.username.trim().replace(/^@/, '').toLowerCase()}`;
  if (cycleCache.has(key)) return cycleCache.get(key);

  const request = (async () => {
    if (s.platform !== 'youtube')
      return checkers[s.platform](s.username, s);

    let cached = youtubeCache.get(key);
    if (!cached || cached.expiresAt <= Date.now()) {
      if (youtubeCache.size >= MAX_YOUTUBE_CACHE) {
        const now = Date.now();
        for (const [cacheKey, entry] of youtubeCache) {
          if (entry.expiresAt <= now) youtubeCache.delete(cacheKey);
        }
        while (youtubeCache.size >= MAX_YOUTUBE_CACHE)
          youtubeCache.delete(youtubeCache.keys().next().value);
      }
      cached = {
        expiresAt: Date.now() + YOUTUBE_INTERVAL,
        promise: Promise.resolve().then(() => checkers.youtube(s.username, s))
      };
      youtubeCache.set(key, cached);
    }

    try {
      return await cached.promise;
    } catch (error) {
      if (youtubeCache.get(key) === cached) {
        cached.expiresAt = Date.now() + YOUTUBE_INTERVAL;
        cached.promise = Promise.resolve(null);
      }
      throw error;
    }
  })().catch(error => {
    console.error(`[streams] ${key}:`, error.message);
    return null;
  });

  cycleCache.set(key, request);
  return request;
}

async function runCheck(client) {
  if (running) return;
  running = true;
  try {
    const guilds = await Guild.find({
      'streamers.0': { $exists: true },
      'stream.channelId': { $exists: true, $nin: [null, ''] }
    });
    const cache = new Map();

    for (const g of guilds) {
      let changed = false;
      for (const s of g.streamers) {
        const checker = checkers[s.platform];
        if (!checker) {
          console.warn(`[streams] Unsupported platform ${s.platform} in guild ${g.guildId}`);
          continue;
        }
        const res = await getStatus(s, cache);
        if (!res) continue; // فشل الفحص: لا نغيّر الحالة
        if (res.externalId && s.externalId !== res.externalId) { s.externalId = res.externalId; changed = true; }
        if (res.isLive && !s.isLive) {
          if (!await notify(client, g, s, res)) continue;
          s.isLive = true;
          changed = true;
        } else if (!res.isLive && s.isLive) {
          s.isLive = false;
          changed = true;
        }
      }
      if (changed) await g.save();
    }
  } catch (err) {
    console.error('[streams] run failed:', err);
  } finally { running = false; }
}

function startStreamChecker(client) {
  if (timer) return;
  runCheck(client);
  timer = setInterval(() => runCheck(client), INTERVAL);
  timer.unref();
  console.log(`Stream checker started (poll=${INTERVAL / 1000}s, YouTube=${YOUTUBE_INTERVAL / 60_000}m)`);
}

module.exports = { startStreamChecker, runCheck };
