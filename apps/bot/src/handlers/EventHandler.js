import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export class EventHandler {
  constructor(client) {
    this.client = client;
  }

  async load(dirPath) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await this.load(fullPath);
        continue;
      }

      if (!entry.name.endsWith('.js')) continue;
      if (entry.name === 'auditLog.js') continue;

      const imported = await import(pathToFileURL(fullPath).href);
      const eventFactory = imported.default ?? imported;
      if (!eventFactory) continue;

      const eventName = imported.eventName || entry.name.replace(/\.js$/, '');
      if (typeof eventFactory !== 'function') continue;

      this.client.on(eventName, (...args) => {
        Promise.resolve(eventFactory(...args)).catch(error => console.error(`Event ${eventName} failed:`, error));
      });
    }
  }
}
