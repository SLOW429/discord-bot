const { ActivityType } = require('discord.js');
const { startStreamChecker } = require('../services/streamChecker');
const { restoreMusicQueues } = require('../utils/musicQueue');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    client.user.setActivity('slow community', { type: ActivityType.Playing });
    console.log(`Logged in as ${client.user.tag}`);
    // تسجيل أوامر السلاش عالمياً (قد يستغرق ظهورها حتى ساعة أول مرة)
    await client.application.commands.set(client.commands.map(c => c.data.toJSON()));
    await restoreMusicQueues(client);
    startStreamChecker(client);
  }
};
