require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const connectDB = require('./config/database');
const loadCommands = require('./handlers/commandHandler');
const loadEvents = require('./handlers/eventHandler');
const setupMusic = require('./music/distube');
const startDashboard = require('./dashboard/server');

// منع سقوط العملية بسبب خطأ غير متوقع
process.on('unhandledRejection', err => console.error('Unhandled rejection:', err));
process.on('uncaughtException', err => console.error('Uncaught exception:', err));

(async () => {
  // 1) قاعدة البيانات
  await connectDB();

  // 2) البوت (لا نحتاج MessageContent ولا GuildMembers = لا حاجة لتفعيل Privileged Intents)
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildVoiceStates]
  });
  client.commands = new Collection();
  loadCommands(client);
  loadEvents(client);
  setupMusic(client);

  // 3) الداشبورد يعمل في نفس العملية ويشارك نفس كائن client
  startDashboard(client);

  await client.login(process.env.DISCORD_TOKEN);
})();
