// Kick: API الرسمي (OAuth client_credentials). أنشئ تطبيقاً من إعدادات حسابك على Kick Developer.
let token = null, tokenExp = 0;

async function getToken() {
  if (token && Date.now() < tokenExp) return token;
  const r = await fetch('https://id.kick.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.KICK_CLIENT_ID,
      client_secret: process.env.KICK_CLIENT_SECRET
    })
  });
  if (!r.ok) throw new Error(`Kick token ${r.status}`);
  const j = await r.json();
  token = j.access_token;
  tokenExp = Date.now() + (j.expires_in - 60) * 1000;
  return token;
}

module.exports = async function checkKick(username) {
  const r = await fetch(`https://api.kick.com/public/v1/channels?slug=${encodeURIComponent(username)}`, {
    headers: { Authorization: `Bearer ${await getToken()}` }
  });
  if (!r.ok) throw new Error(`Kick API ${r.status}`);
  const ch = (await r.json()).data?.[0];
  if (!ch) return { isLive: false };
  return {
    isLive: !!ch.stream?.is_live,
    title: ch.stream_title,
    url: `https://kick.com/${ch.slug}`,
    thumbnail: ch.stream?.thumbnail
  };
};
