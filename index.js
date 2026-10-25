import dotenv from 'dotenv';
import pkg from 'discord.js';
import fs from 'fs';
import path from 'path';

dotenv.config();


const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
  Partials,
} = pkg;


// ---------- Config ----------
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const OWNER_ID = process.env.OWNER_ID || '680035752461205524';
const PREFIX = process.env.PREFIX || '_';
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID || null;
const FEEDBACK_CHANNEL_ID = process.env.FEEDBACK_CHANNEL_ID || null;
const LOG_CHANNEL_NAME = process.env.LOG_CHANNEL_NAME || 'logs';
const TICKETS_CATEGORY_ID = process.env.TICKETS_CATEGORY_ID || null;
const AUTO_ROLE_ID = process.env.AUTO_ROLE_ID || null; // role given on join
const ADMIN_ROLE_IDS = process.env.ADMIN_ROLE_IDS ? process.env.ADMIN_ROLE_IDS.split(',') : [];
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || null;
const SERVER_NAME = process.env.SERVER_NAME || 'SLOW SYSTEM';
const SERVER_IMAGE_URL = process.env.SERVER_IMAGE_URL || '';
const COPYRIGHT_TEXT = `© جميع الحقوق محفوظة لـ ${SERVER_NAME}`;

// ---------- Data files ----------
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
const xpFile = path.join(dataDir, 'xp.json');
const warnsFile = path.join(dataDir, 'warns.json');
const reactionRolesFile = path.join(dataDir, 'reactionRoles.json');
const ticketsArchiveDir = path.join(dataDir, 'tickets');
if (!fs.existsSync(ticketsArchiveDir)) fs.mkdirSync(ticketsArchiveDir);

let xpData = fs.existsSync(xpFile) ? JSON.parse(fs.readFileSync(xpFile, 'utf8')) : {};
let warns = fs.existsSync(warnsFile) ? JSON.parse(fs.readFileSync(warnsFile, 'utf8')) : {};
let reactionRoles = fs.existsSync(reactionRolesFile) ? JSON.parse(fs.readFileSync(reactionRolesFile, 'utf8')) : {};

// ---------- Helpers ----------
function saveJSON(file, obj) { fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8'); }
function getLogChannel(guild) { return guild.channels.cache.find(ch => ch.name === LOG_CHANNEL_NAME && ch.isTextBased()); }
function hasAdminRole(member) { return member?.roles?.cache?.some(r => ADMIN_ROLE_IDS.includes(r.id)) || member.id === OWNER_ID; }
function sendPermissionError(message) { return message.reply({ content: `❌ ليس لديك صلاحيات لاستخدام هذا الأمر` }); }

// ---------- Protection configs ----------
const spamMap = new Map(); // key: guildId:userId -> [{timestamp,...}]
const SPAM_MESSAGE_LIMIT = 5;
const SPAM_TIME_WINDOW = 5000; // 5 seconds
const SPAM_ACTION_THRESHOLD = 2; // after 2 infractions -> timeout
const infractionMap = new Map(); // counts infractions per user

const INVITE_REGEX = /(https?:)?\/\/(discord\.gg|discordapp\.com\/invite|discord\.com\/invite)\/\S+/i;
const BAD_WORDS = ['badword1','badword2','انجليزي_سيء']; // عدّل القائمة حسب احتياجك
const BAD_WORDS_REGEX = new RegExp(BAD_WORDS.join('|'), 'i');

// Mention protection
const OWNER_MAX_MENTIONS = 3;
const ownerMentionTracker = new Map();
const OWNER_TIMEOUT_MS = 10 * 60 * 1000;

// ---------- Client ----------
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

client.once("clientReady", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});


