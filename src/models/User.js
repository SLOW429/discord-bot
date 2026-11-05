const { Schema, model } = require('mongoose');

// بيانات الاقتصاد لكل عضو داخل كل سيرفر
const userSchema = new Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  balance: { type: Number, default: 0 },
  lastDaily: Date
});
userSchema.index({ guildId: 1, userId: 1 }, { unique: true });
userSchema.index({ guildId: 1, balance: -1 });

module.exports = model('User', userSchema);
