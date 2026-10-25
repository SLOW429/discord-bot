import dotenv from 'dotenv';
dotenv.config();

import fs from 'node:fs';
import path from 'node:path';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  Partials,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
} from 'discord.js';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const OWNER_ID = process.env.OWNER_ID || '680035752461205524';
const PREFIX = process.env.PREFIX || '_';
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID || null;
const FEEDBACK_CHANNEL_ID = process.env.FEEDBACK_CHANNEL_ID || null;
const LOG_CHANNEL_NAME = process.env.LOG_CHANNEL_NAME || 'logs';
const TICKETS_CATEGORY_ID = process.env.TICKETS_CATEGORY_ID || null;
const AUTO_ROLE_ID = process.env.AUTO_ROLE_ID || null;
const ADMIN_ROLE_IDS = process.env.ADMIN_ROLE_IDS ? process.env.ADMIN_ROLE_IDS.split(',').map(value => value.trim()).filter(Boolean) : [];
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || null;
const SERVER_NAME = process.env.SERVER_NAME || 'SLOW SYSTEM';
const SERVER_IMAGE_URL = process.env.SERVER_IMAGE_URL || '';
const COPYRIGHT_TEXT = `© جميع الحقوق محفوظة لـ ${SERVER_NAME}`;

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const xpFile = path.join(dataDir, 'xp.json');
const warnsFile = path.join(dataDir, 'warns.json');
const reactionRolesFile = path.join(dataDir, 'reactionRoles.json');
const ticketsArchiveDir = path.join(dataDir, 'tickets');
if (!fs.existsSync(ticketsArchiveDir)) fs.mkdirSync(ticketsArchiveDir, { recursive: true });

const xpData = loadJSON(xpFile, {});
const warns = loadJSON(warnsFile, {});
const reactionRoles = loadJSON(reactionRolesFile, {});

const spamMap = new Map();
const infractionMap = new Map();
const ownerMentionTracker = new Map();

const SPAM_MESSAGE_LIMIT = 5;
const SPAM_TIME_WINDOW = 5000;
const SPAM_ACTION_THRESHOLD = 2;
const OWNER_MAX_MENTIONS = 3;
const OWNER_TIMEOUT_MS = 10 * 60 * 1000;

const INVITE_REGEX = /(https?:)?\/\/(discord\.gg|discordapp\.com\/invite|discord\.com\/invite)\/\S+/i;
const BAD_WORDS = ['badword1', 'badword2', 'انجليزي_سيء'];
const BAD_WORDS_REGEX = new RegExp(BAD_WORDS.join('|'), 'i');

function loadJSON(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const content = fs.readFileSync(filePath, 'utf8');
    return content ? JSON.parse(content) : fallback;
  } catch (error) {
    console.error(`Failed to read ${filePath}:`, error);
    return fallback;
  }
}

function saveJSON(filePath, value) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
  } catch (error) {
    console.error(`Failed to write ${filePath}:`, error);
  }
}

function getLogChannel(guild) {
  return guild.channels.cache.find(channel => channel.name === LOG_CHANNEL_NAME && channel.isTextBased()) || null;
}

function hasAdminRole(member) {
  if (!member) return false;
  if (member.id === OWNER_ID) return true;
  return member.roles?.cache?.some(role => ADMIN_ROLE_IDS.includes(role.id)) ?? false;
}

