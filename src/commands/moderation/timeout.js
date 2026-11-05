const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const modLog = require('../../utils/modLog');

module.exports = {
  data: new SlashCommandBuilder().setName('timeout').setDescription('كتم مؤقت لعضو')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).setDMPermission(false)
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true))
    .addIntegerOption(o => o.setName('minutes').setDescription('المدة بالدقائق (0 = رفع الكتم)')
      .setMinValue(0).setMaxValue(40320).setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('السبب')),
  async execute(i) {
    const user = i.options.getUser('user');
    const minutes = i.options.getInteger('minutes');
    const reason = i.options.getString('reason') || 'غير محدد';
    const member = await i.guild.members.fetch(user.id).catch(() => null);
    if (!member || !member.moderatable || member.roles.highest.position >= i.member.roles.highest.position)
      return i.reply({ content: '❌ لا يمكن تطبيق الكتم على هذا العضو.', flags: 64 });
    await member.timeout(minutes ? minutes * 60_000 : null, `${i.user.tag}: ${reason}`);
    await i.reply(minutes ? `🔇 تم كتم **${user.tag}** لمدة ${minutes} دقيقة.` : `🔊 تم رفع الكتم عن **${user.tag}**.`);
    modLog(i.guild, minutes ? `Timeout (${minutes}m)` : 'Untimeout', user, i.user, reason);
  }
};
