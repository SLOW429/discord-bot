import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { getInteractionText } from '../handlers/i18n.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .addUserOption(option => option.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason')
      || await getInteractionText(interaction, 'moderation.ban.noReason');

    if (!target) {
      return interaction.reply({ content: await getInteractionText(interaction, 'common.noTarget'), ephemeral: true });
    }

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member || !member.bannable) {
      return interaction.reply({ content: await getInteractionText(interaction, 'common.cannotBan'), ephemeral: true });
    }

    await member.ban({ reason });
    const message = await getInteractionText(interaction, 'moderation.ban.success', { target: target.tag, reason });
    return interaction.reply({ content: message, ephemeral: true });
  },
};
