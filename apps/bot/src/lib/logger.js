import { EmbedBuilder } from 'discord.js';
import { getGuildConfig } from './config.js';

export async function logGuildEvent(guild, title, description) {
  const config = await getGuildConfig(guild.id);
  const channelId = config.logging.channelId;
  if (!channelId) return;

  const channel = await guild.channels.fetch(channelId);
  if (!channel?.isTextBased()) return;

  await channel.send({
    embeds: [new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(title)
      .setDescription(description.slice(0, 4000))
      .setTimestamp()],
  });
}
