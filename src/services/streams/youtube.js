// YouTube Data API: نتجنب search.list (يكلّف 100 وحدة) ونستخدم قائمة uploads (وحدتان فقط لكل فحص).
const API = 'https://www.googleapis.com/youtube/v3';

async function api(path, params) {
  const url = new URL(`${API}/${path}`);
  url.search = new URLSearchParams({ ...params, key: process.env.YOUTUBE_API_KEY });
  const r = await fetch(url);
  if (!r.ok) throw new Error(`YouTube API ${r.status}`);
  return r.json();
}

module.exports = async function checkYouTube(username, entry) {
  let channelId = entry.externalId;
  if (!channelId) { // نحوّل @handle إلى channelId مرة واحدة ونحفظه
    const q = /^UC[\w-]{22}$/.test(username) ? { id: username } : { forHandle: username.replace(/^@/, '') };
    channelId = (await api('channels', { part: 'id', ...q })).items?.[0]?.id;
    if (!channelId) return { isLive: false };
  }
  // قائمة الرفع الخاصة بالقناة = "UU" + باقي المعرّف
  const pl = await api('playlistItems', { part: 'contentDetails', playlistId: 'UU' + channelId.slice(2), maxResults: 5 });
  const ids = pl.items.map(i => i.contentDetails.videoId).join(',');
  if (!ids) return { isLive: false, externalId: channelId };

  const videos = await api('videos', { part: 'snippet', id: ids });
  const live = videos.items.find(v => v.snippet.liveBroadcastContent === 'live');
  if (!live) return { isLive: false, externalId: channelId };
  const th = live.snippet.thumbnails;
  return {
    isLive: true, externalId: channelId,
    title: live.snippet.title,
    url: `https://www.youtube.com/watch?v=${live.id}`,
    thumbnail: (th.maxres || th.high || th.medium)?.url
  };
};
