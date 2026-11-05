const User = require('../models/User');

async function getUser(guildId, userId) {
  const q = { guildId, userId };
  return (await User.findOne(q)) ?? (await User.create(q));
}
// خصم آمن: لا ينجح إلا إذا الرصيد كافٍ (عملية ذرية)
const spend = (guildId, userId, amount) =>
  User.findOneAndUpdate({ guildId, userId, balance: { $gte: amount } }, { $inc: { balance: -amount } }, { new: true });
const add = (guildId, userId, amount) =>
  User.findOneAndUpdate({ guildId, userId }, { $inc: { balance: amount } }, { upsert: true, new: true });

module.exports = { getUser, spend, add };
