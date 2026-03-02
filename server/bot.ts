import { Telegraf, Markup } from "telegraf";
import { storage, db } from "./storage";
import { sql } from "drizzle-orm";
import type { Context } from "telegraf";

const BOT_TOKEN = "8516006670:AAF8bry6k6RYVPFfguhRmpp0NNhH5HYYOV4";
const OWNER_ID = 1384026800;

let APPROVAL_GROUP_ID: number | null = null;
let PAYMENT_GROUP_ID: number | null = null;

export const bot = new Telegraf(BOT_TOKEN);

async function loadGroupIds() {
  try {
    const rows = await db.execute(sql`SELECT key, value FROM bot_settings WHERE key IN ('approval_group_id', 'payment_group_id')`);
    for (const row of rows.rows as any[]) {
      if (row.key === "approval_group_id") APPROVAL_GROUP_ID = parseInt(row.value);
      if (row.key === "payment_group_id") PAYMENT_GROUP_ID = parseInt(row.value);
    }
    console.log("Loaded group IDs - Approval:", APPROVAL_GROUP_ID, "Payment:", PAYMENT_GROUP_ID);
  } catch (e) {
    console.log("Could not load group IDs:", (e as any).message);
  }
}

async function saveGroupId(key: string, value: number) {
  try {
    await db.execute(sql`INSERT INTO bot_settings (key, value) VALUES (${key}, ${String(value)}) ON CONFLICT (key) DO UPDATE SET value = ${String(value)}`);
  } catch (e) {
    console.log("Could not save group ID:", (e as any).message);
  }
}

const TASK_LABELS: Record<string, string> = {
  like: "لايك (Like)",
  comment: "تعليق (Comment)",
  share_story: "توجيه ستوري مع تاك (Share to Story + Mention)",
  explore: "حركة الاكسبلور - توجيه للخاص (Direct Share)",
};

const CUSTOM_EMOJI_ACCEPT = "4956454790012863177";
const CUSTOM_EMOJI_CANCEL = "5287527086985069121";
const CUSTOM_EMOJI_APPROVED = "5985446383388204349";
const CUSTOM_EMOJI_WITHDRAW = "5443127283898405358";
const CUSTOM_EMOJI_ZAINCASH = "5280927938454244038";
const CUSTOM_EMOJI_ASIACELL = "5280813344431819469";
const CUSTOM_EMOJI_MASTERCARD = "5296433556371807395";

const memberState: Record<string, { action: string; data?: any }> = {};

const ownerState: { action: string | null; data?: any } = { action: null };

function styledButton(text: string, callbackData: string, style?: string, customEmojiId?: string) {
  const btn: any = { text, callback_data: callbackData };
  if (style) btn.style = style;
  if (customEmojiId) btn.icon_custom_emoji_id = customEmojiId;
  return btn;
}

function styledInlineKeyboard(rows: any[][]) {
  return { reply_markup: { inline_keyboard: rows } };
}

async function rawSendMessage(chatId: number | string, text: string, parseMode: string, replyMarkup: any) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const body: any = {
    chat_id: chatId,
    text: text,
    reply_markup: replyMarkup,
  };
  if (parseMode) body.parse_mode = parseMode;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) console.log("rawSendMessage error:", JSON.stringify(data));
    return data;
  } catch (e) {
    console.log("rawSendMessage fetch error:", (e as any).message);
  }
}

function acceptRejectKeyboard(acceptCb: string, rejectCb: string) {
  return {
    inline_keyboard: [
      [
        styledButton("موافق", acceptCb, "success", CUSTOM_EMOJI_ACCEPT),
        styledButton("إلغاء", rejectCb, "danger", CUSTOM_EMOJI_CANCEL),
      ]
    ]
  };
}

function acceptedKeyboard() {
  return {
    inline_keyboard: [
      [styledButton("تمت الموافقة", "noop_accepted", "primary", CUSTOM_EMOJI_APPROVED)]
    ]
  };
}

function cancelledKeyboard() {
  return {
    inline_keyboard: [
      [styledButton("تم الإلغاء", "noop_cancelled", "danger", CUSTOM_EMOJI_CANCEL)]
    ]
  };
}

async function rawSendPhoto(chatId: number | string, photo: string, caption: string, replyMarkup: any) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
  const body: any = {
    chat_id: chatId,
    photo: photo,
    caption: caption,
    reply_markup: replyMarkup,
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) console.log("rawSendPhoto error:", JSON.stringify(data));
    return data;
  } catch (e) {
    console.log("rawSendPhoto fetch error:", (e as any).message);
  }
}

async function rawEditMarkup(chatId: number | string, messageId: number, replyMarkup: any) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/editMessageReplyMarkup`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reply_markup: replyMarkup,
      }),
    });
  } catch (e) {
    console.log("rawEditMarkup error:", (e as any).message);
  }
}

async function editToAccepted(ctx: any) {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/editMessageReplyMarkup`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ctx.chat.id,
        message_id: ctx.callbackQuery.message.message_id,
        reply_markup: acceptedKeyboard(),
      }),
    });
  } catch (e) {
    console.log("Could not edit to accepted:", (e as any).message);
  }
}

