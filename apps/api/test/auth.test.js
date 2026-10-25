import test from 'node:test';
import assert from 'node:assert/strict';

process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/test';
process.env.DISCORD_CLIENT_ID = 'test-client-id';
process.env.DISCORD_CLIENT_SECRET = 'test-client-secret';
process.env.DISCORD_REDIRECT_URI = 'http://localhost:3001/auth/discord/callback';
process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters';
process.env.WEB_ORIGIN = 'http://localhost:3000';

const { userCanManageGuild } = await import('../src/auth.js');

test('Manage Server and Administrator guild permissions are accepted', () => {
  assert.equal(userCanManageGuild({ permissions: '32' }), true);
  assert.equal(userCanManageGuild({ permissions: '8' }), true);
  assert.equal(userCanManageGuild({ permissions: '40' }), true);
});

test('guilds without Manage Server or Administrator are rejected', () => {
  assert.equal(userCanManageGuild({ permissions: '0' }), false);
  assert.equal(userCanManageGuild({ permissions: '4' }), false);
});
