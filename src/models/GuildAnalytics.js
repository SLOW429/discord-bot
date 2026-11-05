const { Schema, model } = require('mongoose');

const analyticsSchema = new Schema({
  guildId: { type: String, required: true },
  day: { type: String, required: true },
  messages: { type: Number, default: 0 },
  commands: { type: Number, default: 0 },
  joins: { type: Number, default: 0 },
  leaves: { type: Number, default: 0 }
}, { timestamps: true });

analyticsSchema.index({ guildId: 1, day: 1 }, { unique: true });
analyticsSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = model('GuildAnalytics', analyticsSchema);
