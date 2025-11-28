const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();
// 🚀 وارد کردن کتابخانه‌های لازم
const OpenAI = require("openai"); 
// 💾 استفاده از promises برای عملیات نامتقارن فایل
const fs = require('fs').promises; // 👈 تغییر مهم: استفاده از promises
const path = require('path');

// --- تنظیمات توکن‌ها و API Key ---
const token = process.env.BOT_TOKEN;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); 
const bot = new TelegramBot(token, { polling: true });

// ⚠️ شناسه چت شخصی ادمین
const ADMIN_ID = 5946358093; // 👈 این را با ADMIN_ID واقعی خود جایگزین کنید

const MAIN_BUTTONS = [
  ["📚 معرفی کتاب", "⭐ پرفروش‌ها"], 
  ["📦 پیگیری سفارش"],
  ["📞 پشتیبانی"]
];

// 💾 مسیرهای فایل‌های پایداری داده
const BESTSELLERS_FILE = path.join(__dirname, 'bestsellers.json');
const USERS_FILE = path.join(__dirname, 'users.json'); 

// 🔄 متغیرهای اصلی ربات
let waiting = {}; 
let forwardedMessagesMap = {}; 
let BESTSELLER_BOOKS = []; 
let CHAT_USERS = []; 

console.log("Bot running...");

// ----------------------------------------------------
// 💾 توابع مدیریت فایل‌ها و پایداری داده (نامتقارن)
// ----------------------------------------------------

// 1. ذخیره پرفروش‌ها (نامتقارن)
async function saveBestsellersToFile(books) {
    try {
        await fs.writeFile(BESTSELLERS_FILE, JSON.stringify(books, null, 2), 'utf8'); // 👈 تغییر به fs.writeFile
        BESTSELLER_BOOKS = books; 
        return true;
    } catch (error) {
        console.error("Error saving bestsellers to file:", error);
        return false;
    }
}

// 2. بارگذاری پرفروش‌ها (نامتقارن)
async function loadBestsellersFromFile() {
    try {
        if (await fs.access(BESTSELLERS_FILE).then(() => true).catch(() => false)) {
            const data = await fs.readFile(BESTSELLERS_FILE, 'utf8'); // 👈 تغییر به fs.readFile
            const books = JSON.parse(data);
            if (Array.isArray(books) && books.length > 0) {
                BESTSELLER_BOOKS = books;
                console.log(`Bestsellers list loaded from file. Count: ${books.length}`);
                return;
            }
        }
    } catch (error) {
        console.error("Error loading or parsing bestsellers file:", error);
    }
    // داده‌های پیش‌فرض
    BESTSELLER_BOOKS = [
        { title: "۱. کیمیاگر", author: "پائولو کوئلیو", id: "book_1" },
        { title: "۲. ملت عشق", author: "الیف شافاک", id: "book_2" },
        { title: "۳. چهار اثر", author: "فلورانس اسکاول شین", id: "book_3" },
    ];
    await saveBestsellersToFile(BESTSELLER_BOOKS); 
}

// 3. ذخیره کاربران (نامتقارن)
async function saveUsersToFile() {
    try {
        await fs.writeFile(USERS_FILE, JSON.stringify(CHAT_USERS, null, 2), 'utf8'); // 👈 تغییر به fs.writeFile
    } catch (error) {
        console.error("Error saving users list:", error);
    }
}

// 4. بارگذاری کاربران (نامتقارن)
async function loadUsersFromFile() {
    try {
        if (await fs.access(USERS_FILE).then(() => true).catch(() => false)) {
            const data = await fs.readFile(USERS_FILE, 'utf8'); // 👈 تغییر به fs.readFile
            const users = JSON.parse(data);
            if (Array.isArray(users)) {
                CHAT_USERS = users;
                console.log(`Users list loaded. Total users: ${CHAT_USERS.length}`);
                return;
            }
        }
    } catch (error) {
        console.error("Error loading or parsing users file:", error);
    }
    CHAT_USERS = []; 
    await saveUsersToFile();
}

// 5. افزودن کاربر جدید (باید فراخوانی شود)
async function addUser(chatId) {
    const id = chatId.toString(); 
    if (!CHAT_USERS.includes(id)) {
        CHAT_USERS.push(id);
        await saveUsersToFile(); // 👈 فراخوانی نامتقارن
    }
}

// 📞 اجرای بارگذاری هنگام شروع ربات
(async () => {
    await loadBestsellersFromFile();
    await loadUsersFromFile(); 
})();


// ----------------------------------------------------
// --- منطق اصلی پیام‌ها (bot.on('message')) ---
// ----------------------------------------------------

