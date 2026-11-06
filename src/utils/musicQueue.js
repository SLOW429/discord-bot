const Guild = require('../models/Guild');

const writes = new Map();
const MAX_PERSISTED_SONGS = 100;

function serializeQueue(queue) {
  return {
    voiceChannelId: queue.voiceChannelId,
    textChannelId: queue.textChannelId,
    songs: queue.songs.slice(0, MAX_PERSISTED_SONGS)
      .filter(song => typeof song.encoded === 'string' && typeof song.name === 'string')
      .map(song => ({
        encoded: song.encoded,
        url: song.url,
        name: song.name,
        author: song.info?.author || '',
        length: song.info?.length || 0,
        isStream: Boolean(song.info?.isStream)
      })),
    volume: queue.volume,
    repeatMode: queue.repeatMode,
    paused: queue.paused,
    filters: queue.filters || []
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
  const guildId = queue.guildId;
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
  return client.music.restoreQueues();
}

module.exports = { persistQueue, clearPersistedQueue, restoreMusicQueues };
