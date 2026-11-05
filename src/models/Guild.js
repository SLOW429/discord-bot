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
    message: { type: String, default: '{streamer} بدأ البث على {platform}!' }
  },
  streamers: { type: [streamerSchema], default: [] },
  welcome: {
    enabled: { type: Boolean, default: false },
    channelId: String,
    message: { type: String, default: 'أهلاً {user} في {server}!' },
    imageUrl: String,
    leaveEnabled: { type: Boolean, default: false },
    leaveMessage: { type: String, default: 'غادر {user} السيرفر.' },
    autoRoleId: String
  },
  antiRaid: {
    enabled: { type: Boolean, default: false },
    joinThreshold: { type: Number, default: 8 },
    windowSec: { type: Number, default: 10 },
    timeoutMinutes: { type: Number, default: 10 }
  },
  security: {
    antiLinks: { type: Boolean, default: false },
    antiMassMention: { type: Boolean, default: false },
    mentionThreshold: { type: Number, default: 5 },
    antiNuke: { type: Boolean, default: false },
    nukeThreshold: { type: Number, default: 3 },
    nukeWindowSec: { type: Number, default: 10 }
  },
  ticketing: {
    panelChannelId: String,
    categoryId: String,
    staffRoleId: String,
    logChannelId: String
  },
  customCommands: {
    type: [{
      trigger: { type: String, required: true, maxlength: 32 },
      response: { type: String, required: true, maxlength: 1000 }
    }],
    default: []
  },
  musicState: {
    voiceChannelId: String,
    textChannelId: String,
    songs: {
      type: [{
        url: { type: String, required: true },
        name: { type: String, required: true }
      }],
      default: []
    },
    volume: { type: Number, default: 50 },
    repeatMode: { type: Number, default: 0 },
    paused: { type: Boolean, default: false },
    filters: { type: [String], default: [] }
  }
}, { timestamps: true });

module.exports = model('Guild', guildSchema);
