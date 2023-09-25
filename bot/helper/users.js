const { bot } = require('../bot');
const User = require('../../model/user');
const { userKeyboard } = require('../menu/keyboard');
const Product = require('../../model/product');

const getAllUsers = async msg => {
  const chatId = msg.from.id;
  const user = await User.findOne({ chatId }).lean();

  if (user.admin) {
    const users = await User.find().lean();
    let list = '';
    users.forEach(user => {
      list += `${user.name}; ${user.createdAt.toLocaleDateString()}\n`;
    });
    bot.sendMessage(chatId, `Foydalanuvchilar ro'yxati: ${list}`);
  } else {
    bot.sendMessage(chatId, 'Sizga bunday so`rov mumkin emas', {
      reply_markup: {
        keyboard: userKeyboard,
        resize_keyboard: true,
      },
    });
  }
};

const addToCartProd = async (chatId, prodId, quantity) => {
  const product = await Product.findById({ id: prodId }).lean();
  const user = await User.findOne({ chatId }).lean();
  await user.addToCart(prodId, quantity);
  bot.sendPhoto(chatId, product.img, {
    caption: `<b>${product.title}</b>\n📦 💸 Narxi: ${product.price} so'm dan ${quantity} ta.\n🔥 Qisqa ma'lumot:\n${product.text}\n Jami: <b>${quantity} * ${product.price} so'm</b>`,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard,
    },
  });
};

module.exports = {
  getAllUsers,
  addToCartProd,
};
