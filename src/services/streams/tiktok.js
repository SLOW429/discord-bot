// TikTok: لا يوجد API رسمي. نستخدم مكتبة tiktok-live-connector (غير رسمية) وقد تتعطل أو تُحجب.
module.exports = async function checkTikTok(username) {
  const mod = await import('tiktok-live-connector');
  const Conn = mod.TikTokLiveConnection || mod.WebcastPushConnection || mod.default?.WebcastPushConnection;
  const conn = new Conn(username.replace(/^@/, ''));

  try {
    let isLive = false, info = null;
    if (typeof conn.fetchIsLive === 'function') isLive = await conn.fetchIsLive();
    else { info = await conn.getRoomInfo(); isLive = info?.status === 2; }

    if (!isLive) return { isLive: false };
    try {
      info = info || (await conn.fetchRoomInfo?.());
    } catch (error) {
      console.warn('[streams] TikTok thumbnail lookup failed:', error.message);
    }
    return {
      isLive: true,
      title: info?.title,
      url: `https://www.tiktok.com/@${username.replace(/^@/, '')}/live`,
      thumbnail: info?.cover?.url_list?.[0]
    };
  } finally {
    if (typeof conn.disconnect === 'function') {
      try {
        await conn.disconnect();
      } catch (error) {
        console.error('[streams] TikTok connection cleanup failed:', error);
      }
    }
  }
};
