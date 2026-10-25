import { SlashCommandBuilder } from 'discord.js';
import { getInteractionText } from '../handlers/i18n.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency'),
  async execute(interaction) {
    const latency = Date.now() - interaction.createdTimestamp;
    const text = await getInteractionText(interaction, 'utility.ping', { latency });
    return interaction.reply({ content: text, ephemeral: true });
  },
};
