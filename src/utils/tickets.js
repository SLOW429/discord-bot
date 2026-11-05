const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  AttachmentBuilder,
  PermissionFlagsBits
} = require('discord.js');
const Ticket = require('../models/Ticket');
const { getGuild } = require('./getGuild');

async function createTicket(interaction) {
  const guild = interaction.guild;
  const settings = await getGuild(guild.id);
  const config = settings.ticketing;
  if (!config?.staffRoleId || !config?.logChannelId)
    return interaction.reply({ content: 'لم يتم إعداد نظام التذاكر بعد.', flags: 64 });

  const ticket = await Ticket.create({ guildId: guild.id, userId: interaction.user.id, status: 'open' })
    .catch(error => {
      if (error.code === 11000) return null;
      throw error;
    });
  if (!ticket) {
    const existing = await Ticket.findOne({ guildId: guild.id, userId: interaction.user.id, status: 'open' }).lean();
      let channel = existing?.channelId && guild.channels.cache.get(existing.channelId);
      if (existing?.channelId && !channel) {
        channel = await guild.channels.fetch(existing.channelId).catch(error => {
          if (error.code === 10003) return null;
          throw error;
        });
      }
      if (existing?.createdAt && !channel && Date.now() - existing.createdAt.getTime() > 2 * 60_000) {
        const removed = await Ticket.deleteOne({
          _id: existing._id,
          status: 'open',
          closing: { $ne: true }
        });
        if (removed.deletedCount) return createTicket(interaction);
      }
      return interaction.reply({
      content: channel ? `لديك تذكرة مفتوحة: ${channel}` : 'لديك بالفعل طلب تذكرة قيد المعالجة.',
      flags: 64
    });
  }

  let channel;
  try {
    const overwrites = [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: interaction.user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
      },
      {
        id: config.staffRoleId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
      },
      {
        id: interaction.client.user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels]
      }
    ];
    channel = await guild.channels.create({
      name: `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 90),
      type: ChannelType.GuildText,
      parent: config.categoryId || undefined,
      permissionOverwrites: overwrites,
      topic: `Support ticket for ${interaction.user.id}`
    });
    ticket.channelId = channel.id;
    await ticket.save();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:close').setLabel('Close ticket').setStyle(ButtonStyle.Danger)
    );
    await channel.send({
      content: `<@${interaction.user.id}> <@&${config.staffRoleId}>`,
      embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('Support ticket')
        .setDescription('Describe your issue. A staff member will assist you.')],
      components: [row],
      allowedMentions: { users: [interaction.user.id], roles: [config.staffRoleId] }
    });
    return interaction.reply({ content: `تم إنشاء تذكرتك: ${channel}`, flags: 64 });
  } catch (error) {
    if (channel) await channel.delete('Ticket setup failed').catch(cleanupError => {
      console.error(`[tickets] Could not remove incomplete channel ${channel.id}:`, cleanupError);
    });
    await Ticket.deleteOne({ _id: ticket._id });
    throw error;
  }
}

async function closeTicket(interaction) {
  const current = await Ticket.findOne({
    guildId: interaction.guildId, channelId: interaction.channelId, status: 'open'
  }).lean();
  if (!current) return interaction.reply({ content: 'هذه التذكرة مغلقة أو غير مسجلة.', flags: 64 });
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const settings = await getGuild(interaction.guildId);
  const isStaff = member.permissions.has(PermissionFlagsBits.ManageChannels)
    || (settings.ticketing?.staffRoleId && member.roles.cache.has(settings.ticketing.staffRoleId));
  if (current.userId !== interaction.user.id && !isStaff)
    return interaction.reply({ content: 'فقط صاحب التذكرة أو فريق الدعم يمكنه إغلاقها.', flags: 64 });
  const ticket = await Ticket.findOneAndUpdate(
    { _id: current._id, status: 'open', closing: { $ne: true } },
    { $set: { closing: true, closedBy: interaction.user.id } },
    { new: true }
  );
  if (!ticket) return interaction.reply({ content: 'جارٍ إغلاق هذه التذكرة بالفعل.', flags: 64 });

  await interaction.deferReply({ flags: 64 });
  let ticketFinalized = false;
  try {
    const messages = await interaction.channel.messages.fetch({ limit: 100 });
    const transcript = [...messages.values()].reverse().map(message => {
      const text = message.content.replace(/\r?\n/g, ' ').slice(0, 2000);
      const attachments = [...message.attachments.values()].map(item => item.url).join(' ');
      return `[${message.createdAt.toISOString()}] ${message.author.tag}: ${text}${attachments ? ` ${attachments}` : ''}`;
    }).join('\n');
    const logChannel = settings.ticketing?.logChannelId
      ? interaction.guild.channels.cache.get(settings.ticketing.logChannelId)
      : null;
    if (!logChannel?.isTextBased()) throw new Error('Configured ticket log channel is unavailable');
    const file = new AttachmentBuilder(Buffer.from(transcript || 'No messages recorded.', 'utf8'), {
      name: `ticket-${ticket._id}.txt`
    });
    await logChannel.send({
      content: `Ticket closed by <@${interaction.user.id}>. Opener: <@${ticket.userId}>. Channel: ${interaction.channel.name}`,
      files: [file],
      allowedMentions: { users: [interaction.user.id, ticket.userId] }
    });
    const finalized = await Ticket.updateOne({ _id: ticket._id, status: 'open', closing: true }, {
      $set: { status: 'closed', closing: false, closedAt: new Date() }
    });
    if (!finalized.modifiedCount) throw new Error('Ticket state changed while closing');
    ticketFinalized = true;
    await interaction.editReply('تم حفظ سجل التذكرة وإغلاقها.');
    try {
      await interaction.channel.delete(`Ticket closed by ${interaction.user.tag}`);
    } catch (error) {
      console.error(`[tickets] Transcript archived but channel cleanup failed for ${interaction.channelId}:`, error);
      await interaction.editReply('تم حفظ السجل وإغلاق التذكرة، لكن تعذر حذف القناة. تحقق من صلاحيات البوت.');
    }
  } catch (error) {
    if (!ticketFinalized) {
      await Ticket.updateOne({ _id: ticket._id, status: 'open' }, {
        $set: { closing: false },
        $unset: { closedBy: 1 }
      });
    }
    throw error;
  }
}

module.exports = { createTicket, closeTicket };
