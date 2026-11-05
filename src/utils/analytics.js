const GuildAnalytics = require('../models/GuildAnalytics');

const pending = new Map();
const METRICS = ['messages', 'commands', 'joins', 'leaves'];
let flushing = false;

function utcDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function recordActivity(guildId, metric) {
  if (!METRICS.includes(metric)) throw new TypeError(`Unknown analytics metric: ${metric}`);
  const day = utcDay();
  const key = `${guildId}:${day}`;
  const entry = pending.get(key) || { guildId, day, messages: 0, commands: 0, joins: 0, leaves: 0 };
  entry[metric] += 1;
  pending.set(key, entry);
}

async function flushAnalytics() {
  if (!pending.size || flushing) return;
  flushing = true;
  const batch = [...pending.entries()].map(([key, value]) => [key, { ...value }]);
  try {
    for (const [key, written] of batch) {
      await GuildAnalytics.updateOne(
        { guildId: written.guildId, day: written.day },
        {
          $setOnInsert: { guildId: written.guildId, day: written.day },
          $inc: Object.fromEntries(METRICS.map(metric => [metric, written[metric]]))
        },
        { upsert: true }
      );
      const current = pending.get(key);
      if (!current) continue;
      for (const metric of METRICS) current[metric] -= written[metric];
      if (METRICS.every(metric => current[metric] === 0)) pending.delete(key);
    }
  } finally {
    flushing = false;
  }
}

const timer = setInterval(() => {
  flushAnalytics().catch(error => console.error('[analytics] Failed to flush counters:', error));
}, 30_000);
timer.unref();

module.exports = { recordActivity, flushAnalytics };
