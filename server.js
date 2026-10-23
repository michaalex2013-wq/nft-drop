const express = require('express');
const mongoose = require('mongoose');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Подключение к MongoDB
const mongoUri = process.env.MONGO_URI;
if (mongoUri) {
  mongoose.connect(mongoUri)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));
}

// Схема пользователя
const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  username: String,
  stars: { type: Number, default: 100 },
  inventory: Array,
  history: Array
});
const User = mongoose.model('User', userSchema);

// Инициализация Telegram-бота
const botToken = process.env.BOT_TOKEN;
if (botToken) {
  const bot = new Telegraf(botToken);

  bot.start(async (ctx) => {
    try {
      const id = ctx.from.id;
      let user = await User.findOne({ telegramId: id });
      if (!user) {
        user = await User.create({
          telegramId: id,
          username: ctx.from.username || 'User'
        });
      }
      ctx.reply(
        `Привет, ${ctx.from.first_name}! Добро пожаловать в NFT Drop Roulette 🎰\n\nТвой баланс: ${user.stars} ⭐`,
        Markup.inlineKeyboard([
          [Markup.button.webApp('Кейсы и Рулетка 🚀', process.env.RENDER_EXTERNAL_URL || 'https://nft-drop-app.onrender.com')]
        ])
      );
    } catch (e) {
      console.error(e);
      ctx.reply('Ошибка при старте.');
    }
  });

  bot.launch().then(() => {
    console.log('Telegram Bot successfully launched!');
  }).catch(err => {
    console.error('Bot launch error:', err);
  });

  // Безопасное завершение
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

// Простой API маршрут для проверки работы
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Запуск HTTP веб-сервера
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
