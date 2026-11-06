const { EmbedBuilder } = require('discord.js');
const { Connectors, LoadType, Shoukaku } = require('shoukaku');
const Guild = require('../models/Guild');
const { persistQueue, clearPersistedQueue } = require('../utils/musicQueue');

const MAX_QUEUE_SIZE = 100;
const DEFAULT_VOLUME = 50;
const DIRECT_URL_HOSTS = [
  'bandcamp.com',
  'soundcloud.com',
  'sndcdn.com',
  'twitch.tv',
  'vimeo.com'
];
const FILTERS = {
  off: {},
  bassboost: {
    equalizer: [
      { band: 0, gain: 0.15 }, { band: 1, gain: 0.15 }, { band: 2, gain: 0.1 },
      { band: 3, gain: 0.05 }, { band: 4, gain: 0 }, { band: 5, gain: -0.05 },
      { band: 6, gain: -0.1 }, { band: 7, gain: -0.1 }, { band: 8, gain: -0.1 },
      { band: 9, gain: -0.1 }, { band: 10, gain: -0.1 }, { band: 11, gain: -0.1 },
      { band: 12, gain: -0.1 }, { band: 13, gain: -0.1 }, { band: 14, gain: -0.1 }
    ]
  },
  nightcore: { timescale: { speed: 1.1, pitch: 1.2, rate: 1 } },
  '3d': { rotation: { rotationHz: 0.2 } },
  karaoke: { karaoke: { level: 1, monoLevel: 1, filterBand: 220, filterWidth: 100 } },
  vaporwave: { timescale: { speed: 0.8, pitch: 0.8, rate: 1 } }
};

function parseNodes() {
  let nodes;
  try {
    nodes = JSON.parse(process.env.LAVALINK_NODES || '');
  } catch (error) {
    throw new Error('LAVALINK_NODES must be a valid JSON array of Lavalink node definitions.', { cause: error });
  }
  if (!Array.isArray(nodes) || !nodes.length) {
    throw new Error('LAVALINK_NODES must contain at least one Lavalink node.');
  }
  for (const node of nodes) {
    if (!node || typeof node.name !== 'string' || typeof node.url !== 'string'
      || typeof node.auth !== 'string' || !node.name.trim() || !node.url.trim() || !node.auth) {
      throw new Error('Each LAVALINK_NODES entry requires non-empty name, url, and auth fields.');
    }
    if (node.secure !== undefined && typeof node.secure !== 'boolean') {
      throw new Error(`Lavalink node "${node.name}" secure must be a boolean.`);
    }
  }
  return nodes;
}

