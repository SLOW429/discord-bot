const { Schema, model } = require('mongoose');

module.exports = model('Warn', new Schema({
  guildId: String, userId: String, moderatorId: String, reason: String
}, { timestamps: true }));
