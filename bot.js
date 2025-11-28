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

// 🆕 تغییر در ساختار دکمه‌های اصلی
const MAIN_BUTTONS = [
  ["📚 معرفی کتاب", "⭐ پرفروش‌ها"], 
  ["📦 پیگیری سفارش", "📞 پشتیبانی"],
  ["📢 کانال بوف‌بوک"] // 👈 اضافه شدن دکمه کانال
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
        await fs.writeFile(BESTSELLERS_FILE, JSON.stringify(books, null, 2), 'utf8');
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
            const data = await fs.readFile(BESTSELLERS_FILE, 'utf8');
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
        { title: "۱. کیمیاگر", author: "پائولو کوئلیو", description: "داستان سفر چوپانی جوان به سوی گنج، رمانی درباره ایمان به خود و پیگیری رؤیاها.", id: "book_1" },
        { title: "۲. ملت عشق", author: "الیف شافاک", description: "روایتی موازی از زندگی یک زن خانه‌دار در قرن ۲۱ و شمس تبریزی در قرن ۱۳، با محوریت عشق و عرفان.", id: "book_2" },
        { title: "۳. چهار اثر", author: "فلورانس اسکاول شین", description: "کتابی در مورد قدرت کلام و نیروی اندیشه که راه دستیابی به آرزوها را نشان می‌دهد.", id: "book_3" },
    ];
    await saveBestsellersToFile(BESTSELLER_BOOKS); 
}

// 3. ذخیره کاربران (نامتقارن)
async function saveUsersToFile() {
    try {
        await fs.writeFile(USERS_FILE, JSON.stringify(CHAT_USERS, null, 2), 'utf8');
    } catch (error) {
        console.error("Error saving users list:", error);
    }
}