async function editToCancelled(ctx: any) {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/editMessageReplyMarkup`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ctx.chat.id,
        message_id: ctx.callbackQuery.message.message_id,
        reply_markup: cancelledKeyboard(),
      }),
    });
  } catch (e) {
    console.log("Could not edit to cancelled:", (e as any).message);
  }
}

async function sendTermsMessage1(ctx: Context) {
  await rawSendMessage(
    ctx.chat!.id,
    `📋 *الشروط الأساسية للحسابات:*\n\n` +
    `1️⃣ *عدد المتابعين:* لازم حسابك الشخصي بي أكثر من *5000 متابع*.\n` +
    `2️⃣ *نوع الحساب:* حساب حقيقي، شخصي، ونشط (مو حساب وهمي أو جديد).\n` +
    `3️⃣ *المتابعين:* حصراً لازم يكون أغلب متابعينك *عراقيين*.`,
    "Markdown",
    acceptRejectKeyboard("terms1_accept", "terms1_reject"),
  );
}

async function sendTermsMessage2(ctx: Context) {
  await rawSendMessage(
    ctx.chat!.id,
    `📌 *خطة العمل:*\n\n` +
    `بمجرد ما ننزل رابط البوست، تشوف المهام الخاصة بالبوست وتسوي:\n\n` +
    `• ❤️ *لايك (Like)* للبوست.\n` +
    `• 💬 *تعليق (Comment)* مناسب للمحتوى (تجنب التعليقات المكررة).\n` +
    `• 📤 *توجيه للخاص (Direct Share):* توجه البوست لـ 5 أشخاص (حتى لو لنفسك أو حسابات ثانوية).\n` +
    `• 📖 *توجيه ستوري (Share to Story)* مع منشن (Tag) للمشهور أو صاحب البوست.`,
    "Markdown",
    acceptRejectKeyboard("terms2_accept", "terms2_reject"),
  );
}

async function sendTermsMessage3(ctx: Context) {
  await rawSendMessage(
    ctx.chat!.id,
    `💰 *المستحقات:*\n\n` +
    `• *الأجر:* استحقاقك هو *1000 دينار* عن كل بوست تكمل كل خطواته.\n` +
    `• *الإنتاجية:* يومياً عدنا شغل ويه مشاهير، تگدر تحصل بين *25,000 إلى 30,000 دينار* يومياً إذا كنت ملتزم ويانا بكل الروابط.\n\n` +
    `⚠️ *ملاحظات مهمة:*\n` +
    `• الحسابات اللي يتبين إنها وهمية أو متابعينها أجانب يتم استبعادها فوراً.\n` +
    `• الأولوية للي يتفاعلون بأول دقائق من نزول الرابط.\n` +
    `• إذا الطلب 250 تعليق مثلاً، أول الناس هم من يحصلون الأجور.`,
    "Markdown",
    acceptRejectKeyboard("terms3_accept", "terms3_reject"),
  );
}

bot.start(async (ctx) => {
  const telegramId = String(ctx.from.id);
  const existing = await storage.getMember(telegramId);

  if (existing && existing.status === "approved") {
    await rawSendMessage(
      ctx.chat!.id,
      `مرحباً ${ctx.from.first_name}! 👋\n\n` +
      `أنت عضو فعال في المنظومة.\n\n` +
      `💰 رصيدك الحالي: ${existing.balance} دينار`,
      "",
      {
        inline_keyboard: [
          [styledButton("سحب أموال", "withdraw_funds", undefined, CUSTOM_EMOJI_WITHDRAW)],
        ]
      }
    );
    return;
  }

  if (existing && existing.status === "banned") {
    await ctx.reply("⛔ تم حظرك من المنظومة.");
    return;
  }

  if (existing && existing.status === "waiting_approval") {
    await ctx.reply(
      `⏳ طلبك قيد المراجعة`,
      {
        ...styledInlineKeyboard([
          [styledButton("تقديم حساب آخر", "submit_another_account")]
        ]),
      }
    );
    return;
  }

  if (existing && existing.status === "rejected") {
    await storage.updateMember(telegramId, {
      status: "onboarding",
      registrationStep: 1,
      accountLink: null,
      screenshotFileId: null,
    });
  }

  if (!existing) {
    await storage.createMember({
      telegramId,
      username: ctx.from.username || null,
      firstName: ctx.from.first_name || null,
      lastName: ctx.from.last_name || null,
      status: "onboarding",
      registrationStep: 1,
      balance: 0,
    });
  } else {
    await storage.updateMember(telegramId, { registrationStep: 1, status: "onboarding" });
  }

  await ctx.reply(
    `أهلاً وسهلاً ${ctx.from.first_name}! 👋\n\nمرحباً بك في منظومة التفاعل الرقمي.\n\nقبل البدء، يرجى قراءة الشروط والموافقة عليها:`,
    { parse_mode: "Markdown" }
  );

  await sendTermsMessage1(ctx);
});

bot.command("setapproval", async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  if (ctx.chat.type === "private") {
    await ctx.reply("أرسل هذا الأمر في مجموعة الموافقة على العمل.");
    return;
  }
  APPROVAL_GROUP_ID = ctx.chat.id;
  await saveGroupId("approval_group_id", ctx.chat.id);
  console.log(`Approval group ID set to: ${ctx.chat.id}`);
  await ctx.reply(`✅ تم تعيين هذه المجموعة كمجموعة الموافقة.\n\nChat ID: \`${ctx.chat.id}\``, { parse_mode: "Markdown" });
});

