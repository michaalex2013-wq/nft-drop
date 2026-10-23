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
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB Error:', err));
}

// Схема пользователя
const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  username: { type: String, default: 'Player' },
  stars: { type: Number, default: 150 },
  tonBalance: { type: Number, default: 0 },
  inventory: { type: Array, default: [] },
  lastBonusDate: { type: Date, default: null },
  isAdmin: { type: Boolean, default: false }
});
const User = mongoose.model('User', userSchema);

// API для получения данных юзера
app.get('/api/user/:id', async (req, res) => {
  try {
    let user = await User.findOne({ telegramId: req.params.id });
    if (!user) {
      user = await User.create({ telegramId: req.params.id, stars: 150 });
    }
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// API для открытия кейса
app.post('/api/open-case', async (req, res) => {
  const { telegramId, price, rewardName, rewardIcon } = req.body;
  try {
    let user = await User.findOne({ telegramId });
    if (!user || user.stars < price) {
      return res.status(400).json({ success: false, message: 'Недостаточно звезд!' });
    }
    user.stars -= price;
    user.inventory.unshift({ name: rewardName, icon: rewardIcon, date: new Date() });
    await user.save();
    res.json({ success: true, stars: user.stars, inventory: user.inventory });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// API для бонуса
app.post('/api/bonus', async (req, res) => {
  const { telegramId } = req.body;
  try {
    let user = await User.findOne({ telegramId });
    if (!user) return res.status(404).json({ success: false });
    
    const now = new Date();
    if (user.lastBonusDate && new Date() - new Date(user.lastBonusDate) < 24 * 60 * 60 * 1000) {
      return res.json({ success: false, message: 'Бонус доступен раз в 24 часа!' });
    }

    const reward = Math.floor(Math.random() * 90) + 10;
    user.stars += reward;
    user.lastBonusDate = now;
    await user.save();
    res.json({ success: true, stars: user.stars, reward });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Telegram Bot
const botToken = process.env.BOT_TOKEN;
if (botToken) {
  const bot = new Telegraf(botToken);
  const getAppUrl = () => process.env.RENDER_EXTERNAL_URL || 'https://nft-drop-4d89.onrender.com';

  bot.start(async (ctx) => {
    const id = ctx.from.id;
    let user = await User.findOne({ telegramId: id });
    if (!user) {
      await User.create({ telegramId: id, username: ctx.from.username || 'Player', stars: 150 });
    }
    ctx.reply(
      `💎 **NFT Drop Roulette & Cases**\n\nПривет, ${ctx.from.first_name}! Твой стартовый баланс: **150 ⭐**`,
      {
        parse_mode: 'Markdown',
        ...Markup.keyboard([
          [Markup.button.webApp('🚀 Открыть NFT Drop WebApp', getAppUrl())],
          ['🔑 Вход в Админ-панель']
        ]).resize()
      }
    );
  });

  bot.hears('/auth 3861!+*@^Shwkw18#', async (ctx) => {
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { isAdmin: true });
    ctx.reply('👑 Успешный вход в админ-панель!', Markup.keyboard([
      ['👥 Пользователи', '🟢 Онлайн'],
      ['💰 Выдать Звезды', '🔄 Сброс базы (Вайп)'],
      ['🚀 Открыть NFT Drop WebApp']
    ]).resize());
  });

  bot.hears('👥 Пользователи', async (ctx) => {
    const count = await User.countDocuments();
    ctx.reply(`📊 Всего игроков в базе: ${count}`);
  });

  bot.hears('🟢 Онлайн', (ctx) => {
    ctx.reply('🟢 Сервер работает стабильно 24/7 на Render.');
  });

  bot.hears('💰 Выдать Звезды', async (ctx) => {
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { stars: 1000 } });
    ctx.reply('🎁 Вам начислено +1000 ⭐!');
  });

  bot.hears('🔄 Сброс базы (Вайп)', async (ctx) => {
    await User.updateMany({}, { stars: 150, inventory: [] });
    ctx.reply('⚠️ Вайп выполнен! Балансы сброшены до 150 ⭐.');
  });

  bot.hears('🔑 Вход в Админ-панель', (ctx) => {
    ctx.reply('Введите пароль администратора: `/auth 3861!+*@^Shwkw18#`', { parse_mode: 'Markdown' });
  });

  bot.launch().then(() => console.log('Bot started'));
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
