import {
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { getGuildConfig } from '../lib/config.js';

export const data = new SlashCommandBuilder()
  .setName('moderation')
  .setDescription('Moderation actions')
  .setDefaultMemberPermissions(null)
  .addSubcommand(command => command
    .setName('ban').setDescription('Ban a member')
    .addUserOption(option => option.setName('member').setDescription('Member to ban').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason').setMaxLength(500)))
  .addSubcommand(command => command
    .setName('kick').setDescription('Kick a member')
    .addUserOption(option => option.setName('member').setDescription('Member to kick').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason').setMaxLength(500)))
  .addSubcommand(command => command
    .setName('timeout').setDescription('Timeout a member for up to 28 days')
    .addUserOption(option => option.setName('member').setDescription('Member to timeout').setRequired(true))
    .addIntegerOption(option => option.setName('minutes').setDescription('Duration in minutes').setMinValue(1).setMaxValue(40320).setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason').setMaxLength(500)))
  .addSubcommand(command => command
    .setName('purge').setDescription('Delete recent messages (1-100)')
    .addIntegerOption(option => option.setName('amount').setDescription('Number of messages').setMinValue(1).setMaxValue(100).setRequired(true)));

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const reason = interaction.options.getString('reason') || `Requested by ${interaction.user.tag}`;
  const requiredPermission = {
    ban: PermissionFlagsBits.BanMembers,
    kick: PermissionFlagsBits.KickMembers,
    timeout: PermissionFlagsBits.ModerateMembers,
    purge: PermissionFlagsBits.ManageMessages,
  }[subcommand];
  const config = await getGuildConfig(interaction.guildId);
  const hasModeratorRole = interaction.member.roles.cache.some(role => config.moderation.modRoleIds.includes(role.id));
  if (!interaction.memberPermissions?.has(requiredPermission) && !hasModeratorRole) {
    return interaction.reply({ content: 'You do not have permission to use this moderation action.', ephemeral: true });
  }

  if (subcommand === 'purge') {
    if (!interaction.channel?.isTextBased() || !interaction.channel.bulkDelete) {
      return interaction.reply({ content: 'This command requires a text channel.', ephemeral: true });
    }
    const amount = interaction.options.getInteger('amount');
    const deleted = await interaction.channel.bulkDelete(amount, true);
    return interaction.reply({ content: `Deleted ${deleted.size} recent messages.`, ephemeral: true });
  }

  const user = interaction.options.getUser('member');
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!member) return interaction.reply({ content: 'That member is not in this server.', ephemeral: true });
  if (member.id === interaction.guild.ownerId || !member.manageable) {
    return interaction.reply({ content: 'I cannot moderate this member due to Discord role hierarchy.', ephemeral: true });
  }

  if (subcommand === 'ban') await member.ban({ reason });
  if (subcommand === 'kick') await member.kick(reason);
  if (subcommand === 'timeout') {
    const minutes = interaction.options.getInteger('minutes');
    await member.timeout(minutes * 60_000, reason);
  }
  const pastTense = { ban: 'banned', kick: 'kicked', timeout: 'timed out' }[subcommand];
  await interaction.reply({ content: `${member.user.tag} was ${pastTense}.`, ephemeral: true });
}