bot.command("setpayment", async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  if (ctx.chat.type === "private") {
    await ctx.reply("أرسل هذا الأمر في مجموعة المدفوعات.");
    return;
  }
  PAYMENT_GROUP_ID = ctx.chat.id;
  await saveGroupId("payment_group_id", ctx.chat.id);
  console.log(`Payment group ID set to: ${ctx.chat.id}`);
  await ctx.reply(`✅ تم تعيين هذه المجموعة كمجموعة المدفوعات.\n\nChat ID: \`${ctx.chat.id}\``, { parse_mode: "Markdown" });
});

bot.command("chatid", async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  await ctx.reply(`Chat ID: \`${ctx.chat.id}\`\nType: ${ctx.chat.type}`, { parse_mode: "Markdown" });
});

bot.command("admin", async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  if (ctx.chat.type !== "private") return;
  ownerState.action = null;
  await rawSendMessage(
    ctx.chat.id,
    `⚙️ لوحة التحكم`,
    "",
    {
      inline_keyboard: [
        [styledButton("إرسال مهمة", "admin_send_task", "success")],
        [styledButton("إحصائيات عامة", "admin_stats", "primary"), styledButton("إحصائيات المدفوعات", "admin_payment_stats", "primary")],
        [styledButton("إضافة أموال", "admin_add_money", "success"), styledButton("حذف أموال", "admin_remove_money", "danger")],
        [styledButton("كشف رصيد", "admin_check_balance", "primary")],
        [styledButton("حظر مستخدم", "admin_ban_user", "danger")],
        [styledButton("إحصائيات التفاعل", "admin_interaction_stats", "primary")],
      ]
    }
  );
});

bot.command("status", async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  await ctx.reply(
    `📊 حالة الإعدادات:\n\n` +
    `مجموعة الموافقة: ${APPROVAL_GROUP_ID ? `✅ ${APPROVAL_GROUP_ID}` : "❌ غير معيّنة - أرسل /setapproval بالمجموعة"}\n` +
    `مجموعة المدفوعات: ${PAYMENT_GROUP_ID ? `✅ ${PAYMENT_GROUP_ID}` : "❌ غير معيّنة - أرسل /setpayment بالمجموعة"}`
  );
});

bot.action("withdraw_funds", async (ctx) => {
  await ctx.answerCbQuery();
  const telegramId = String(ctx.from.id);
  const member = await storage.getMember(telegramId);
  if (!member || member.status !== "approved") return;

  if (member.balance < 5000) {
    await ctx.reply(
      `❌ رصيدك الحالي ${member.balance} دينار.\n\nالحد الأدنى للسحب هو 5,000 دينار.`
    );
    return;
  }

  await rawSendMessage(
    ctx.chat!.id,
    `💰 رصيدك الحالي: ${member.balance} دينار\n\nاختر طريقة الدفع:`,
    "",
    {
      inline_keyboard: [
        [styledButton("زين كاش", "withdraw_method_zaincash", "success", CUSTOM_EMOJI_ZAINCASH)],
        [styledButton("اسياسيل", "withdraw_method_asiacell", "primary", CUSTOM_EMOJI_ASIACELL)],
        [styledButton("ماستر كارد", "withdraw_method_mastercard", "primary", CUSTOM_EMOJI_MASTERCARD)],
      ]
    }
  );
});

bot.action(/^withdraw_method_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const telegramId = String(ctx.from.id);
  const member = await storage.getMember(telegramId);
  if (!member || member.status !== "approved" || member.balance < 5000) return;

  const method = ctx.match[1];
  const methodNames: Record<string, string> = {
    zaincash: "زين كاش",
    asiacell: "اسياسيل",
    mastercard: "ماستر كارد",
  };

  memberState[telegramId] = {
    action: "awaiting_withdraw_number",
    data: { method, methodName: methodNames[method] || method, balance: member.balance }
  };

  await ctx.reply(`📱 اختيارك: ${methodNames[method]}\n\nأرسل رقمك الآن:`);
});

bot.action("submit_another_account", async (ctx) => {
  await ctx.answerCbQuery();
  const telegramId = String(ctx.from.id);
  await storage.updateMember(telegramId, {
    status: "awaiting_info",
    registrationStep: 4,
    accountLink: null,
    screenshotFileId: null,
  });
  await ctx.reply(
    `📱 أرسل لنا:\n\n` +
    `1️⃣ رابط حسابك على انستجرام\n` +
    `2️⃣ سكرين شوت من داخل الحساب\n\n` +
    `*أرسل الرابط أولاً في رسالة منفصلة ثم السكرين شوت.*`,
    { parse_mode: "Markdown" }
  );
});

bot.action("admin_send_task", async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  await ctx.answerCbQuery();
  ownerState.action = "awaiting_task_link";
  await ctx.reply("📎 أرسل رابط البوست (Instagram link):");
});

