import { logGuildEvent } from '../lib/logger.js';

export default async function messageDelete(message) {
  if (!message.guild || message.author?.bot) return;
  await logGuildEvent(
    message.guild,
    'Message deleted',
    `A message by ${message.author?.tag ?? 'unknown user'} was deleted in <#${message.channelId}>.`,
  );
}
