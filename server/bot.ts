import { Telegraf, Markup } from "telegraf";
import { storage } from "./storage";
import type { Context } from "telegraf";

const BOT_TOKEN = "8516006670:AAF8bry6k6RYVPFfguhRmpp0NNhH5HYYOV4";
const OWNER_ID = 1384026800;
const APPROVAL_GROUP = "@" + "C9Qk7j81KSdiODM6";
const PAYMENT_GROUP = "@" + "wWAHO42c4wFiZTJi";

export const bot = new Telegraf(BOT_TOKEN);

const TASK_LABELS: Record<string, string> = {
  like: "لايك (Like)",
  comment: "تعليق (Comment)",
  share_story: "توجيه ستوري مع تاك (Share to Story + Mention)",
  explore: "حركة الاكسبلور - توجيه للخاص (Direct Share)",
};

function getTaskDescription(taskTypes: string[], commentCount?: number) {
  return taskTypes.map(t => {
    if (t === "comment" && commentCount) return `${commentCount} تعليق (Comment)`;
    return TASK_LABELS[t] || t;
  }).join("\n• ");
}

async function sendTermsMessage1(ctx: Context) {
  await ctx.reply(
    `📋 *الشروط الأساسية للحسابات:*\n\n` +
    `1️⃣ *عدد المتابعين:* لازم حسابك الشخصي بي أكثر من *5000 متابع*.\n` +
    `2️⃣ *نوع الحساب:* حساب حقيقي، شخصي، ونشط (مو حساب وهمي أو جديد).\n` +
    `3️⃣ *المتابعين:* حصراً لازم يكون أغلب متابعينك *عراقيين*.`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback("✅ موافق", "terms1_accept"),
          Markup.button.callback("❌ إلغاء", "terms1_reject"),
        ]
      ])
    }
  );
}

async function sendTermsMessage2(ctx: Context) {
  await ctx.reply(
    `📌 *خطة العمل:*\n\n` +
    `بمجرد ما ننزل رابط البوست، تشوف المهام الخاصة بالبوست وتسوي:\n\n` +
    `• ❤️ *لايك (Like)* للبوست.\n` +
    `• 💬 *تعليق (Comment)* مناسب للمحتوى (تجنب التعليقات المكررة).\n` +
    `• 📤 *توجيه للخاص (Direct Share):* توجه البوست لـ 5 أشخاص (حتى لو لنفسك أو حسابات ثانوية).\n` +
    `• 📖 *توجيه ستوري (Share to Story)* مع منشن (Tag) للمشهور أو صاحب البوست.`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback("✅ موافق", "terms2_accept"),
          Markup.button.callback("❌ إلغاء", "terms2_reject"),
        ]
      ])
    }
  );
}

async function sendTermsMessage3(ctx: Context) {
  await ctx.reply(
    `💰 *المستحقات:*\n\n` +
    `• *الأجر:* استحقاقك هو *1000 دينار* عن كل بوست تكمل كل خطواته.\n` +
    `• *الإنتاجية:* يومياً عدنا شغل ويه مشاهير، تگدر تحصل بين *25,000$ إلى 30,000 دينار* يومياً إذا كنت ملتزم ويانا بكل الروابط.\n\n` +
    `⚠️ *ملاحظات مهمة:*\n` +
    `• الحسابات اللي يتبين إنها وهمية أو متابعينها أجانب يتم استبعادها فوراً.\n` +
    `• الأولوية للي يتفاعلون بأول دقائق من نزول الرابط.\n` +
    `• إذا الطلب 250 تعليق مثلاً، أول الناس هم من يحصلون الأجور.`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback("✅ موافق وأبدأ", "terms3_accept"),
          Markup.button.callback("❌ إلغاء", "terms3_reject"),
        ]
      ])
    }
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
    await ctx.reply("⏳ طلبك قيد المراجعة. انتظر موافقة الإدارة.");
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

bot.action("terms1_accept", async (ctx) => {
  await ctx.answerCbQuery("تم القبول ✅");
  const telegramId = String(ctx.from.id);
  await storage.updateMember(telegramId, { registrationStep: 2 });
  await sendTermsMessage2(ctx);
});

