const { getGuild } = require('../utils/getGuild');
const { recordActivity } = require('../utils/analytics');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    recordActivity(member.guild.id, 'leaves');
    const settings = await getGuild(member.guild.id);
    if (!settings.welcome.leaveEnabled || !settings.welcome.channelId) return;
    const channel = member.guild.channels.cache.get(settings.welcome.channelId);
    if (!channel?.isTextBased()) return;

    const content = settings.welcome.leaveMessage
      .replaceAll('{user}', member.user.username)
      .replaceAll('{server}', member.guild.name)
      .replaceAll('{memberCount}', String(member.guild.memberCount));
    try {
      await channel.send({ content, allowedMentions: { parse: [] } });
    } catch (error) {
      console.error(`[welcome] Could not send leave message in ${channel.id}:`, error);
    }
  }
};