function sendPermissionError(message) {
  return message.reply({ content: '❌ ليس لديك صلاحيات لاستخدام هذا الأمر' });
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on(Events.GuildMemberAdd, async member => {
  try {
    if (WELCOME_CHANNEL_ID) {
      const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
      if (channel?.isTextBased()) {
        const embed = new EmbedBuilder()
          .setColor('#00eaff')
          .setTitle(`🎉 مرحبًا بك في ${member.guild.name}, ${member.user.username}!`)
          .setDescription(`👋 أهلاً وسهلاً بك في عائلتنا الكبيرة ${member.user}!\n📅 تاريخ الانضمام: ${new Date().toLocaleDateString('ar-EG')}`)
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
          .setImage(SERVER_IMAGE_URL || null)
          .setFooter({ text: COPYRIGHT_TEXT })
          .setTimestamp();
        await channel.send({ embeds: [embed] }).catch(() => {});
      }
    }

    if (AUTO_ROLE_ID) {
      const role = member.guild.roles.cache.get(AUTO_ROLE_ID);
      if (role) await member.roles.add(role).catch(() => {});
    }
  } catch (error) {
    console.error('GuildMemberAdd failed:', error);
  }
});

client.on(Events.GuildMemberRemove, async member => {
  try {
    const logChannel = getLogChannel(member.guild);
    if (!logChannel) return;
    const embed = new EmbedBuilder()
      .setTitle('👋 عضو خرج من السيرفر')
      .setDescription(`${member.user.tag} (${member.id})`)
      .setTimestamp();
    await logChannel.send({ embeds: [embed] }).catch(() => {});
  } catch (error) {
    console.error('GuildMemberRemove failed:', error);
  }
});

client.on(Events.RoleDelete, async role => {
  try {
    const logChannel = getLogChannel(role.guild);
    if (!logChannel) return;
    await logChannel.send({
      embeds: [new EmbedBuilder().setTitle('🚨 تم حذف رتبة').setDescription(`الرتبة: ${role.name} (${role.id})`).setTimestamp()],
    }).catch(() => {});
  } catch (error) {
    console.error('RoleDelete failed:', error);
  }
});

client.on(Events.ChannelDelete, async channel => {
  try {
    const logChannel = getLogChannel(channel.guild);
    if (!logChannel) return;
    await logChannel.send({
      embeds: [new EmbedBuilder().setTitle('🚨 تم حذف قناة').setDescription(`القناة: ${channel.name} (${channel.id})`).setTimestamp()],
    }).catch(() => {});
  } catch (error) {
    console.error('ChannelDelete failed:', error);
  }
});

client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;

  const guildId = message.guild.id;
  const userId = message.author.id;
  const isAdmin = hasAdminRole(message.member);

  if (INVITE_REGEX.test(message.content) && !isAdmin) {
    await message.delete().catch(() => {});
    await message.channel.send({ content: `🚫 <@${userId}> ممنوع نشر روابط دعوات!` }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000)).catch(() => {});
    return;
  }

  if (BAD_WORDS.length && BAD_WORDS_REGEX.test(message.content) && !isAdmin) {
    await message.delete().catch(() => {});
    warns[guildId] = warns[guildId] || {};
    warns[guildId][userId] = (warns[guildId][userId] || 0) + 1;
    saveJSON(warnsFile, warns);

    const warnCount = warns[guildId][userId];
    await message.channel.send({ content: `⚠️ <@${userId}> تم تحذيرك (${warnCount}) بسبب كلمات غير لائقة.` }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000)).catch(() => {});
    if (warnCount >= 3 && message.member?.moderatable) {
      await message.member.timeout(10 * 60 * 1000, 'تجاوز تحذيرات الكلمات').catch(() => {});
      await message.channel.send({ content: `⏱️ <@${userId}> تم تقييد الكتابة مؤقتًا بسبب تعدي التحذيرات.` }).catch(() => {});
    }
    return;
  }

  const mentionCount = (message.mentions.users.size + message.mentions.roles.size) + (message.mentions.everyone ? 1 : 0);
  if (mentionCount > 0 && !isAdmin && message.mentions.everyone) {
    await message.delete().catch(() => {});
    await message.channel.send({ content: '🚫 ممنوع منشن @everyone أو @here هنا.' }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000)).catch(() => {});
    return;
  }

  if (message.mentions.users.size > 0 && !isAdmin) {
    const key = `${guildId}:${userId}`;
    const now = Date.now();
    const recent = (spamMap.get(key) ?? []).filter(timestamp => now - timestamp < SPAM_TIME_WINDOW);
    recent.push(now);
    spamMap.set(key, recent);

    if (recent.length >= SPAM_MESSAGE_LIMIT) {
      const count = infractionMap.get(key) ?? 0;
      infractionMap.set(key, count + 1);
      recent.length = 0;
      spamMap.set(key, recent);

      if (count + 1 >= SPAM_ACTION_THRESHOLD && message.member?.moderatable) {
        await message.member.timeout(10 * 60 * 1000, 'Spam protection').catch(() => {});
      }
      await message.delete().catch(() => {});
    }
  }

  if (!xpData[guildId]) xpData[guildId] = {};
  if (!xpData[guildId][userId]) xpData[guildId][userId] = { xp: 0, level: 1, messages: 0 };
  xpData[guildId][userId].messages += 1;
  const addXP = Math.floor(Math.random() * 11) + 5;
  xpData[guildId][userId].xp += addXP;
  const nextLevelXP = xpData[guildId][userId].level * 100;
  if (xpData[guildId][userId].xp >= nextLevelXP) {
    xpData[guildId][userId].level += 1;
    const level = xpData[guildId][userId].level;
    await message.channel.send(`🎉 <@${userId}> وصلت المستوى **${level}**!`).catch(() => {});
    if (level === 5) {
      const role = message.guild.roles.cache.find(currentRole => currentRole.name === 'Level 5');
      if (role) await message.member.roles.add(role).catch(() => {});
    }
  }
  saveJSON(xpFile, xpData);

  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();
  if (!command) return;

  if (command === 'avatar') {
    const target = message.mentions.users.first() || message.author;
    const embed = new EmbedBuilder()
      .setTitle(`${target.tag} - Avatar`)
      .setImage(target.displayAvatarURL({ dynamic: true, size: 1024 }))
      .setTimestamp();
    return message.channel.send({ embeds: [embed] });
  }

  if (command === 'say') {
    const text = args.join(' ');
    if (!text) return message.reply('❌ اكتب نصًّا');
    await message.delete().catch(() => {});
    return message.channel.send(text);
  }

  if (command === 'serverinfo') {
    const guild = message.guild;
    const embed = new EmbedBuilder()
      .setTitle(`${guild.name} معلومات عن السيرفر`)
      .addFields(
        { name: 'الأعضاء', value: String(guild.memberCount), inline: true },
        { name: 'إنشئ في', value: new Date(guild.createdTimestamp).toLocaleDateString('ar-EG'), inline: true },
      )
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .setTimestamp();
    return message.channel.send({ embeds: [embed] });
  }

  if (!hasAdminRole(message.member)) return sendPermissionError(message);

  if (command === 'مسح' || command === 'clear') {
    const amount = Number.parseInt(args[0], 10);
    if (!amount || amount <= 0) return message.reply('❌ أدخل رقم صحيح');
    const messagesToDelete = await message.channel.messages.fetch({ limit: Math.min(amount + 1, 100) });
    await message.channel.bulkDelete(messagesToDelete, true).catch(() => {});
    return message.channel.send(`✅ تم مسح ${messagesToDelete.size - 1} رسالة`).then(msg => setTimeout(() => msg.delete().catch(() => {}), 3000)).catch(() => {});
  }

  if (['kick', 'طرد'].includes(command)) {
    const target = message.mentions.members.first();
    if (!target) return message.reply('❌ منشن العضو');
    await target.kick(args.join(' ') || 'تم الطرد');
    const logChannel = getLogChannel(message.guild);
    if (logChannel) {
      await logChannel.send({ embeds: [new EmbedBuilder().setTitle('⚠️ طرد عضو').setDescription(`${target.user.tag} (${target.id})`).setTimestamp()] }).catch(() => {});
    }
    return message.reply(`✅ تم طرد ${target.user.tag}`);
  }

  if (['ban', 'حظر'].includes(command)) {
    const target = message.mentions.members.first();
    if (!target) return message.reply('❌ منشن العضو');
    await target.ban({ reason: args.join(' ') || 'تم الحظر' }).catch(() => {});
    const logChannel = getLogChannel(message.guild);
    if (logChannel) {
      await logChannel.send({ embeds: [new EmbedBuilder().setTitle('⛔ حظر عضو').setDescription(`${target.user.tag} (${target.id})`).setTimestamp()] }).catch(() => {});
    }
    return message.reply(`✅ تم حظر ${target.user.tag}`);
  }

  if (command === 'mute') {
    const target = message.mentions.members.first();
    const duration = Number.parseInt(args[1], 10) || 10;
    if (!target) return message.reply('❌ منشن العضو');
    await target.timeout(duration * 60 * 1000, `Muted by ${message.author.tag}`).catch(() => {});
    return message.reply(`🔇 تم تقييد <@${target.id}> لمدة ${duration} دقيقة`);
  }

  if (command === 'unmute') {
    const target = message.mentions.members.first();
    if (!target) return message.reply('❌ منشن العضو');
    await target.timeout(null).catch(() => {});
    return message.reply(`🔊 تم رفع التقييد عن <@${target.id}>`);
  }

  if (['unban', 'فك_حظر'].includes(command)) {
    const userIdToUnban = args[0];
    if (!userIdToUnban) return message.reply('❌ أدخل ID العضو');
    await message.guild.members.unban(userIdToUnban).catch(() => {});
    return message.reply('✅ تم فك الحظر');
  }

  if (command === 'reactionrole') {
    const sub = args[0];
    if (sub === 'add') {
      const [messageId, emoji, roleId] = [args[1], args[2], args[3]];
      if (!messageId || !emoji || !roleId) return message.reply('❌ استخدام: .reactionrole add <messageId> <emoji> <roleId>');
      reactionRoles[messageId] = reactionRoles[messageId] || [];
      reactionRoles[messageId].push({ emoji, roleId });
      saveJSON(reactionRolesFile, reactionRoles);
      return message.reply('✅ تم إضافة Reaction Role');
    }
    if (sub === 'remove') {
      const messageId = args[1];
      if (!messageId) return message.reply('❌ اذكر messageId');
      delete reactionRoles[messageId];
      saveJSON(reactionRolesFile, reactionRoles);
      return message.reply('✅ تم الحذف');
    }
  }

  if (['ticket', 'تذكرة'].includes(command)) {
    const embed = new EmbedBuilder()
      .setColor('#00aaff')
      .setTitle(`🎫 نظام التذاكر | ${SERVER_NAME}`)
      .setDescription('⚠️ ممنوع منشن الإدارة داخل التذكرة\n✅ فقط الإدمن يمكنه غلق التذكرة')
      .setImage(SERVER_IMAGE_URL || null)
      .setFooter({ text: COPYRIGHT_TEXT });

    const menu = new StringSelectMenuBuilder()
      .setCustomId('ticket_select')
      .setPlaceholder('اختر نوع التذكرة')
      .addOptions([
        { label: 'شكوى', value: 'report', emoji: '🚨' },
        { label: 'اقتراح', value: 'suggest', emoji: '💡' },
        { label: 'استفسار', value: 'question', emoji: '❓' },
      ]);

    const row = new ActionRowBuilder().addComponents(menu);
    return message.reply({ embeds: [embed], components: [row] });
  }

  if (command === 'meme') {
    try {
      const response = await fetch('https://meme-api.com/gimme');
      const data = await response.json();
      if (data?.url) {
        return message.channel.send({ content: data.postLink || '', embeds: [new EmbedBuilder().setImage(data.url).setTitle(data.title || 'Meme')] });
      }
      return message.reply('❌ لم أتمكن من جلب ميم الآن');
    } catch (error) {
      console.error('Meme command failed:', error);
      return message.reply('❌ خطأ في جلب الميم');
    }
  }

  if (command === 'rps') {
    const choice = args[0];
    if (!['rock', 'paper', 'scissors', 'حجر', 'ورق', 'مقص'].includes(choice)) {
      return message.reply('❌ اختر: rock/paper/scissors');
    }
    const options = ['rock', 'paper', 'scissors'];
    const botChoice = options[Math.floor(Math.random() * options.length)];
    return message.reply(`🤖 اختياري: ${botChoice} — أنت: ${choice}`);
  }

  if (command === 'poll') {
    const raw = message.content.slice(PREFIX.length + 4).trim();
    if (!raw) return message.reply('❌ اكتب السؤال والأجوبة مفصولة بـ |');
    const parts = raw.split('|').map(item => item.trim()).filter(Boolean);
    if (parts.length < 2) return message.reply('❌ اكتب سؤالًا من 2 إجابات على الأقل');
    const question = parts.shift();
    const options = parts.map((item, index) => `${index + 1}. ${item}`).join('\n');
    return message.channel.send({ embeds: [new EmbedBuilder().setTitle(`📊 ${question}`).setDescription(options).setTimestamp()] });
  }

  return message.reply('❌ الأمر غير موجود أو غير مسموح به');
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;
  try {
    if (reaction.message.partial) await reaction.message.fetch();
    const msgId = reaction.message.id;
    if (!reactionRoles[msgId]) return;
    const matches = reactionRoles[msgId];
    const match = matches.find(entry => entry.emoji === reaction.emoji.name || entry.emoji === reaction.emoji.toString());
    if (!match) return;
    const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
    const role = reaction.message.guild.roles.cache.get(match.roleId);
    if (member && role) await member.roles.add(role).catch(() => {});
  } catch (error) {
    console.error('MessageReactionAdd failed:', error);
  }
});

