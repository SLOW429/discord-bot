import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { authenticated } from '../middleware/authenticated.js';
import { userCanManageGuild } from '../auth.js';
import { env } from '../config.js';

const router = Router();
const discordApi = 'https://discord.com/api/v10';
const snowflake = z.string().regex(/^\d{17,20}$/);
const settingsSchema = z.object({
  language: z.enum(['en', 'ar']).optional(),
  features: z.object({
    welcome: z.boolean().optional(),
    antiSpam: z.boolean().optional(),
    antiLink: z.boolean().optional(),
    antiInvite: z.boolean().optional(),
    antiMassMention: z.boolean().optional(),
    antiRaid: z.boolean().optional(),
    music: z.boolean().optional(),
    economy: z.boolean().optional(),
    leveling: z.boolean().optional(),
  }).strict().optional(),
  welcome: z.object({
    channelId: snowflake.nullable().optional(),
    message: z.string().max(500).optional(),
  }).strict().optional(),
  logging: z.object({ channelId: snowflake.nullable().optional() }).strict().optional(),
  moderation: z.object({
    modRoleIds: z.array(snowflake).max(20).optional(),
    antiSpamLimit: z.number().int().min(3).max(20).optional(),
    antiSpamWindowMs: z.number().int().min(3000).max(30000).optional(),
    automodAction: z.enum(['warn', 'timeout', 'kick', 'ban']).optional(),
    automodTimeoutMs: z.number().int().min(1000).max(2419200000).optional(),
    massMentionLimit: z.number().int().min(3).max(50).optional(),
  }).strict().optional(),
  music: z.object({ defaultVolume: z.number().int().min(1).max(100).optional() }).strict().optional(),
}).strict();

async function fetchManageableGuilds(req) {
  if (Date.now() >= (req.session.tokenExpiresAt ?? 0) - 60_000) {
    if (!req.session.refreshToken) {
      const error = new Error('Discord session expired; sign in again.');
      error.status = 401;
      throw error;
    }
    const refreshResponse = await fetch(`${discordApi}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: req.session.refreshToken,
      }),
    });
    if (!refreshResponse.ok) {
      const error = new Error('Discord session expired; sign in again.');
      error.status = 401;
      throw error;
    }
    const token = await refreshResponse.json();
    req.session.accessToken = token.access_token;
    req.session.refreshToken = token.refresh_token;
    req.session.tokenExpiresAt = Date.now() + token.expires_in * 1000;
    req.session.guildsExpiresAt = 0;
  }

  if (Date.now() > (req.session.guildsExpiresAt ?? 0)) {
    const response = await fetch(`${discordApi}/users/@me/guilds`, {
      headers: { Authorization: `Bearer ${req.session.accessToken}` },
    });
    if (!response.ok) throw new Error(`Discord guild lookup failed (${response.status}).`);
    const guilds = await response.json();
    req.session.manageableGuilds = guilds
      .filter(userCanManageGuild)
      .map(({ id, name, icon }) => ({ id, name, icon }));
    req.session.guildsExpiresAt = Date.now() + 60_000;
  }
  return req.session.manageableGuilds ?? [];
}

async function requireGuildAccess(req, res, next) {
  try {
    const guildId = snowflake.parse(req.params.guildId);
    const guilds = await fetchManageableGuilds(req);
    if (!guilds.some(guild => guild.id === guildId)) {
      return res.status(403).json({ error: 'Manage Server permission required.' });
    }
    req.guildId = guildId;
    return next();
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid server ID.' });
    return next(error);
  }
}

router.use(authenticated);

router.get('/', async (req, res, next) => {
  try {
    const guilds = await fetchManageableGuilds(req);
    return res.json({ guilds });
  } catch (error) {
    return next(error);
  }
});

router.get('/:guildId/config', requireGuildAccess, async (req, res, next) => {
  try {
    const Config = mongoose.model('GuildConfig');
    const config = await Config.findOneAndUpdate(
      { guildId: req.guildId },
      { $setOnInsert: { guildId: req.guildId } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    return res.json({ config });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:guildId/config', requireGuildAccess, async (req, res, next) => {
  try {
    const patch = settingsSchema.parse(req.body);
    const updates = {};
    for (const [section, values] of Object.entries(patch)) {
      if (section === 'language') {
        updates.language = values;
        continue;
      }
      for (const [key, value] of Object.entries(values)) updates[`${section}.${key}`] = value;
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No settings provided.' });

    const Config = mongoose.model('GuildConfig');
    const config = await Config.findOneAndUpdate(
      { guildId: req.guildId },
      { $set: updates, $setOnInsert: { guildId: req.guildId } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();
    return res.json({ config });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid settings.', details: error.issues });
    return next(error);
  }
});

export default router;
