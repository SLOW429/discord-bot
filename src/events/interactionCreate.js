const { getGuild } = require('../utils/getGuild');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) return;
    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) return;
    try {
      // هل عُطّل الأمر من الداشبورد؟
      if (interaction.guildId) {
        const s = await getGuild(interaction.guildId);
        if (s.disabledCommands.includes(cmd.data.name))
          return interaction.reply({ content: '⛔ هذا الأمر معطّل في هذا السيرفر.', flags: 64 });
      }
      await cmd.execute(interaction, client);
    } catch (err) {
      console.error(`Error in /${interaction.commandName}:`, err);
      const msg = { content: '❌ حدث خطأ أثناء تنفيذ الأمر.', flags: 64 };
      if (interaction.deferred || interaction.replied) interaction.followUp(msg).catch(() => {});
      else interaction.reply(msg).catch(() => {});
    }
  }
};
