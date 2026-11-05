const { SlashCommandBuilder } = require('discord.js');

// أوامر التحكم: /music skip | stop | queue | loop
module.exports = {
  data: new SlashCommandBuilder().setName('music').setDescription('التحكم بالموسيقى').setDMPermission(false)
    .addSubcommand(s => s.setName('skip').setDescription('تخطي الأغنية'))
    .addSubcommand(s => s.setName('stop').setDescription('إيقاف ومسح القائمة'))
    .addSubcommand(s => s.setName('queue').setDescription('عرض القائمة'))
    .addSubcommand(s => s.setName('loop').setDescription('وضع التكرار')
      .addIntegerOption(o => o.setName('mode').setDescription('الوضع').setRequired(true)
        .addChoices({ name: 'إيقاف', value: 0 }, { name: 'الأغنية', value: 1 }, { name: 'القائمة', value: 2 }))),
  async execute(i, client) {
    const queue = client.distube.getQueue(i.guildId);
    if (!queue) return i.reply({ content: '❌ لا يوجد تشغيل حالياً.', flags: 64 });
    if (i.member.voice.channelId !== queue.voiceChannel?.id)
      return i.reply({ content: '❌ يجب أن تكون معي في نفس الروم الصوتي.', flags: 64 });

    switch (i.options.getSubcommand()) {
      case 'skip':
        if (queue.songs.length <= 1) await queue.stop(); else await queue.skip();
        return i.reply('⏭️ تم التخطي.');
      case 'stop':
        await queue.stop();
        return i.reply('⏹️ تم الإيقاف.');
      case 'queue': {
        const list = queue.songs.slice(0, 10).map((s, n) => `${n ? n : '▶️'}. ${s.name} \`${s.formattedDuration}\``).join('\n');
        return i.reply(`📜 **القائمة:**\n${list}${queue.songs.length > 10 ? `\n... و${queue.songs.length - 10} أخرى` : ''}`);
      }
      case 'loop': {
        const mode = i.options.getInteger('mode');
        queue.setRepeatMode(mode);
        return i.reply(`🔁 التكرار: ${['إيقاف', 'الأغنية', 'القائمة'][mode]}`);
      }
    }
  }
};
