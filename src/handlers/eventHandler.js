const fs = require('fs');
const path = require('path');

module.exports = function loadEvents(client) {
  const dir = path.join(__dirname, '../events');
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
    const ev = require(path.join(dir, file));
    client[ev.once ? 'once' : 'on'](ev.name, (...args) => {
      Promise.resolve().then(() => ev.execute(...args, client)).catch(error => {
        console.error(`Error in event ${ev.name}:`, error);
      });
    });
  }
};
