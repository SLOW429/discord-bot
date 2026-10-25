import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { env } from './config.js';

const router = Router();
const discordApi = 'https://discord.com/api/v10';
const manageGuild = 0x20n;
const administrator = 0x8n;

function userCanManageGuild(guild) {
  const permissions = BigInt(guild.permissions);
  return (permissions & manageGuild) === manageGuild || (permissions & administrator) === administrator;
}

router.get('/discord', (req, res) => {
  const state = randomBytes(32).toString('hex');
  req.session.oauthState = state;
  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds',
    state,
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

router.get('/discord/callback', async (req, res, next) => {
  try {
    const state = req.query.state;
    const expected = req.session.oauthState;
    delete req.session.oauthState;
    if (typeof state !== 'string' || typeof expected !== 'string') {
      return res.status(400).send('Invalid OAuth state.');
    }
    const providedBuffer = Buffer.from(state);
    const expectedBuffer = Buffer.from(expected);
    if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
      return res.status(400).send('Invalid OAuth state.');
    }
    if (typeof req.query.code !== 'string') return res.status(400).send('Missing OAuth code.');

    const tokenResponse = await fetch(`${discordApi}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: req.query.code,
        redirect_uri: env.DISCORD_REDIRECT_URI,
      }),
    });
    if (!tokenResponse.ok) throw new Error(`OAuth token exchange failed (${tokenResponse.status}).`);
    const token = await tokenResponse.json();

    const userResponse = await fetch(`${discordApi}/users/@me`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!userResponse.ok) throw new Error(`Discord user lookup failed (${userResponse.status}).`);
    const user = await userResponse.json();

    await new Promise((resolve, reject) => {
      req.session.regenerate(error => error ? reject(error) : resolve());
    });
    req.session.user = { id: user.id, username: user.username, avatar: user.avatar };
    req.session.accessToken = token.access_token;
    req.session.refreshToken = token.refresh_token;
    req.session.tokenExpiresAt = Date.now() + token.expires_in * 1000;
    return res.redirect(new URL('/dashboard', env.WEB_ORIGIN).toString());
  } catch (error) {
    return next(error);
  }
});

router.get('/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ user: null });
  return res.json({ user: req.session.user });
});

router.post('/logout', (req, res, next) => {
  req.session.destroy(error => {
    if (error) return next(error);
    res.clearCookie('slows.sid');
    return res.status(204).end();
  });
});

export { router as authRouter, userCanManageGuild };

