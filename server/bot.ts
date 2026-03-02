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

const EMOJI_PLACEHOLDER = "\u2705";

function styledButton(text: string, callbackData: string, style?: string, customEmojiId?: string) {
  const btn: any = { text, callback_data: callbackData };
  if (style) btn.style = style;
  if (customEmojiId) {
    btn.text = EMOJI_PLACEHOLDER + " " + text;
    btn.text_entities = [{ type: "custom_emoji", offset: 0, length: 1, custom_emoji_id: customEmojiId }];
  }
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
    await ctx.reply(
      `مرحباً ${ctx.from.first_name}! 👋\n\nأنت مسجل ومفعل. سيتم إرسال المهام لك قريباً. ابقَ متابع! 🚀`,
      { parse_mode: "Markdown" }
    );
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
    await ctx.reply("❌ تم رفض طلبك. للاستفسار تواصل مع الإدارة.");
    return;
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
  await ctx.reply(
    `⚙️ *لوحة الأوامر:*\n\n` +
    `📌 /setapproval - أرسلها بمجموعة الموافقة\n` +
    `💰 /setpayment - أرسلها بمجموعة المدفوعات\n` +
    `🔢 /chatid - لمعرفة ID المحادثة\n` +
    `📊 /status - حالة الإعدادات\n\n` +
    `مجموعة الموافقة: ${APPROVAL_GROUP_ID ? `\`${APPROVAL_GROUP_ID}\`` : "❌ غير معيّنة"}\n` +
    `مجموعة المدفوعات: ${PAYMENT_GROUP_ID ? `\`${PAYMENT_GROUP_ID}\`` : "❌ غير معيّنة"}`,
    { parse_mode: "Markdown" }
  );
});

bot.command("status", async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  await ctx.reply(
    `📊 *حالة الإعدادات:*\n\n` +
    `مجموعة الموافقة: ${APPROVAL_GROUP_ID ? `✅ \`${APPROVAL_GROUP_ID}\`` : "❌ غير معيّنة - أرسل /setapproval بالمجموعة"}\n` +
    `مجموعة المدفوعات: ${PAYMENT_GROUP_ID ? `✅ \`${PAYMENT_GROUP_ID}\`` : "❌ غير معيّنة - أرسل /setpayment بالمجموعة"}`,
    { parse_mode: "Markdown" }
  );
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

    if (APPROVAL_GROUP_ID) {
      try {
        await bot.telegram.sendMessage(
          APPROVAL_GROUP_ID,
          `🆕 *طلب انضمام جديد*\n\n` +
          `👤 الاسم: ${member.firstName || ""} ${member.lastName || ""}\n` +
          `🔗 يوزر: @${member.username || "بدون يوزر"}\n` +
          `📱 ID: \`${telegramId}\`\n` +
          `🌐 الحساب: ${member.accountLink}`,
          { parse_mode: "Markdown" }
        );
        await bot.telegram.sendPhoto(APPROVAL_GROUP_ID, fileId, {
          caption: `📸 سكرين شوت الحساب - ID: ${telegramId}\n\nللموافقة: /approve_${telegramId}\nللرفض: /reject_${telegramId}`,
        });
      } catch (e) {
        console.log("Could not send to approval group:", e);
      }
    } else {
      try {
        await bot.telegram.sendMessage(OWNER_ID,
          `🆕 *طلب انضمام جديد* (المجموعة غير معيّنة)\n\n` +
          `👤 ${member.firstName || ""} @${member.username || "بدون يوزر"}\n` +
          `📱 ID: \`${telegramId}\`\n` +
          `🌐 ${member.accountLink}\n\n` +
          `⚠️ أرسل /setapproval في مجموعة الموافقة لتفعيل الإرسال التلقائي`,
          { parse_mode: "Markdown" }
        );
      } catch (e) {
        console.log("Could not notify owner:", e);
      }
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
  if (!task) return;

  const taskList = task.taskTypes.map(t => `• ${TASK_LABELS[t] || t}`).join("\n");
  const priceText = task.price === 1000 ? "1000 دينار (كل المهام)" : `${task.price} دينار`;

  try {
    await bot.telegram.sendMessage(
      parseInt(telegramId),
      `🔔 *مهمة جديدة!*\n\n` +
      `🔗 الرابط: ${task.postLink}\n\n` +
      `📋 *المهام المطلوبة:*\n${taskList}\n\n` +
      `💰 الأجر: *${priceText}*\n\n` +
      `⚡ أنجز المهمة بأسرع وقت للحصول على الأجر!`,
      {
        parse_mode: "Markdown",
        ...styledInlineKeyboard([
          [styledButton("✅ تم إكمال المهام", `complete_task_${taskId}`, "success")]
        ]),
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
