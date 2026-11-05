const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

module.exports = {
  data: new SlashCommandBuilder().setName('top').setDescription('توب السيرفر (الأغنى)').setDMPermission(false),
  async execute(i) {
    const top = await User.find({ guildId: i.guildId, balance: { $gt: 0 } }).sort({ balance: -1 }).limit(10);
    const medals = ['🥇', '🥈', '🥉'];
    const lines = top.map((u, n) => `${medals[n] || `**${n + 1}.**`} <@${u.userId}> — ${u.balance} 💰`);
    await i.reply({ embeds: [new EmbedBuilder().setColor(0xf1c40f).setTitle('🏆 توب السيرفر')
      .setDescription(lines.join('\n') || 'لا يوجد أحد بعد!')] });
  }
};
