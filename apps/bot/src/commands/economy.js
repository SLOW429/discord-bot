import mongoose from 'mongoose';
import { SlashCommandBuilder } from 'discord.js';
import { getGuildConfig } from '../lib/config.js';
import { UserProfile } from '../models/UserProfile.js';
import { getInteractionText } from '../handlers/i18n.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const data = new SlashCommandBuilder()
  .setName('economy')
  .setDescription('Wallet, daily rewards, work, and transfers')
  .addSubcommand(command => command
    .setName('wallet')
    .setDescription('View your wallet and bank balances'))
  .addSubcommand(command => command
    .setName('daily')
    .setDescription('Claim your daily reward'))
  .addSubcommand(command => command
    .setName('work')
    .setDescription('Work for a random reward'))
  .addSubcommand(command => command
    .setName('transfer')
    .setDescription('Transfer wallet funds to a server member')
    .addUserOption(option => option
      .setName('member')
      .setDescription('Member receiving the transfer')
      .setRequired(true))
    .addIntegerOption(option => option
      .setName('amount')
      .setDescription('Amount to transfer')
      .setMinValue(1)
      .setMaxValue(1000000)
      .setRequired(true)));

async function getProfile(guildId, user) {
  return UserProfile.findOneAndUpdate(
    { guildId, userId: user.id },
    {
      $set: { username: user.username },
      $setOnInsert: { guildId, userId: user.id },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

function cooldownRemaining(until, now) {
  return Math.max(0, new Date(until).getTime() - now);
}

export async function execute(interaction) {
  const config = await getGuildConfig(interaction.guildId);
  if (!config.features.economy) {
    return interaction.reply({
      content: await getInteractionText(interaction, 'economy.disabled'),
      ephemeral: true,
    });
  }

  const action = interaction.options.getSubcommand();
  const profile = await getProfile(interaction.guildId, interaction.user);
  const currency = config.economy.currencyName;

  if (action === 'wallet') {
    return interaction.reply({
      content: await getInteractionText(interaction, 'economy.balance', {
        user: interaction.user.username,
        wallet: profile.wallet,
        bank: profile.bank,
        currency,
      }),
      ephemeral: true,
    });
  }

  const now = new Date();
  if (action === 'daily') {
    const claimed = await UserProfile.findOneAndUpdate(
      {
        guildId: interaction.guildId,
        userId: interaction.user.id,
        $or: [{ dailyClaimedAt: null }, { dailyClaimedAt: { $lte: new Date(now.getTime() - DAY) } }],
      },
      { $inc: { wallet: config.economy.dailyReward }, $set: { dailyClaimedAt: now } },
      { new: true },
    );

    if (!claimed) {
      const current = await UserProfile.findOne({ guildId: interaction.guildId, userId: interaction.user.id });
      const remaining = cooldownRemaining(new Date(current.dailyClaimedAt).getTime() + DAY, now.getTime());
      return interaction.reply({
        content: await getInteractionText(interaction, 'economy.dailyCooldown', {
          hours: Math.floor(remaining / HOUR),
          minutes: Math.floor((remaining % HOUR) / 60_000),
        }),
        ephemeral: true,
      });
    }

    return interaction.reply({
      content: await getInteractionText(interaction, 'economy.daily', {
        amount: config.economy.dailyReward,
        currency,
      }),
      ephemeral: true,
    });
  }

  if (action === 'work') {
    const reward = Math.floor(Math.random() * 151) + 50;
    const worked = await UserProfile.findOneAndUpdate(
      {
        guildId: interaction.guildId,
        userId: interaction.user.id,
        $or: [{ workCooldownUntil: null }, { workCooldownUntil: { $lte: now } }],
      },
      { $inc: { wallet: reward }, $set: { workCooldownUntil: new Date(now.getTime() + HOUR) } },
      { new: true },
    );

    if (!worked) {
      const current = await UserProfile.findOne({ guildId: interaction.guildId, userId: interaction.user.id });
      const remaining = cooldownRemaining(current.workCooldownUntil, now.getTime());
      return interaction.reply({
        content: await getInteractionText(interaction, 'economy.workCooldown', {
          minutes: Math.ceil(remaining / 60_000),
        }),
        ephemeral: true,
      });
    }

    return interaction.reply({
      content: await getInteractionText(interaction, 'economy.work', { amount: reward, currency }),
      ephemeral: true,
    });
  }

  const recipient = interaction.options.getUser('member', true);
  const amount = interaction.options.getInteger('amount', true);
  if (recipient.id === interaction.user.id) {
    return interaction.reply({
      content: await getInteractionText(interaction, 'economy.transferSelf'),
      ephemeral: true,
    });
  }

  try {
    await interaction.guild.members.fetch(recipient.id);
  } catch (error) {
    if (error.code === 10007) {
      return interaction.reply({
        content: await getInteractionText(interaction, 'economy.recipientNotMember'),
        ephemeral: true,
      });
    }
    throw error;
  }

  await getProfile(interaction.guildId, recipient);
  const session = await mongoose.startSession();
  let transferred = false;
  try {
    await session.withTransaction(async () => {
      const debited = await UserProfile.findOneAndUpdate(
        { guildId: interaction.guildId, userId: interaction.user.id, wallet: { $gte: amount } },
        { $inc: { wallet: -amount } },
        { new: true, session },
      );
      if (!debited) return;

      await UserProfile.updateOne(
        { guildId: interaction.guildId, userId: recipient.id },
        { $inc: { wallet: amount } },
        { session },
      );
      transferred = true;
    });
  } finally {
    await session.endSession();
  }

  if (!transferred) {
    return interaction.reply({
      content: await getInteractionText(interaction, 'economy.insufficientFunds'),
      ephemeral: true,
    });
  }

  return interaction.reply({
    content: await getInteractionText(interaction, 'economy.transfer', {
      amount,
      currency,
      user: recipient.username,
    }),
    ephemeral: true,
  });
}
