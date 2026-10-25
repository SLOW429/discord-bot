import { EmbedBuilder } from 'discord.js';
import { getGuildConfig } from '../lib/config.js';
import { logGuildEvent } from '../lib/logger.js';

const joinWindows = new Map();
const raidAlertTimes = new Map();

export default async function guildMemberAdd(member) {
  const config = await getGuildConfig(member.guild.id);

  if (config.features.antiRaid) {
    const now = Date.now();
    const recent = (joinWindows.get(member.guild.id) ?? []).filter(time => now - time < 10_000);
    recent.push(now);
    joinWindows.set(member.guild.id, recent);
    if (recent.length >= 10 && now - (raidAlertTimes.get(member.guild.id) ?? 0) >= 60_000) {
      raidAlertTimes.set(member.guild.id, now);
      await logGuildEvent(member.guild, 'Possible raid activity', `${recent.length} members joined within 10 seconds.`);
    }
  }

  await logGuildEvent(member.guild, 'Member joined', `${member.user.tag} (${member.id}) joined the server.`);
  if (!config.features.welcome || !config.welcome.channelId) return;
  const channel = await member.guild.channels.fetch(config.welcome.channelId);
  if (!channel?.isTextBased()) return;
  const text = config.welcome.message
    .replaceAll('{user}', `<@${member.id}>`)
    .replaceAll('{server}', member.guild.name);
  await channel.send({
    embeds: [new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('Welcome!')
      .setDescription(text.slice(0, 4000))
      .setThumbnail(member.displayAvatarURL())
      .setTimestamp()],
  });
}
