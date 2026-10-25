import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('voice')
  .setDescription('Move members between voice channels')
  .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
  .addSubcommand(command => command
    .setName('pull')
    .setDescription('Pull a member into your current voice channel')
    .addUserOption(option => option.setName('member').setDescription('Member to pull').setRequired(true)))
  .addSubcommand(command => command
    .setName('move')
    .setDescription('Move one member to a voice channel')
    .addUserOption(option => option.setName('member').setDescription('Member to move').setRequired(true))
    .addChannelOption(option => option.setName('destination').setDescription('Destination voice channel')
      .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice).setRequired(true)))
  .addSubcommand(command => command
    .setName('move-all')
    .setDescription('Move all members from one voice channel to another')
    .addChannelOption(option => option.setName('source').setDescription('Source voice channel')
      .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice).setRequired(true))
    .addChannelOption(option => option.setName('destination').setDescription('Destination voice channel')
      .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice).setRequired(true)));

export async function execute(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.MoveMembers)) {
    return interaction.reply({ content: 'You need Move Members permission to use this command.', ephemeral: true });
  }

  const subcommand = interaction.options.getSubcommand();
  const callerChannel = interaction.member.voice.channel;
  if (subcommand === 'pull' && !callerChannel) {
    return interaction.reply({ content: 'Join a voice channel first.', ephemeral: true });
  }

  const destination = subcommand === 'pull'
    ? callerChannel
    : interaction.options.getChannel('destination');
  const botMember = interaction.guild.members.me;
  const source = subcommand === 'move-all' ? interaction.options.getChannel('source') : null;
  if (!destination.permissionsFor(botMember)?.has(PermissionFlagsBits.MoveMembers)
    || (source && !source.permissionsFor(botMember)?.has(PermissionFlagsBits.MoveMembers))) {
    return interaction.reply({ content: 'I need Move Members permission in the destination channel.', ephemeral: true });
  }

  if (subcommand === 'move-all') {
    const members = [...source.members.values()];
    const moved = [];
    for (const member of members) {
      if (!member.voice.channel || member.id === interaction.guild.ownerId) continue;
      await member.voice.setChannel(destination, `Bulk move requested by ${interaction.user.tag}`);
      moved.push(member.id);
    }
    return interaction.reply({ content: `Moved ${moved.length} of ${members.length} members to ${destination}.`, ephemeral: true });
  }

  const user = interaction.options.getUser('member');
  const member = await interaction.guild.members.fetch(user.id);
  if (!member.voice.channel) {
    return interaction.reply({ content: 'That member is not connected to voice.', ephemeral: true });
  }
  if (!member.voice.channel.permissionsFor(botMember)?.has(PermissionFlagsBits.MoveMembers)) {
    return interaction.reply({ content: 'I need Move Members permission in the member’s current voice channel.', ephemeral: true });
  }
  if (member.id === interaction.guild.ownerId) {
    return interaction.reply({ content: 'The server owner cannot be moved by the bot.', ephemeral: true });
  }

  await member.voice.setChannel(destination, `Voice move requested by ${interaction.user.tag}`);
  return interaction.reply({ content: `Moved ${member} to ${destination}.`, ephemeral: true });
}