// 4. بارگذاری کاربران (نامتقارن)
async function loadUsersFromFile() {
    try {
        if (await fs.access(USERS_FILE).then(() => true).catch(() => false)) {
            const data = await fs.readFile(USERS_FILE, 'utf8');
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
// 💡 تابع ارتباط با ChatGPT (موقت غیرفعال شده برای رفع خطای سهمیه)
// ----------------------------------------------------
// 🚨 بنا به درخواست کاربر، این قابلیت موقتاً غیرفعال شده تا خطای سهمیه OpenAI برطرف شود.
async function getBookRecommendation(query) {
    // ⚠️ پیام موقت برای کاربر
    return "متأسفانه در حال حاضر به دلیل مشکل سهمیه API، قابلیت معرفی کتاب موقتاً غیرفعال است. لطفاً بعداً دوباره امتحان کنید. 😔";
    
    /* کدهای اصلی تماس با OpenAI در اینجا قرار داشتند:
    try {
        const completion = await openai.chat.completions.create({...
        return completion.choices[0].message.content; 
    } catch (error) {
        console.error("خطا در ارتباط با OpenAI:", error);
        return "متأسفانه در حال حاضر نمی‌توانم به سوال شما پاسخ دهم. 😔";
    }
    */
}

// ----------------------------------------------------
// --- منطق اصلی پیام‌ها (bot.on('message')) ---
// ----------------------------------------------------

// 🆕 کیبورد بازگشت به منو (Inline Keyboard)
const BACK_TO_MENU_KEYBOARD = {
    reply_markup: {
        inline_keyboard: [
            [{ text: "🏠 بازگشت به منوی اصلی", callback_data: "back_to_menu" }]
        ]
    }
};

bot.on("message", async (msg) => {
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
        // 🆕 انتظار برای فرمت: عنوان - نویسنده - توضیح مختصر
        const parts = line.split('-').map(p => p.trim());
        const title = parts[0] || `کتاب ${index + 1}`;
        const author = parts.length > 1 ? parts[1] : 'ناشناس';
        const description = parts.length > 2 ? parts.slice(2).join('-').trim() : 'توضیحات موجود نیست.'; // 👈 استخراج توضیح

        return { title, author, description, id: `book_${index}` }; // 👈 اضافه شدن description
    });

    if (await saveBestsellersToFile(newBooks)) { // 👈 استفاده از await
        return bot.sendMessage(chatId, `✅ لیست پرفروش‌ها با موفقیت به‌روزرسانی شد. (${newBooks.length} کتاب)`);
    } else {
        return bot.sendMessage(chatId, "❌ خطایی در ذخیره‌سازی لیست جدید رخ داد.");
    }
  }

  // 3. 📢 منطق Broadcast (ارسال پیام به همه)
  if (waiting[chatId] === 'broadcast_message') {
    if (chatId.toString() !== ADMIN_ID.toString()) return;

    waiting[chatId] = null;
    let successCount = 0;
    
    // کپی از لیست کاربران برای جلوگیری از تغییر در حین ارسال
    const usersToSendTo = [...CHAT_USERS];

    for (const targetId of usersToSendTo) {
        try {
            // اطمینان از عدم ارسال به خود ادمین
            if (targetId !== ADMIN_ID.toString()) {
                await bot.sendMessage(targetId, text);
                successCount++;
            }
        } catch (error) {
            console.error(`Error sending message to ${targetId}:`, error.message);
            // در صورت بلاک شدن، کاربر از لیست حذف می‌شود (در آینده)
        }
    }

    return bot.sendMessage(
        ADMIN_ID, 
        `✅ عملیات Broadcast به پایان رسید. ${successCount} پیام با موفقیت ارسال شد.`
    );
  }
  
  // 4. 🧠 منطق معرفی کتاب (گام به گام) 
  
  // 🚀 گام دوم - ارسال به ChatGPT
  if (waiting[chatId] && typeof waiting[chatId] === 'object' && waiting[chatId].state === 'book_search_step2') {
    waiting[chatId] = null;
    await bot.sendChatAction(chatId, 'typing');
    
    // ⚠️ تابع getBookRecommendation اکنون فقط پیام خطا می‌دهد (موقت غیرفعال شده است)
    const recommendation = await getBookRecommendation(text); 
    
    await bot.sendMessage(chatId, recommendation, BACK_TO_MENU_KEYBOARD); // 👈 اضافه شدن بازگشت به منو
    return;
  }
  
  // 🚀 گام اول - پرسش سوال راهنما
  if (waiting[chatId] === 'book_search_step1') {
    waiting[chatId] = { state: 'book_search_step2' };
    return bot.sendMessage(chatId, "لطفاً ژانر، علاقه‌مندی‌ها یا عنوان کتاب مدنظرتان را برای من بنویسید تا بتوانم کتاب مناسبی معرفی کنم:", BACK_TO_MENU_KEYBOARD);
  }


  // 5. 📦 پیگیری سفارش
  if (waiting[chatId] === 'order_tracking') { 
    waiting[chatId] = null;
    return bot.sendMessage(chatId, "✅ درخواست پیگیری سفارش شما دریافت شد. در اسرع وقت پاسخ داده خواهد شد.", BACK_TO_MENU_KEYBOARD);
  }

  // 6. /start
  if (text === "/start") {
    waiting[chatId] = null; 
    await addUser(chatId); 

    const welcomeMessage = `سلام ${msg.from.first_name || ""}! به ربات کتابفروشی بوف خوش آمدید.
از طریق دکمه‌های زیر می‌توانید با منوی اصلی تعامل کنید.`;

    return bot.sendMessage(chatId, welcomeMessage, {
      reply_markup: {
        keyboard: MAIN_BUTTONS, // 👈 استفاده از MAIN_BUTTONS جدید
        resize_keyboard: true,
      },
    });
  }
  
  // 7. 🛠️ فرمان‌های ادمین
  if (text === "/setbestsellers" && chatId.toString() === ADMIN_ID.toString()) {
    waiting[chatId] = 'set_bestsellers';
    return bot.sendMessage(chatId, `لطفاً لیست پرفروش‌های جدید را به صورت زیر و در خطوط جداگانه ارسال کنید:
    
**مثال:**
عنوان کتاب - نویسنده - توضیح مختصر در مورد کتاب
رمان - نویسنده - یک توضیح دیگر
    
(هرگونه متن اضافی بعد از نویسنده، به عنوان توضیحات مختصر ذخیره می‌شود.)`);
  }
  
  if (text === "/broadcast" && chatId.toString() === ADMIN_ID.toString()) {
    waiting[chatId] = 'broadcast_message';
    return bot.sendMessage(chatId, `لطفاً پیام تبلیغاتی خود را برای ${CHAT_USERS.length} کاربر ارسال کنید:`);
  }

  // 8. دکمه‌ها
  // 8.1 📚 معرفی کتاب
  if (text === "📚 معرفی کتاب") {
    waiting[chatId] = 'book_search_step1';
    return bot.sendMessage(chatId, "لطفاً برای معرفی کتاب، درخواست خود را ارسال کنید.", BACK_TO_MENU_KEYBOARD);
  }

  // 8.2 ⭐ پرفروش‌ها (با دکمه‌های شیشه‌ای برای توضیحات)
  if (text === "⭐ پرفروش‌ها") {
    waiting[chatId] = null;
    if (BESTSELLER_BOOKS.length === 0) {
        return bot.sendMessage(chatId, "⚠️ در حال حاضر لیست پرفروش‌ها خالی است.", BACK_TO_MENU_KEYBOARD);
    }
    
    let messageText = "🏆 **لیست پرفروش‌ترین کتاب‌ها:**\n\n";
    let inlineKeyboard = [];

    BESTSELLER_BOOKS.forEach((book, index) => {
        messageText += `${index + 1}. **${book.title}** اثر ${book.author}\n`;
        // 🆕 ساخت دکمه شیشه‌ای برای دیدن توضیحات
        inlineKeyboard.push([
            { text: `📖 توضیحات ${book.title}`, callback_data: `book_desc_${book.id}` }
        ]);
    });
    
    // 🆕 اضافه شدن دکمه بازگشت به منو به صورت شیشه‌ای
    inlineKeyboard.push([{ text: "🏠 بازگشت به منوی اصلی", callback_data: "back_to_menu" }]);

    return bot.sendMessage(chatId, messageText, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: inlineKeyboard
        }
    });
  }
  
  // 8.3 📦 پیگیری سفارش
  if (text === "📦 پیگیری سفارش") {
    waiting[chatId] = 'order_tracking';
    return bot.sendMessage(chatId, "لطفاً کد پیگیری سفارش خود را ارسال کنید.", BACK_TO_MENU_KEYBOARD);
  }
  
  // 8.4 📞 پشتیبانی
  if (text === "📞 پشتیبانی") {
    waiting[chatId] = null;
    return bot.sendMessage(chatId, "برای ارتباط با بخش پشتیبانی، لطفاً سؤال یا پیام خود را ارسال کنید.", BACK_TO_MENU_KEYBOARD);
  }
  
  // 8.5 📢 کانال بوف‌بوک
  if (text === "📢 کانال بوف‌بوک") {
    waiting[chatId] = null;
    return bot.sendMessage(chatId, "برای مشاهده کانال رسمی بوف‌بوک، روی دکمه زیر کلیک کنید:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "لینک به کانال 📢", url: "https://t.me/boofbook_official" }],
          [{ text: "🏠 بازگشت به منوی اصلی", callback_data: "back_to_menu" }] // 👈 اضافه شدن بازگشت به منو
        ]
      }
    });
  }


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
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const messageId = callbackQuery.message.message_id;

    await bot.answerCallbackQuery(callbackQuery.id); // 👈 بستن اعلان

    // 1. 🆕 نمایش توضیحات کتاب
    if (data.startsWith('book_desc_')) {
        const bookId = data.replace('book_desc_', '');
        const book = BESTSELLER_BOOKS.find(b => b.id === bookId);

        if (book) {
            const descriptionMessage = `**📘 ${book.title}**
            
**🖋️ نویسنده:** ${book.author}
**📝 توضیحات:** ${book.description || 'توضیحات مختصر موجود نیست.'}`;

            // ویرایش پیام قبلی به جای ارسال پیام جدید
            await bot.editMessageText(descriptionMessage, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "📚 بازگشت به لیست پرفروش‌ها", callback_data: "show_bestsellers" }],
                        [{ text: "🏠 بازگشت به منوی اصلی", callback_data: "back_to_menu" }]
                    ]
                }
            });
        }
    }
    
    // 2. 🆕 بازگشت به لیست پرفروش‌ها (پس از نمایش توضیحات)
    if (data === 'show_bestsellers') {
        let messageText = "🏆 **لیست پرفروش‌ترین کتاب‌ها:**\n\n";
        let inlineKeyboard = [];

        BESTSELLER_BOOKS.forEach((book, index) => {
            messageText += `${index + 1}. **${book.title}** اثر ${book.author}\n`;
            inlineKeyboard.push([
                { text: `📖 توضیحات ${book.title}`, callback_data: `book_desc_${book.id}` }
            ]);
        });
        
        inlineKeyboard.push([{ text: "🏠 بازگشت به منوی اصلی", callback_data: "back_to_menu" }]);

        await bot.editMessageText(messageText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: inlineKeyboard
            }
        });
    }

    // 3. 🆕 بازگشت به منوی اصلی (Back to Main Menu)
    if (data === 'back_to_menu') {
        waiting[chatId] = null;
        
        // ارسال کیبورد اصلی (Reply Keyboard)
        await bot.sendMessage(chatId, "به منوی اصلی بازگشتید. لطفاً عملیات مورد نظر خود را انتخاب کنید.", {
            reply_markup: {
                keyboard: MAIN_BUTTONS,
                resize_keyboard: true,
            },
        });
        
        // حذف پیام قبلی (شیشه‌ای) برای تمیزکاری
        // در صورت عدم موفقیت، صرفاً خطا نادیده گرفته می‌شود.
        await bot.deleteMessage(chatId, messageId).catch(() => {});
    }
});