import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { getGuildConfig } from '../lib/config.js';

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Search and play a track')
  .addStringOption(option => option.setName('query').setDescription('Track name or supported URL').setRequired(true));

export async function execute(interaction, player) {
  const config = await getGuildConfig(interaction.guildId);
  if (!config.features.music) {
    return interaction.reply({ content: 'Music is disabled for this server.', ephemeral: true });
  }

  const voiceChannel = interaction.member.voice.channel;
  if (!voiceChannel) {
    return interaction.reply({ content: 'Join a voice channel before requesting music.', ephemeral: true });
  }
  const permissions = voiceChannel.permissionsFor(interaction.guild.members.me);
  if (!permissions?.has([PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) {
    return interaction.reply({ content: 'I need Connect and Speak permissions in your voice channel.', ephemeral: true });
  }

  await interaction.deferReply();
  const query = interaction.options.getString('query', true);
  const result = await player.search(query, { requestedBy: interaction.user });
  if (!result.tracks.length) {
    return interaction.editReply('No playable tracks were found for that query.');
  }

  const queue = player.nodes.create(interaction.guild, {
    metadata: interaction.channel,
    volume: config.music.defaultVolume,
    leaveOnEnd: true,
    leaveOnStop: true,
  });
  await queue.connect(voiceChannel);
  queue.addTrack(result.tracks[0]);
  if (!queue.isPlaying()) await queue.node.play();

  const playbackControls = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_skip').setLabel('Skip').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('music_pause').setLabel('Pause / resume').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_stop').setLabel('Stop').setStyle(ButtonStyle.Danger),
  );
  const utilityControls = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_queue').setLabel('Queue').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_volume_down').setLabel('Volume −').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_volume_up').setLabel('Volume +').setStyle(ButtonStyle.Secondary),
  );
  return interaction.editReply({
    content: `Queued **${result.tracks[0].title}** — ${result.tracks[0].url}`,
    components: [playbackControls, utilityControls],
  });
}

export async function handleButton(interaction, player) {
  const queue = player.nodes.get(interaction.guildId);
  if (!queue) return interaction.reply({ content: 'There is no active player.', ephemeral: true });
  if (queue.channel && interaction.member.voice.channelId !== queue.channel.id) {
    return interaction.reply({ content: 'Join the bot voice channel to control playback.', ephemeral: true });
  }

  if (interaction.customId === 'music_skip') {
    if (!queue.isPlaying()) return interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
    queue.node.skip();
    return interaction.reply({ content: 'Skipped the current track.', ephemeral: true });
  }
  if (interaction.customId === 'music_pause') {
    if (!queue.isPlaying()) return interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
    queue.node.setPaused(!queue.node.isPaused());
    return interaction.reply({ content: queue.node.isPaused() ? 'Playback paused.' : 'Playback resumed.', ephemeral: true });
  }
  if (interaction.customId === 'music_queue') {
    const upcoming = queue.tracks.toArray().slice(0, 10);
    const description = upcoming.length
      ? upcoming.map((track, index) => `${index + 1}. **${track.title}**`).join('\n')
      : 'No tracks are waiting after the current track.';
    return interaction.reply({ content: `**Up next**\n${description}`, ephemeral: true });
  }
  if (interaction.customId === 'music_volume_down' || interaction.customId === 'music_volume_up') {
    const adjustment = interaction.customId === 'music_volume_up' ? 10 : -10;
    const volume = Math.max(1, Math.min(100, queue.node.volume + adjustment));
    queue.node.setVolume(volume);
    return interaction.reply({ content: `Volume set to ${volume}%.`, ephemeral: true });
  }
  queue.delete();
  return interaction.reply({ content: 'Playback stopped.', ephemeral: true });
}
