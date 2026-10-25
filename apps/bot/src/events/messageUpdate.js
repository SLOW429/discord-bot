import { logGuildEvent } from '../lib/logger.js';

export default async function messageUpdate(oldMessage, newMessage) {
  if (!newMessage.guild || newMessage.author?.bot || oldMessage.content === newMessage.content) return;
  await logGuildEvent(
    newMessage.guild,
    'Message edited',
    `Message by ${newMessage.author?.tag ?? 'unknown user'} in <#${newMessage.channelId}>: `
      + `[jump to message](${newMessage.url})\nBefore: ${(oldMessage.content || '[unavailable]').slice(0, 900)}`
      + `\nAfter: ${(newMessage.content || '[empty]').slice(0, 900)}`,
  );
}
