import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { GuildConfig } from '../models/GuildConfig.js';
import { translate } from '../handlers/i18n.js';

export const data = new SlashCommandBuilder()
  .setName('language')
  .setDescription('Set this server’s language')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption(option => option
    .setName('locale')
    .setDescription('Language to use for bot responses')
    .setRequired(true)
    .addChoices(
      { name: 'English', value: 'en' },
      { name: 'العربية', value: 'ar' },
    ));

export async function execute(interaction) {
  if (!interaction.guildId) {
    return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
  }

  const language = interaction.options.getString('locale', true);
  await GuildConfig.findOneAndUpdate(
    { guildId: interaction.guildId },
    { $set: { language }, $setOnInsert: { guildId: interaction.guildId } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );

  const displayName = await translate(`language.${language === 'ar' ? 'arabic' : 'english'}`, language);
  const content = await translate('language.updated', language, { language: displayName });
  return interaction.reply({ content, ephemeral: true });
}
