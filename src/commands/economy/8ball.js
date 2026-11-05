const { SlashCommandBuilder } = require('discord.js');
const answers = ['نعم بالتأكيد', 'لا أظن', 'ربما', 'اسأل لاحقاً', 'مستحيل', 'أكيد', 'الأمر غير واضح'];

module.exports = {
  data: new SlashCommandBuilder().setName('8ball').setDescription('اسأل كرة الحظ')
    .addStringOption(o => o.setName('question').setDescription('سؤالك').setRequired(true)),
  async execute(i) {
    await i.reply(`**${i.options.getString('question')}**\n${answers[Math.floor(Math.random() * answers.length)]}`);
  }
};
