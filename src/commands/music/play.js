const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('play').setDescription('تشغيل أغنية (اسم / YouTube / Spotify)').setDMPermission(false)
    .addStringOption(o => o.setName('query').setDescription('الاسم أو الرابط').setRequired(true)),
  async execute(i, client) {
    const vc = i.member.voice.channel;
    if (!vc) return i.reply({ content: '🎧 ادخل روم صوتي أولاً.', flags: 64 });
    await i.deferReply();
    await client.distube.play(vc, i.options.getString('query'), {
      member: i.member, textChannel: i.channel // DisTube يرسل رسائل التشغيل إلى هذه القناة
    });
    await i.editReply('🔎 تمت المعالجة...');
  }
};
