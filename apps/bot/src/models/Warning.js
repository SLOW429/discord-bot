import mongoose from 'mongoose';

const warningSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  moderatorId: { type: String, required: true },
  reason: { type: String, default: 'No reason provided.' },
  caseId: { type: Number, required: true },
}, { timestamps: true, versionKey: false });

warningSchema.index({ guildId: 1, caseId: 1 }, { unique: true });

export const Warning = mongoose.model('Warning', warningSchema);
