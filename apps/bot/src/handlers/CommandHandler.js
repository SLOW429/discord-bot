import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Collection } from 'discord.js';

export class CommandHandler {
  constructor(client) {
    this.client = client;
    this.commands = new Collection();
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

      const imported = await import(pathToFileURL(fullPath).href);
      const command = imported.default ?? imported;
      if (!command || !command.data || !command.execute) continue;

      const commandName = command.data.name || entry.name.replace(/\.js$/, '');
      this.commands.set(commandName, command);
    }

    return this.commands;
  }
}
