import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getGuildConfig } from '../lib/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, '../locales');

const localeCache = new Map();
const supportedLocales = new Set(['en', 'ar']);

async function loadLocale(locale) {
  const normalizedLocale = supportedLocales.has(locale) ? locale : 'en';
  if (localeCache.has(normalizedLocale)) return localeCache.get(normalizedLocale);

  const filePath = path.join(localesDir, `${normalizedLocale}.js`);
  const data = await import(pathToFileURL(filePath).href);
  localeCache.set(normalizedLocale, data.default ?? data);
  return localeCache.get(normalizedLocale);
}

export async function getLocaleData(locale = 'en') {
  return loadLocale(locale);
}

export async function translate(key, locale = 'en', variables = {}) {
  const localeData = await loadLocale(locale);
  const value = key.split('.').reduce((acc, part) => acc?.[part], localeData) ?? key;
  return Object.entries(variables).reduce((text, [token, replacement]) => text.replaceAll(`{${token}}`, String(replacement)), value);
}

export async function resolveGuildLocale(guildSettings = {}, fallback = 'en') {
  const locale = guildSettings.language || fallback;
  return supportedLocales.has(locale) ? locale : fallback;
}

export async function getGuildText(guildSettings = {}, key, variables = {}) {
  return translate(key, await resolveGuildLocale(guildSettings), variables);
}

export async function getInteractionText(interaction, key, variables = {}) {
  const settings = interaction.guildId
    ? await getGuildConfig(interaction.guildId)
    : { language: interaction.locale?.startsWith('ar') ? 'ar' : 'en' };
  return getGuildText(settings, key, variables);
}
