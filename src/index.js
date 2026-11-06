require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const connectDB = require('./config/database');
const loadCommands = require('./handlers/commandHandler');
const loadEvents = require('./handlers/eventHandler');
const setupMusic = require('./music/lavalink');
const startDashboard = require('./dashboard/server');

(async () => {
  const required = [
    'DISCORD_TOKEN', 'MONGODB_URI', 'SESSION_SECRET', 'BASE_URL',
    'CLIENT_ID', 'CLIENT_SECRET'
  ];
  const missing = required.filter(name => !process.env[name]);
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  if (process.env.SESSION_SECRET.length < 32)
    throw new Error('SESSION_SECRET must contain at least 32 characters');

  // 1) قاعدة البيانات
  await connectDB();

  // MessageContent and GuildMembers must also be enabled in the Discord Developer Portal.
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildModeration
    ]
  });
  client.commands = new Collection();
  loadCommands(client);
  loadEvents(client);
  setupMusic(client);

  // 3) الداشبورد يعمل في نفس العملية ويشارك نفس كائن client
  startDashboard(client);

  await client.login(process.env.DISCORD_TOKEN);
})();
