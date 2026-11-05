const Guild = require('../models/Guild');

// كاش قصير لإعدادات السيرفر حتى لا نضرب القاعدة مع كل رسالة
const cache = new Map();
const TTL = 60_000;

async function getGuild(guildId) {
  const hit = cache.get(guildId);
  if (hit && Date.now() - hit.t < TTL) return hit.doc;
  const doc = await Guild.findOneAndUpdate(
    { guildId }, { $setOnInsert: { guildId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  cache.set(guildId, { doc, t: Date.now() });
  return doc;
}

// تُستدعى بعد أي حفظ من الداشبورد ليظهر التغيير فوراً
const invalidate = (guildId) => cache.delete(guildId);

module.exports = { getGuild, invalidate };
