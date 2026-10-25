export default {
  common: {
    success: 'Success',
    error: 'Something went wrong.',
    permission: 'You do not have permission to use this command.',
    noTarget: 'Please mention or provide a valid user.',
    noPermission: 'You do not have permission to use this command.',
    cannotBan: 'I cannot ban this user due to role hierarchy or missing permissions.',
  },
  moderation: {
    ban: {
      success: 'User {target} was banned for: {reason}',
      noReason: 'No reason provided.',
    },
    kick: {
      success: 'User {target} was kicked for: {reason}',
    },
    timeout: {
      success: 'User {target} was timed out for {duration} minutes.',
    },
    purge: {
      success: 'Deleted {count} messages.',
    },
  },
  utility: {
    ping: 'Pong! Latency: {latency}ms',
  },
  language: {
    updated: 'This server will now use {language}.',
    english: 'English',
    arabic: 'Arabic',
    guildOnly: 'This command can only be used in a server.',
  },
  economy: {
    disabled: 'The economy system is disabled in this server.',
    balance: '{user} has {wallet} {currency} in their wallet and {bank} {currency} in the bank.',
    daily: 'You claimed {amount} {currency}. Come back in 24 hours.',
    dailyCooldown: 'Your next daily reward is available in {hours}h {minutes}m.',
    work: 'You earned {amount} {currency}.',
    workCooldown: 'You can work again in {minutes}m.',
    transfer: 'Transferred {amount} {currency} to {user}.',
    transferSelf: 'You cannot transfer currency to yourself.',
    recipientNotMember: 'The recipient must be a member of this server.',
    insufficientFunds: 'You do not have enough wallet funds.',
    invalidAmount: 'Enter an amount greater than zero.',
    profileError: 'Could not load your economy profile.',
  },
  music: {
    queued: 'Queued: {title}',
  },
};
