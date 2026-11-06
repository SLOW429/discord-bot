const API = 'https://www.googleapis.com/youtube/v3';

async function api(path, params) {
  if (!process.env.YOUTUBE_API_KEY) throw new Error('YOUTUBE_API_KEY is not configured');
  const url = new URL(`${API}/${path}`);
  url.search = new URLSearchParams({ ...params, key: process.env.YOUTUBE_API_KEY });
  const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(`YouTube API ${r.status}: ${body.error?.message || 'request failed'}`);
  }
  return r.json();
}

module.exports = async function checkYouTube(username, entry) {
  let channelId = entry.externalId;
  if (!channelId) {
    const q = /^UC[\w-]{22}$/.test(username) ? { id: username } : { forHandle: username.replace(/^@/, '') };
    channelId = (await api('channels', { part: 'id', ...q })).items?.[0]?.id;
    if (!channelId) return { isLive: false };
  }

  const search = await api('search', {
    part: 'snippet',
    channelId,
    eventType: 'live',
    type: 'video',
    maxResults: '1'
  });
  const live = search.items?.find(item => item.id?.videoId);
  if (!live) return { isLive: false, externalId: channelId };
  const th = live.snippet?.thumbnails || {};
  return {
    isLive: true, externalId: channelId,
    title: live.snippet.title,
    url: `https://www.youtube.com/watch?v=${live.id.videoId}`,
    thumbnail: (th.maxres || th.high || th.medium)?.url
  };
};
