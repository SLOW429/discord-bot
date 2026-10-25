import { getGuildConfig } from '../lib/config.js';
import { logGuildEvent } from '../lib/logger.js';

export default async function guildMemberRemove(member) {
  await logGuildEvent(member.guild, 'Member left', `${member.user.tag} (${member.id}) left the server.`);

  const config = await getGuildConfig(member.guild.id);
  if (!config.features.welcome || !config.welcome.channelId) return;
  const channel = await member.guild.channels.fetch(config.welcome.channelId);
  if (!channel?.isTextBased()) return;
  const text = config.welcome.leaveMessage
    .replaceAll('{user}', member.user.username)
    .replaceAll('{server}', member.guild.name);
  await channel.send({ content: text.slice(0, 2000) });
}
