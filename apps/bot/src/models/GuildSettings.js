import mongoose from 'mongoose';

const guildSettingsSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true, index: true },
  language: { type: String, enum: ['en', 'ar'], default: 'en' },
  prefix: { type: String, default: '!' },
  moderation: {
    modRoleIds: [{ type: String }],
    logChannelId: { type: String, default: null },
    antiSpam: { type: Boolean, default: false },
    antiInvite: { type: Boolean, default: false },
    antiLink: { type: Boolean, default: false },
  },
  music: {
    defaultVolume: { type: Number, default: 50 },
    autoPlay: { type: Boolean, default: false },
  },
  economy: {
    enabled: { type: Boolean, default: true },
    currencyName: { type: String, default: 'coins' },
  },
  welcome: {
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: null },
    message: { type: String, default: 'Welcome {user} to {server}!' },
  },
}, { timestamps: true, versionKey: false });

export const GuildSettings = mongoose.model('GuildSettings', guildSettingsSchema);
