const { SlashCommandBuilder } = require('discord.js');
const { getUser, moveFunds, transfer, claimWork } = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder().setName('bank').setDescription('إدارة البنك والتحويل والعمل').setDMPermission(false)
    .addSubcommand(command => command.setName('balance').setDescription('عرض المحفظة والبنك'))
    .addSubcommand(command => command.setName('deposit').setDescription('إيداع في البنك')
      .addIntegerOption(option => option.setName('amount').setDescription('المبلغ').setMinValue(1).setRequired(true)))
    .addSubcommand(command => command.setName('withdraw').setDescription('سحب من البنك')
      .addIntegerOption(option => option.setName('amount').setDescription('المبلغ').setMinValue(1).setRequired(true)))
    .addSubcommand(command => command.setName('pay').setDescription('تحويل عملات لعضو')
      .addUserOption(option => option.setName('user').setDescription('المستلم').setRequired(true))
      .addIntegerOption(option => option.setName('amount').setDescription('المبلغ').setMinValue(1).setRequired(true)))
    .addSubcommand(command => command.setName('work').setDescription('اعمل مقابل أجر (مرة كل ساعة)')),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const amount = interaction.options.getInteger('amount');

    if (subcommand === 'balance') {
      const user = await getUser(interaction.guildId, interaction.user.id);
      return interaction.reply(`محفظتك: **${user.balance}** | البنك: **${user.bank || 0}**`);
    }

    if (subcommand === 'deposit' || subcommand === 'withdraw') {
      const user = await moveFunds(interaction.guildId, interaction.user.id, amount, subcommand);
      return interaction.reply(user
        ? `تم ${subcommand === 'deposit' ? 'الإيداع' : 'السحب'}. المحفظة: **${user.balance}** | البنك: **${user.bank}**`
        : 'الرصيد المتاح غير كافٍ.');
    }

    if (subcommand === 'pay') {
      const recipient = interaction.options.getUser('user');
      if (recipient.bot || recipient.id === interaction.user.id)
        return interaction.reply({ content: 'اختر عضواً آخر غير البوتات.', flags: 64 });
      const sender = await transfer(interaction.guildId, interaction.user.id, recipient.id, amount);
      return interaction.reply(sender
        ? `تم تحويل **${amount}** عملة إلى **${recipient.username}**. رصيدك: **${sender.balance}**`
        : 'رصيد محفظتك غير كافٍ.');
    }

    const reward = 100 + Math.floor(Math.random() * 201);
    const user = await claimWork(interaction.guildId, interaction.user.id, reward);
    if (user) return interaction.reply(`أنهيت عملاً وربحت **${reward}** عملة. رصيدك: **${user.balance}**`);
    const existing = await getUser(interaction.guildId, interaction.user.id);
    const readyAt = new Date((existing.lastWork?.getTime() || Date.now()) + 60 * 60 * 1000);
    return interaction.reply({ content: `يمكنك العمل مجدداً <t:${Math.floor(readyAt.getTime() / 1000)}:R>`, flags: 64 });
  }
};
