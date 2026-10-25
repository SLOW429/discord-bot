import path from 'node:path';
import mongoose from 'mongoose';
import {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
} from 'discord.js';
import { Player } from 'discord-player';
import { env } from './config.js';
import { CommandHandler } from './handlers/CommandHandler.js';
import { EventHandler } from './handlers/EventHandler.js';
import { attachAuditEvents } from './events/auditLog.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    ...(env.ENABLE_MESSAGE_CONTENT_INTENT === 'true' ? [GatewayIntentBits.MessageContent] : []),
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const player = new Player(client);
player.events.on('error', error => console.error('Music player error:', error));
player.extractors.on('error', (_context, extractor, error) => {
  console.error(`Music extractor ${extractor.constructor.name} failed:`, error);
});

const commandHandler = new CommandHandler(client);
const eventHandler = new EventHandler(client);

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = commandHandler.commands.get(interaction.commandName);
      if (command) await command.execute(interaction, player);
    } else if (interaction.isButton() && interaction.customId.startsWith('music_')) {
      const musicCommand = commandHandler.commands.get('play');
      if (musicCommand && typeof musicCommand.handleButton === 'function') {
        await musicCommand.handleButton(interaction, player);
      }
    }
  } catch (error) {
    console.error('Interaction failed:', error);
    const response = { content: 'The action failed. Check the bot logs and permissions.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(response).catch(console.error);
    } else {
      await interaction.reply(response).catch(console.error);
    }
  }
});

await mongoose.connect(env.MONGODB_URI);
await eventHandler.load(path.join(process.cwd(), 'apps/bot/src/events'));
await commandHandler.load(path.join(process.cwd(), 'apps/bot/src/commands'));
attachAuditEvents(client);

const extractorLoad = await player.extractors.loadDefault();
if (!extractorLoad.success) throw extractorLoad.error;

const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
const commandData = [...commandHandler.commands.values()].map(command => command.data.toJSON());
if (env.DISCORD_TEST_GUILD_ID) {
  await rest.put(
    Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_TEST_GUILD_ID),
    { body: commandData },
  );
} else {
  await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), { body: commandData });
}

client.once(Events.ClientReady, readyClient => {
  console.log(`Bot ready as ${readyClient.user.tag}`);
});
await client.login(env.DISCORD_TOKEN);
