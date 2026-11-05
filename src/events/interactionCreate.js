const { getGuild } = require('../utils/getGuild');
const { recordActivity } = require('../utils/analytics');
const { createTicket, closeTicket } = require('../utils/tickets');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (interaction.isButton() && ['ticket:create', 'ticket:close'].includes(interaction.customId)) {
      try {
        if (interaction.customId === 'ticket:create') await createTicket(interaction);
        else await closeTicket(interaction);
      } catch (error) {
        console.error(`Ticket interaction failed in guild ${interaction.guildId}:`, error);
        const content = 'تعذر إكمال إجراء التذكرة. تحقق من صلاحيات البوت وإعدادات النظام.';
        if (interaction.deferred) await interaction.editReply({ content }).catch(replyError => console.error('Could not update ticket error reply:', replyError));
        else if (!interaction.replied) await interaction.reply({ content, flags: 64 }).catch(replyError => console.error('Could not send ticket error reply:', replyError));
      }
      return;
    }
    if (!interaction.isChatInputCommand()) return;
    if (interaction.guildId) recordActivity(interaction.guildId, 'commands');
    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) return;
    try {
      // هل عُطّل الأمر من الداشبورد؟
      if (interaction.guildId) {
        const s = await getGuild(interaction.guildId);
        if (s.disabledCommands.includes(cmd.data.name))
          return interaction.reply({ content: 'هذا الأمر معطّل في هذا السيرفر.', flags: 64 });
      }
      await cmd.execute(interaction, client);
    } catch (err) {
      console.error(`Error in /${interaction.commandName}:`, err);
      const content = 'حدث خطأ أثناء تنفيذ الأمر.';
      if (interaction.deferred)
        interaction.editReply({ content }).catch(replyError => console.error('Could not edit interaction error reply:', replyError));
      else if (interaction.replied)
        interaction.followUp({ content, flags: 64 }).catch(replyError => console.error('Could not send interaction error reply:', replyError));
      else
        interaction.reply({ content, flags: 64 }).catch(replyError => console.error('Could not send interaction error reply:', replyError));
    }
  }
};
