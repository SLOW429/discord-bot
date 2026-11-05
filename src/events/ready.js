const { startStreamChecker } = require('../services/streamChecker');

module.exports = {
  name: 'clientReady', // في discord.js v14.17+ ؛ إن كانت نسختك أقدم استخدم 'ready'
  once: true,
  async execute(client) {
    console.log(`🤖 Logged in as ${client.user.tag}`);
    // تسجيل أوامر السلاش عالمياً (قد يستغرق ظهورها حتى ساعة أول مرة)
    await client.application.commands.set(client.commands.map(c => c.data.toJSON()));
    startStreamChecker(client);
  }
};