// ---------- Events: Guild Member Join / Leave ----------
client.on('guildMemberAdd', async member => {
  try {
    // Welcome embed
    if (WELCOME_CHANNEL_ID) {
      const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
      if (channel?.isTextBased()) {
        const embed = new EmbedBuilder()
          .setColor('#00eaff')
          .setTitle(`🎉 مرحبًا بك في ${member.guild.name}, ${member.user.username}!`)
          .setDescription(`👋 أهلاً وسهلاً بك في عائلتنا الكبيرة ${member.user}!
📅 تاريخ الانضمام: ${new Date().toLocaleDateString('ar-EG')}`)
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
          .setImage(SERVER_IMAGE_URL || undefined)
          .setFooter({ text: COPYRIGHT_TEXT })
          .setTimestamp();
        channel.send({ embeds: [embed] }).catch(()=>{});
      }
    }

    // Auto role
    if (AUTO_ROLE_ID) {
      const role = member.guild.roles.cache.get(AUTO_ROLE_ID);
      if (role) member.roles.add(role).catch(()=>{});
    }

  } catch (err){ console.error(err); }
});

client.on('guildMemberRemove', async member => {
  try {
    const logChannel = getLogChannel(member.guild);
    if (!logChannel) return;
    const embed = new EmbedBuilder()
      .setTitle('👋 عضو خرج من السيرفر')
      .setDescription(`${member.user.tag} (${member.id})`)
      .setTimestamp();
    logChannel.send({ embeds: [embed] }).catch(()=>{});
  } catch (err){ console.error(err); }
});

// ---------- Role/Channel protection ----------
client.on('roleDelete', async role => {
  try {
    const guild = role.guild;
    const logChannel = getLogChannel(guild);
    if (logChannel) {
      logChannel.send({ embeds: [new EmbedBuilder().setTitle('🚨 تم حذف رتبة').setDescription(`الرتبة: ${role.name} (${role.id})`).setTimestamp()] }).catch(()=>{});
    }
  } catch (err) { console.error(err); }
});

client.on('channelDelete', async channel => {
  try {
    const guild = channel.guild;
    const logChannel = getLogChannel(guild);
    if (logChannel) {
      logChannel.send({ embeds: [new EmbedBuilder().setTitle('🚨 تم حذف قناة').setDescription(`القناة: ${channel.name} (${channel.id})`).setTimestamp()] }).catch(()=>{});
    }
  } catch (err) { console.error(err); }
});

