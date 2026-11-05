const { inspectAuditEvent, AuditLogEvent } = require('../utils/antiNuke');

module.exports = {
  name: 'channelDelete',
  async execute(channel) {
    if (!channel.guild) return;
    try {
      await inspectAuditEvent(channel.guild, channel.id, AuditLogEvent.ChannelDelete);
    } catch (error) {
      console.error(`[anti-nuke] Could not inspect channel deletion in ${channel.guild.id}:`, error);
    }
  }
};