bot.on("message", async (msg) => { // 👈 تابع اصلی پیام‌ها باید async باشد
  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();
  
  // 1. 🛑 منطق پاسخگویی ادمین (بدون تغییر)
  if (chatId.toString() === ADMIN_ID.toString() && msg.reply_to_message) {
    const repliedMessageId = msg.reply_to_message.message_id;
    const mapData = forwardedMessagesMap[repliedMessageId];

    if (mapData) {
      const originalUserChatId = mapData.chatId;
      const originalUserMessageId = mapData.messageId;
      const replyText = text;

      await bot.sendMessage(
        originalUserChatId,
        `📢 پاسخ بوف بوک:
        
${replyText}`,
        { reply_to_message_id: originalUserMessageId } 
      );

      await bot.sendMessage(
        ADMIN_ID,
        `✅ پیام شما با موفقیت به کاربر ${originalUserChatId} ارسال شد.`
      );
      
      delete forwardedMessagesMap[repliedMessageId];

      return;
    }
  }
  
  // 2. 🛡️ منطق فرمان ادمین: به‌روزرسانی پرفروش‌ها
  if (waiting[chatId] === 'set_bestsellers') {
    if (chatId.toString() !== ADMIN_ID.toString()) return;
    
    waiting[chatId] = null; 
    const bookLines = text.split('\n').filter(line => line.trim() !== '');

    if (bookLines.length < 1) {
        return bot.sendMessage(chatId, "⚠️ باید حداقل یک عنوان کتاب در پیام خود وارد کنید.");
    }

    const newBooks = bookLines.map((line, index) => {
        const parts = line.split('-').map(p => p.trim());
        const title = parts[0] || `کتاب ${index + 1}`;
        const author = parts.length > 1 ? parts[1] : 'ناشناس';

        return { title, author, id: `book_${index}` };
    });

    if (await saveBestsellersToFile(newBooks)) { // 👈 استفاده از await
        return bot.sendMessage(chatId, `✅ لیست پرفروش‌ها با موفقیت به‌روزرسانی شد. (${newBooks.length} کتاب)`);
    } else {
        return bot.sendMessage(chatId, "❌ خطایی در ذخیره‌سازی لیست جدید رخ داد.");
    }
  }

  // 3. 📢 منطق Broadcast (ارسال پیام به همه)
  if (waiting[chatId] === 'broadcast_message') {
    // ... (بدون تغییر) ...
    return;
  }
  
  // 4. 🧠 منطق معرفی کتاب (گام به گام) 
  
  // 🚀 گام دوم - ارسال به ChatGPT
  if (waiting[chatId] && typeof waiting[chatId] === 'object' && waiting[chatId].state === 'book_search_step2') {
    // ... (بدون تغییر) ...
    return;
  }
  
  // 🚀 گام اول - پرسش سوال راهنما
  if (waiting[chatId] === 'book_search_step1') {
    // ... (بدون تغییر) ...
    return;
  }


  // 5. 📦 پیگیری سفارش
  if (waiting[chatId] === 'order_tracking') { 
    // ... (بدون تغییر) ...
    return;
  }

  // 6. /start
  if (text === "/start") {
    // ... (بدون تغییر) ...
    return;
  }
  
  // 7. 🛠️ فرمان‌های ادمین
  // ... (بدون تغییر) ...
  
  // 8. دکمه‌ها
  // ... (بدون تغییر) ...

  // 9. 📩 پیام‌های عادی (فوروارد به ادمین) و ردیابی کاربر
  if (chatId.toString() !== ADMIN_ID.toString()) {
    await addUser(chatId); // 👈 استفاده از await

    const sentMessage = await bot.sendMessage(
      ADMIN_ID,
      `📩 پیام جدید (عادی):
      
👤 ${msg.from.first_name || ""} ${msg.from.last_name || ""}
🆔 ${msg.from.id}
📱 @${msg.from.username || "ندارد"}
💬 ${text}`
    );

    forwardedMessagesMap[sentMessage.message_id] = { 
        chatId: chatId, 
        messageId: msg.message_id 
    };

    return bot.sendMessage(chatId, "پیام دریافت شد. پاسخ داده می‌شود. ❤️");
  }

  // 10. جلوگیری از فوروارد شدن پیام‌های ادمین
  if (chatId.toString() === ADMIN_ID.toString()) {
    return;
  }
});


// ----------------------------------------------------
// 📢 مدیریت کلیک‌های دکمه‌های شیشه‌ای (Inline Buttons) 
// ----------------------------------------------------
bot.on('callback_query', async (callbackQuery) => {
    // ... (بدون تغییر) ...
});