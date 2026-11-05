const { Schema, model } = require('mongoose');

// حساب مراقَب للبث (Kick / YouTube / TikTok)
const streamerSchema = new Schema({
  platform: { type: String, enum: ['kick', 'youtube', 'tiktok'], required: true },
  username: { type: String, required: true },
  externalId: String,                       // مثال: channelId في يوتيوب (يُحفظ تلقائياً)
  isLive: { type: Boolean, default: false } // آخر حالة معروفة لتجنب تكرار الإشعار
});

const guildSchema = new Schema({
  guildId: { type: String, required: true, unique: true },
  modLogChannelId: String,
  antiSpam: {
    enabled: { type: Boolean, default: true },
    maxMessages: { type: Number, default: 5 },   // عدد الرسائل
    intervalSec: { type: Number, default: 5 }    // خلال كم ثانية
  },
  disabledCommands: { type: [String], default: [] },
  stream: {
    channelId: String,
    mentionRoleId: String,
    message: { type: String, default: '🔴 {streamer} بدأ البث على {platform}!' }
  },
  streamers: { type: [streamerSchema], default: [] }
}, { timestamps: true });

module.exports = model('Guild', guildSchema);
