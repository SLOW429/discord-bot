const Guild = require('../models/Guild');

// كاش قصير لإعدادات السيرفر حتى لا نضرب القاعدة مع كل رسالة
const cache = new Map();
const TTL = 60_000;
const MAX_CACHE_SIZE = 5_000;
const DEFAULTS = {
  antiSpam: { enabled: true, maxMessages: 5, intervalSec: 5 },
  stream: { channelId: null, mentionRoleId: null, message: '{streamer} بدأ البث على {platform}!' },
  welcome: {
    enabled: false,
    channelId: null,
    message: 'أهلاً {user} في {server}!',
    imageUrl: null,
    leaveEnabled: false,
    leaveMessage: 'غادر {user} السيرفر.',
    autoRoleId: null
  },
  antiRaid: { enabled: false, joinThreshold: 8, windowSec: 10, timeoutMinutes: 10 },
  security: {
    antiLinks: false,
    antiMassMention: false,
    mentionThreshold: 5,
    antiNuke: false,
    nukeThreshold: 3,
    nukeWindowSec: 10
  },
  ticketing: { panelChannelId: null, categoryId: null, staffRoleId: null, logChannelId: null },
  musicState: { songs: [], volume: 50, repeatMode: 0, paused: false, filters: [] }
};

function applyDefaults(doc) {
  return {
    ...doc,
    antiSpam: { ...DEFAULTS.antiSpam, ...doc.antiSpam },
    stream: { ...DEFAULTS.stream, ...doc.stream },
    streamers: doc.streamers || [],
    disabledCommands: doc.disabledCommands || [],
    welcome: { ...DEFAULTS.welcome, ...doc.welcome },
    antiRaid: { ...DEFAULTS.antiRaid, ...doc.antiRaid },
    security: { ...DEFAULTS.security, ...doc.security },
    ticketing: { ...DEFAULTS.ticketing, ...doc.ticketing },
    customCommands: doc.customCommands || [],
    musicState: { ...DEFAULTS.musicState, ...doc.musicState }
  };
}

async function getGuild(guildId) {
  const hit = cache.get(guildId);
  if (hit && Date.now() - hit.t < TTL) return hit.doc;
  let doc;
  try {
    doc = await Guild.findOneAndUpdate(
      { guildId }, { $setOnInsert: { guildId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
  } catch (error) {
    if (error.code !== 11000) throw error;
    doc = await Guild.findOne({ guildId }).lean();
    if (!doc) throw error;
  }
  if (cache.size >= MAX_CACHE_SIZE) {
    const now = Date.now();
    for (const [id, entry] of cache) {
      if (now - entry.t > TTL) cache.delete(id);
    }
    while (cache.size >= MAX_CACHE_SIZE) cache.delete(cache.keys().next().value);
  }
  const normalized = applyDefaults(doc);
  cache.set(guildId, { doc: normalized, t: Date.now() });
  return normalized;
}

// تُستدعى بعد أي حفظ من الداشبورد ليظهر التغيير فوراً
const invalidate = (guildId) => cache.delete(guildId);

module.exports = { getGuild, invalidate };
