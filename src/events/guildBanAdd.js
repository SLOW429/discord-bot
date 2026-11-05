const { inspectAuditEvent, AuditLogEvent } = require('../utils/antiNuke');

module.exports = {
  name: 'guildBanAdd',
  async execute(ban) {
    try {
      await inspectAuditEvent(ban.guild, ban.user.id, AuditLogEvent.MemberBanAdd);
    } catch (error) {
      console.error(`[anti-nuke] Could not inspect ban audit event in ${ban.guild.id}:`, error);
    }
  }
};
