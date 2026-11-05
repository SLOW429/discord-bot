const { getGuild } = require('../utils/getGuild');
const modLog = require('../utils/modLog');

const hits = new Map(); // "guild-user" -> [timestamps]

// نظام Anti-Spam: إذا تجاوز العضو الحد يُعطى Timeout لدقيقة
module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (!message.guild || message.author.bot || !message.member) return;
    const s = await getGuild(message.guild.id);
    if (!s.antiSpam.enabled) return;
    if (message.member.permissions.has('ManageMessages')) return; // استثناء المشرفين

    const key = `${message.guild.id}-${message.author.id}`;
    const now = Date.now();
    const list = (hits.get(key) || []).filter(t => now - t < s.antiSpam.intervalSec * 1000);
    list.push(now);
    hits.set(key, list);

    if (list.length >= s.antiSpam.maxMessages && message.member.moderatable) {
      hits.delete(key);
      await message.member.timeout(60_000, 'Anti-spam').catch(() => {});
      message.channel.send(`🚫 ${message.author}، توقف عن الإزعاج (Timeout دقيقة).`).catch(() => {});
      modLog(message.guild, 'Anti-Spam Timeout', message.author, message.client.user, 'إرسال رسائل بسرعة');
    }
  }
};
