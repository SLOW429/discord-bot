import mongoose from 'mongoose';

const guildConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true, index: true },
  language: { type: String, enum: ['en', 'ar'], default: 'en' },
  features: {
    welcome: { type: Boolean, default: false },
    antiSpam: { type: Boolean, default: false },
    antiLink: { type: Boolean, default: false },
    antiInvite: { type: Boolean, default: false },
    antiMassMention: { type: Boolean, default: false },
    antiRaid: { type: Boolean, default: false },
    music: { type: Boolean, default: true },
    economy: { type: Boolean, default: true },
    leveling: { type: Boolean, default: false },
  },
  welcome: {
    channelId: { type: String, default: null },
    message: { type: String, default: 'Welcome {user} to {server}!' },
    leaveMessage: { type: String, default: 'Goodbye {user}.' },
    backgroundUrl: { type: String, default: null },
  },
  logging: { channelId: { type: String, default: null } },
  moderation: {
    modRoleIds: { type: [String], default: [] },
    antiSpamLimit: { type: Number, min: 3, max: 20, default: 6 },
    antiSpamWindowMs: { type: Number, min: 3000, max: 30000, default: 7000 },
    automodAction: { type: String, enum: ['warn', 'timeout', 'kick', 'ban'], default: 'timeout' },
    automodTimeoutMs: { type: Number, min: 1000, max: 2419200000, default: 60000 },
    massMentionLimit: { type: Number, min: 3, max: 50, default: 5 },
    caseCounter: { type: Number, min: 0, default: 0 },
  },
  music: {
    defaultVolume: { type: Number, min: 1, max: 100, default: 50 },
  },
  economy: {
    currencyName: { type: String, default: 'coins', maxlength: 20 },
    dailyReward: { type: Number, min: 1, max: 1000000, default: 250 },
  },
  leveling: {
    xpPerMessage: { type: Number, min: 1, max: 100, default: 15 },
    levelUpChannelId: { type: String, default: null },
  },
}, { timestamps: true, versionKey: false });

export const GuildConfig = mongoose.model('GuildConfig', guildConfigSchema);
