const { SlashCommandBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');
const DAY = 24 * 60 * 60 * 1000;

module.exports = {
  data: new SlashCommandBuilder().setName('daily').setDescription('الجائزة اليومية').setDMPermission(false),
  async execute(i) {
    const u = await getUser(i.guildId, i.user.id);
    const next = u.lastDaily ? u.lastDaily.getTime() + DAY : 0;
    if (next > Date.now())
      return i.reply({ content: `⏳ ارجع <t:${Math.floor(next / 1000)}:R>`, flags: 64 });
    const reward = 200 + Math.floor(Math.random() * 301); // 200-500
    u.balance += reward; u.lastDaily = new Date();
    await u.save();
    await i.reply(`🎁 حصلت على **${reward}** عملة! رصيدك: ${u.balance}`);
  }
};