bot.action("admin_stats", async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  await ctx.answerCbQuery();
  const stats = await storage.getStats();
  const allMembers = await storage.getAllMembers();
  const approved = allMembers.filter(m => m.status === "approved");
  const waiting = allMembers.filter(m => m.status === "waiting_approval");
  const banned = allMembers.filter(m => m.status === "banned");
  await ctx.reply(
    `📊 إحصائيات عامة:\n\n` +
    `👥 إجمالي الأعضاء: ${stats.totalMembers}\n` +
    `✅ أعضاء مفعلين: ${approved.length}\n` +
    `⏳ بانتظار الموافقة: ${waiting.length}\n` +
    `⛔ محظورين: ${banned.length}\n\n` +
    `📋 إجمالي المهام: ${stats.totalTasks}\n` +
    `✅ مهام مكتملة: ${stats.completedTasks}`
  );
});

bot.action("admin_payment_stats", async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  await ctx.answerCbQuery();
  const stats = await storage.getStats();
  const allMembers = await storage.getAllMembers();
  const approved = allMembers.filter(m => m.status === "approved");
  const totalBalance = approved.reduce((sum, m) => sum + m.balance, 0);
  const topMembers = approved.sort((a, b) => b.balance - a.balance).slice(0, 10);
  let topList = topMembers.map((m, i) => `${i + 1}. ${m.firstName || ""} @${m.username || m.telegramId} - ${m.balance} دينار`).join("\n");
  if (!topList) topList = "لا يوجد أعضاء بعد";
  await ctx.reply(
    `💰 إحصائيات المدفوعات:\n\n` +
    `💵 إجمالي الأرصدة: ${totalBalance} دينار\n` +
    `⏳ مدفوعات معلقة: ${stats.pendingPayments}\n\n` +
    `🏆 أعلى 10 أرصدة:\n${topList}`
  );
});

bot.action("admin_add_money", async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  await ctx.answerCbQuery();
  ownerState.action = "awaiting_add_money_id";
  await ctx.reply("💰 أرسل ID المستخدم الذي تريد إضافة أموال له:");
});

bot.action("admin_remove_money", async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  await ctx.answerCbQuery();
  ownerState.action = "awaiting_remove_money_id";
  await ctx.reply("💸 أرسل ID المستخدم الذي تريد حذف أموال منه:");
});

bot.action("admin_check_balance", async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  await ctx.answerCbQuery();
  ownerState.action = "awaiting_check_id";
  await ctx.reply("🔍 أرسل ID المستخدم للكشف عن رصيده:");
});

bot.action("admin_ban_user", async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  await ctx.answerCbQuery();
  ownerState.action = "awaiting_ban_id";
  await ctx.reply("⛔ أرسل ID المستخدم الذي تريد حظره:");
});

bot.action(/^task_type_(.+)$/, async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  await ctx.answerCbQuery();
  const type = ctx.match[1];

  if (!ownerState.data?.postLink) {
    await ctx.reply("❌ حدث خطأ. أرسل /admin وحاول مجدداً.");
    ownerState.action = null;
    return;
  }

  let taskTypes: string[];
  let price: number;
  if (type === "all") {
    taskTypes = ["like", "comment", "share_story", "explore"];
    price = 1000;
  } else if (type === "like") {
    taskTypes = ["like"];
    price = 500;
  } else if (type === "comment") {
    taskTypes = ["comment"];
    price = 500;
  } else if (type === "story") {
    taskTypes = ["share_story"];
    price = 500;
  } else {
    taskTypes = ["explore"];
    price = 500;
  }

  const approvedMembers = await storage.getMembersByStatus("approved");
  if (approvedMembers.length === 0) {
    await ctx.reply("❌ لا يوجد أعضاء مفعلين لإرسال المهمة لهم.");
    ownerState.action = null;
    return;
  }

  let sentCount = 0;
  for (const m of approvedMembers) {
    const task = await storage.createTask({
      postLink: ownerState.data.postLink,
      assignedTo: m.telegramId,
      taskTypes,
      price,
      status: "pending",
    });
    const sent = await sendTaskToMember(m.telegramId, task.id);
    if (sent) sentCount++;
  }

  await ctx.reply(`✅ تم إرسال المهمة لـ ${sentCount} عضو من أصل ${approvedMembers.length}`);
  ownerState.action = null;
});

bot.action("admin_interaction_stats", async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  await ctx.answerCbQuery();
  const allTasks = await storage.getAllTasks();
  const sentTasks = allTasks.filter(t => t.status === "sent" || t.status === "completed");
  const allSubs = await storage.getAllSubmissions();
  const approvedMembers = await storage.getMembersByStatus("approved");

  if (sentTasks.length === 0) {
    await ctx.reply("📊 لا توجد مهام مرسلة بعد.");
    return;
  }

  let report = `📊 إحصائيات التفاعل:\n\n`;
  const lastTasks = sentTasks.slice(0, 5);
  for (const task of lastTasks) {
    const taskSubs = allSubs.filter(s => s.taskId === task.id);
    const interacted = taskSubs.map(s => s.memberId);
    const notInteracted = approvedMembers.filter(m => !interacted.includes(m.telegramId));

    report += `📌 المهمة #${task.id} - ${task.postLink.substring(0, 30)}...\n`;
    report += `✅ تفاعلوا: ${interacted.length}\n`;
    report += `❌ لم يتفاعلوا: ${notInteracted.length}\n\n`;
  }
  await ctx.reply(report);
});

