const { EmbedBuilder } = require('discord.js');
const { DisTube, Events } = require('distube');
const { SpotifyPlugin } = require('@distube/spotify');
const { YouTubePlugin } = require('@distube/youtube');
const { YtDlpPlugin } = require('@distube/yt-dlp');
const { persistQueue, clearPersistedQueue } = require('../utils/musicQueue');

// يربط DisTube بالبوت ويضيفه على client.distube
module.exports = function setupMusic(client) {
  client.ytDlpPlugin = new YtDlpPlugin({ update: true });
  client.distube = new DisTube(client, {
    ffmpeg: { path: require('ffmpeg-static') },
    emitNewSongOnly: true,
    savePreviousSongs: false,
    // Keep yt-dlp last as the fallback playable extractor for supported URLs.
    plugins: [new SpotifyPlugin(), new YouTubePlugin(), client.ytDlpPlugin]
  });

  const embed = (title, song) => new EmbedBuilder().setColor(0x1db954).setTitle(title)
    .setDescription(`[${song.name}](${song.url}) \`${song.formattedDuration}\``)
    .setThumbnail(song.thumbnail || null);
  const notify = (queue, payload) => {
    if (client.restoringMusicQueues || !queue?.textChannel) return;
    queue.textChannel.send(payload).catch(error => console.error('Could not send music notification:', error));
  };
  const persist = queue => persistQueue(queue)
    .catch(error => console.error(`Could not persist music queue for guild ${queue.id}:`, error));

  client.distube
    .on(Events.PLAY_SONG, (queue, song) => {
      notify(queue, { embeds: [embed('يتم التشغيل الآن', song)] });
      persist(queue);
    })
    .on(Events.ADD_SONG, (queue, song) => {
      notify(queue, { embeds: [embed('أضيفت للقائمة', song)] });
      persist(queue);
    })
    .on(Events.DELETE_QUEUE, queue => clearPersistedQueue(queue.id)
      .catch(error => console.error(`Could not clear music queue for guild ${queue.id}:`, error)))
    .on(Events.ERROR, (err, q) => {
      console.error('DisTube error:', err);
      notify(q, {
        content: String(err.message).slice(0, 300),
        allowedMentions: { parse: [] }
      });
    });
};
