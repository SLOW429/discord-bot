const { SlashCommandBuilder } = require('discord.js');
const { spend, add } = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder().setName('coinflip').setDescription('راهن على وجه العملة').setDMPermission(false)
    .addIntegerOption(o => o.setName('bet').setDescription('مبلغ الرهان').setMinValue(1).setRequired(true))
    .addStringOption(o => o.setName('side').setDescription('اختيارك').setRequired(true)
      .addChoices({ name: 'صورة', value: 'heads' }, { name: 'كتابة', value: 'tails' })),
  async execute(i) {
    const bet = i.options.getInteger('bet');
    const side = i.options.getString('side');
    const paid = await spend(i.guildId, i.user.id, bet); // يفشل تلقائياً إذا الرصيد غير كافٍ
    if (!paid) return i.reply({ content: 'رصيدك لا يكفي.', flags: 64 });
    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    const win = result === side;
    if (win) await add(i.guildId, i.user.id, bet * 2);
    await i.reply(`النتيجة: **${result === 'heads' ? 'صورة' : 'كتابة'}** — ${win ? `ربحت ${bet}!` : `خسرت ${bet}.`}`);
  }
};
