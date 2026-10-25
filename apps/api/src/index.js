import mongoose from 'mongoose';
import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { env } from './config.js';
import { authRouter } from './auth.js';
import guildRoutes from './routes/guilds.js';
import '../../bot/src/models/GuildConfig.js';

await mongoose.connect(env.MONGODB_URI);

const app = express();
if (env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json({ limit: '20kb' }));
app.use(session({
  name: 'slows.sid',
  secret: process.env.SESSION_SECRET,
  store: MongoStore.create({ mongoUrl: env.MONGODB_URI, collectionName: 'webSessions' }),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));
app.use('/auth', rateLimit({ windowMs: 15 * 60_000, limit: 30 }), authRouter);
app.use('/api/guilds', rateLimit({ windowMs: 60_000, limit: 120 }), guildRoutes);
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use((error, _req, res, _next) => {
  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) console.error('API request failed:', error);
  res.status(status).json({
    error: status === 401 ? 'Sign in with Discord again.' : 'The request could not be completed.',
  });
});

app.listen(env.API_PORT, '127.0.0.1', () => {
  console.log(`Configuration API listening on 127.0.0.1:${env.API_PORT}`);
});
