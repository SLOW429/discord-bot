import mongoose from 'mongoose';

const customCommandSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  response: { type: String, required: true },
  createdBy: { type: String, required: true },
}, { timestamps: true, versionKey: false });

export const CustomCommand = mongoose.model('CustomCommand', customCommandSchema);
