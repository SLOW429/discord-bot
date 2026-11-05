const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

module.exports = {
  data: new SlashCommandBuilder().setName('rank').setDescription('عرض المستوى والخبرة').setDMPermission(false)
    .addUserOption(option => option.setName('user').setDescription('عضو آخر')),
  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const data = await User.findOne({ guildId: interaction.guildId, userId: target.id }).lean();
    const xp = data?.xp || 0;
    const level = Math.floor(Math.sqrt(xp / 100));
    const nextLevelXp = (level + 1) ** 2 * 100;
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x8b5cf6)
        .setTitle(`مستوى ${target.username}`)
        .setDescription(`المستوى **${level}** · الخبرة **${xp} / ${nextLevelXp} XP**`)]
    });
  }
};
