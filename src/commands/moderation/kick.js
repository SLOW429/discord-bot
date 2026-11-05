const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const modLog = require('../../utils/modLog');

module.exports = {
  data: new SlashCommandBuilder().setName('kick').setDescription('طرد عضو')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers).setDMPermission(false)
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('السبب')),
  async execute(i) {
    const user = i.options.getUser('user');
    const reason = i.options.getString('reason') || 'غير محدد';
    const member = await i.guild.members.fetch(user.id).catch(() => null);
    if (!member || !member.kickable || member.roles.highest.position >= i.member.roles.highest.position)
      return i.reply({ content: '❌ لا يمكن طرد هذا العضو.', flags: 64 });
    await member.kick(`${i.user.tag}: ${reason}`);
    await i.reply(`👢 تم طرد **${user.tag}** — ${reason}`);
    modLog(i.guild, 'Kick', user, i.user, reason);
  }
};
