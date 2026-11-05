const { EmbedBuilder } = require('discord.js');
const { getGuild } = require('./getGuild');

// يرسل سجل إجراء إداري إلى قناة السجل (إن كانت محددة من الداشبورد)
module.exports = async function modLog(guild, action, target, moderator, reason) {
  const s = await getGuild(guild.id);
  const ch = s.modLogChannelId && guild.channels.cache.get(s.modLogChannelId);
  if (!ch) return;
  const embed = new EmbedBuilder().setColor(0xe67e22).setTitle(`🛡️ ${action}`)
    .addFields(
      { name: 'العضو', value: `${target} (${target.id})`, inline: true },
      { name: 'المسؤول', value: `${moderator}`, inline: true },
      { name: 'السبب', value: reason || 'غير محدد' }
    ).setTimestamp();
  ch.send({ embeds: [embed] }).catch(() => {});
};
