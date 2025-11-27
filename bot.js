const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config(); // اضافه شده برای خواندن .env

const token = process.env.BOT_TOKEN;

const bot = new TelegramBot(token, { polling: true });

const ADMIN_ID = 5946358093;

const MAIN_BUTTONS = [
  ["🔍 جستجوی کتاب", "⭐ پرفروش‌ها"],
  ["📦 پیگیری سفارش"],
  ["📞 پشتیبانی"]
];

let waiting = {};

console.log("Bot running...");

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();

  // پیگیری سفارش
  if (waiting[chatId]) {
    waiting[chatId] = false;

    await bot.sendMessage(
      ADMIN_ID,
      `📦 اطلاعات پیگیری سفارش:

👤 ${msg.from.first_name || ""} ${msg.from.last_name || ""}
🆔 ${msg.from.id}
📱 @${msg.from.username || "ندارد"}
📝 پیام: ${text}`
    );

    return bot.sendMessage(
      chatId,
      "پیام‌تون دریافت شد. تا چند ساعت آینده شما رو از وضعیت سفارش‌تون مطلع می‌کنیم. ❤️"
    );
  }

  // /start
  if (text === "/start") {
    waiting[chatId] = false;
    return bot.sendMessage(
      chatId,
      "سلام! به ربات بوف بوک خوش اومدی. یکی از گزینه‌ها رو انتخاب کن:",
      { reply_markup: { keyboard: MAIN_BUTTONS, resize_keyboard: true } }
    );
  }

  // دکمه‌ها
  if (text === "📦 پیگیری سفارش") {
    waiting[chatId] = true;
    return bot.sendMessage(
      chatId,
      "نام و نام خانوادگی، شماره موبایل و شماره سفارش ات رو در یک پیام ارسال کن:"
    );
  }

  if (text === "🔍 جستجوی کتاب")
    return bot.sendMessage(chatId, "نام کتاب را بفرستید.");

  if (text === "⭐ پرفروش‌ها")
    return bot.sendMessage(chatId, "در حال تهیه لیست...");

  if (text === "📞 پشتیبانی")
    return bot.sendMessage(chatId, "پشتیبانی: @eilia03");

  // پیام‌های عادی
  if (chatId !== ADMIN_ID) {
    await bot.sendMessage(
      ADMIN_ID,
      `📩 پیام جدید:

👤 ${msg.from.first_name || ""} ${msg.from.last_name || ""}
🆔 ${msg.from.id}
📱 @${msg.from.username || "ندارد"}
💬 ${text}`
    );

    return bot.sendMessage(chatId, "پیام دریافت شد. پاسخ داده می‌شود. ❤️");
  }
});
