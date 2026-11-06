const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('music')
    .setDescription('التحكم بالموسيقى')
    .setDMPermission(false)
    .addSubcommand(subcommand => subcommand.setName('skip').setDescription('تخطي المقطع الحالي'))
    .addSubcommand(subcommand => subcommand.setName('stop').setDescription('إيقاف ومسح القائمة'))
    .addSubcommand(subcommand => subcommand.setName('pause').setDescription('إيقاف مؤقت'))
    .addSubcommand(subcommand => subcommand.setName('resume').setDescription('استئناف التشغيل'))
    .addSubcommand(subcommand => subcommand.setName('volume').setDescription('تغيير مستوى الصوت')
      .addIntegerOption(option => option.setName('level').setDescription('من 0 إلى 100')
        .setMinValue(0).setMaxValue(100).setRequired(true)))
    .addSubcommand(subcommand => subcommand.setName('filter').setDescription('تغيير مؤثر الصوت')
      .addStringOption(option => option.setName('name').setDescription('المؤثر').setRequired(true)
        .addChoices(
          { name: 'إيقاف المؤثرات', value: 'off' },
          { name: 'Bass Boost', value: 'bassboost' },
          { name: 'Nightcore', value: 'nightcore' },
          { name: '3D', value: '3d' },
          { name: 'Karaoke', value: 'karaoke' },
          { name: 'Vaporwave', value: 'vaporwave' }
        )))
    .addSubcommand(subcommand => subcommand.setName('queue').setDescription('عرض القائمة'))
    .addSubcommand(subcommand => subcommand.setName('loop').setDescription('وضع التكرار')
      .addIntegerOption(option => option.setName('mode').setDescription('الوضع').setRequired(true)
        .addChoices({ name: 'إيقاف', value: 0 }, { name: 'المقطع', value: 1 }, { name: 'القائمة', value: 2 }))),

  async execute(interaction, client) {
    const queue = client.music.getQueue(interaction.guildId);
    if (!queue) return interaction.reply({ content: 'لا يوجد تشغيل حالياً.', flags: 64 });
    if (interaction.member.voice.channelId !== queue.voiceChannelId) {
      return interaction.reply({ content: 'يجب أن تكون معي في نفس الروم الصوتي.', flags: 64 });
    }

    try {
      switch (interaction.options.getSubcommand()) {
        case 'skip':
          await client.music.skip(interaction.guildId);
          return interaction.reply('⏭ تم تخطي المقطع.');
        case 'stop':
          await client.music.stop(interaction.guildId);
          return interaction.reply('⏹ تم إيقاف التشغيل ومسح القائمة.');
        case 'pause':
          if (queue.paused) return interaction.reply({ content: 'التشغيل متوقف مؤقتاً بالفعل.', flags: 64 });
          await client.music.setPaused(interaction.guildId, true);
          return interaction.reply('⏸ تم إيقاف التشغيل مؤقتاً.');
        case 'resume':
          if (!queue.paused) return interaction.reply({ content: 'التشغيل يعمل بالفعل.', flags: 64 });
          await client.music.setPaused(interaction.guildId, false);
          return interaction.reply('▶ تم استئناف التشغيل.');
        case 'volume': {
          const volume = interaction.options.getInteger('level');
          await client.music.setVolume(interaction.guildId, volume);
          return interaction.reply(`🔊 تم ضبط الصوت على ${volume}%.`);
        }
        case 'filter': {
          const filter = interaction.options.getString('name');
          await client.music.setFilter(interaction.guildId, filter);
          return interaction.reply(filter === 'off' ? '🎛 تم إيقاف المؤثرات.' : `🎛 تم تفعيل ${filter}.`);
        }
        case 'queue': {
          const list = queue.songs.slice(0, 10)
            .map((song, index) => `**${index ? index : 'الحالي'}**. ${song.name} \`${song.formattedDuration}\``)
            .join('\n');
          return interaction.reply(`📜 **القائمة:**\n${list}${queue.songs.length > 10 ? `\n... و${queue.songs.length - 10} أخرى` : ''}`);
        }
        case 'loop': {
          const mode = interaction.options.getInteger('mode');
          await client.music.setRepeatMode(interaction.guildId, mode);
          return interaction.reply(`🔁 التكرار: ${['إيقاف', 'المقطع', 'القائمة'][mode]}`);
        }
        default:
          return interaction.reply({ content: 'إجراء موسيقى غير معروف.', flags: 64 });
      }
    } catch (error) {
      console.error(`[music] Control failed in guild ${interaction.guildId}:`, error);
      const message = 'تعذر تنفيذ إجراء الموسيقى.';
      if (interaction.replied || interaction.deferred) return interaction.followUp({ content: message, flags: 64 });
      return interaction.reply({ content: message, flags: 64 });
    }
  }
};
