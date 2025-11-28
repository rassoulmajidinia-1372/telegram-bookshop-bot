const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();
// 🚀 وارد کردن کتابخانه‌های لازم
const OpenAI = require("openai"); 
const fs = require('fs');
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
const USERS_FILE = path.join(__dirname, 'users.json'); // 👈 فایل جدید برای ذخیره کاربران

// 🔄 متغیرهای اصلی ربات
let waiting = {}; // حالت انتظار برای گام به گام یا فرمان‌های ادمین
let forwardedMessagesMap = {}; // نگاشت پیام‌های ادمین به پیام‌های کاربر
let BESTSELLER_BOOKS = []; 
let CHAT_USERS = []; // 👈 لیست کاربران برای Broadcast

console.log("Bot running...");

// ----------------------------------------------------
// 💾 توابع مدیریت فایل‌ها و پایداری داده
// ----------------------------------------------------

// 1. ذخیره پرفروش‌ها
function saveBestsellersToFile(books) {
    try {
        fs.writeFileSync(BESTSELLERS_FILE, JSON.stringify(books, null, 2), 'utf8');
        BESTSELLER_BOOKS = books; 
        return true;
    } catch (error) {
        console.error("Error saving bestsellers to file:", error);
        return false;
    }
}

// 2. بارگذاری پرفروش‌ها
function loadBestsellersFromFile() {
    try {
        if (fs.existsSync(BESTSELLERS_FILE)) {
            const data = fs.readFileSync(BESTSELLERS_FILE, 'utf8');
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
    // داده‌های پیش‌فرض در صورت خطا یا عدم وجود فایل
    BESTSELLER_BOOKS = [
        { title: "۱. کیمیاگر", author: "پائولو کوئلیو", id: "book_1" },
        { title: "۲. ملت عشق", author: "الیف شافاک", id: "book_2" },
        { title: "۳. چهار اثر", author: "فلورانس اسکاول شین", id: "book_3" },
    ];
    saveBestsellersToFile(BESTSELLER_BOOKS); 
}

// 3. ذخیره کاربران
function saveUsersToFile() {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(CHAT_USERS, null, 2), 'utf8');
    } catch (error) {
        console.error("Error saving users list:", error);
    }
}

// 4. بارگذاری کاربران
function loadUsersFromFile() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            const data = fs.readFileSync(USERS_FILE, 'utf8');
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
    saveUsersToFile();
}

// 5. افزودن کاربر جدید (اگر قبلاً وجود نداشت)
function addUser(chatId) {
    const id = chatId.toString(); 
    if (!CHAT_USERS.includes(id)) {
        CHAT_USERS.push(id);
        saveUsersToFile();
    }
}

// 📞 بارگذاری داده‌ها هنگام شروع ربات
loadBestsellersFromFile();
loadUsersFromFile(); 


// ----------------------------------------------------
// 💡 تابع ارتباط با ChatGPT 
// ----------------------------------------------------
async function getBookRecommendation(query) {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "شما یک کتابفروش آگاه و خونگرم به نام بوف بوک هستید که به کاربران در انتخاب کتاب کمک می‌کنید. پاسخ شما باید کاملاً به زبان فارسی باشد. یک پیشنهاد جذاب، مرتبط و تخصصی بر اساس ژانر یا موضوع درخواستی بدهید.",
                },
                {
                    role: "user",
                    content: query, 
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
// 🌟 تابع ساخت منوی Inline برای پرفروش‌ها 
// ----------------------------------------------------
function getBestsellersList() {
    let messageText = "🏆 **جدیدترین پرفروش‌های بوف بوک:**\n\n";
    const inlineKeyboard = [];

    BESTSELLER_BOOKS.forEach((book, index) => {
        messageText += `🔹 **${book.title}** - ${book.author || 'ناشناس'}\n`;
        inlineKeyboard.push([
            { text: `✨ اطلاعات بیشتر درباره ${book.title}`, callback_data: `info_book_${index}` },
        ]);
    });
    
    inlineKeyboard.push([
        { text: "✅ تمام شد / بازگشت به منو", callback_data: 'done_bestsellers' }
    ]);

    return {
        text: messageText,
        options: {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: inlineKeyboard
            }
        }
    };
}


