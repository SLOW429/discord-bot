const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const modLog = require('../../utils/modLog');

module.exports = {
  data: new SlashCommandBuilder().setName('ban').setDescription('حظر عضو')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers).setDMPermission(false)
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('السبب')),
  async execute(i) {
    const user = i.options.getUser('user');
    const reason = i.options.getString('reason') || 'غير محدد';
    const member = await i.guild.members.fetch(user.id).catch(() => null);
    // تحقق من الرتب: لا نحظر من رتبته أعلى منا
    if (member && (!member.bannable || member.roles.highest.position >= i.member.roles.highest.position))
      return i.reply({ content: 'لا يمكن حظر هذا العضو (رتبته أعلى أو مساوية).', flags: 64 });
    await i.guild.members.ban(user, { reason: `${i.user.tag}: ${reason}` });
    await i.reply(`تم حظر **${user.tag}** — ${reason}`);
    modLog(i.guild, 'Ban', user, i.user, reason);
  }
};
