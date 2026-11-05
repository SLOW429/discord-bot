const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder
} = require('discord.js');
const Guild = require('../../models/Guild');
const { invalidate } = require('../../utils/getGuild');

module.exports = {
  data: new SlashCommandBuilder().setName('tickets').setDescription('إعداد لوحة تذاكر الدعم').setDMPermission(false)
    .addChannelOption(option => option.setName('panel').setDescription('قناة نشر اللوحة')
      .addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addRoleOption(option => option.setName('staff').setDescription('رتبة فريق الدعم').setRequired(true))
    .addChannelOption(option => option.setName('logs').setDescription('قناة حفظ النصوص')
      .addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addChannelOption(option => option.setName('category').setDescription('فئة قنوات التذاكر')
      .addChannelTypes(ChannelType.GuildCategory)),
  async execute(interaction) {
    if (!interaction.memberPermissions.has('ManageGuild'))
      return interaction.reply({ content: 'تحتاج صلاحية إدارة السيرفر.', flags: 64 });
    const panel = interaction.options.getChannel('panel');
    const staffRole = interaction.options.getRole('staff');
    const logChannel = interaction.options.getChannel('logs');
    const category = interaction.options.getChannel('category');
    if (!staffRole.editable)
      return interaction.reply({ content: 'رتبة فريق الدعم أعلى من رتبة البوت أو غير قابلة للاستخدام.', flags: 64 });

    await Guild.findOneAndUpdate({ guildId: interaction.guildId }, {
      $set: {
        guildId: interaction.guildId,
        'ticketing.panelChannelId': panel.id,
        'ticketing.staffRoleId': staffRole.id,
        'ticketing.logChannelId': logChannel.id,
        'ticketing.categoryId': category?.id || null
      }
    }, { upsert: true });
    invalidate(interaction.guildId);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:create').setLabel('Open a support ticket').setStyle(ButtonStyle.Primary)
    );
    await panel.send({
      embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('Support')
        .setDescription('Press the button to open a private support ticket.')],
      components: [row]
    });
    await interaction.reply({ content: 'تم إعداد لوحة التذاكر ونشرها.', flags: 64 });
  }
};
