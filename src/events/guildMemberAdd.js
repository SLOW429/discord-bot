const { EmbedBuilder } = require('discord.js');
const { getGuild } = require('../utils/getGuild');
const modLog = require('../utils/modLog');
const { recordActivity } = require('../utils/analytics');

const joins = new Map();
const MAX_TRACKED_GUILDS = 5_000;

function renderMessage(template, member) {
  return template
    .replaceAll('{user}', member.user.username)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{memberCount}', String(member.guild.memberCount));
}

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    recordActivity(member.guild.id, 'joins');
    const settings = await getGuild(member.guild.id);
    const { welcome, antiRaid } = settings;

    if (antiRaid.enabled) {
      const now = Date.now();
      if (!joins.has(member.guild.id) && joins.size >= MAX_TRACKED_GUILDS)
        joins.delete(joins.keys().next().value);
      const recent = (joins.get(member.guild.id) || [])
        .filter(timestamp => now - timestamp < antiRaid.windowSec * 1000);
      recent.push(now);
      if (recent.length > antiRaid.joinThreshold)
        recent.splice(0, recent.length - antiRaid.joinThreshold);
      joins.set(member.guild.id, recent);

      if (recent.length >= antiRaid.joinThreshold) {
        if (member.moderatable) {
          try {
            await member.timeout(antiRaid.timeoutMinutes * 60_000, 'Anti-raid join burst');
            await modLog(member.guild, 'Anti-Raid Timeout', member.user, member.client.user,
              `${recent.length} انضمامات خلال ${antiRaid.windowSec} ثوانٍ`);
          } catch (error) {
            console.error(`[anti-raid] Could not timeout ${member.id} in ${member.guild.id}:`, error);
          }
        } else {
          console.warn(`[anti-raid] Cannot timeout ${member.id} in ${member.guild.id}; check bot permissions and role hierarchy`);
        }
        return;
      }
    }

    if (welcome.autoRoleId) {
      const role = member.guild.roles.cache.get(welcome.autoRoleId);
      if (role && role.editable) {
        try {
          await member.roles.add(role, 'Automatic welcome role');
        } catch (error) {
          console.error(`[welcome] Could not assign role ${role.id} in ${member.guild.id}:`, error);
        }
      } else {
        console.warn(`[welcome] Configured auto-role ${welcome.autoRoleId} is unavailable or not assignable in ${member.guild.id}`);
      }
    }

    if (welcome.enabled && welcome.channelId) {
      const channel = member.guild.channels.cache.get(welcome.channelId);
      if (channel?.isTextBased()) {
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setDescription(renderMessage(welcome.message, member))
          .setThumbnail(member.user.displayAvatarURL());
        if (welcome.imageUrl) embed.setImage(welcome.imageUrl);
        try {
          await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
        } catch (error) {
          console.error(`[welcome] Could not send welcome message in ${channel.id}:`, error);
        }
      }
    }
  }
};
