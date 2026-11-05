const { SlashCommandBuilder } = require('discord.js');
const { getUser, claimDaily } = require('../../utils/economy');
const DAY = 24 * 60 * 60 * 1000;

module.exports = {
  data: new SlashCommandBuilder().setName('daily').setDescription('الجائزة اليومية').setDMPermission(false),
  async execute(i) {
    const reward = 200 + Math.floor(Math.random() * 301); // 200-500
    const user = await claimDaily(i.guildId, i.user.id, reward);
    if (user) return i.reply(`حصلت على **${reward}** عملة! رصيدك: ${user.balance}`);

    const existing = await getUser(i.guildId, i.user.id);
    const next = (existing.lastDaily?.getTime() || 0) + DAY;
    return i.reply({ content: `ارجع <t:${Math.floor(next / 1000)}:R>`, flags: 64 });
  }
};
