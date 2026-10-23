const express = require('express');
const mongoose = require('mongoose');
const { Telegraf, Markup } = require('telegraf');

const app = express();
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI;
const BOT_TOKEN = process.env.BOT_TOKEN || '8690240997:AAHzj6GXKVLPytwfNpjFqxHK6ho8hWxrVt0';
const ADMIN_PASS = '3861!+*@^Shwkw18#';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB Подключена'))
  .catch(err => console.error('❌ Ошибка БД:', err));

const UserSchema = new mongoose.Schema({
  telegramId: { type: String, unique: true },
  username: String,
  stars: { type: Number, default: 150 },
  ton: { type: Number, default: 0 },
  inventory: Array
});
const User = mongoose.model('User', UserSchema);

// Список кейсов со скриншотов
const CASES = [
  { name: 'Bear', price: 149 },
  { name: 'Play...', price: 199 },
  { name: 'Skull', price: 249 },
  { name: 'Mood', price: 249 },
  { name: 'Miracle (Лимит)', price: 249 },
  { name: 'Lamp', price: 299 },
  { name: 'Perfume', price: 399 },
  { name: 'Lamp (Лимит)', price: 399 },
  { name: 'Lucky (Лимит)', price: 499 },
  { name: 'Pap...', price: 599 },
  { name: 'Bangles', price: 999 },
  { name: 'Pack', price: 999 },
  { name: 'Shadow', price: 999 },
  { name: 'Hero', price: 1499 },
  { name: 'Loot', price: 1999 },
  { name: 'Person...', price: 2999 },
  { name: 'Scooter', price: 4999 },
  { name: 'Inv...', price: 9999 },
  { name: 'Midas Gold', price: 14999 }
];

// Простой HTML веб-интерфейс
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Nft Drop</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-neutral-950 text-white min-h-screen p-4 font-sans">
      <div class="max-w-md mx-auto">
        <header class="flex justify-between items-center py-4 border-b border-neutral-800">
          <h1 class="text-xl font-bold bg-gradient-to-r from-amber-400 to-yellow-600 bg-clip-text text-transparent">NFT DROP</h1>
          <div class="bg-neutral-900 px-3 py-1 rounded-full text-amber-400 font-bold border border-neutral-800">⭐ 150</div>
        </header>
        <h2 class="text-lg font-bold my-4">Кейсы</h2>
        <div class="grid grid-cols-2 gap-3">
          ${CASES.map(c => `
            <div class="bg-neutral-900/80 p-3 rounded-2xl border border-neutral-800 text-center flex flex-col justify-between h-36">
              <div class="text-sm font-semibold truncate">${c.name}</div>
              <div class="text-amber-400 font-extrabold text-sm">⭐ ${c.price}</div>
              <button onclick="alert('Для открытия авторизуйтесь через бота')" class="w-full py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-xs">Открыть</button>
            </div>
          `).join('')}
        </div>
      </div>
    </body>
    </html>
  `);
});

// Telegram Bot
const bot = new Telegraf(BOT_TOKEN);
const admins = new Set();

bot.start(async (ctx) => {
  const id = String(ctx.from.id);
  let user = await User.findOne({ telegramId: id });
  if (!user) {
    user = await User.create({ telegramId: id, username: ctx.from.username || 'User' });
  }
  ctx.reply(`🔥 **Nft drop**\nВаш баланс: ${user.stars} ⭐`, Markup.inlineKeyboard([
    [Markup.button.webApp('🚀 Открыть сайт', process.env.APP_URL || 'https://google.com')],
    [Markup.button.callback('🔐 Админка', 'admin')]
  ]));
});

bot.action('admin', (ctx) => ctx.reply('Введите: `/auth ваш_пароль`'));

bot.command('auth', (ctx) => {
  const pass = ctx.message.text.split(' ')[1];
  if (pass === ADMIN_PASS) {
    admins.add(ctx.from.id);
    ctx.reply('✅ Админ-панель активирована!', Markup.keyboard([
      ['👥 Статистика', '🔄 Провести Вайп']
    ]).resize());
  } else {
    ctx.reply('❌ Неверный пароль');
  }
});

bot.hears('👥 Статистика', async (ctx) => {
  if (!admins.has(ctx.from.id)) return;
  const count = await User.countDocuments();
  ctx.reply(`📊 Всего игроков: ${count}`);
});

bot.hears('🔄 Провести Вайп', async (ctx) => {
  if (!admins.has(ctx.from.id)) return;
  await User.updateMany({}, { $set: { stars: 150, inventory: [] } });
  ctx.reply('⚠️ Вайп балансов успешно проведен!');
});

bot.launch();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));
