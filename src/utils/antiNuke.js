const { AuditLogEvent } = require('discord.js');
const { getGuild } = require('./getGuild');
const modLog = require('./modLog');

const actions = new Map();
const MAX_TRACKED_ACTORS = 10_000;

async function inspectAuditEvent(guild, targetId, type) {
  const settings = await getGuild(guild.id);
  const config = settings.security;
  if (!config.antiNuke) return;

  const logs = await guild.fetchAuditLogs({ type, limit: 5 });
  const entry = logs.entries.find(item =>
    item.target?.id === targetId && Date.now() - item.createdTimestamp < 15_000
  );
  const executor = entry?.executor;
  if (!executor || executor.bot || executor.id === guild.ownerId) return;

  const member = await guild.members.fetch(executor.id).catch(error => {
    if (error.code === 10007) return null;
    throw error;
  });
  if (!member || member.permissions.has('Administrator')) return;

  const key = `${guild.id}:${executor.id}`;
  if (!actions.has(key) && actions.size >= MAX_TRACKED_ACTORS)
    actions.delete(actions.keys().next().value);
  const now = Date.now();
  const recent = (actions.get(key) || [])
    .filter(timestamp => now - timestamp < config.nukeWindowSec * 1000);
  recent.push(now);
  actions.set(key, recent);

  if (recent.length < config.nukeThreshold) return;
  actions.delete(key);
  if (member.moderatable) {
    await member.timeout(60_000, 'Anti-nuke: destructive action threshold exceeded');
    await modLog(guild, 'Anti-Nuke Timeout', executor, guild.client.user,
      `${recent.length} destructive actions within ${config.nukeWindowSec} seconds`);
  } else {
    console.warn(`[anti-nuke] Threshold reached for ${executor.id} in ${guild.id}, but the bot cannot timeout the actor`);
  }
}

module.exports = { inspectAuditEvent, AuditLogEvent };