// ----------------------------------------------------
// --- منطق اصلی پیام‌ها (bot.on('message')) ---
// ----------------------------------------------------

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();
  
  // 1. 🛑 منطق پاسخگویی ادمین (اصلاح شده)
  if (chatId.toString() === ADMIN_ID.toString() && msg.reply_to_message) {
    const repliedMessageId = msg.reply_to_message.message_id;
    const mapData = forwardedMessagesMap[repliedMessageId];

    if (mapData) {
      const originalUserChatId = mapData.chatId;
      const originalUserMessageId = mapData.messageId;
      const replyText = text;

      // ارسال پاسخ با ریپلای به پیام اصلی کاربر
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

    if (saveBestsellersToFile(newBooks)) {
        return bot.sendMessage(chatId, `✅ لیست پرفروش‌ها با موفقیت به‌روزرسانی شد. (${newBooks.length} کتاب)`);
    } else {
        return bot.sendMessage(chatId, "❌ خطایی در ذخیره‌سازی لیست جدید رخ داد.");
    }
  }

  // 3. 📢 جدید: منطق Broadcast (ارسال پیام به همه)
  if (waiting[chatId] === 'broadcast_message') {
    if (chatId.toString() !== ADMIN_ID.toString()) return;
    
    waiting[chatId] = null; 
    
    const messageToSend = text;
    let successCount = 0;
    let blockedCount = 0;

    await bot.sendMessage(ADMIN_ID, `⏳ عملیات ارسال به ${CHAT_USERS.length} کاربر شروع شد...`);

    // حلقه ارسال پیام به تمام کاربران ذخیره شده
    for (const userId of CHAT_USERS) {
        try {
            await bot.sendMessage(userId, messageToSend);
            successCount++;
        } catch (error) {
            if (error.response && error.response.statusCode === 403) {
                blockedCount++;
            } else {
                console.error(`Error sending broadcast to ${userId}:`, error.message);
            }
        }
    }

    return bot.sendMessage(
        ADMIN_ID, 
        `✅ عملیات Broadcast به پایان رسید:
        
        تعداد کل کاربران: ${CHAT_USERS.length}
        ارسال موفق: ${successCount}
        مسدود شده یا خطا: ${blockedCount}`
    );
  }
  
  // 4. 🧠 منطق معرفی کتاب (گام به گام) 
  
  // 🚀 گام دوم - ارسال به ChatGPT
  if (waiting[chatId] && typeof waiting[chatId] === 'object' && waiting[chatId].state === 'book_search_step2') {
    const previousBook = waiting[chatId].data.previous_book;
    waiting[chatId] = null; 
    
    const fullQuery = `کاربر قبلاً این کتاب را دوست داشته یا خوانده است: ${previousBook}. حالا او به دنبال این موضوع یا ژانر است: ${text}. بر اساس این اطلاعات، یک کتاب دقیق و جذاب پیشنهاد بده.`;

    const processingMessage = await bot.sendMessage(chatId, "⏳ بسیار عالی! در حال جستجوی تخصصی کتاب برای شما هستم. لطفاً صبر کنید."); 

    const gptResponse = await getBookRecommendation(fullQuery);

    await bot.deleteMessage(chatId, processingMessage.message_id).catch(() => {}); 
    await bot.sendMessage(chatId, gptResponse);

    return;
  }
  
  // 🚀 گام اول - پرسش سوال راهنما
  if (waiting[chatId] === 'book_search_step1') {
    const userStep1Response = text;
    waiting[chatId] = {
        state: 'book_search_step2',
        data: { previous_book: userStep1Response }
    }; 
    
    return bot.sendMessage(chatId, "بسیار خب. حالا نام ژانر، نویسنده یا موضوعی که مد نظرتون هست رو برام بفرستید (مثلاً علمی-تخیلی، یا کتاب‌های تاریخی).");
  }


  // 5. 📦 پیگیری سفارش
  if (waiting[chatId] === 'order_tracking') { 
    waiting[chatId] = null; 

    const sentMessage = await bot.sendMessage(
      ADMIN_ID,
      `📦 اطلاعات پیگیری سفارش:
      
👤 ${msg.from.first_name || ""} ${msg.from.last_name || ""}
🆔 ${msg.from.id}
📱 @${msg.from.username || "ندارد"}
📝 پیام: ${text}`
    );

    // ذخیره شناسه چت و شناسه پیام کاربر برای ریپلای
    forwardedMessagesMap[sentMessage.message_id] = { 
        chatId: chatId, 
        messageId: msg.message_id 
    };

    return bot.sendMessage(
      chatId,
      "پیام‌تون دریافت شد. تا چند ساعت آینده شما رو از وضعیت سفارش‌تون مطلع می‌کنیم. ❤️"
    );
  }

  // 6. /start
  if (text === "/start") {
    waiting[chatId] = null;
    return bot.sendMessage(
      chatId,
      "سلام! به ربات بوف بوک خوش اومدی. یکی از گزینه‌ها رو انتخاب کن:",
      { reply_markup: { keyboard: MAIN_BUTTONS, resize_keyboard: true } }
    );
  }
  
  // 7. 🛠️ فرمان‌های ادمین
  
  // 📢 فرمان شروع Broadcast
  if (text === "/broadcast") {
      if (chatId.toString() !== ADMIN_ID.toString()) {
          return bot.sendMessage(chatId, "شما اجازه استفاده از این فرمان را ندارید.");
      }
      waiting[chatId] = 'broadcast_message';
      return bot.sendMessage(
          chatId, 
          "لطفاً **پیام تبلیغاتی** خود را که می‌خواهید برای همه کاربران ارسال شود، بفرستید. (فقط پیام متنی)."
      );
  }

  // 🔒 فرمان به‌روزرسانی لیست پرفروش‌ها
  if (text === "/setbestsellers") {
      if (chatId.toString() !== ADMIN_ID.toString()) {
          return bot.sendMessage(chatId, "شما اجازه استفاده از این فرمان را ندارید.");
      }
      waiting[chatId] = 'set_bestsellers';
      return bot.sendMessage(
          chatId, 
          "لطفاً نام کتاب‌های پرفروش جدید را ارسال کنید. هر کتاب را در یک خط جدید و ترجیحاً با فرمت **عنوان - نویسنده** وارد کنید."
      );
  }

  // 8. دکمه‌ها
  
  // 📚 دکمه معرفی کتاب 
  if (text === "📚 معرفی کتاب") {
    waiting[chatId] = 'book_search_step1'; 
    return bot.sendMessage(
      chatId, 
      "سلام. من اینجا برای انتخاب کتاب به شما کمک می‌کنم. ابتدا، برای شروع، بگید که آخرین کتابی که خوندید یا دوست داشتید چی بود؟"
    );
  }
  
  // ⭐ دکمه پرفروش‌ها 
  if (text === "⭐ پرفروش‌ها") {
    const { text: listText, options } = getBestsellersList();
    return bot.sendMessage(chatId, listText, options);
  }

  if (text === "📦 پیگیری سفارش") {
    waiting[chatId] = 'order_tracking'; 
    return bot.sendMessage(
      chatId,
      "نام و نام خانوادگی، شماره موبایل و شماره سفارش ات رو در یک پیام ارسال کن:"
    );
  }

  if (text === "📞 پشتیبانی")
    return bot.sendMessage(chatId, "پشتیبانی: @eilia03");

  // 9. 📩 پیام‌های عادی (فوروارد به ادمین) و ردیابی کاربر
  if (chatId.toString() !== ADMIN_ID.toString()) {
    addUser(chatId); // 👈 ذخیره شناسه چت کاربر

    const sentMessage = await bot.sendMessage(
      ADMIN_ID,
      `📩 پیام جدید (عادی):
      
👤 ${msg.from.first_name || ""} ${msg.from.last_name || ""}
🆔 ${msg.from.id}
📱 @${msg.from.username || "ندارد"}
💬 ${text}`
    );

    // ذخیره شناسه چت و شناسه پیام کاربر برای ریپلای
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
    const message = callbackQuery.message;
    const data = callbackQuery.data; 
    
    await bot.answerCallbackQuery(callbackQuery.id);

    // 1. منطق اطلاعات بیشتر (info_)
    if (data.startsWith('info_book_')) {
        const bookIndex = parseInt(data.split('_')[2]); 
        const book = BESTSELLER_BOOKS[bookIndex];

        if (book) {
            await bot.sendMessage(
                message.chat.id, 
                `📚 اطلاعات کتاب **${book.title}**\n\n نویسنده: ${book.author || 'ناشناس'}\n\nتوضیحات: این بخش در آینده از دیتابیس یا API فراخوانی می‌شود و توضیحات کامل کتاب را نمایش می‌دهد.`, 
                { parse_mode: 'Markdown' }
            );
        } else {
            await bot.sendMessage(message.chat.id, "متأسفانه اطلاعات کتاب مورد نظر پیدا نشد.");
        }
    }
    
    // 2. منطق تمام شد
    if (data === 'done_bestsellers') {
        await bot.editMessageText(
            "لیست پرفروش‌ها مشاهده شد. برای بازگشت به منوی اصلی، /start را بزنید یا یکی از گزینه‌ها را انتخاب کنید.",
            {
                chat_id: message.chat.id,
                message_id: message.message_id
            }
        ).catch(err => {
            console.log("Error editing message:", err.message); 
        });
    }
});