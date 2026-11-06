const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('play').setDescription('تشغيل أغنية (اسم / YouTube / Spotify)').setDMPermission(false)
    .addStringOption(o => o.setName('query').setDescription('الاسم أو الرابط').setRequired(true)),
  async execute(i, client) {
    const vc = i.member.voice.channel;
    if (!vc) return i.reply({ content: 'ادخل روم صوتي أولاً.', flags: 64 });
    const queue = client.distube.getQueue(i.guildId);
    if (queue?.songs.length >= 100)
      return i.reply({ content: 'وصلت قائمة التشغيل إلى الحد الأقصى وهو 100 مقطع.', flags: 64 });
    await i.deferReply();
    const query = i.options.getString('query').trim();
    const options = { member: i.member, textChannel: i.channel };
    try {
      await client.distube.play(vc, query, options);
      await i.editReply('🎶 جاري تجهيز المقطع. ستظهر رسالة عند بدء التشغيل.');
    } catch (error) {
      const fallbackQuery = youtubeFallbackQuery(query);
      if (fallbackQuery && client.ytDlpPlugin) {
        try {
          const song = await client.ytDlpPlugin.resolve(fallbackQuery, { member: i.member });
          await client.distube.play(vc, song, options);
          await i.editReply('🎶 تم تجهيز المقطع باستخدام extractor بديل.');
          return;
        } catch (fallbackError) {
          console.error(`[music] /play and yt-dlp fallback failed in guild ${i.guildId}:`, {
            primary: error,
            fallback: fallbackError
          });
          const details = `${error.message || ''} ${fallbackError.message || ''}`;
          const blocked = /sign in|not a bot|bot detection|confirm you're not|403|private video/i.test(details);
          await i.editReply(blocked
            ? '⚠️ رفض YouTube الطلب أو يتطلب تسجيل الدخول/التحقق. جرّب مصدراً آخر؛ لا يتجاوز البوت قيود المنصة.'
            : '⚠️ تعذر تشغيل الطلب عبر المصدر الأساسي والبديل. تحقق من yt-dlp وPython واتصال الصوت ثم أعد المحاولة.');
          return;
        }
      }

      console.error(`[music] /play failed in guild ${i.guildId}:`, error);
      await i.editReply('⚠️ تعذر تشغيل هذا الطلب. تحقق من الرابط واتصال الصوت ثم أعد المحاولة.');
    }
  }
};

function youtubeFallbackQuery(query) {
  if (!/^https?:\/\//i.test(query)) return `ytsearch1:${query}`;
  try {
    const url = new URL(query);
    const host = url.hostname.toLowerCase();
    return host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com')
      ? query
      : null;
  } catch {
    return null;
  }
}