client.on(Events.MessageReactionRemove, async (reaction, user) => {
  if (user.bot) return;
  try {
    if (reaction.message.partial) await reaction.message.fetch();
    const msgId = reaction.message.id;
    if (!reactionRoles[msgId]) return;
    const matches = reactionRoles[msgId];
    const match = matches.find(entry => entry.emoji === reaction.emoji.name || entry.emoji === reaction.emoji.toString());
    if (!match) return;
    const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
    const role = reaction.message.guild.roles.cache.get(match.roleId);
    if (member && role) await member.roles.remove(role).catch(() => {});
  } catch (error) {
    console.error('MessageReactionRemove failed:', error);
  }
});

client.on(Events.MessageCreate, async msg => {
  if (!msg.guild || msg.author.bot) return;
  if (!msg.channel.name?.startsWith('ticket-')) return;
  if (!msg.mentions.users.has(OWNER_ID)) return;
  await msg.delete().catch(() => {});
  const key = `${msg.channel.id}:${msg.author.id}`;
  const entry = ownerMentionTracker.get(key) || { count: 0, timeoutId: null };
  entry.count += 1;
  if (entry.timeoutId) clearTimeout(entry.timeoutId);
  entry.timeoutId = setTimeout(() => ownerMentionTracker.delete(key), OWNER_TIMEOUT_MS);
  ownerMentionTracker.set(key, entry);
  await msg.channel.send({ content: `⛔ <@${msg.author.id}> ممنوع منشن الاونر هنا (${entry.count}/${OWNER_MAX_MENTIONS})` }).catch(() => {});
  if (entry.count >= OWNER_MAX_MENTIONS) {
    const member = await msg.guild.members.fetch(msg.author.id).catch(() => null);
    if (member?.moderatable) await member.timeout(OWNER_TIMEOUT_MS, 'منشن الاونر المتكرر').catch(() => {});
    ownerMentionTracker.delete(key);
  }
});

