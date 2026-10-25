# Slows Discord Bot + Dashboard

This repository includes a modular Discord.js v14 bot, an Express OAuth/configuration API, and a Next.js dashboard. The default `npm start` runs the modular bot; `npm run start:legacy` preserves the previous root entry point.

## Project structure

```text
apps/
  api/
    src/
      auth.js                  # Discord OAuth2 and session endpoints
      config.js                # Environment validation
      index.js                 # Express API entry point
      middleware/authenticated.js
      routes/guilds.js         # Permission-checked guild config API
  bot/
    src/
      commands/
        moderation.js          # Ban, kick, timeout, purge
        music.js               # Search/play plus interactive controls
        voice.js               # Pull a member / move one or all members
        language.js            # Per-server English/Arabic language setting
        economy.js             # Guild wallet, daily, work, and transfer example
      events/
        guildMemberAdd.js      # Welcome and anti-raid signal
        guildMemberRemove.js
        messageCreate.js       # Configurable anti-spam/link/invite/mention moderation
        messageDelete.js
        messageUpdate.js
        auditLog.js            # Channel, role, ban, and guild/member audit events
      handlers/
        CommandHandler.js      # Recursive command loader
        EventHandler.js        # Recursive event loader
        i18n.js                # English/Arabic locale loading and interpolation
      lib/
        config.js              # MongoDB guild settings access
        logger.js
      models/
        GuildConfig.js         # Canonical per-guild settings
        UserProfile.js         # Guild-scoped wallet/level profile
        Warning.js             # Moderation cases
        CustomCommand.js
      index.js                 # Bot process entry point
    test/config.test.js
  api/test/auth.test.js
  web/                        # apps/web in the repository
    app/
      dashboard/page.js        # Server picker + per-server settings form
      globals.css
      layout.js
      page.js                  # Sign-in landing page
      page.module.css
    next.config.js            # Local API/auth proxy rewrites
.env.example
README.md
```

## Architecture

- **Bot:** Discord.js v14 process, slash commands, MongoDB-backed per-guild configuration. Run independently from the web services.
- **API:** Express on port `3001`, Discord OAuth2 authorization-code flow with state verification, MongoDB-backed sessions, rate limiting, and allow-listed configuration updates. It checks the signed-in user's current guild list and `Manage Guild`/`Administrator` permission before reading or changing a server's settings.
- **Dashboard:** Next.js on port `3000`; browser calls `/api` and `/auth` on the same origin. Server settings auto-save after a short debounce. In production, the reverse proxy routes those paths to Express and all other paths to Next.js.
- **Database:** One `GuildConfig` document per guild plus guild-scoped user profiles and warning records. Add MongoDB backups, TLS, and access controls before production.

## Included starter capabilities

The repository is a scalable starter, not a claim that every item in the feature wishlist is already implemented. Working command/event surfaces are:

| Area | Included now | Designed extension points |
| --- | --- | --- |
| Localization | English/Arabic locale files, localized ping/economy responses, `/language`, and dashboard language selection | Add keys to both `apps/bot/src/locales/` files as commands are localized. Discord's current application-command locale enum does not accept Arabic, so registered command labels remain English. |
| Moderation | Ban, kick, timeout, purge; warning model; configurable spam/link/invite/mass-mention auto-moderation and audit logs | Add cases/commands for slowmode, lock/unlock, nicknames, and richer policy rules |
| Voice | Pull, move one member, move all members | Temp/private voice lifecycle, channel locking/limits |
| Music | Discord Player search/play, queue, skip, pause/resume, volume, stop | Lavalink operation, loop/shuffle/seek/lyrics/24-7 and translated controls |
| Economy | Guild-scoped wallet/bank display, daily reward, work cooldown, safe transfer transaction | Deposit/withdraw/crime, leaderboards, leveling XP/roles/cards |
| Welcome and utility | Configurable text welcome/leave message, logging, dashboard config | Image-card rendering, tickets/transcripts, polls/giveaways, games, AI adapters |

Feature switches default off where they can moderate members. Configure an appropriate log channel and test bot permissions and role hierarchy in a private guild before enabling enforcement.

## Local setup

1. Install Node.js 22.22.2+ (or Node.js 24.15+) and MongoDB (MongoDB Atlas or a local replica set; economy transfers use transactions).
2. Create a Discord application at <https://discord.com/developers/applications>. Under **OAuth2**, add the redirect URI `http://localhost:3001/auth/discord/callback` for local use. Copy the application ID and secret. Under **Bot**, create/copy a bot token and enable the **Server Members Intent**. To use anti-link, anti-invite, or mass-mention filtering, also enable **Message Content Intent** and set `ENABLE_MESSAGE_CONTENT_INTENT=true`; it is opt-in because Discord classifies it as privileged.
3. Copy `.env.example` to `.env`. Set `MONGODB_URI`, `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, and a long random `SESSION_SECRET`. For local work set:

   ```env
   DISCORD_REDIRECT_URI=http://localhost:3001/auth/discord/callback
   WEB_ORIGIN=http://localhost:3000
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   TRUST_PROXY=false
   ```

4. Install dependencies with `npm install`.
5. Use the Discord Developer Portal's **OAuth2 → URL Generator** to create the bot invite: select `bot` and `applications.commands` scopes, then grant only the bot permissions needed for your features (View Channel, Send Messages, Embed Links, Read Message History, Move Members, Connect, Speak, plus the moderation permissions you intend to use). This avoids embedding a stale or overbroad permission integer. The bot's role must be above roles it manages. Never grant Administrator just to work around role hierarchy.

6. Run the processes in separate terminals:

   ```sh
   npm run start:api
   npm run start:bot
   npm run dev:web
   ```

7. Run `npm test` to execute the starter checks.
8. Visit `http://localhost:3000`, sign in, and select a server where you have Manage Server. Slash commands are registered globally; Discord may take time to propagate them. Set `DISCORD_TEST_GUILD_ID` during development to register commands immediately to one test guild.