// ---------- Message Create (Protection, XP, Commands) ----------
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  const guildId = message.guild.id;
  const userId = message.author.id;

  // ---------- Anti Invite Links ----------
  if (INVITE_REGEX.test(message.content) && !hasAdminRole(message.member)) {
    await message.delete().catch(()=>{});
    await message.channel.send({ content: `🚫 <@${userId}> ممنوع نشر روابط دعوات!` }).then(m=>setTimeout(()=>m.delete().catch(()=>{}),5000)).catch(()=>{});
    return;
  }

  // ---------- Anti Bad Words ----------
  if (BAD_WORDS.length && BAD_WORDS_REGEX.test(message.content) && !hasAdminRole(message.member)) {
    await message.delete().catch(()=>{});
    warns[guildId] = warns[guildId] || {};
    warns[guildId][userId] = (warns[guildId][userId] || 0) + 1;
    saveJSON(warnsFile, warns);
    const warnCount = warns[guildId][userId];
    await message.channel.send({ content: `⚠️ <@${userId}> تم تحذيرك (${warnCount}) بسبب كلمات غير لائقة.` }).then(m=>setTimeout(()=>m.delete().catch(()=>{}),5000)).catch(()=>{});
    if (warnCount >= 3 && message.member.moderatable) {
      await message.member.timeout(10*60*1000, 'تجاوز تحذيرات الكلمات').catch(()=>{});
      await message.channel.send({ content: `⏱️ <@${userId}> تم تقييد الكتابة مؤقتًا بسبب تعدي التحذيرات.` }).catch(()=>{});
    }
    return;
  }

  // ---------- Anti Mention Admin Roles / everyone / here ----------
  if (message.mentions.everyone && !hasAdminRole(message.member)) {
    await message.delete().catch(()=>{});
    await message.channel.send({ content: `🚫 ممنوع منشن @everyone أو @here هنا.` }).then(m=>setTimeout(()=>m.delete().catch(()=>{}),5000)).catch(()=>{});
    return;
  }
  if (message.mentions.roles.size > 0) {
    const mentionedAdmins = message.mentions.roles.filter(r => ADMIN_ROLE_IDS.includes(r.id));
    if (mentionedAdmins.size > 0 && !message.member.roles.cache.some(r => ADMIN_ROLE_IDS.includes(r.id))) {
      await message.delete().catch(()=>{});
      await message.channel.send({ content: `🚫 <@${userId}> ممنوع منشن الإدارة!` }).then(m=>setTimeout(()=>m.delete().catch(()=>{}),5000)).catch(()=>{});
      // increase infraction and possibly timeout
      return;
    }
  }

  // ---------- Anti Spam (simple rate limit) ----------
  try {
    const key = `${guildId}:${userId}`;
    const now = Date.now();
    if (!spamMap.has(key)) spamMap.set(key, []);
    const arr = spamMap.get(key);
    arr.push(now);
    // keep only recent
    while (arr.length && now - arr[0] > SPAM_TIME_WINDOW) arr.shift();
    if (arr.length >= SPAM_MESSAGE_LIMIT && !hasAdminRole(message.member)) {
      // infraction
      const curr = (infractionMap.get(key) || 0) + 1;
      infractionMap.set(key, curr);
      await message.channel.send({ content: `⚠️ <@${userId}> من فضلك لا تكرر الرسائل.` }).catch(()=>{});
      if (curr >= SPAM_ACTION_THRESHOLD && message.member.moderatable) {
        await message.member.timeout(5*60*1000, 'Spam').catch(()=>{});
        infractionMap.set(key, 0);
        await message.channel.send({ content: `⏱️ <@${userId}> تم توقيفك مؤقتًا بسبب سبام.` }).catch(()=>{});
      }
    }
  } catch (err) { console.error(err); }

  // ---------- XP System ----------
  if (!xpData[guildId]) xpData[guildId] = {};
  if (!xpData[guildId][userId]) xpData[guildId][userId] = { xp: 0, level: 1, messages: 0 };
  xpData[guildId][userId].messages++;
  const addXP = Math.floor(Math.random() * 11) + 5; // 5-15
  xpData[guildId][userId].xp += addXP;
  const nextLevelXP = xpData[guildId][userId].level * 100;
  if (xpData[guildId][userId].xp >= nextLevelXP) {
    xpData[guildId][userId].level++;
    const lvl = xpData[guildId][userId].level;
    message.channel.send(`🎉 <@${userId}> وصلت المستوى **${lvl}**!`).catch(()=>{});
    // optional: give role on certain levels
    // example: give role on level 5
    if (lvl === 5) {
      // give a role if exists named Level 5
      const role = message.guild.roles.cache.find(r => r.name === 'Level 5');
      if (role) message.member.roles.add(role).catch(()=>{});
    }
  }
  saveJSON(xpFile, xpData);

  // ---------- Command handling ----------
  if (!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // Some commands allowed to everyone
  if (command === 'avatar') {
    const target = message.mentions.users.first() || message.author;
    const embed = new EmbedBuilder().setTitle(`${target.tag} - Avatar`).setImage(target.displayAvatarURL({ dynamic: true, size: 1024 })).setTimestamp();
    return message.channel.send({ embeds: [embed] });
  }
  if (command === 'say') {
    const text = args.join(' ');
    if (!text) return message.reply('❌ اكتب نصًّا');
    await message.delete().catch(()=>{});
    return message.channel.send(text);
  }
  if (command === 'serverinfo') {
    const guild = message.guild;
    const embed = new EmbedBuilder()
      .setTitle(`${guild.name} معلومات عن السيرفر`)
      .addFields(
        { name: 'الأعضاء', value: String(guild.memberCount), inline: true },
        { name: 'إنشئ في', value: new Date(guild.createdTimestamp).toLocaleDateString(), inline: true },
      ).setThumbnail(guild.iconURL({ dynamic: true })).setTimestamp();
    return message.channel.send({ embeds: [embed] });
  }

  // Admin-only commands
  if (!hasAdminRole(message.member)) return sendPermissionError(message);

  // مسح
  if (command === 'مسح' || command === 'clear') {
    const amount = parseInt(args[0]);
    if (!amount || amount <= 0) return message.reply('❌ أدخل رقم صحيح');
    const msgs = await message.channel.messages.fetch({ limit: Math.min(amount + 1, 100) });
    await message.channel.bulkDelete(msgs, true).catch(()=>{});
    return message.channel.send(`✅ تم مسح ${msgs.size - 1} رسالة`).then(msg => setTimeout(() => msg.delete().catch(()=>{}), 3000)).catch(()=>{});
  }

  // kick
  if (['kick','طرد'].includes(command)) {
    const target = message.mentions.members.first();
    if (!target) return message.reply('❌ منشن العضو');
    await target.kick(args.join(' ') || 'تم الطرد');
    const logChannel = getLogChannel(message.guild);
    if (logChannel) logChannel.send({ embeds: [new EmbedBuilder().setTitle('⚠️ طرد عضو').setDescription(`${target.user.tag} (${target.id})`).setTimestamp()] }).catch(()=>{});
    return message.reply(`✅ تم طرد ${target.user.tag}`);
  }

  // ban
  if (['ban','حظر'].includes(command)) {
    const target = message.mentions.members.first();
    if (!target) return message.reply('❌ منشن العضو');
    await target.ban({ reason: args.join(' ') || 'تم الحظر' }).catch(()=>{});
    const logChannel = getLogChannel(message.guild);
    if (logChannel) logChannel.send({ embeds: [new EmbedBuilder().setTitle('⛔ حظر عضو').setDescription(`${target.user.tag} (${target.id})`).setTimestamp()] }).catch(()=>{});
    return message.reply(`✅ تم حظر ${target.user.tag}`);
  }

  // mute / unmute (using timeout)
  if (command === 'mute') {
    const target = message.mentions.members.first();
    const duration = parseInt(args[1]) || 10; // minutes
    if (!target) return message.reply('❌ منشن العضو');
    await target.timeout(duration * 60 * 1000, `Muted by ${message.author.tag}`).catch(()=>{});
    return message.reply(`🔇 تم تقييد <@${target.id}> لمدة ${duration} دقيقة`);
  }
  if (command === 'unmute') {
    const target = message.mentions.members.first();
    if (!target) return message.reply('❌ منشن العضو');
    await target.timeout(null).catch(()=>{});
    return message.reply(`🔊 تم رفع التقييد عن <@${target.id}>`);
  }

  // unban
  if (['unban','فك_حظر'].includes(command)) {
    const userIdToUnban = args[0];
    if (!userIdToUnban) return message.reply('❌ أدخل ID العضو');
    await message.guild.members.unban(userIdToUnban).catch(()=>{});
    return message.reply('✅ تم فك الحظر');
  }

  // reaction role setup (admin)
  if (command === 'reactionrole') {
    // Usage: .reactionrole add <messageId> <emoji> <roleId>
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

  // ticket creation command (admin or everyone) -> show menu
  if (['ticket','تذكرة'].includes(command)) {
    const embed = new EmbedBuilder()
      .setColor('#00aaff')
      .setTitle(`🎫 نظام التذاكر | ${SERVER_NAME}`)
      .setDescription(`⚠️ ممنوع منشن الإدارة داخل التذكرة\n✅ فقط الإدمن يمكنه غلق التذكرة`)
      .setImage(SERVER_IMAGE_URL || undefined)
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

  // meme command (uses public api)
  if (command === 'meme') {
    try {
      const res = await fetch('https://meme-api.com/gimme').then(r => r.json());
      if (res && res.url) return message.channel.send({ content: res.postLink, embeds: [new EmbedBuilder().setImage(res.url).setTitle(res.title || 'Meme')] });
      return message.reply('❌ لم أتمكن من جلب ميم الآن');
    } catch (err) { return message.reply('❌ خطأ في جلب الميم'); }
  }

  // rps (rock paper scissors)
  if (command === 'rps') {
    const choice = args[0];
    if (!['rock','paper','scissors','حجر','ورق','مقص'].includes(choice)) return message.reply('❌ اختر: rock/paper/scissors');
    const opts = ['rock','paper','scissors'];
    const bot = opts[Math.floor(Math.random()*3)];
    return message.reply(`🤖 اختياري: ${bot} — أنت: ${choice}`);
  }

  // poll
  if (command === 'poll') {
    const raw = message.content.slice(PREFIX.length + 4).trim();
    if (!raw) return message.reply('❌ اكتب السؤال والأجوبة مفصولة بـ |');
    const parts = raw.split('|').map(s => s.trim()).filter(Boolean);
    const question = parts.shift();
    const embed = new EmbedBuilder().setTitle('📊 ' + question).setDescription(parts.map((p,i)=>`${i+1}. ${p}`).join('\n'));
    const msg = await message.channel.send({ embeds: [embed] });
    for (let i=0;i<parts.length && i<10;i++) await msg.react(`${i+1}️⃣`).catch(()=>{});
    return;
  }

  // server stats
  if (command === 'stats' || command === 'serverstats') {
    const guild = message.guild;
    const bots = guild.members.cache.filter(m=>m.user.bot).size;
    const embed = new EmbedBuilder().setTitle('📈 إحصائيات السيرفر').addFields(
      { name: 'الأعضاء', value: String(guild.memberCount), inline: true },
      { name: 'البوتات', value: String(bots), inline: true },
    ).setTimestamp();
    return message.channel.send({ embeds: [embed] });
  }

});

// ---------- Interactions: Tickets, Buttons, Selects ----------
client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const ticketName = `ticket-${member.id}`;
      if (interaction.guild.channels.cache.some(c => c.name === ticketName)) {
        return interaction.reply({ content: '⚠️ لديك تذكرة مفتوحة بالفعل', ephemeral: true });
      }
      const permissionOverwrites = [
        { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      ];
      ADMIN_ROLE_IDS.forEach(rid => permissionOverwrites.push({ id: rid, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }));
      const ticketChannel = await interaction.guild.channels.create({
        name: ticketName,
        type: ChannelType.GuildText,
        parent: TICKETS_CATEGORY_ID || null,
        permissionOverwrites,
      });
      const embed = new EmbedBuilder().setColor('#00aaff').setTitle(`🎫 تذكرتك`).setDescription(`👤 صاحب التذكرة: ${member}\n🔖 نوع: ${interaction.values[0]}`);
      const closeButton = new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 إغلاق التذكرة').setStyle(ButtonStyle.Danger);
      const row = new ActionRowBuilder().addComponents(closeButton);
      await ticketChannel.send({ embeds: [embed], components: [row] });
      return interaction.reply({ content: `✅ تم إنشاء التذكرة: ${ticketChannel}`, ephemeral: true });
    }

    if (interaction.isButton() && interaction.customId === 'close_ticket') {
      if (!interaction.member.roles.cache.some(r => ADMIN_ROLE_IDS.includes(r.id))) return interaction.reply({ content: '❌ فقط الإدمن يمكنه إغلاق التذكرة', ephemeral: true });
      const channel = interaction.channel;
      const messages = await channel.messages.fetch({ limit: 100 });
      const sorted = Array.from(messages.values()).sort((a,b)=>a.createdTimestamp - b.createdTimestamp);
      let logContent = `📁 سجل التذكرة: ${channel.name}\n------------------------------------\n`;
      sorted.forEach(m => logContent += `[${new Date(m.createdTimestamp).toLocaleString()}] ${m.author.tag}: ${m.content}\n`);
      const filePath = path.join(ticketsArchiveDir, `${channel.name}.txt`);
      fs.writeFileSync(filePath, logContent, 'utf8');

      const userId = channel.name.split('ticket-')[1];
      const user = await client.users.fetch(userId).catch(()=>null);
      if (user) {
        await user.send({ content: `📄 نسخة من محادثة التذكرة:
${channel.name}` }).catch(()=>{});
      }

      const ratingRow = new ActionRowBuilder().addComponents(...[1,2,3,4,5].map(n=>new ButtonBuilder().setCustomId(`rate_${n}`).setLabel('⭐'.repeat(n)).setStyle(n===5?ButtonStyle.Success:ButtonStyle.Secondary)));
      if (user) await user.send({ content: `من فضلك قيّم تجربة الدعم 1-5 ⭐`, components: [ratingRow] }).catch(()=>{});

      setTimeout(()=>{ channel.delete().catch(()=>{}); }, 1000);
      return interaction.reply({ content: '✅ تم إغلاق التذكرة وإرسال النسخة للمستخدم', ephemeral: true });
    }

    if (interaction.isButton() && interaction.customId.startsWith('rate_')) {
      const rating = parseInt(interaction.customId.split('_')[1]);
      await interaction.reply({ content: `✅ تم إرسال تقييمك (${'⭐'.repeat(rating)})، شكرًا لك!`, ephemeral: true });
      if (FEEDBACK_CHANNEL_ID) {
        const feedbackChannel = await client.channels.fetch(FEEDBACK_CHANNEL_ID).catch(()=>null);
        if (feedbackChannel) feedbackChannel.send({ embeds: [new EmbedBuilder().setTitle('💬 تقييم جديد').setDescription(`User: ${interaction.user.tag}\nRating: ${'⭐'.repeat(rating)} (${rating}/5)`).setTimestamp()] }).catch(()=>{});
      }
    }

  } catch (err) { console.error(err); }
});

