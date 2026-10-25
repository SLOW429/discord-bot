import { getGuildConfig } from '../lib/config.js';
import { logGuildEvent } from '../lib/logger.js';
import { GuildConfig } from '../models/GuildConfig.js';
import { Warning } from '../models/Warning.js';

const recentMessages = new Map();
const cleanupInterval = setInterval(() => {
  const cutoff = Date.now() - 60_000;
  for (const [key, timestamps] of recentMessages) {
    if (timestamps.length === 0 || timestamps.at(-1) < cutoff) recentMessages.delete(key);
  }
}, 60_000);
cleanupInterval.unref();

export default async function messageCreate(message) {
  if (!message.guild || !message.member || message.author.bot) return;
  const config = await getGuildConfig(message.guild.id);
  if (message.member?.permissions.has('Administrator')
    || message.member?.roles.cache.some(role => config.moderation.modRoleIds.includes(role.id))) return;

  const now = Date.now();
  const violations = [];
  if (config.features.antiSpam) {
    const key = `${message.guild.id}:${message.author.id}`;
    const recent = (recentMessages.get(key) ?? [])
      .filter(time => now - time < config.moderation.antiSpamWindowMs);
    recent.push(now);
    recentMessages.set(key, recent);
    if (recent.length >= config.moderation.antiSpamLimit) {
      recentMessages.set(key, []);
      violations.push('anti-spam');
    }
  }
  if (config.features.antiInvite && /(?:discord\.gg\/|discord(?:app)?\.com\/invite\/)\S+/i.test(message.content)) {
    violations.push('anti-invite');
  }
  if (config.features.antiLink && /https?:\/\/\S+/i.test(message.content)) {
    violations.push('anti-link');
  }
  if (config.features.antiMassMention
    && (message.mentions.users.size + message.mentions.roles.size >= config.moderation.massMentionLimit
      || message.mentions.everyone)) {
    violations.push('anti-mass-mention');
  }
  if (!violations.length) return;

  try {
    await message.delete();
  } catch (error) {
    if (error.code === 50013) {
      console.warn(`Auto-mod could not delete a message in guild ${message.guild.id}: missing permission.`);
    } else {
      throw error;
    }
  }

  const latestConfig = await GuildConfig.findOneAndUpdate(
    { guildId: message.guild.id },
    { $inc: { 'moderation.caseCounter': 1 } },
    { new: true },
  );
  const caseId = latestConfig.moderation.caseCounter;
  const reason = violations.join(', ');
  await Warning.create({
    guildId: message.guild.id,
    userId: message.author.id,
    moderatorId: message.client.user.id,
    reason: `Auto-mod: ${reason}`,
    caseId,
  });

  const member = message.member;
  const action = latestConfig.moderation.automodAction;
  if (action === 'timeout') {
    if (!member.moderatable) {
      console.warn(`Auto-mod could not timeout ${message.author.id} in guild ${message.guild.id}: role hierarchy.`);
    } else {
      await member.timeout(latestConfig.moderation.automodTimeoutMs, `Auto-mod: ${reason}`);
    }
  } else if (action === 'kick') {
    if (!member.kickable) {
      console.warn(`Auto-mod could not kick ${message.author.id} in guild ${message.guild.id}: role hierarchy.`);
    } else {
      await member.kick(`Auto-mod: ${reason}`);
    }
  } else if (action === 'ban') {
    if (!member.bannable) {
      console.warn(`Auto-mod could not ban ${message.author.id} in guild ${message.guild.id}: role hierarchy.`);
    } else {
      await member.ban({ reason: `Auto-mod: ${reason}` });
    }
  }
  await logGuildEvent(
    message.guild,
    'Auto-mod action',
    `Case #${caseId}: ${message.author.tag} (${message.author.id}); action: ${action}; violation: ${reason}.`,
  );
}