bot.action("noop_accepted", async (ctx) => {
  await ctx.answerCbQuery("تمت الموافقة مسبقاً ✅");
});

bot.action("noop_cancelled", async (ctx) => {
  await ctx.answerCbQuery("تم الإلغاء مسبقاً");
});

bot.action("terms1_accept", async (ctx) => {
  await ctx.answerCbQuery("تم القبول ✅");
  const telegramId = String(ctx.from.id);
  await storage.updateMember(telegramId, { registrationStep: 2 });
  await editToAccepted(ctx);
  await sendTermsMessage2(ctx);
});

bot.action("terms1_reject", async (ctx) => {
  await ctx.answerCbQuery("تم الإلغاء");
  await storage.updateMember(String(ctx.from.id), { status: "rejected", registrationStep: 0 });
  await editToCancelled(ctx);
  await ctx.reply("تم إلغاء التسجيل. يمكنك الضغط على /start للمحاولة مجدداً.");
});

bot.action("terms2_accept", async (ctx) => {
  await ctx.answerCbQuery("تم القبول ✅");
  const telegramId = String(ctx.from.id);
  await storage.updateMember(telegramId, { registrationStep: 3 });
  await editToAccepted(ctx);
  await sendTermsMessage3(ctx);
});

bot.action("terms2_reject", async (ctx) => {
  await ctx.answerCbQuery("تم الإلغاء");
  await storage.updateMember(String(ctx.from.id), { status: "rejected", registrationStep: 0 });
  await editToCancelled(ctx);
  await ctx.reply("تم إلغاء التسجيل. يمكنك الضغط على /start للمحاولة مجدداً.");
});

bot.action("terms3_accept", async (ctx) => {
  await ctx.answerCbQuery("تم القبول ✅");
  const telegramId = String(ctx.from.id);
  await storage.updateMember(telegramId, { registrationStep: 4, status: "awaiting_info" });
  await editToAccepted(ctx);
  await ctx.reply(
    `ممتاز! 🎉\n\nالآن أرسل لنا:\n\n` +
    `1️⃣ رابط حسابك على انستجرام\n` +
    `2️⃣ سكرين شوت من داخل الحساب\n\n` +
    `*أرسل الرابط أولاً في رسالة منفصلة ثم السكرين شوت.*`,
    { parse_mode: "Markdown" }
  );
});

bot.action("terms3_reject", async (ctx) => {
  await ctx.answerCbQuery("تم الإلغاء");
  await storage.updateMember(String(ctx.from.id), { status: "rejected", registrationStep: 0 });
  await editToCancelled(ctx);
  await ctx.reply("تم إلغاء التسجيل. يمكنك الضغط على /start للمحاولة مجدداً.");
});