client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild || message.content !== '.help') return;
  const generalEmbed = new EmbedBuilder()
    .setColor('#00A8E8')
    .setTitle('💬 الأوامر العامة')
    .setDescription('قائمة الأوامر العامة المتاحة:')
    .addFields(
      { name: '🧠 ذكاء صناعي', value: '`.ai [سؤالك]` — اسأل الذكاء الصناعي.', inline: false },
      { name: '💬 الحالة', value: '`.ping` — لقياس سرعة استجابة البوت.', inline: false },
      { name: '🎟️ تذاكر الدعم', value: '`.ticket` — إنشاء تذكرة دعم.', inline: false },
      { name: '🎶 موسيقى', value: '`.play [اسم الأغنية أو الرابط]` — تشغيل موسيقى.', inline: false },
    )
    .setFooter({ text: 'SLOW SYSTEM BOT © 2025', iconURL: client.user.displayAvatarURL() });

  const adminEmbed = new EmbedBuilder()
    .setColor('#FF5555')
    .setTitle('🛡️ الأوامر الإدارية')
    .setDescription('قائمة الأوامر الخاصة بالإدارة:')
    .addFields(
      { name: '🧹 مسح الرسائل', value: '`.مسح [عدد]` — حذف عدد معين من الرسائل.', inline: false },
      { name: '⚠️ الحظر والطرد', value: '`.ban [@user]`, `.kick [@user]`', inline: false },
      { name: '🔇 كتم', value: '`.mute [@user]` — كتم المستخدم.', inline: false },
      { name: '🛡️ الحماية التلقائية', value: '- منع روابط دعوات Discord.\n- منع السبام.\n- منع الكلمات المسيئة.\n- منع منشن everyone أو الإدارة.', inline: false },
    )
    .setFooter({ text: 'SLOW SYSTEM BOT © 2025', iconURL: client.user.displayAvatarURL() });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('general_help').setLabel('💬 الأوامر العامة').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('admin_help').setLabel('🛡️ الأوامر الإدارية').setStyle(ButtonStyle.Danger),
  );

  const sent = await message.reply({ embeds: [generalEmbed], components: [row] });
  const collector = sent.createMessageComponentCollector({ time: 5 * 60 * 1000 });
  collector.on('collect', async interaction => {
    if (interaction.customId === 'general_help') {
      await interaction.update({ embeds: [generalEmbed] });
    } else if (interaction.customId === 'admin_help') {
      await interaction.update({ embeds: [adminEmbed] });
    }
  });
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
      if (!interaction.guild) return interaction.reply({ content: '❌ لا يمكن إنشاء التذكرة خارج السيرفر.', ephemeral: true });
      const member = interaction.member;
      const ticketType = interaction.values[0];
      const ticketName = `ticket-${member.id}-${Date.now()}`;
      const permissionOverwrites = [
        { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      ];
      ADMIN_ROLE_IDS.forEach(roleId => {
        permissionOverwrites.push({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
      });

      const ticketChannel = await interaction.guild.channels.create({
        name: ticketName,
        type: ChannelType.GuildText,
        parent: TICKETS_CATEGORY_ID || null,
        permissionOverwrites,
      });

      const embed = new EmbedBuilder()
        .setColor('#00aaff')
        .setTitle('🎫 تذكرتك')
        .setDescription(`👤 صاحب التذكرة: ${member}\n🔖 نوع: ${ticketType}`);
      const closeButton = new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 إغلاق التذكرة').setStyle(ButtonStyle.Danger);
      const row = new ActionRowBuilder().addComponents(closeButton);
      await ticketChannel.send({ embeds: [embed], components: [row] });
      return interaction.reply({ content: `✅ تم إنشاء التذكرة: ${ticketChannel}`, ephemeral: true });
    }

    if (interaction.isButton() && interaction.customId === 'close_ticket') {
      if (!interaction.member.roles.cache.some(role => ADMIN_ROLE_IDS.includes(role.id))) {
        return interaction.reply({ content: '❌ فقط الإدمن يمكنه إغلاق التذكرة', ephemeral: true });
      }
      const channel = interaction.channel;
      const messages = await channel.messages.fetch({ limit: 100 });
      const sorted = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
      let logContent = `📁 سجل التذكرة: ${channel.name}\n------------------------------------\n`;
      sorted.forEach(message => {
        logContent += `[${new Date(message.createdTimestamp).toLocaleString()}] ${message.author.tag}: ${message.content}\n`;
      });
      const filePath = path.join(ticketsArchiveDir, `${channel.name}.txt`);
      fs.writeFileSync(filePath, logContent, 'utf8');

      const userId = channel.name.split('ticket-')[1]?.split('-')[0];
      const user = userId ? await client.users.fetch(userId).catch(() => null) : null;
      if (user) {
        await user.send({ content: `📄 نسخة من محادثة التذكرة:\n${channel.name}` }).catch(() => {});
      }

      const ratingRow = new ActionRowBuilder().addComponents(...[1, 2, 3, 4, 5].map(value => new ButtonBuilder().setCustomId(`rate_${value}`).setLabel('⭐'.repeat(value)).setStyle(value === 5 ? ButtonStyle.Success : ButtonStyle.Secondary)));
      if (user) {
        await user.send({ content: 'من فضلك قيّم تجربة الدعم 1-5 ⭐', components: [ratingRow] }).catch(() => {});
      }

      setTimeout(() => channel.delete().catch(() => {}), 1000);
      return interaction.reply({ content: '✅ تم إغلاق التذكرة وإرسال النسخة للمستخدم', ephemeral: true });
    }

    if (interaction.isButton() && interaction.customId.startsWith('rate_')) {
      const rating = Number.parseInt(interaction.customId.split('_')[1], 10);
      await interaction.reply({ content: `✅ تم إرسال تقييمك (${'⭐'.repeat(rating)})، شكرًا لك!`, ephemeral: true });
      if (FEEDBACK_CHANNEL_ID) {
        const feedbackChannel = await client.channels.fetch(FEEDBACK_CHANNEL_ID).catch(() => null);
        if (feedbackChannel) {
          await feedbackChannel.send({
            embeds: [new EmbedBuilder().setTitle('💬 تقييم جديد').setDescription(`User: ${interaction.user.tag}\nRating: ${'⭐'.repeat(rating)} (${rating}/5)`).setTimestamp()],
          }).catch(() => {});
        }
      }
    }
  } catch (error) {
    console.error('Interaction handling failed:', error);
  }
});

if (!DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN missing');
  process.exit(1);
}

client.login(DISCORD_TOKEN).catch(error => {
  console.error('Bot login failed:', error);
  process.exit(1);
});
