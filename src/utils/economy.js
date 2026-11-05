const User = require('../models/User');

async function getUser(guildId, userId) {
  const q = { guildId, userId };
  try {
    return await User.findOneAndUpdate(q, { $setOnInsert: q }, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const user = await User.findOne(q);
    if (!user) throw error;
    return user;
  }
}
// خصم آمن: لا ينجح إلا إذا الرصيد كافٍ (عملية ذرية)
const spend = (guildId, userId, amount) =>
  User.findOneAndUpdate({ guildId, userId, balance: { $gte: amount } }, { $inc: { balance: -amount } }, { new: true });
const add = (guildId, userId, amount) =>
  User.findOneAndUpdate({ guildId, userId }, { $inc: { balance: amount } }, { upsert: true, new: true });

async function claimDaily(guildId, userId, reward, now = new Date()) {
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  try {
    return await User.findOneAndUpdate({
      guildId,
      userId,
      $or: [{ lastDaily: { $exists: false } }, { lastDaily: { $lte: cutoff } }]
    }, {
      $inc: { balance: reward },
      $set: { lastDaily: now }
    }, { upsert: true, new: true });
  } catch (error) {
    if (error.code === 11000) return null;
    throw error;
  }
}

async function transfer(guildId, fromId, toId, amount) {
  if (!Number.isSafeInteger(amount) || amount <= 0 || fromId === toId)
    throw new TypeError('Invalid transfer');
  const session = await User.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const sender = await User.findOneAndUpdate(
        { guildId, userId: fromId, balance: { $gte: amount } },
        { $inc: { balance: -amount } },
        { new: true, session }
      );
      if (!sender) {
        result = null;
        return;
      }
      await User.findOneAndUpdate(
        { guildId, userId: toId },
        { $inc: { balance: amount }, $setOnInsert: { guildId, userId: toId } },
        { upsert: true, new: true, setDefaultsOnInsert: true, session }
      );
      result = sender;
    });
    return result;
  } finally {
    await session.endSession();
  }
}

async function moveFunds(guildId, userId, amount, direction) {
  if (!Number.isSafeInteger(amount) || amount <= 0 || !['deposit', 'withdraw'].includes(direction))
    throw new TypeError('Invalid bank operation');
  const field = direction === 'deposit' ? 'balance' : 'bank';
  const increment = direction === 'deposit'
    ? { balance: -amount, bank: amount }
    : { bank: -amount, balance: amount };
  try {
    return await User.findOneAndUpdate(
      { guildId, userId, [field]: { $gte: amount } },
      { $inc: increment },
      { new: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    return null;
  }
}

async function claimWork(guildId, userId, reward, now = new Date()) {
  const cutoff = new Date(now.getTime() - 60 * 60 * 1000);
  try {
    return await User.findOneAndUpdate({
      guildId,
      userId,
      $or: [{ lastWork: { $exists: false } }, { lastWork: { $lte: cutoff } }]
    }, {
      $inc: { balance: reward },
      $set: { lastWork: now }
    }, { upsert: true, new: true, setDefaultsOnInsert: true });
  } catch (error) {
    if (error.code === 11000) return null;
    throw error;
  }
}

module.exports = { getUser, spend, add, claimDaily, transfer, moveFunds, claimWork };
