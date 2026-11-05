const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Warn = require('../../models/Warn');
const modLog = require('../../utils/modLog');

module.exports = {
  data: new SlashCommandBuilder().setName('warn').setDescription('تحذير عضو')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).setDMPermission(false)
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('السبب').setRequired(true)),
  async execute(i) {
    const user = i.options.getUser('user');
    const reason = i.options.getString('reason');
    await Warn.create({ guildId: i.guildId, userId: user.id, moderatorId: i.user.id, reason });
    const count = await Warn.countDocuments({ guildId: i.guildId, userId: user.id });
    user.send(`تلقيت تحذيراً في **${i.guild.name}**: ${reason}`).catch(error => {
      console.warn(`[warn] Could not DM ${user.id}:`, error.message);
    });
    await i.reply(`تم تحذير **${user.tag}** (مجموع التحذيرات: ${count}) — ${reason}`);
    modLog(i.guild, `Warn #${count}`, user, i.user, reason);
  }
};