function durationLabel(track) {
  if (track.info.isStream) return 'LIVE';
  const totalSeconds = Math.floor((track.info.length || 0) / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

function isSpotifyLink(query) {
  if (/^spotify:/i.test(query)) return true;
  try {
    const host = new URL(query).hostname.toLowerCase();
    return host === 'spotify.com' || host.endsWith('.spotify.com');
  } catch {
    return false;
  }
}

function isYouTubeLink(query) {
  try {
    const host = new URL(query).hostname.toLowerCase();
    return host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com');
  } catch {
    return false;
  }
}

function isAllowedSourceHost(host) {
  return DIRECT_URL_HOSTS.some(domain => host === domain || host.endsWith(`.${domain}`));
}

function toSong(track) {
  if (typeof track?.encoded !== 'string' || typeof track.info?.title !== 'string') {
    throw new Error('Lavalink returned a malformed or unplayable track.');
  }
  return {
    encoded: track.encoded,
    info: track.info,
    name: track.info.title,
    url: track.info.uri || '',
    formattedDuration: durationLabel(track)
  };
}

function notify(state, content) {
  const channel = state.textChannel || state.client.channels.cache.get(state.textChannelId);
  if (!channel?.isTextBased()) return;
  const payload = typeof content === 'string' ? { content } : content;
  channel.send({ ...payload, allowedMentions: { parse: [] } }).catch(error => {
    console.error(`[music] Could not send notification for guild ${state.guildId}:`, error);
  });
}

function setupMusic(client) {
  const nodes = parseNodes();
  const shoukaku = new Shoukaku(
    new Connectors.DiscordJS(client),
    nodes,
    {
      resume: true,
      resumeTimeout: 60,
      resumeByLibrary: true,
      reconnectTries: 10,
      reconnectInterval: 5,
      moveOnDisconnect: true
    }
  );
  const queues = new Map();
  const mutations = new Map();
  let readyResolve;
  let readySettled = false;
  const ready = new Promise(resolve => { readyResolve = resolve; });
  const resolveReady = () => {
    if (readySettled) return;
    readySettled = true;
    readyResolve();
  };

  shoukaku.on('ready', name => {
    console.log(`[music] Lavalink node "${name}" is ready.`);
    resolveReady();
  });
  shoukaku.on('error', (name, error) => console.error(`[music] Lavalink node "${name}" error:`, error));
  shoukaku.on('close', (name, code, reason) => {
    console.warn(`[music] Lavalink node "${name}" closed (${code}): ${reason}`);
  });
  shoukaku.on('disconnect', (name, count) => {
    console.warn(`[music] Lavalink node "${name}" disconnected after ${count} reconnect attempts.`);
  });

  function getQueue(guildId) {
    const state = queues.get(guildId);
    if (!state?.songs.length) return null;
    return state;
  }

  function serializeGuild(guildId, operation) {
    const previous = mutations.get(guildId) || Promise.resolve();
    const current = previous.then(operation, operation);
    mutations.set(guildId, current);
    return current.finally(() => {
      if (mutations.get(guildId) === current) mutations.delete(guildId);
    });
  }

  function persist(state) {
    persistQueue(state).catch(error => {
      console.error(`[music] Could not persist queue for guild ${state.guildId}:`, error);
    });
  }

  async function playCurrent(state) {
    const current = state.songs[0];
    if (!current) {
      await finishQueue(state);
      return;
    }
    await state.player.playTrack({
      track: { encoded: current.encoded },
      volume: state.volume * 10
    });
    state.paused = false;
    persist(state);
  }

  async function finishQueue(state) {
    if (queues.get(state.guildId) !== state) return;
    queues.delete(state.guildId);
    try {
      await shoukaku.leaveVoiceChannel(state.guildId);
    } finally {
      await clearPersistedQueue(state.guildId).catch(error => {
        console.error(`[music] Could not clear queue for guild ${state.guildId}:`, error);
      });
    }
  }

  async function advance(state, reason) {
    if (queues.get(state.guildId) !== state) return;
    if (state.ignoreNextEnd) {
      state.ignoreNextEnd = false;
      return;
    }
    if (reason === 'stopped' || reason === 'replaced' || reason === 'cleanup') return;
    if (reason === 'finished' && state.repeatMode === 1 && state.songs[0]) {
      await playCurrent(state);
      return;
    }
    const finished = state.songs.shift();
    if (reason === 'finished' && state.repeatMode === 2 && finished) state.songs.push(finished);
    if (state.songs.length) {
      await playCurrent(state);
    } else {
      await finishQueue(state);
    }
  }

  function bindPlayer(state, player) {
    state.player = player;
    player.on('start', event => {
      if (state.player !== player) return;
      const { info } = event.track;
      const title = (info.title || 'مقطع صوتي').slice(0, 256);
      const description = info.uri
        ? `[${title}](${info.uri}) · \`${durationLabel(event.track)}\``
        : `${title} · \`${durationLabel(event.track)}\``;
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('🎶 يتم التشغيل الآن')
        .setDescription(description.slice(0, 4096));
      if (info.author) embed.setFooter({ text: info.author.slice(0, 2048) });
      notify(state, { embeds: [embed] });
    });
    player.on('end', event => {
      if (state.player !== player) return;
      serializeGuild(state.guildId, () => advance(state, event.reason)).catch(error => {
        console.error(`[music] Could not advance queue for guild ${state.guildId}:`, error);
      });
    });
    player.on('exception', event => {
      if (state.player !== player) return;
      console.error(`[music] Lavalink track exception in guild ${state.guildId}:`, event.exception);
      notify(state, '⚠️ تعذر تشغيل المقطع الحالي من المصدر. سيتم تخطيه إذا أنهى Lavalink المحاولة.');
    });
    player.on('stuck', event => {
      if (state.player !== player) return;
      console.warn(`[music] Lavalink track stuck in guild ${state.guildId} after ${event.thresholdMs}ms.`);
      notify(state, '⚠️ توقف تدفق الصوت؛ جارٍ الانتقال إلى المقطع التالي.');
      state.ignoreNextEnd = true;
      player.stopTrack()
        .then(() => {
          return serializeGuild(state.guildId, async () => {
            state.ignoreNextEnd = false;
            await advance(state, 'skip');
          });
        })
        .catch(error => console.error(`[music] Could not recover stuck player for guild ${state.guildId}:`, error));
    });
    player.on('closed', event => {
      if (state.player !== player) return;
      console.warn(`[music] Discord voice connection closed in guild ${state.guildId}: ${event.reason}`);
    });
  }

  async function connect(state, voiceChannel) {
    let connected = false;
    const currentConnection = shoukaku.connections.get(state.guildId);
    if (currentConnection && currentConnection.channelId !== voiceChannel.id) {
      await shoukaku.leaveVoiceChannel(state.guildId);
      state.player = null;
    }
    if (state.player && shoukaku.connections.has(state.guildId)) return connected;
    const player = await shoukaku.joinVoiceChannel({
      guildId: state.guildId,
      shardId: voiceChannel.guild.shardId,
      channelId: voiceChannel.id,
      deaf: true
    });
    bindPlayer(state, player);
    if (state.filters.length) await player.setFilters(FILTERS[state.filters[0]]);
    connected = true;
    return connected;
  }

  async function resolve(query) {
    if (isSpotifyLink(query)) {
      throw new Error('Spotify links provide catalog metadata, not an audio stream. Please play audio from a provider you are authorized to use.');
    }
    const url = /^https?:\/\//i.test(query);
    if (url) {
      let parsed;
      try {
        parsed = new URL(query);
      } catch {
        throw new Error('Enter a valid audio URL or search term.');
      }
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only HTTP and HTTPS audio URLs are supported.');
      if (isYouTubeLink(query)) {
        throw new Error('YouTube playback is disabled. The bot does not bypass YouTube authentication or bot-detection controls.');
      }
      if (!isAllowedSourceHost(parsed.hostname.toLowerCase())) {
        throw new Error('This URL host is not an enabled audio provider.');
      }
      return resolveWithNode(query);
    }
    return resolveWithNode(`scsearch:${query}`);
  }

  async function resolveWithNode(identifier) {
    const node = shoukaku.getIdealNode();
    if (!node) throw new Error('Lavalink is not connected. Check LAVALINK_NODES and the Lavalink server.');
    const result = await node.rest.resolve(identifier);
    if (!result || result.loadType === LoadType.EMPTY) throw new Error('No playable tracks were found for that request.');
    if (result.loadType === LoadType.ERROR) {
      throw new Error(`Lavalink could not resolve the request: ${result.data?.message || result.data?.cause || 'source unavailable'}`);
    }
    const tracks = result.loadType === LoadType.PLAYLIST
      ? result.data.tracks
      : result.loadType === LoadType.TRACK
        ? [result.data]
        : result.data;
    if (!Array.isArray(tracks) || !tracks.length) throw new Error('No playable tracks were found for that request.');
    return tracks.slice(0, MAX_QUEUE_SIZE).map(toSong);
  }

  async function play(voiceChannel, textChannel, query) {
    const songs = await resolve(query);
    return serializeGuild(voiceChannel.guild.id, async () => {
      let state = queues.get(voiceChannel.guild.id);
      if (state && state.songs.length + songs.length > MAX_QUEUE_SIZE) {
        throw new Error(`The queue can hold at most ${MAX_QUEUE_SIZE} tracks.`);
      }
      if (!state) {
        state = {
          client,
          guildId: voiceChannel.guild.id,
          voiceChannelId: voiceChannel.id,
          textChannelId: textChannel.id,
          textChannel,
          player: null,
          songs: [],
          volume: DEFAULT_VOLUME,
          repeatMode: 0,
          paused: false,
          filters: [],
          ignoreNextEnd: false
        };
        queues.set(state.guildId, state);
      }
      const oldTextChannelId = state.textChannelId;
      const oldTextChannel = state.textChannel;
      const oldVoiceChannelId = state.voiceChannelId;
      state.textChannel = textChannel;
      state.textChannelId = textChannel.id;
      state.voiceChannelId = voiceChannel.id;
      const wasPlaying = state.songs.length > 0;
      state.songs.push(...songs);
      try {
        const connected = await connect(state, voiceChannel);
        if (!wasPlaying || connected) await playCurrent(state);
        else persist(state);
      } catch (error) {
        state.songs.splice(Math.max(0, state.songs.length - songs.length), songs.length);
        if (shoukaku.connections.has(state.guildId)) {
          await shoukaku.leaveVoiceChannel(state.guildId).catch(cleanupError => {
            console.error(`[music] Could not clean up failed voice connection for guild ${state.guildId}:`, cleanupError);
          });
        }
        state.player = null;
        state.textChannelId = oldTextChannelId;
        state.textChannel = oldTextChannel;
        state.voiceChannelId = oldVoiceChannelId;
        if (!wasPlaying) queues.delete(state.guildId);
        throw error;
      }
      if (wasPlaying) notify(state, `🎶 تمت إضافة ${songs.length} مقطع إلى القائمة.`);
      return state;
    });
  }

  async function skip(guildId) {
    return serializeGuild(guildId, async () => {
      const state = getQueue(guildId);
      if (!state) throw new Error('There is no active music queue.');
      state.ignoreNextEnd = true;
      try {
        await state.player.stopTrack();
      } catch (error) {
        state.ignoreNextEnd = false;
        throw error;
      }
      state.ignoreNextEnd = false;
      await advance(state, 'skip');
    });
  }

  async function stop(guildId) {
    return serializeGuild(guildId, async () => {
      const state = getQueue(guildId);
      if (!state) throw new Error('There is no active music queue.');
      state.ignoreNextEnd = true;
      state.songs.length = 0;
      try {
        await state.player.stopTrack();
      } finally {
        await finishQueue(state);
      }
    });
  }

  async function setPaused(guildId, paused) {
    return serializeGuild(guildId, async () => {
      const state = getQueue(guildId);
      if (!state) throw new Error('There is no active music queue.');
      await state.player.setPaused(paused);
      state.paused = paused;
      persist(state);
    });
  }

  async function setVolume(guildId, volume) {
    return serializeGuild(guildId, async () => {
      const state = getQueue(guildId);
      if (!state) throw new Error('There is no active music queue.');
      if (!Number.isInteger(volume) || volume < 0 || volume > 100) throw new Error('Volume must be between 0 and 100.');
      await state.player.setGlobalVolume(volume * 10);
      state.volume = volume;
      persist(state);
    });
  }

  async function setRepeatMode(guildId, mode) {
    return serializeGuild(guildId, async () => {
      const state = getQueue(guildId);
      if (!state) throw new Error('There is no active music queue.');
      if (![0, 1, 2].includes(mode)) throw new Error('Repeat mode must be 0, 1, or 2.');
      state.repeatMode = mode;
      persist(state);
    });
  }

  async function setFilter(guildId, filter) {
    return serializeGuild(guildId, async () => {
      const state = getQueue(guildId);
      if (!state) throw new Error('There is no active music queue.');
      if (!Object.hasOwn(FILTERS, filter)) throw new Error('Unsupported audio filter.');
      await state.player.setFilters(FILTERS[filter]);
      state.filters = filter === 'off' ? [] : [filter];
      persist(state);
    });
  }

  async function restoreQueues() {
    const savedGuilds = await Guild.find({ 'musicState.songs.0': { $exists: true } }).lean();
    for (const settings of savedGuilds) {
      const saved = settings.musicState;
      const guild = client.guilds.cache.get(settings.guildId);
      const voiceChannel = guild?.channels.cache.get(saved.voiceChannelId);
      const textChannel = client.channels.cache.get(saved.textChannelId);
      if (!guild || !voiceChannel?.isVoiceBased() || !textChannel?.isTextBased()) {
        await clearPersistedQueue(settings.guildId);
        continue;
      }
      try {
        const songs = [];
        for (const item of saved.songs.slice(0, MAX_QUEUE_SIZE)) {
          if (item.encoded) {
            songs.push({
              encoded: item.encoded,
              info: {
                title: item.name,
                author: item.author || '',
                uri: item.url || '',
                length: item.length || 0,
                isStream: Boolean(item.isStream)
              },
              name: item.name,
              url: item.url || '',
              formattedDuration: item.isStream ? 'LIVE' : durationLabel({ info: { length: item.length || 0 } })
            });
          } else if (item.url) {
            songs.push(...await resolve(item.url));
          }
        }
        if (!songs.length) {
          await clearPersistedQueue(settings.guildId);
          continue;
        }
        const state = {
          client,
          guildId: guild.id,
          voiceChannelId: voiceChannel.id,
          textChannelId: textChannel.id,
          textChannel,
          player: null,
          songs,
          volume: Number.isInteger(saved.volume) ? Math.min(Math.max(saved.volume, 0), 100) : DEFAULT_VOLUME,
          repeatMode: [0, 1, 2].includes(saved.repeatMode) ? saved.repeatMode : 0,
          paused: false,
          filters: [],
          ignoreNextEnd: false
        };
        queues.set(guild.id, state);
        await connect(state, voiceChannel);
        await state.player.setGlobalVolume(state.volume * 10);
        if (saved.filters?.[0] && Object.hasOwn(FILTERS, saved.filters[0])) {
          await state.player.setFilters(FILTERS[saved.filters[0]]);
          state.filters = saved.filters;
        }
        await playCurrent(state);
        if (saved.paused) await setPaused(guild.id, true);
      } catch (error) {
        queues.delete(settings.guildId);
        console.error(`[music] Failed to restore Lavalink queue for guild ${settings.guildId}:`, error);
        await clearPersistedQueue(settings.guildId);
      }
    }
  }

  client.music = {
    shoukaku,
    ready,
    getQueue,
    play,
    skip,
    stop,
    setPaused,
    setVolume,
    setRepeatMode,
    setFilter,
    restoreQueues
  };
  return client.music;
}

module.exports = setupMusic;
