'use client';

import { useEffect, useState } from 'react';

const initialSettings = {
  language: 'en',
  features: {
    welcome: false,
    antiSpam: false,
    antiLink: false,
    antiInvite: false,
    antiMassMention: false,
    antiRaid: false,
    music: true,
    economy: true,
    leveling: false,
  },
  welcome: { channelId: '', message: 'Welcome {user} to {server}!' },
  logging: { channelId: '' },
  moderation: { antiSpamLimit: 6, antiSpamWindowMs: 7000, automodAction: 'timeout', automodTimeoutMs: 60000, massMentionLimit: 5 },
  music: { defaultVolume: 50 },
};

export default function DashboardPage() {
  const [guilds, setGuilds] = useState([]);
  const [guildId, setGuildId] = useState('');
  const [readyGuildId, setReadyGuildId] = useState('');
  const [settings, setSettings] = useState(initialSettings);
  const [status, setStatus] = useState('Loading your servers…');

  useEffect(() => {
    fetch('/api/guilds', { credentials: 'include' })
      .then(async response => {
        if (response.status === 401) {
          window.location.assign('/');
          return null;
        }
        if (!response.ok) throw new Error('Could not load servers.');
        return response.json();
      })
      .then(data => {
        if (!data) return;
        setGuilds(data.guilds);
        setGuildId(data.guilds[0]?.id ?? '');
        setStatus(data.guilds.length ? 'Choose a server to configure.' : 'No manageable servers were found.');
      })
      .catch(error => setStatus(error.message));
  }, []);

  useEffect(() => {
    if (!guildId) return;
    fetch(`/api/guilds/${guildId}/config`, { credentials: 'include' })
      .then(async response => {
        if (response.status === 401) {
          window.location.assign('/');
          return null;
        }
        if (!response.ok) throw new Error('Could not load server settings.');
        return response.json();
      })
      .then(result => {
        if (!result) return;
        const { config } = result;
        setSettings({
          language: config.language ?? 'en',
          features: { ...initialSettings.features, ...config.features },
          welcome: {
            ...initialSettings.welcome,
            ...config.welcome,
            channelId: config.welcome.channelId ?? '',
          },
          logging: { ...initialSettings.logging, ...config.logging, channelId: config.logging.channelId ?? '' },
          moderation: { ...initialSettings.moderation, ...config.moderation },
          music: { ...initialSettings.music, ...config.music },
        });
        setReadyGuildId(guildId);
        setStatus('Settings loaded.');
      })
      .catch(error => setStatus(error.message));
  }, [guildId]);

  useEffect(() => {
    if (!guildId || readyGuildId !== guildId) return undefined;
    const timeout = setTimeout(async () => {
      setStatus('Saving…');
      try {
        const response = await fetch(`/api/guilds/${guildId}/config`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            language: settings.language,
            features: settings.features,
            welcome: { ...settings.welcome, channelId: settings.welcome.channelId || null },
            logging: { channelId: settings.logging.channelId || null },
            moderation: settings.moderation,
            music: settings.music,
          }),
        });
        if (response.status === 401) {
          window.location.assign('/');
          return;
        }
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || 'Could not save settings.');
        }
        setStatus('Settings saved.');
      } catch (error) {
        setStatus(error.message);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [guildId, readyGuildId, settings]);

  function update(section, key, value) {
    setSettings(current => ({ ...current, [section]: { ...current[section], [key]: value } }));
  }

  async function logout() {
    await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.assign('/');
  }

  return (
    <main style={{ maxWidth: 850, margin: '0 auto', padding: 32 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Server dashboard</h1>
        <button onClick={logout}>Log out</button>
      </header>
      <p>{status}</p>
      <label>
        Server{' '}
        <select value={guildId} onChange={event => setGuildId(event.target.value)}>
          {guilds.map(guild => <option key={guild.id} value={guild.id}>{guild.name ?? guild.id}</option>)}
        </select>
      </label>

      <h2>Language</h2>
      <label>
        Server language{' '}
        <select value={settings.language} onChange={event => setSettings(current => ({ ...current, language: event.target.value }))}>
          <option value="en">English</option>
          <option value="ar">العربية</option>
        </select>
      </label>

      <h2>Features</h2>
      {Object.entries(settings.features).map(([key, enabled]) => (
        <label key={key} style={{ display: 'block', margin: '12px 0' }}>
          <input type="checkbox" checked={enabled} onChange={event => update('features', key, event.target.checked)} />
          {' '}{key}
        </label>
      ))}

      <h2>Welcome</h2>
      <label>Channel ID <input value={settings.welcome.channelId} onChange={event => update('welcome', 'channelId', event.target.value)} /></label>
      <br />
      <label>Message <input value={settings.welcome.message} maxLength={500} onChange={event => update('welcome', 'message', event.target.value)} /></label>

      <h2>Logging</h2>
      <label>Channel ID <input value={settings.logging.channelId} onChange={event => update('logging', 'channelId', event.target.value)} /></label>

      <h2>Moderation</h2>
      <label>Messages before anti-spam action <input type="number" min="3" max="20" value={settings.moderation.antiSpamLimit} onChange={event => update('moderation', 'antiSpamLimit', Number(event.target.value))} /></label>
      <br />
      <label>Moderator role IDs (comma-separated) <input value={(settings.moderation.modRoleIds ?? []).join(',')} onChange={event => update('moderation', 'modRoleIds', event.target.value.split(',').map(value => value.trim()).filter(Boolean))} /></label>
      <br />
      <label>
        Auto-mod action{' '}
        <select value={settings.moderation.automodAction} onChange={event => update('moderation', 'automodAction', event.target.value)}>
          <option value="warn">Warn only</option>
          <option value="timeout">Timeout</option>
          <option value="kick">Kick</option>
          <option value="ban">Ban</option>
        </select>
      </label>
      <br />
      <label>Auto-mod timeout (seconds) <input type="number" min="1" max="2419200" value={settings.moderation.automodTimeoutMs / 1000} onChange={event => update('moderation', 'automodTimeoutMs', Number(event.target.value) * 1000)} /></label>
      <h2>Music</h2>
      <label>Default volume <input type="number" min="1" max="100" value={settings.music.defaultVolume} onChange={event => update('music', 'defaultVolume', Number(event.target.value))} /></label>
      <br /><br />
      <p>Changes save automatically.</p>
    </main>
  );
}
