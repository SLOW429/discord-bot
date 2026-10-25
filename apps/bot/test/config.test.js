import test from 'node:test';
import assert from 'node:assert/strict';
import { GuildConfig } from '../src/models/GuildConfig.js';
import * as voice from '../src/commands/voice.js';
import * as moderation from '../src/commands/moderation.js';
import * as music from '../src/commands/music.js';
import * as economy from '../src/commands/economy.js';
import * as language from '../src/commands/language.js';
import * as ban from '../src/commands/ban.js';
import * as ping from '../src/commands/ping.js';
import { translate } from '../src/handlers/i18n.js';

test('new guild configurations default optional protections off', () => {
  const config = new GuildConfig({ guildId: '123456789012345678' });
  assert.equal(config.features.antiSpam, false);
  assert.equal(config.features.antiRaid, false);
  assert.equal(config.features.welcome, false);
  assert.equal(config.features.music, true);
  assert.equal(config.language, 'en');
  assert.equal(config.features.economy, true);
  assert.equal(config.moderation.automodAction, 'timeout');
  assert.deepEqual(config.moderation.modRoleIds, []);
});

test('starter slash command definitions are serializable', () => {
  assert.deepEqual(
    [voice, moderation, music, economy, language, ban, ping]
      .map(command => (command.default ?? command).data.toJSON().name),
    ['voice', 'moderation', 'play', 'economy', 'language', 'ban', 'ping'],
  );
});

test('English and Arabic locale strings resolve and interpolate', async () => {
  assert.equal(await translate('utility.ping', 'en', { latency: 42 }), 'Pong! Latency: 42ms');
  assert.match(await translate('utility.ping', 'ar', { latency: 42 }), /42ms/);
  assert.equal(await translate('utility.ping', 'unknown', { latency: 5 }), 'Pong! Latency: 5ms');
});
