import mongoose from 'mongoose';

const userProfileSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  username: { type: String, default: '' },
  wallet: { type: Number, min: 0, default: 0 },
  bank: { type: Number, min: 0, default: 0 },
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  dailyClaimedAt: { type: Date, default: null },
  workCooldownUntil: { type: Date, default: null },
  crimeCooldownUntil: { type: Date, default: null },
}, { timestamps: true, versionKey: false });

userProfileSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const UserProfile = mongoose.model('UserProfile', userProfileSchema);
