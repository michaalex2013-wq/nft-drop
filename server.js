const express = require('express');
const mongoose = require('mongoose');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
const mongoUri = process.env.MONGO_URI;
if (mongoUri) {
  mongoose.connect(mongoUri)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB Error:', err));
}

// Database Schemas
const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  username: { type: String, default: 'Игрок' },
  stars: { type: Number, default: 150 },
  tonBalance: { type: Number, default: 0 },
  role: { type: String, default: 'Игрок' }, // Тестер, Спонсор, Админ, Владелец
  inventory: { type: Array, default: [] },
  lastBonus: { type: Date, default: null }
});
const User = mongoose.model('User', userSchema);

const marketSchema = new mongoose.Schema({
  sellerId: Number,
  sellerName: String,
  item: String,
  priceTon: Number,
  createdAt: { type: Date, default: Date.now }
});
const MarketItem = mongoose.model('MarketItem', marketSchema);

// REST API
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

app.get('/api/leaderboard', async (req, res) => {
  try {
    const top = await User.find().sort({ stars: -1 }).limit(10);
    res.json(top);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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

app.get('/api/market', async (req, res) => {
  try {
    const items = await MarketItem.find().sort({ createdAt: -1 });
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Telegram Bot Integration
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
      `💎 **NFT Drop Roulette & Fragment Market**\n\nПривет, ${ctx.from.first_name}! Твой стартовый баланс: **150 ⭐**`,
      {
        parse_mode: 'Markdown',
        ...Markup.keyboard([
          [Markup.button.webApp('🚀 Открыть NFT Drop WebApp', getAppUrl())],
          ['🔑 Авторизация Админ / Спонсор']
        ]).resize()
      }
    );
  });

  // Авторизация Спонсора
  bot.hears('/auth Guy67pidoras', async (ctx) => {
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { role: 'Спонсор' });
    ctx.reply('💼 **Вы вошли как СПОНСОР!**', {
      parse_mode: 'Markdown',
      ...Markup.keyboard([
        ['🎁 Выдать +500 ⭐', '🏷️ Назначить Метку'],
        ['🚀 Открыть NFT Drop WebApp']
      ]).resize()
    });
  });

  // Авторизация Создателя
  bot.hears('/auth 3861!+*@^Shwkw18#', async (ctx) => {
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { role: 'Владелец' });
    ctx.reply('👑 **Вы вошли как СОЗДАТЕЛЬ (FULL ADMIN)!**', {
      parse_mode: 'Markdown',
      ...Markup.keyboard([
        ['👥 Всего пользователей', '🟢 Статус сервера'],
        ['🎁 Выдать +1000 ⭐', '🔄 Глобальный Вайп'],
        ['🚀 Открыть NFT Drop WebApp']
      ]).resize()
    });
  });

  bot.hears('👥 Всего пользователей', async (ctx) => {
    const count = await User.countDocuments();
    ctx.reply(`📊 Всего игроков в базе данных: ${count}`);
  });

  bot.hears('🟢 Статус сервера', (ctx) => {
    ctx.reply('🟢 Сервер и система работае 24/7.');
  });

  bot.hears('🎁 Выдать +500 ⭐', async (ctx) => {
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { stars: 500 } });
    ctx.reply('🎁 Вам начислено +500 ⭐!');
  });

  bot.hears('🎁 Выдать +1000 ⭐', async (ctx) => {
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { stars: 1000 } });
    ctx.reply('🎁 Вам начислено +1000 ⭐!');
  });

  bot.hears('🔄 Глобальный Вайп', async (ctx) => {
    await User.updateMany({}, { stars: 150, inventory: [] });
    ctx.reply('⚠️ Вайп выполнен! Все балансы сброшены.');
  });

  bot.hears('🔑 Авторизация Админ / Спонсор', (ctx) => {
    ctx.reply('Введите пароль командой:\n`/auth пароль`', { parse_mode: 'Markdown' });
  });

  bot.launch().then(() => console.log('Bot running')).catch(console.error);

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

app.listen(PORT, () => console.log(`Server on port ${PORT}`));
