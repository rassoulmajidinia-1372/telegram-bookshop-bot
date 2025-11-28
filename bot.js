const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();
// 🚀 وارد کردن کتابخانه OpenAI
const OpenAI = require("openai"); 

// --- تنظیمات توکن‌ها و API Key ---
const token = process.env.BOT_TOKEN;
// 🔑 ساخت شیء OpenAI با استفاده از کلید API در فایل .env
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); 

const bot = new TelegramBot(token, { polling: true });

// ⚠️ این ADMIN_ID باید شناسه چت شخصی شما باشد.
const ADMIN_ID = 5946358093;

const MAIN_BUTTONS = [
  ["📚 معرفی کتاب", "⭐ پرفروش‌ها"], // دکمه معرفی کتاب برای ChatGPT
  ["📦 پیگیری سفارش"],
  ["📞 پشتیبانی"]
];

// 🔄 waiting اکنون می‌تواند حالت‌های 'book_search' و 'order_tracking' را ذخیره کند.
let waiting = {}; 
// 🔑 نگاشت Message ID ادمین به Chat ID کاربر اصلی برای پاسخگویی
let forwardedMessagesMap = {};

console.log("Bot running...");

// ----------------------------------------------------
// 💡 تابع ارتباط با ChatGPT برای جستجوی کتاب
// ----------------------------------------------------
async function getBookRecommendation(query) {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "شما یک کتابفروش آگاه و خونگرم به نام بوف بوک هستید که به کاربران در انتخاب کتاب کمک می‌کنید. پاسخ شما باید کاملاً به زبان فارسی باشد. اگر کاربر یک کتاب مشخص را درخواست کرد، آن را معرفی کنید. اگر کلی پرسید، یک پیشنهاد جذاب بدهید.",
                },
                {
                    role: "user",
                    content: `در مورد این کتاب توضیح بده یا پیشنهاد بده: ${query}`,
                },
            ],
            temperature: 0.7,
        });

        return completion.choices[0].message.content; 
    } catch (error) {
        console.error("خطا در ارتباط با OpenAI:", error);
        return "متأسفانه در حال حاضر نمی‌توانم به سوال شما پاسخ دهم. لطفاً بعداً امتحان کنید. 😔";
    }
}

// ----------------------------------------------------
// --- منطق پیام‌ها ---
// ----------------------------------------------------

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();

  // 1. 🛑 منطق پاسخگویی ادمین 🛑 
  if (chatId === ADMIN_ID && msg.reply_to_message) {
    const repliedMessageId = msg.reply_to_message.message_id;

    if (forwardedMessagesMap[repliedMessageId]) {
      const originalUserChatId = forwardedMessagesMap[repliedMessageId];
      const replyText = text;

      await bot.sendMessage(
        originalUserChatId,
        `📢 پاسخ بوف بوک:
        
${replyText}`,
        { reply_to_message_id: msg.reply_to_message.message_id }
      );

      await bot.sendMessage(
        ADMIN_ID,
        `✅ پیام شما با موفقیت به کاربر ${originalUserChatId} ارسال شد.`
      );

      return;
    }
  }

  // 2. 🧠 منطق معرفی کتاب (حالت انتظار 'book_search') 🧠
  if (waiting[chatId] === 'book_search') {
    waiting[chatId] = null; // خروج از حالت انتظار

    // ⏳ نمایش پیام "در حال جستجو"
    const processingMessage = await bot.sendMessage(chatId, "⏳ در حال جستجوی کتاب... لطفاً صبر کنید."); 

    // 📞 تماس با تابع جستجو
    const gptResponse = await getBookRecommendation(text);

    // 🗑️ حذف پیام "در حال جستجو"
    await bot.deleteMessage(chatId, processingMessage.message_id).catch(() => {}); 

    // 📝 ارسال پاسخ ChatGPT به کاربر
    await bot.sendMessage(chatId, gptResponse);

    return;
  }

  // 3. پیگیری سفارش (حالت انتظار 'order_tracking')
  if (waiting[chatId] === 'order_tracking') { 
    waiting[chatId] = null; // خروج از حالت انتظار

    const sentMessage = await bot.sendMessage(
      ADMIN_ID,
      `📦 اطلاعات پیگیری سفارش:
      
👤 ${msg.from.first_name || ""} ${msg.from.last_name || ""}
🆔 ${msg.from.id}
📱 @${msg.from.username || "ندارد"}
📝 پیام: ${text}`
    );

    forwardedMessagesMap[sentMessage.message_id] = chatId;

    return bot.sendMessage(
      chatId,
      "پیام‌تون دریافت شد. تا چند ساعت آینده شما رو از وضعیت سفارش‌تون مطلع می‌کنیم. ❤️"
    );
  }

  // 4. /start
  if (text === "/start") {
    waiting[chatId] = null; 
    return bot.sendMessage(
      chatId,
      "سلام! به ربات بوف بوک خوش اومدی. یکی از گزینه‌ها رو انتخاب کن:",
      { reply_markup: { keyboard: MAIN_BUTTONS, resize_keyboard: true } }
    );
  }

  // 5. دکمه‌ها
  
  // 📚 دکمه معرفی کتاب (ورود به حالت انتظار)
  if (text === "📚 معرفی کتاب") {
    waiting[chatId] = 'book_search';
    return bot.sendMessage(
      chatId, 
      "سلام. من اینجا برای انتخاب کتاب به شما کمک می‌کنم. کافیه اسم کتابی که دوست داری بخونی رو بنویسی تا در مورد کتاب بهت توضیح بده."
    );
  }

  if (text === "📦 پیگیری سفارش") {
    waiting[chatId] = 'order_tracking'; 
    return bot.sendMessage(
      chatId,
      "نام و نام خانوادگی، شماره موبایل و شماره سفارش ات رو در یک پیام ارسال کن:"
    );
  }

  if (text === "⭐ پرفروش‌ها")
    return bot.sendMessage(chatId, "در حال تهیه لیست...");

  if (text === "📞 پشتیبانی")
    return bot.sendMessage(chatId, "پشتیبانی: @eilia03");

  // 6. پیام‌های عادی (فوروارد به ادمین)
  if (chatId !== ADMIN_ID) {
    const sentMessage = await bot.sendMessage(
      ADMIN_ID,
      `📩 پیام جدید (عادی):
      
👤 ${msg.from.first_name || ""} ${msg.from.last_name || ""}
🆔 ${msg.from.id}
📱 @${msg.from.username || "ندارد"}
💬 ${text}`
    );

    forwardedMessagesMap[sentMessage.message_id] = chatId;

    return bot.sendMessage(chatId, "پیام دریافت شد. پاسخ داده می‌شود. ❤️");
  }

  // 7. جلوگیری از فوروارد شدن پیام‌های ادمین
  if (chatId === ADMIN_ID) {
    return;
  }
});