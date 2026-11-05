const Guild = require('../models/Guild');

const writes = new Map();
const MAX_PERSISTED_SONGS = 100;

function serializeQueue(queue) {
  return {
    voiceChannelId: queue.voiceChannel?.id,
    textChannelId: queue.textChannel?.id,
    songs: queue.songs.slice(0, MAX_PERSISTED_SONGS)
      .filter(song => typeof song.url === 'string' && typeof song.name === 'string')
      .map(song => ({ url: song.url, name: song.name })),
    volume: queue.volume,
    repeatMode: queue.repeatMode,
    paused: queue.paused,
    filters: queue.filters?.collection ? [...queue.filters.collection.keys()] : []
  };
}

function enqueueWrite(guildId, operation) {
  const previous = writes.get(guildId) || Promise.resolve();
  const current = previous.then(operation, operation);
  writes.set(guildId, current);
  return current.finally(() => {
    if (writes.get(guildId) === current) writes.delete(guildId);
  });
}

function persistQueue(queue) {
  const guildId = queue.id;
  const state = serializeQueue(queue);
  if (!guildId || !state.voiceChannelId || !state.textChannelId || !state.songs.length)
    return Promise.resolve();
  return enqueueWrite(guildId, () => Guild.updateOne(
    { guildId },
    { $set: { musicState: state } },
    { upsert: true }
  ));
}

function clearPersistedQueue(guildId) {
  return enqueueWrite(guildId, () => Guild.updateOne(
    { guildId },
    { $unset: { musicState: 1 } }
  ));
}

async function restoreMusicQueues(client) {
  const guilds = await Guild.find({ 'musicState.songs.0': { $exists: true } }).lean();
  client.restoringMusicQueues = true;
  try {
    for (const settings of guilds) {
      const state = settings.musicState;
      const guild = client.guilds.cache.get(settings.guildId);
      const voiceChannel = guild?.channels.cache.get(state.voiceChannelId);
      const textChannel = guild?.channels.cache.get(state.textChannelId);
      if (!guild || !voiceChannel?.isVoiceBased() || !textChannel?.isTextBased()) {
        console.warn(`[music] Skipping saved queue for unavailable channels in guild ${settings.guildId}`);
        await discardSavedQueue(settings.guildId);
        continue;
      }

      try {
        const options = { textChannel };
        for (const song of state.songs) {
          const url = new URL(song.url);
          if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported saved track URL');
          await client.distube.play(voiceChannel, song.url, options);
        }

        const queue = client.distube.getQueue(guild.id);
        if (queue) {
          const volume = Number.isFinite(state.volume) ? state.volume : 50;
          await queue.setVolume(Math.min(Math.max(volume, 0), 100));
          queue.setRepeatMode([0, 1, 2].includes(state.repeatMode) ? state.repeatMode : 0);
          if (state.filters?.length) await queue.filters.set(state.filters);
          if (state.paused) await queue.pause();
          await persistQueue(queue);
        }
      } catch (error) {
        console.error(`[music] Failed to restore saved queue for guild ${settings.guildId}:`, error);
        await discardSavedQueue(settings.guildId);
      }
    }
  } finally {
    client.restoringMusicQueues = false;
  }
}

async function discardSavedQueue(guildId) {
  try {
    await clearPersistedQueue(guildId);
  } catch (error) {
    console.error(`[music] Could not clear invalid saved queue for guild ${guildId}:`, error);
  }
}

module.exports = { persistQueue, clearPersistedQueue, restoreMusicQueues };