// ---------- Reaction role handling ----------
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  try {
    if (reaction.message.partial) await reaction.message.fetch();
    const msgId = reaction.message.id;
    if (!reactionRoles[msgId]) return;
    const confs = reactionRoles[msgId];
    const found = confs.find(c => c.emoji === reaction.emoji.name || c.emoji === reaction.emoji.toString());
    if (!found) return;
    const member = await reaction.message.guild.members.fetch(user.id);
    const role = reaction.message.guild.roles.cache.get(found.roleId);
    if (role) member.roles.add(role).catch(()=>{});
  } catch (err) { console.error(err); }
});
client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot) return;
  try {
    if (reaction.message.partial) await reaction.message.fetch();
    const msgId = reaction.message.id;
    if (!reactionRoles[msgId]) return;
    const confs = reactionRoles[msgId];
    const found = confs.find(c => c.emoji === reaction.emoji.name || c.emoji === reaction.emoji.toString());
    if (!found) return;
    const member = await reaction.message.guild.members.fetch(user.id);
    const role = reaction.message.guild.roles.cache.get(found.roleId);
    if (role) member.roles.remove(role).catch(()=>{});
  } catch (err) { console.error(err); }
});

// ---------- Owner mention monitor inside ticket channels ----------
client.on('messageCreate', async msg => {
  if (!msg.guild || msg.author.bot) return;
  if (!msg.channel.name?.startsWith('ticket-')) return;
  if (!msg.mentions.users.has(OWNER_ID)) return;
  await msg.delete().catch(()=>{});
  const key = `${msg.channel.id}:${msg.author.id}`;
  const entry = ownerMentionTracker.get(key) || { count: 0, timeoutId: null };
  entry.count++;
  if (entry.timeoutId) clearTimeout(entry.timeoutId);
  entry.timeoutId = setTimeout(()=>ownerMentionTracker.delete(key), OWNER_TIMEOUT_MS);
  ownerMentionTracker.set(key, entry);
  await msg.channel.send({ content: `⛔ <@${msg.author.id}> ممنوع منشن الاونر هنا (${entry.count}/${OWNER_MAX_MENTIONS})` }).catch(()=>{});
  if (entry.count >= OWNER_MAX_MENTIONS) {
    const member = await msg.guild.members.fetch(msg.author.id).catch(()=>null);
    if (member && member.moderatable) await member.timeout(OWNER_TIMEOUT_MS, 'منشن الاونر المتكرر').catch(()=>{});
    ownerMentionTracker.delete(key);
  }
});
// ---------- Help Command with Buttons ----------

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  if (message.content === ".help") {
    // ====== الأساسيات ======
    const generalEmbed = new EmbedBuilder()
      .setColor("#00A8E8")
      .setTitle("💬 الأوامر العامة")
      .setDescription("قائمة الأوامر العامة المتاحة:")
      .addFields(
        { name: "🧠 ذكاء صناعي", value: "`.ai [سؤالك]` — اسأل الذكاء الصناعي.", inline: false },
        { name: "💬 الحالة", value: "`.ping` — لقياس سرعة استجابة البوت.", inline: false },
        { name: "🎟️ تذاكر الدعم", value: "`.ticket` — إنشاء تذكرة دعم.", inline: false },
        { name: "🎶 موسيقى", value: "`.play [اسم الأغنية أو الرابط]` — تشغيل موسيقى.", inline: false },
      )
      .setFooter({ text: "SLOW SYSTEM BOT © 2025", iconURL: client.user.displayAvatarURL() });

    const adminEmbed = new EmbedBuilder()
      .setColor("#FF5555")
      .setTitle("🛡️ الأوامر الإدارية")
      .setDescription("قائمة الأوامر الخاصة بالإدارة:")
      .addFields(
        { name: "🧹 مسح الرسائل", value: "`.مسح [عدد]` — حذف عدد معين من الرسائل.", inline: false },
        { name: "⚠️ الحظر والطرد", value: "`.ban [@user]`, `.kick [@user]`", inline: false },
        { name: "🔇 كتم", value: "`.mute [@user]` — كتم المستخدم.", inline: false },
        { name: "🛡️ الحماية التلقائية", value: "- منع روابط دعوات Discord.\n- منع السبام.\n- منع الكلمات المسيئة.\n- منع منشن everyone أو الإدارة.", inline: false }
      )
      .setFooter({ text: "SLOW SYSTEM BOT © 2025", iconURL: client.user.displayAvatarURL() });

    // ====== الأزرار ======
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("general_help")
        .setLabel("💬 الأوامر العامة")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("admin_help")
        .setLabel("🛡️ الأوامر الإدارية")
        .setStyle(ButtonStyle.Danger)
    );

    const sent = await message.reply({ embeds: [generalEmbed], components: [row] });

    // ====== التفاعل مع الأزرار ======
    const collector = sent.createMessageComponentCollector({ time: 5 * 60 * 1000 }); // 5 دقايق

    collector.on("collect", async (interaction) => {
      if (interaction.customId === "general_help") {
        await interaction.update({ embeds: [generalEmbed] });
      } else if (interaction.customId === "admin_help") {
        await interaction.update({ embeds: [adminEmbed] });
      }
    });
  }
});



// ---------- Login ----------
if (!DISCORD_TOKEN) { console.error('❌ DISCORD_TOKEN missing'); process.exit(1); }
client.login(DISCORD_TOKEN).catch(err => { console.error(err); process.exit(1); });
