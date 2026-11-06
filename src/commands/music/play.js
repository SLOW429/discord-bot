const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('play').setDescription('تشغيل أغنية (اسم / YouTube / Spotify)').setDMPermission(false)
    .addStringOption(o => o.setName('query').setDescription('الاسم أو الرابط').setMaxLength(500).setRequired(true)),
  async execute(i, client) {
    const vc = i.member.voice.channel;
    if (!vc) return i.reply({ content: 'ادخل روم صوتي أولاً.', flags: 64 });
    const query = i.options.getString('query').trim();
    if (!query) return i.reply({ content: 'أدخل اسم مقطع أو رابطاً صالحاً.', flags: 64 });
    const queue = client.distube.getQueue(i.guildId);
    if (queue?.songs.length >= 100)
      return i.reply({ content: 'وصلت قائمة التشغيل إلى الحد الأقصى وهو 100 مقطع.', flags: 64 });
    await i.deferReply();
    const options = { member: i.member, textChannel: i.channel };
    try {
      await client.distube.play(vc, query, options);
      await i.editReply('🎶 جاري تجهيز المقطع. ستظهر رسالة عند بدء التشغيل.');
    } catch (error) {
      console.error(`[music] /play failed in guild ${i.guildId}:`, error);
      await i.editReply(playbackErrorMessage(query, error));
    }
  }
};

function getSource(query) {
  if (/^spotify:/i.test(query)) return 'spotify';
  try {
    const url = new URL(query);
    const host = url.hostname.toLowerCase();
    if (host === 'open.spotify.com' || host.endsWith('.spotify.com')) return 'spotify';
    if (host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com')) return 'youtube';
  } catch {
    return 'search';
  }
  return 'other';
}

function playbackErrorMessage(query, error) {
  const details = `${error?.message || ''} ${error?.errorCode || ''}`;
  if (getSource(query) === 'spotify') {
    return '⚠️ تعذر حل رابط Spotify إلى مقطع قابل للتشغيل. تحقق من أن الرابط عام وأن المقطع متاح. رابط Spotify يوفر بيانات المسار، وليس تدفقاً صوتياً.';
  }
  if (/sign in|not a bot|bot detection|confirm you're not|authentication required/i.test(details)
    || (getSource(query) === 'youtube' && /403|forbidden/i.test(details))) {
    return '⚠️ رفض YouTube هذا الطلب أو يتطلب تسجيل الدخول/التحقق. لا يحاول البوت تجاوز هذه القيود؛ جرّب مصدراً مرخصاً آخر أو ملفاً تملك حق بثه.';
  }
  if (getSource(query) === 'youtube') {
    return '⚠️ تعذر تشغيل رابط YouTube. تحقق من أن الفيديو عام وقابل للتشغيل، أو جرّب مصدراً مرخصاً آخر.';
  }
  return '⚠️ تعذر تشغيل هذا الطلب. تحقق من الاسم أو الرابط واتصال الصوت ثم أعد المحاولة.';
}