bot.action("terms1_reject", async (ctx) => {
  await ctx.answerCbQuery("تم الإلغاء");
  await storage.updateMember(String(ctx.from.id), { status: "rejected", registrationStep: 0 });
  await ctx.reply("تم إلغاء التسجيل. يمكنك الضغط على /start للمحاولة مجدداً.");
});

bot.action("terms2_accept", async (ctx) => {
  await ctx.answerCbQuery("تم القبول ✅");
  const telegramId = String(ctx.from.id);
  await storage.updateMember(telegramId, { registrationStep: 3 });
  await sendTermsMessage3(ctx);
});

bot.action("terms2_reject", async (ctx) => {
  await ctx.answerCbQuery("تم الإلغاء");
  await storage.updateMember(String(ctx.from.id), { status: "rejected", registrationStep: 0 });
  await ctx.reply("تم إلغاء التسجيل. يمكنك الضغط على /start للمحاولة مجدداً.");
});

bot.action("terms3_accept", async (ctx) => {
  await ctx.answerCbQuery("تم القبول ✅");
  const telegramId = String(ctx.from.id);
  await storage.updateMember(telegramId, { registrationStep: 4, status: "awaiting_info" });
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

    try {
      await bot.telegram.sendMessage(
        -1002547447878,
        `🆕 *طلب انضمام جديد*\n\n` +
        `👤 الاسم: ${member.firstName || ""} ${member.lastName || ""}\n` +
        `🔗 يوزر: @${member.username || "بدون يوزر"}\n` +
        `📱 ID: \`${telegramId}\`\n` +
        `🌐 الحساب: ${member.accountLink}`,
        { parse_mode: "Markdown" }
      );
      await bot.telegram.sendPhoto(-1002547447878, fileId, {
        caption: `📸 سكرين شوت الحساب - ID: ${telegramId}\n\nللموافقة: /approve_${telegramId}\nللرفض: /reject_${telegramId}`,
      });
    } catch (e) {
      console.log("Could not send to approval group:", e);
    }

    await ctx.reply(
      `🎉 شكراً! تم إرسال طلبك للمراجعة.\n\n⏳ سيتم الرد عليك خلال وقت قصير بعد مراجعة حسابك من قِبل الإدارة.`
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

        try {
          await bot.telegram.sendMessage(
            -1001956258658,
            `✅ *إكمال مهمة*\n\n` +
            `👤 ${member.firstName || ""} @${member.username || member.telegramId}\n` +
            `🔗 الرابط: ${pendingTask.postLink}\n` +
            `💰 الأجر: ${pendingTask.price} دينار\n\n` +
            `للموافقة: /pay_${existingSub.id}\nللرفض: /rejectpay_${existingSub.id}`,
            { parse_mode: "Markdown" }
          );
          if (existingSub.workScreenshotFileId) {
            await bot.telegram.sendPhoto(-1001956258658, existingSub.workScreenshotFileId, { caption: "سكرين العمل" });
          }
          await bot.telegram.sendPhoto(-1001956258658, fileId, { caption: "سكرين الحساب" });
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

  await storage.updateMember(telegramId, { registrationStep: 10 });
  await ctx.reply(
    `✅ ممتاز! لإثبات إنجاز المهمة:\n\n` +
    `📸 أرسل أولاً سكرين شوت من العمل الذي قمت به (التعليق أو اللايك أو الستوري).`
  );
});

async function approveViaBot(telegramId: string, approverCtx: any) {
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
  const priceText = task.price === 1000 ? "1000 دينار (كل المهام)" : "500 دينار (مهام جزئية)";

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
        ...Markup.inlineKeyboard([
          [Markup.button.callback("✅ تم إكمال المهام", `complete_task_${taskId}`)]
        ])
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
  return approveViaBot(telegramId, null);
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

export function startBot() {
  bot.launch().then(() => {
    console.log("Telegram bot started successfully");
  }).catch((err) => {
    console.error("Bot launch error:", err.message);
  });

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
