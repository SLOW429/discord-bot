const { EmbedBuilder } = require('discord.js');
const { DisTube, Events } = require('distube');
const { SpotifyPlugin } = require('@distube/spotify');
const { YouTubePlugin } = require('@distube/youtube');
const { YtDlpPlugin } = require('@distube/yt-dlp');

// يربط DisTube بالبوت ويضيفه على client.distube
module.exports = function setupMusic(client) {
  client.distube = new DisTube(client, {
    ffmpeg: { path: require('ffmpeg-static') },
    // Spotify يحوّل الروابط إلى YouTube للتشغيل؛ yt-dlp كاحتياط
    plugins: [new SpotifyPlugin(), new YouTubePlugin(), new YtDlpPlugin()]
  });

  const embed = (title, song) => new EmbedBuilder().setColor(0x1db954).setTitle(title)
    .setDescription(`[${song.name}](${song.url}) \`${song.formattedDuration}\``)
    .setThumbnail(song.thumbnail || null);

  client.distube
    .on(Events.PLAY_SONG, (q, song) => q.textChannel?.send({ embeds: [embed('🎶 يتم التشغيل الآن', song)] }))
    .on(Events.ADD_SONG, (q, song) => q.textChannel?.send({ embeds: [embed('➕ أُضيفت للقائمة', song)] }))
    .on(Events.ERROR, (err, q) => {
      console.error('DisTube error:', err);
      q?.textChannel?.send(`❌ ${String(err.message).slice(0, 300)}`);
    });
};
