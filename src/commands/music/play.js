const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('تشغيل مقطع من مصدر صوت مدعوم')
    .setDMPermission(false)
    .addStringOption(option => option
      .setName('query')
      .setDescription('اسم المقطع أو رابط المصدر')
      .setMaxLength(500)
      .setRequired(true)),
  async execute(interaction, client) {
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      return interaction.reply({ content: 'ادخل روم صوتي أولاً.', flags: 64 });
    }

    const query = interaction.options.getString('query').trim();
    if (!query) return interaction.reply({ content: 'أدخل اسم مقطع أو رابطاً صالحاً.', flags: 64 });

    const queue = client.music.getQueue(interaction.guildId);
    if (queue && queue.songs.length >= 100) {
      return interaction.reply({ content: 'وصلت قائمة التشغيل إلى الحد الأقصى وهو 100 مقطع.', flags: 64 });
    }

    await interaction.deferReply();
    try {
      await client.music.play(voiceChannel, interaction.channel, query);
      await interaction.editReply('🎶 تمت معالجة طلبك بواسطة Lavalink.');
    } catch (error) {
      console.error(`[music] /play failed in guild ${interaction.guildId}:`, error);
      await interaction.editReply(playbackErrorMessage(query, error));
    }
  }
};

function playbackErrorMessage(query, error) {
  if (/spotify:/i.test(query) || /spotify\.com/i.test(query)) {
    return '⚠️ رابط Spotify يوفر بيانات الكتالوج وليس تدفقاً صوتياً. شغّل الصوت من مصدر لديك صلاحية بثه.';
  }
  if (/youtube\.com|youtu\.be/i.test(query)) {
    return '⚠️ تعذر تشغيل رابط YouTube؛ قد يرفض المصدر الطلب أو يتطلب تحققاً. لن يعيد البوت المحاولة عبر وسائل بديلة لتجاوز القيود؛ جرّب مصدراً مرخصاً آخر.';
  }
  if (/Lavalink is not connected/i.test(error.message || '')) {
    return '⚠️ خدمة Lavalink غير متصلة حالياً. يرجى المحاولة لاحقاً أو التواصل مع إدارة البوت.';
  }
  if (/queue can hold at most/i.test(error.message || '')) {
    return '⚠️ وصلت قائمة التشغيل إلى الحد الأقصى وهو 100 مقطع.';
  }
  return '⚠️ تعذر تشغيل الطلب من مصدر متاح. تحقق من الرابط أو جرّب مصدراً صوتياً آخر.';
}
