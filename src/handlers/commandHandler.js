const fs = require('fs');
const path = require('path');

// يحمّل كل أمر من src/commands/<category>/<name>.js
module.exports = function loadCommands(client) {
  const root = path.join(__dirname, '../commands');
  for (const category of fs.readdirSync(root)) {
    for (const file of fs.readdirSync(path.join(root, category)).filter(f => f.endsWith('.js'))) {
      const cmd = require(path.join(root, category, file));
      cmd.category = category;
      client.commands.set(cmd.data.name, cmd);
    }
  }
  console.log(`📦 Loaded ${client.commands.size} commands`);
};
