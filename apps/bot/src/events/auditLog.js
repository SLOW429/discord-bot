import { Events } from 'discord.js';
import { logGuildEvent } from '../lib/logger.js';

export function attachAuditEvents(client) {
  const events = [
    [Events.ChannelCreate, channel => logGuildEvent(channel.guild, 'Channel created', `${channel.name} (${channel.id})`)],
    [Events.ChannelDelete, channel => logGuildEvent(channel.guild, 'Channel deleted', `${channel.name} (${channel.id})`)],
    [Events.ChannelUpdate, (oldChannel, newChannel) => {
      if (oldChannel.name !== newChannel.name) {
        return logGuildEvent(newChannel.guild, 'Channel updated', `${oldChannel.name} → ${newChannel.name} (${newChannel.id})`);
      }
      return Promise.resolve();
    }],
    [Events.RoleCreate, role => logGuildEvent(role.guild, 'Role created', `${role.name} (${role.id})`)],
    [Events.RoleDelete, role => logGuildEvent(role.guild, 'Role deleted', `${role.name} (${role.id})`)],
    [Events.RoleUpdate, (oldRole, newRole) => {
      if (oldRole.name !== newRole.name) {
        return logGuildEvent(newRole.guild, 'Role updated', `${oldRole.name} → ${newRole.name} (${newRole.id})`);
      }
      return Promise.resolve();
    }],
    [Events.GuildBanAdd, ban => logGuildEvent(ban.guild, 'Member banned', `${ban.user.tag} (${ban.user.id})`)],
    [Events.GuildUpdate, (oldGuild, newGuild) => {
      if (oldGuild.name !== newGuild.name) {
        return logGuildEvent(newGuild, 'Server updated', `Name changed from "${oldGuild.name}" to "${newGuild.name}".`);
      }
      return Promise.resolve();
    }],
    [Events.GuildMemberUpdate, (oldMember, newMember) => {
      if (oldMember.nickname !== newMember.nickname) {
        return logGuildEvent(
          newMember.guild,
          'Member nickname updated',
          `${newMember.user.tag}: "${oldMember.nickname ?? oldMember.user.username}" → "${newMember.nickname ?? newMember.user.username}"`,
        );
      }
      return Promise.resolve();
    }],
    [Events.VoiceStateUpdate, (oldState, newState) => {
      if (oldState.channelId === newState.channelId) return Promise.resolve();
      const change = oldState.channelId
        ? newState.channelId
          ? `moved from <#${oldState.channelId}> to <#${newState.channelId}>`
          : `left <#${oldState.channelId}>`
        : `joined <#${newState.channelId}>`;
      return logGuildEvent(newState.guild, 'Voice state updated', `${newState.member?.user.tag ?? 'Member'} ${change}.`);
    }],
  ];

  for (const [event, handler] of events) {
    client.on(event, (...args) => handler(...args).catch(error => {
      console.error(`Audit logging failed for ${event}:`, error);
    }));
  }
}
