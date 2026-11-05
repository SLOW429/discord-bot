const { getGuild } = require('../utils/getGuild');
const modLog = require('../utils/modLog');
const { recordActivity } = require('../utils/analytics');

const hits = new Map(); // "guild-user" -> [timestamps]
const xpCooldowns = new Map();
const timeoutPending = new Set();
const XP_COOLDOWN = 60_000;
const MAX_TRACKED_USERS = 50_000;
const CUSTOM_PREFIX = '!';

function pruneMap(map, now) {
  for (const [key, expiresAt] of map) {
    if (expiresAt > now) continue;
    map.delete(key);
    if (map.size <= MAX_TRACKED_USERS) return;
  }
  while (map.size > MAX_TRACKED_USERS) map.delete(map.keys().next().value);
}

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (!message.guild || message.author.bot || !message.member) return;
    recordActivity(message.guild.id, 'messages');
    const s = await getGuild(message.guild.id);

    if (!message.member.permissions.has('ManageMessages')) {
      const linkDetected = s.security.antiLinks
        && /(?:https?:\/\/|www\.)\S+/i.test(message.content);
      const mentionCount = message.mentions.users.size + message.mentions.roles.size
        + Number(message.mentions.everyone);
      const massMention = s.security.antiMassMention && mentionCount >= s.security.mentionThreshold;
      if (linkDetected || massMention) {
        try {
          await message.delete();
          const reason = massMention ? 'Excessive mentions' : 'Link filter';
          if (message.member.moderatable)
            await message.member.timeout(60_000, reason);
          await modLog(message.guild, reason, message.author, message.client.user, 'Automatic message security rule');
        } catch (error) {
          console.error(`[security] Could not enforce message rule for ${message.author.id} in ${message.guild.id}:`, error);
        }
        return;
      }
    }

    if (message.content.startsWith(CUSTOM_PREFIX)) {
      const [trigger] = message.content.slice(CUSTOM_PREFIX.length).trim().split(/\s+/, 1);
      const command = s.customCommands.find(c => c.trigger.toLowerCase() === trigger?.toLowerCase());
      if (command) {
        const response = command.response
          .replaceAll('{user}', message.author.toString())
          .replaceAll('{server}', message.guild.name)
          .replaceAll('{memberCount}', String(message.guild.memberCount));
        await message.channel.send({ content: response, allowedMentions: { parse: [] } });
      }
    }

    const now = Date.now();
    const cooldownKey = `${message.guild.id}-${message.author.id}`;
    if ((xpCooldowns.get(cooldownKey) || 0) <= now) {
      xpCooldowns.set(cooldownKey, now + XP_COOLDOWN);
      if (xpCooldowns.size > MAX_TRACKED_USERS) pruneMap(xpCooldowns, now);
      const User = require('../models/User');
      const filter = { guildId: message.guild.id, userId: message.author.id };
      let user;
      try {
        user = await User.findOneAndUpdate(filter,
          { $inc: { xp: 10 + Math.floor(Math.random() * 11) } },
          { upsert: true, new: true, setDefaultsOnInsert: true });
      } catch (error) {
        if (error.code !== 11000) throw error;
        user = await User.findOneAndUpdate(filter,
          { $inc: { xp: 10 + Math.floor(Math.random() * 11) } }, { new: true });
      }
      const level = Math.floor(Math.sqrt(user.xp / 100));
      if (level > user.level) {
        const updated = await User.updateOne({
          ...filter,
          $or: [{ level: { $lt: level } }, { level: { $exists: false } }]
        }, { $set: { level } });
        if (updated.modifiedCount) {
          await message.channel.send({
            content: `${message.author} وصل إلى المستوى **${level}**!`,
            allowedMentions: { users: [message.author.id] }
          });
        }
      }
    }

    if (!s.antiSpam.enabled || message.member.permissions.has('ManageMessages')) return;

    const key = `${message.guild.id}-${message.author.id}`;
    const list = (hits.get(key) || []).filter(t => now - t < s.antiSpam.intervalSec * 1000);
    list.push(now);
    hits.set(key, list);
    if (hits.size > MAX_TRACKED_USERS) {
      for (const [trackedKey, timestamps] of hits) {
        if (timestamps.some(t => now - t < s.antiSpam.intervalSec * 1000)) continue;
        hits.delete(trackedKey);
        if (hits.size <= MAX_TRACKED_USERS) break;
      }
      while (hits.size > MAX_TRACKED_USERS) hits.delete(hits.keys().next().value);
    }

    if (list.length >= s.antiSpam.maxMessages && message.member.moderatable && !timeoutPending.has(key)) {
      hits.delete(key);
      timeoutPending.add(key);
      try {
        await message.member.timeout(60_000, 'Anti-spam');
        await message.channel.send({
          content: `${message.author}، توقف عن الإزعاج (Timeout دقيقة).`,
          allowedMentions: { users: [message.author.id] }
        });
        await modLog(message.guild, 'Anti-Spam Timeout', message.author, message.client.user, 'إرسال رسائل بسرعة');
      } catch (error) {
        console.error(`[anti-spam] Failed to timeout ${message.author.id} in ${message.guild.id}:`, error);
      } finally {
        timeoutPending.delete(key);
      }
    }
  }
};