bot.on("text", async (ctx) => {
  const telegramId = String(ctx.from.id);

  if (ctx.from.id === OWNER_ID && ctx.chat.type === "private" && ownerState.action) {
    const text = ctx.message.text;

    if (ownerState.action === "awaiting_task_link") {
      ownerState.action = "awaiting_task_types";
      ownerState.data = { postLink: text };
      await rawSendMessage(
        ctx.chat.id,
        "📋 اختر نوع المهام:",
        "",
        {
          inline_keyboard: [
            [styledButton("كل المهام (1000 دينار)", "task_type_all", "success")],
            [styledButton("لايك فقط (500 دينار)", "task_type_like", "primary")],
            [styledButton("تعليق فقط (500 دينار)", "task_type_comment", "primary")],
            [styledButton("ستوري فقط (500 دينار)", "task_type_story", "primary")],
            [styledButton("اكسبلور فقط (500 دينار)", "task_type_explore", "primary")],
          ]
        }
      );
      return;
    }

    if (ownerState.action === "awaiting_add_money_id") {
      const member = await storage.getMember(text);
      if (!member) {
        await ctx.reply("❌ لم يتم العثور على هذا المستخدم. أرسل /admin للعودة.");
        ownerState.action = null;
        return;
      }
      ownerState.action = "awaiting_add_money_amount";
      ownerState.data = { targetId: text, memberName: member.firstName || member.username || text };
      await ctx.reply(`👤 ${member.firstName || ""} @${member.username || text}\nرصيده: ${member.balance} دينار\n\n💰 أرسل المبلغ المراد إضافته:`);
      return;
    }

    if (ownerState.action === "awaiting_add_money_amount") {
      const amount = parseInt(text);
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply("❌ أدخل مبلغ صحيح. أرسل /admin للعودة.");
        ownerState.action = null;
        return;
      }
      const member = await storage.getMember(ownerState.data.targetId);
      if (!member) { ownerState.action = null; return; }
      const newBalance = member.balance + amount;
      await storage.updateMember(ownerState.data.targetId, { balance: newBalance });
      await ctx.reply(`✅ تم إضافة ${amount} دينار لـ ${ownerState.data.memberName}\nالرصيد الجديد: ${newBalance} دينار`);
      try {
        await bot.telegram.sendMessage(parseInt(ownerState.data.targetId), `💰 تم إضافة ${amount} دينار لرصيدك!\n\nرصيدك الحالي: ${newBalance} دينار`);
      } catch (e) {}
      ownerState.action = null;
      return;
    }

    if (ownerState.action === "awaiting_remove_money_id") {
      const member = await storage.getMember(text);
      if (!member) {
        await ctx.reply("❌ لم يتم العثور على هذا المستخدم. أرسل /admin للعودة.");
        ownerState.action = null;
        return;
      }
      ownerState.action = "awaiting_remove_money_amount";
      ownerState.data = { targetId: text, memberName: member.firstName || member.username || text };
      await ctx.reply(`👤 ${member.firstName || ""} @${member.username || text}\nرصيده: ${member.balance} دينار\n\n💸 أرسل المبلغ المراد حذفه:`);
      return;
    }

    if (ownerState.action === "awaiting_remove_money_amount") {
      const amount = parseInt(text);
      if (isNaN(amount) || amount <= 0) {
        await ctx.reply("❌ أدخل مبلغ صحيح. أرسل /admin للعودة.");
        ownerState.action = null;
        return;
      }
      const member = await storage.getMember(ownerState.data.targetId);
      if (!member) { ownerState.action = null; return; }
      const newBalance = Math.max(0, member.balance - amount);
      await storage.updateMember(ownerState.data.targetId, { balance: newBalance });
      await ctx.reply(`✅ تم حذف ${amount} دينار من ${ownerState.data.memberName}\nالرصيد الجديد: ${newBalance} دينار`);
      try {
        await bot.telegram.sendMessage(parseInt(ownerState.data.targetId), `💸 تم خصم ${amount} دينار من رصيدك.\n\nرصيدك الحالي: ${newBalance} دينار`);
      } catch (e) {}
      ownerState.action = null;
      return;
    }

    if (ownerState.action === "awaiting_check_id") {
      const member = await storage.getMember(text);
      if (!member) {
        await ctx.reply("❌ لم يتم العثور على هذا المستخدم.");
        ownerState.action = null;
        return;
      }
      await ctx.reply(
        `🔍 كشف رصيد:\n\n` +
        `👤 الاسم: ${member.firstName || ""} ${member.lastName || ""}\n` +
        `🔗 يوزر: @${member.username || "بدون يوزر"}\n` +
        `📱 ID: ${member.telegramId}\n` +
        `💰 الرصيد: ${member.balance} دينار\n` +
        `📊 الحالة: ${member.status}`
      );
      ownerState.action = null;
      return;
    }

    if (ownerState.action === "awaiting_ban_id") {
      const member = await storage.getMember(text);
      if (!member) {
        await ctx.reply("❌ لم يتم العثور على هذا المستخدم.");
        ownerState.action = null;
        return;
      }
      await storage.updateMember(text, { status: "banned" });
      await ctx.reply(`⛔ تم حظر المستخدم ${member.firstName || ""} @${member.username || text}`);
      try {
        await bot.telegram.sendMessage(parseInt(text), "⛔ تم حظرك من المنظومة.");
      } catch (e) {}
      ownerState.action = null;
      return;
    }
  }

  if (memberState[telegramId]?.action === "awaiting_withdraw_number" && ctx.chat.type === "private") {
    const phoneNumber = ctx.message.text;
    const data = memberState[telegramId].data;
    delete memberState[telegramId];

    const member = await storage.getMember(telegramId);
    if (!member || member.status !== "approved" || member.balance < 5000) return;

    await ctx.reply(
      `✅ تم استلام طلب السحب\n\n` +
      `💰 الرصيد: ${member.balance} دينار\n` +
      `📱 طريقة الدفع: ${data.methodName}\n` +
      `📞 الرقم: ${phoneNumber}\n\n` +
      `سيتم تحويل المبلغ قريباً ⏳`
    );

    if (PAYMENT_GROUP_ID) {
      try {
        await bot.telegram.sendMessage(
          parseInt(PAYMENT_GROUP_ID),
          `💸 طلب سحب جديد\n\n` +
          `👤 العضو: ${member.firstName || ""} @${member.username || telegramId}\n` +
          `📱 ID: ${telegramId}\n` +
          `💰 الرصيد: ${member.balance} دينار\n` +
          `🏦 طريقة الدفع: ${data.methodName}\n` +
          `📞 الرقم: ${phoneNumber}`
        );
      } catch (e) {
        console.error("Failed to send withdrawal to payment group:", e);
      }
    }
    return;
  }

  const member = await storage.getMember(telegramId);

  if (!member) return;

  if (member.status === "awaiting_info" && member.registrationStep === 4) {
    const text = ctx.message.text;
    if (text.startsWith("http") || text.includes("instagram.com") || text.includes("@")) {
      await storage.updateMember(telegramId, { accountLink: text, registrationStep: 5 });
      await ctx.reply("✅ تم حفظ الرابط! الآن أرسل سكرين شوت من داخل الحساب.");
      return;
    }
  }

  if (member.status === "approved") {
    const tasks = await storage.getTasksForMember(telegramId);
    if (tasks.length > 0) {
      await ctx.reply(`لديك ${tasks.length} مهمة نشطة. استخدم الأزرار للتفاعل معها.`);
    }
  }
});

