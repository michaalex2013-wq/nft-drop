const express = require('express');
const mongoose = require('mongoose');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database Connection
const mongoUri = process.env.MONGO_URI;
if (mongoUri) {
  mongoose.connect(mongoUri)
    .then(() => console.log('[DB] Connected'))
    .catch(err => console.error('[DB] Error:', err));
}

// Schemas
const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  username: { type: String, default: 'Player' },
  stars: { type: Number, default: 150 },
  role: { type: String, default: 'Игрок' },
  inventory: { type: Array, default: [] },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

const marketSchema = new mongoose.Schema({
  sellerName: String,
  itemName: String,
  itemImage: String,
  priceTon: Number,
  createdAt: { type: Date, default: Date.now }
});
const MarketItem = mongoose.model('MarketItem', marketSchema);

// API Endpoints
app.get('/api/user/:id', async (req, res) => {
  try {
    let tid = Number(req.params.id);
    if (!tid || isNaN(tid)) tid = 999999; // Защита от undefined
    let user = await User.findOne({ telegramId: tid });
    if (!user) {
      user = await User.create({ telegramId: tid, username: 'Player_' + tid, stars: 150 });
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
  const { telegramId, price, rewardName, rewardImage } = req.body;
  try {
    let user = await User.findOne({ telegramId });
    if (!user || user.stars < price) {
      return res.status(400).json({ success: false, message: 'Недостаточно звезд!' });
    }
    user.stars -= price;
    user.inventory.unshift({ name: rewardName, image: rewardImage, date: new Date() });
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

app.post('/api/market/add', async (req, res) => {
  const { sellerName, itemName, itemImage, priceTon } = req.body;
  try {
    await MarketItem.create({ sellerName, itemName, itemImage: itemImage || '🖼️', priceTon });
    const items = await MarketItem.find().sort({ createdAt: -1 });
    res.json({ success: true, items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('*', (req, res) => {
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
      `💎 **NFT Drop Service**\n\nПривет, ${ctx.from.first_name}!\nТвой баланс: **150 ⭐**`,
      {
        parse_mode: 'Markdown',
        ...Markup.keyboard([
          [Markup.button.webApp('🚀 Открыть NFT Drop WebApp', getAppUrl())],
          ['🔑 Авторизация (Админ / Спонсор)']
        ]).resize()
      }
    );
  });

  // Панель Спонсора
  bot.hears('/auth Guy67pidoras', async (ctx) => {
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { role: 'Спонсор' });
    ctx.reply('💼 **Панель Спонсора активна!** Доступна выдача звёзд и управление.', {
      parse_mode: 'Markdown',
      ...Markup.keyboard([
        ['🎁 Выдать +500 ⭐', '🚀 Открыть WebApp']
      ]).resize()
    });
  });

  // Панель Создателя
  bot.hears('/auth 3861!+*@^Shwkw18#', async (ctx) => {
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { role: 'Владелец' });
    ctx.reply('👑 **Панель Создателя (FULL ADMIN) активна!**', {
      parse_mode: 'Markdown',
      ...Markup.keyboard([
        ['👥 Пользователи', '🟢 Статус сервера'],
        ['🎁 Выдать +1000 ⭐', '🔄 Глобальный Вайп'],
        ['🚀 Открыть WebApp']
      ]).resize()
    });
  });

  bot.hears('👥 Пользователи', async (ctx) => {
    const count = await User.countDocuments();
    ctx.reply(`📊 Игроков в базе: ${count}`);
  });

  bot.hears('🟢 Статус сервера', async (ctx) => {
    ctx.reply('🟢 Сервер работает 24/7.');
  });

  bot.hears('🎁 Выдать +500 ⭐', async (ctx) => {
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { stars: 500 } });
    ctx.reply('🎁 Начислено +500 ⭐!');
  });

  bot.hears('🎁 Выдать +1000 ⭐', async (ctx) => {
    await User.findOneAndUpdate({ telegramId: ctx.from.id }, { $inc: { stars: 1000 } });
    ctx.reply('🎁 Начислено +1000 ⭐!');
  });

  bot.hears('🔄 Глобальный Вайп', async (ctx) => {
    await User.updateMany({}, { stars: 150, inventory: [] });
    ctx.reply('⚠️ База данных сброшена!');
  });

  bot.hears('🔑 Авторизация (Админ / Спонсор)', (ctx) => {
    ctx.reply('Введите команду авторизации:\n`/auth ваш_пароль`', { parse_mode: 'Markdown' });
  });

  bot.hears('🚀 Открыть WebApp', (ctx) => {
    ctx.reply('Нажмите кнопку ниже:', Markup.keyboard([
      [Markup.button.webApp('🚀 Открыть NFT Drop WebApp', getAppUrl())]
    ]).resize());
  });

  bot.launch().then(() => console.log('Bot started')).catch(console.error);

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

app.listen(PORT, () => console.log(`Server on port ${PORT}`));
