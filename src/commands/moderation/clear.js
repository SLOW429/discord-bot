const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('clear').setDescription('حذف رسائل')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages).setDMPermission(false)
    .addIntegerOption(o => o.setName('amount').setDescription('العدد (1-100)').setMinValue(1).setMaxValue(100).setRequired(true)),
  async execute(i) {
    await i.deferReply({ flags: 64 });
    // true = تجاهل الرسائل الأقدم من 14 يوماً (قيد من ديسكورد)
    const deleted = await i.channel.bulkDelete(i.options.getInteger('amount'), true);
    await i.editReply(`تم حذف ${deleted.size} رسالة.`);
  }
};
