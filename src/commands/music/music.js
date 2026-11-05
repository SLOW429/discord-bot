const { SlashCommandBuilder } = require('discord.js');
const { persistQueue } = require('../../utils/musicQueue');

// أوامر التحكم: /music skip | stop | pause | resume | volume | queue | loop
module.exports = {
  data: new SlashCommandBuilder().setName('music').setDescription('التحكم بالموسيقى').setDMPermission(false)
    .addSubcommand(s => s.setName('skip').setDescription('تخطي الأغنية'))
    .addSubcommand(s => s.setName('stop').setDescription('إيقاف ومسح القائمة'))
    .addSubcommand(s => s.setName('pause').setDescription('إيقاف مؤقت'))
    .addSubcommand(s => s.setName('resume').setDescription('استئناف التشغيل'))
    .addSubcommand(s => s.setName('volume').setDescription('تغيير مستوى الصوت')
      .addIntegerOption(o => o.setName('level').setDescription('من 0 إلى 100').setMinValue(0).setMaxValue(100).setRequired(true)))
    .addSubcommand(s => s.setName('filter').setDescription('تغيير مؤثر الصوت')
      .addStringOption(o => o.setName('name').setDescription('المؤثر').setRequired(true)
        .addChoices(
          { name: 'إيقاف المؤثرات', value: 'off' },
          { name: 'Bass Boost', value: 'bassboost' },
          { name: 'Nightcore', value: 'nightcore' },
          { name: '3D', value: '3d' },
          { name: 'Echo', value: 'echo' },
          { name: 'Karaoke', value: 'karaoke' },
          { name: 'Vaporwave', value: 'vaporwave' }
        )))
    .addSubcommand(s => s.setName('queue').setDescription('عرض القائمة'))
    .addSubcommand(s => s.setName('loop').setDescription('وضع التكرار')
      .addIntegerOption(o => o.setName('mode').setDescription('الوضع').setRequired(true)
        .addChoices({ name: 'إيقاف', value: 0 }, { name: 'الأغنية', value: 1 }, { name: 'القائمة', value: 2 }))),
  async execute(i, client) {
    const queue = client.distube.getQueue(i.guildId);
    if (!queue) return i.reply({ content: 'لا يوجد تشغيل حالياً.', flags: 64 });
    if (i.member.voice.channelId !== queue.voiceChannel?.id)
      return i.reply({ content: 'يجب أن تكون معي في نفس الروم الصوتي.', flags: 64 });

    switch (i.options.getSubcommand()) {
      case 'skip':
        if (queue.songs.length <= 1) await queue.stop(); else await queue.skip();
        return i.reply('تم التخطي.');
      case 'stop':
        await queue.stop();
        return i.reply('تم الإيقاف.');
      case 'pause':
        if (queue.paused) return i.reply({ content: 'التشغيل متوقف مؤقتاً بالفعل.', flags: 64 });
        await queue.pause();
        await persistQueue(queue);
        return i.reply('تم الإيقاف المؤقت.');
      case 'resume':
        if (!queue.paused) return i.reply({ content: 'التشغيل يعمل بالفعل.', flags: 64 });
        await queue.resume();
        await persistQueue(queue);
        return i.reply('تم استئناف التشغيل.');
      case 'volume': {
        const volume = i.options.getInteger('level');
        await queue.setVolume(volume);
        await persistQueue(queue);
        return i.reply(`تم ضبط الصوت على ${volume}%.`);
      }
      case 'filter': {
        const filter = i.options.getString('name');
        await queue.filters.set(filter === 'off' ? [] : [filter]);
        await persistQueue(queue);
        return i.reply(filter === 'off' ? 'تم إيقاف المؤثرات.' : `تم تفعيل ${filter}.`);
      }
      case 'queue': {
        const list = queue.songs.slice(0, 10).map((s, n) => `**${n ? n : 'الحالي'}**. ${s.name} \`${s.formattedDuration}\``).join('\n');
        return i.reply(`**القائمة:**\n${list}${queue.songs.length > 10 ? `\n... و${queue.songs.length - 10} أخرى` : ''}`);
      }
      case 'loop': {
        const mode = i.options.getInteger('mode');
        queue.setRepeatMode(mode);
        await persistQueue(queue);
        return i.reply(`التكرار: ${['إيقاف', 'الأغنية', 'القائمة'][mode]}`);
      }
    }
  }
};