bot.on("photo", async (ctx) => {
  const telegramId = String(ctx.from.id);
  const member = await storage.getMember(telegramId);

  if (!member) return;

  if (member.status === "awaiting_info" && member.registrationStep === 5 && member.accountLink) {
    const photos = ctx.message.photo;
    const fileId = photos[photos.length - 1].file_id;
    await storage.updateMember(telegramId, {
      screenshotFileId: fileId,
      status: "waiting_approval",
      registrationStep: 6,
    });

    const targetGroupId = APPROVAL_GROUP_ID || OWNER_ID;
    try {
      const caption =
        `🆕 طلب انضمام جديد\n\n` +
        `👤 الاسم: ${member.firstName || ""} ${member.lastName || ""}\n` +
        `🔗 يوزر: @${member.username || "بدون يوزر"}\n` +
        `📱 ID: ${telegramId}\n` +
        `🌐 الحساب: ${member.accountLink}`;

      const approvalKeyboard = {
        inline_keyboard: [
          [{ text: "حساب التيليكرام", url: `tg://user?id=${telegramId}`, style: "primary" }],
          [{ text: "فتح الحساب", url: member.accountLink || `https://instagram.com/${member.username || ""}`, style: "primary" }],
          [
            styledButton("موافقة", `grp_approve_${telegramId}`, "success", CUSTOM_EMOJI_ACCEPT),
            styledButton("رفض", `grp_reject_${telegramId}`, "danger", CUSTOM_EMOJI_CANCEL),
          ]
        ]
      };

      await rawSendPhoto(targetGroupId, fileId, caption, approvalKeyboard);
    } catch (e) {
      console.log("Could not send to approval group:", e);
    }

    await ctx.reply(
      `⏳ طلبك قيد المراجعة`,
      {
        ...styledInlineKeyboard([
          [styledButton("تقديم حساب آخر", "submit_another_account")]
        ]),
      }
    );
    return;
  }

  if (member.status === "approved" && member.registrationStep === 10) {
    const photos = ctx.message.photo;
    const fileId = photos[photos.length - 1].file_id;
    await storage.updateMember(telegramId, { registrationStep: 11 });

    const pendingTask = (await storage.getTasksForMember(telegramId))[0];
    if (pendingTask) {
      const existingSub = await storage.getSubmission(pendingTask.id, telegramId);
      if (existingSub && existingSub.status === "awaiting_work_screenshot") {
        await storage.updateSubmission(existingSub.id, {
          workScreenshotFileId: fileId,
          status: "awaiting_account_screenshot"
        });
        await ctx.reply("✅ تم! الآن أرسل سكرين شوت من داخل الحساب الذي أنجزت منه العمل.");
      } else if (existingSub && existingSub.status === "awaiting_account_screenshot") {
        await storage.updateSubmission(existingSub.id, {
          accountScreenshotFileId: fileId,
          status: "pending"
        });
        await storage.updateMember(telegramId, { registrationStep: 0 });

        const payGroupId = PAYMENT_GROUP_ID || OWNER_ID;
        try {
          await bot.telegram.sendMessage(
            payGroupId,
            `✅ *إكمال مهمة*${!PAYMENT_GROUP_ID ? " (المجموعة غير معيّنة)" : ""}\n\n` +
            `👤 ${member.firstName || ""} @${member.username || member.telegramId}\n` +
            `🔗 الرابط: ${pendingTask.postLink}\n` +
            `💰 الأجر: ${pendingTask.price} دينار\n\n` +
            `للموافقة: /pay_${existingSub.id}\nللرفض: /rejectpay_${existingSub.id}`,
            { parse_mode: "Markdown" }
          );
          if (existingSub.workScreenshotFileId) {
            await bot.telegram.sendPhoto(payGroupId, existingSub.workScreenshotFileId, { caption: "سكرين العمل" });
          }
          await bot.telegram.sendPhoto(payGroupId, fileId, { caption: "سكرين الحساب" });
        } catch (e) {
          console.log("Could not send to payment group:", e);
        }

        await ctx.reply(
          `🎉 ممتاز! تم إرسال إنجازك للإدارة.\n\n` +
          `⏳ سيتم مراجعة عملك وإضافة ${pendingTask.price} دينار لرصيدك قريباً.`
        );
      }
    }
  }
});

bot.action(/^grp_approve_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery("تمت الموافقة ✅");
  const telegramId = ctx.match[1];
  const member = await storage.getMember(telegramId);
  if (!member) return;

  const accountUrl = member.accountLink || `https://instagram.com/${member.username || ""}`;
  const approvedMarkup = {
    inline_keyboard: [
      [{ text: "حساب التيليكرام", url: `tg://user?id=${telegramId}`, style: "primary" }],
      [{ text: "فتح الحساب", url: accountUrl, style: "primary" }],
      [styledButton("تمت الموافقة", "noop_accepted", "primary", CUSTOM_EMOJI_APPROVED)],
    ]
  };
  await rawEditMarkup(ctx.chat!.id, ctx.callbackQuery.message!.message_id, approvedMarkup);
  await approveViaBot(telegramId);
});

