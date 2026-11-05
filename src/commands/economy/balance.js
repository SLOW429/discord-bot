const { SlashCommandBuilder } = require('discord.js');
const { getUser } = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder().setName('balance').setDescription('عرض الرصيد').setDMPermission(false)
    .addUserOption(o => o.setName('user').setDescription('عضو آخر')),
  async execute(i) {
    const user = i.options.getUser('user') || i.user;
    const doc = await getUser(i.guildId, user.id);
    await i.reply(`رصيد **${user.username}**: المحفظة **${doc.balance}**، البنك **${doc.bank || 0}** عملة`);
  }
};
