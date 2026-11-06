let token = null;
let tokenExpiresAt = 0;
let tokenRequest = null;

async function getToken() {
  if (token && Date.now() < tokenExpiresAt) return token;
  if (tokenRequest) return tokenRequest;
  if (!process.env.KICK_CLIENT_ID || !process.env.KICK_CLIENT_SECRET)
    throw new Error('Kick API credentials are not configured');

  tokenRequest = (async () => {
    const response = await fetch('https://id.kick.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.KICK_CLIENT_ID,
        client_secret: process.env.KICK_CLIENT_SECRET
      }),
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) throw new Error(`Kick token request failed: HTTP ${response.status}`);
    const result = await response.json();
    if (typeof result.access_token !== 'string' || !Number.isFinite(result.expires_in))
      throw new Error('Kick returned an invalid token response');
    token = result.access_token;
    tokenExpiresAt = Date.now() + Math.max(0, result.expires_in - 60) * 1000;
    return token;
  })();

  try {
    return await tokenRequest;
  } finally {
    tokenRequest = null;
  }
}

module.exports = async function checkKick(username) {
  const accessToken = await getToken();
  const slug = username.trim().replace(/^@/, '');
  const response = await fetch(
    `https://api.kick.com/public/v1/channels?slug=${encodeURIComponent(slug)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000)
    }
  );
  if (!response.ok) throw new Error(`Kick API request failed: HTTP ${response.status}`);
  const result = await response.json();
  if (!Array.isArray(result.data)) throw new Error('Kick returned an invalid channel response');
  const channel = result.data[0];
  if (!channel) return { isLive: false };
  return {
    isLive: channel.stream?.is_live === true,
    title: channel.stream_title,
    url: `https://kick.com/${channel.slug}`,
    thumbnail: channel.stream?.thumbnail
  };
};