bot.action(/^grp_reject_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery("تم الرفض");
  const telegramId = ctx.match[1];
  const member = await storage.getMember(telegramId);
  if (!member) return;

  const accountUrl = member.accountLink || `https://instagram.com/${member.username || ""}`;
  const rejectedMarkup = {
    inline_keyboard: [
      [{ text: "حساب التيليكرام", url: `tg://user?id=${telegramId}`, style: "primary" }],
      [{ text: "فتح الحساب", url: accountUrl, style: "primary" }],
      [styledButton("تم الرفض", "noop_cancelled", "danger", CUSTOM_EMOJI_CANCEL)],
    ]
  };
  await rawEditMarkup(ctx.chat!.id, ctx.callbackQuery.message!.message_id, rejectedMarkup);
  await rejectMember(telegramId);
});

bot.action(/^complete_task_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery("تم!");
  const taskId = parseInt(ctx.match[1]);
  const telegramId = String(ctx.from.id);
  const member = await storage.getMember(telegramId);
  if (!member || member.status !== "approved") return;

  const task = await storage.getTask(taskId);
  if (!task) return;

  const existing = await storage.getSubmission(taskId, telegramId);
  if (!existing) {
    await storage.createSubmission({
      taskId,
      memberId: telegramId,
      status: "awaiting_work_screenshot",
    });
  }

  try {
    await ctx.editMessageReplyMarkup(
      styledInlineKeyboard([
        [styledButton("📸 جاري إرسال الإثبات...", "noop_accepted", "primary")]
      ]).reply_markup
    );
  } catch (e) {
    console.log("Could not edit task button:", (e as any).message);
  }

  await storage.updateMember(telegramId, { registrationStep: 10 });
  await ctx.reply(
    `✅ ممتاز! لإثبات إنجاز المهمة:\n\n` +
    `📸 أرسل أولاً سكرين شوت من العمل الذي قمت به (التعليق أو اللايك أو الستوري).`
  );
});

async function approveViaBot(telegramId: string) {
  await storage.updateMember(telegramId, {
    status: "approved",
    approvedAt: new Date(),
    registrationStep: 0,
  });
  try {
    await bot.telegram.sendMessage(
      parseInt(telegramId),
      `🎉 *تهانينا! تم قبولك في المنظومة!*\n\n` +
      `أنت الآن عضو فعال وسيتم إرسال المهام لك.\n` +
      `ابقَ متابعاً وجاهزاً للروابط! 💪`,
      { parse_mode: "Markdown" }
    );
  } catch (e) {
    console.log("Could not notify member:", e);
  }
}

export async function sendTaskToMember(telegramId: string, taskId: number) {
  const task = await storage.getTask(taskId);
  if (!task) return false;

  const taskList = task.taskTypes.map(t => `• ${TASK_LABELS[t] || t}`).join("\n");
  const priceText = task.price === 1000 ? "1000 دينار (كل المهام)" : `${task.price} دينار`;

  try {
    await rawSendMessage(
      parseInt(telegramId),
      `🔔 مهمة جديدة!\n\n` +
      `🔗 الرابط:\n${task.postLink}\n\n` +
      `📋 المهام المطلوبة:\n${taskList}\n\n` +
      `💰 الأجر: ${priceText}\n\n` +
      `⚡ أنجز المهمة بأسرع وقت للحصول على الأجر!`,
      "",
      {
        inline_keyboard: [
          [styledButton("✅ تم إكمال المهام", `complete_task_${taskId}`, "success")]
        ]
      }
    );

    await storage.updateTask(taskId, { status: "sent", sentAt: new Date() });
    return true;
  } catch (e) {
    console.log("Error sending task:", e);
    return false;
  }
}

export async function approveMember(telegramId: string) {
  return approveViaBot(telegramId);
}

export async function rejectMember(telegramId: string) {
  await storage.updateMember(telegramId, { status: "rejected" });
  try {
    await bot.telegram.sendMessage(
      parseInt(telegramId),
      `❌ نأسف، تم رفض طلبك.\n\nإذا كنت تعتقد أن هناك خطأ، تواصل مع الإدارة.`
    );
  } catch (e) {
    console.log("Could not notify member:", e);
  }
}

export async function approvePayment(submissionId: number) {
  const sub = await storage.updateSubmission(submissionId, {
    status: "approved",
    approvedAt: new Date(),
  });
  if (!sub) return;

  const task = await storage.getTask(sub.taskId);
  if (!task) return;

  const member = await storage.getMember(sub.memberId);
  if (!member) return;

  const newBalance = member.balance + task.price;
  await storage.updateMember(sub.memberId, { balance: newBalance });
  await storage.updateTask(sub.taskId, { status: "completed" });

  try {
    await bot.telegram.sendMessage(
      parseInt(sub.memberId),
      `💰 *تم إضافة ${task.price} دينار لرصيدك!*\n\n` +
      `رصيدك الحالي: *${newBalance} دينار*\n\n` +
      `شكراً على التزامك! 🌟`,
      { parse_mode: "Markdown" }
    );
  } catch (e) {
    console.log("Could not notify member:", e);
  }
}

export async function startBot() {
  await loadGroupIds();
  console.log("Group IDs loaded, launching bot...");
  bot.launch().then(() => {
    console.log("Telegram bot started successfully");
  }).catch((err) => {
    console.error("Bot launch error:", err.message);
  });

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
