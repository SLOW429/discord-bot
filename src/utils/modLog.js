const { EmbedBuilder } = require('discord.js');
const { getGuild } = require('./getGuild');

// يرسل سجل إجراء إداري إلى قناة السجل (إن كانت محددة من الداشبورد)
module.exports = async function modLog(guild, action, target, moderator, reason) {
  try {
    const s = await getGuild(guild.id);
    const ch = s.modLogChannelId && guild.channels.cache.get(s.modLogChannelId);
    if (!ch) return;
    const embed = new EmbedBuilder().setColor(0xe67e22).setTitle(String(action).slice(0, 256))
      .addFields(
        { name: 'العضو', value: `${target} (${target.id})`, inline: true },
        { name: 'المسؤول', value: `${moderator}`, inline: true },
        { name: 'السبب', value: String(reason || 'غير محدد').slice(0, 1000) }
      ).setTimestamp();
    await ch.send({ embeds: [embed] });
  } catch (error) {
    console.error(`[mod-log] Could not write ${action} for guild ${guild.id}:`, error);
  }
};