`npm start` and `npm run start:bot` launch the same modular bot. The old root entry remains available with `npm run start:legacy`. Never run two bot processes with the same Discord token at the same time.

## Production deployment on `slows.dev`

1. Deploy the web app and API on a Node.js 22.22.2+ host or VPS with persistent process supervision. Run the bot as its own continuously running worker. Use a managed MongoDB database with TLS and a least-privilege database user.
2. Point `slows.dev` DNS to the web ingress and provision HTTPS. Keep the API private behind the ingress where possible.
3. Route `https://slows.dev/auth/*` and `https://slows.dev/api/*` to the Express service on `127.0.0.1:3001`. Route remaining requests to Next.js on `127.0.0.1:3000`. Preserve the host and forward `X-Forwarded-Proto`; set `TRUST_PROXY=true` only behind that trusted proxy.

   Example Nginx routing for a VPS (provision the TLS certificate before enabling this block):

   ```nginx
   server {
       listen 80;
       server_name slows.dev www.slows.dev;
       return 301 https://$host$request_uri;
   }

   server {
       listen 443 ssl;
       server_name slows.dev www.slows.dev;
       ssl_certificate /etc/letsencrypt/live/slows.dev/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/slows.dev/privkey.pem;

       location ~ ^/(api|auth)/ {
           proxy_pass http://127.0.0.1:3001;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

   Create DNS `A`/`AAAA` records for `slows.dev` and `www.slows.dev` pointing at the VPS, then use Certbot or your host's TLS service to issue the certificate.

4. In the Discord Developer Portal, configure OAuth2 redirect URI exactly as `https://slows.dev/auth/discord/callback`; ensure **General Information → Application ID**, **OAuth2 client secret**, and the bot token match the production environment.
5. Configure production secrets from your host's secret manager (do not commit `.env`). Set:

   ```env
   NODE_ENV=production
   DISCORD_REDIRECT_URI=https://slows.dev/auth/discord/callback
   WEB_ORIGIN=https://slows.dev
   NEXT_PUBLIC_SITE_URL=https://slows.dev
   TRUST_PROXY=true
   ```

6. Build and start:

   ```sh
   npm install --omit=dev
   npm run build:web
   npm run start:api
   npm run start:bot
   npm run start:web
   ```

   Use systemd, Docker Compose, or your provider's process manager to restart each service on failure and send logs to a monitored sink.
7. Verify OAuth login, server selection, settings persistence after refresh, slash-command permissions, voice movement, and moderation in a private test guild before inviting users.

## Commands and permissions

- `/voice pull member` moves a member to the command user's current voice channel.
- `/voice move member destination` moves one member; `/voice move-all source destination` moves all occupants.
- `/moderation ban|kick|timeout|purge` performs standard moderation operations.
- `/play query` searches a supported Discord Player extractor and starts playback. Buttons provide skip, pause/resume, queue display, volume adjustment, and stop.

Voice movement and moderation are intentionally limited by both Discord permissions and role hierarchy. Configure the bot role and channel permissions deliberately. Anti-spam is configurable and timeout-based; anti-raid is a signal/logging starter only, not a substitute for a tested incident-response policy.

## Music notes

Discord Player delegates search and extraction to its configured extractors. Source availability changes over time; confirm the providers' current terms and extractor compatibility before enabling playback in a public bot. Spotify generally provides metadata rather than playable audio in third-party bots; this starter does not download or bypass Spotify/YouTube access controls. Add a supported Lavalink server and source plugin if you need a separately operated audio backend, then secure and monitor that service.

## Security and operations

- OAuth sessions use HTTP-only, same-site cookies; production cookies are Secure. Keep the session secret stable and private.
- Revoke/rotate any token that was previously printed or committed. Do not paste real tokens into issues or chat.
- Review intents, permissions, rate limits, database retention, privacy disclosures, and Discord Developer Terms before launch.
- Add tests and monitoring around the exact protections and moderation policy you intend to enforce. Defaults are conservative and features are off until configured.
- Before deploying the guild-scoped `UserProfile` index, migrate any existing data and remove the old global unique `userId` index (`userId_1`) from the profiles collection. Back up the database before index migration.
