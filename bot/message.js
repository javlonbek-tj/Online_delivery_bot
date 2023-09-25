const { bot } = require('./bot');
const User = require('../model/user');
const { start, requestContact } = require('./helper/start');
const { getAllUsers } = require('./helper/users');
const { getAllCategories, newCategory, saveCategory } = require('./helper/category');
const { addProductNext } = require('./helper/product');

bot.on('message', async msg => {
  const chatId = msg.from.id;
  const text = msg.text;
  const user = await User.findOne({ chatId }).lean();

  if (text === '/start' || text === '/menu') {
    return start(msg);
  }
  if (user) {
    if (user.action === 'request_contact' && !user.phone) {
      requestContact(msg);
    }
    if (text === 'Foydalanuvchilar') {
      getAllUsers(msg);
      return;
    }
    if (text === 'Katalog') {
      getAllCategories(chatId, 1);
      return;
    }
    if (user.action === 'add_category') {
      newCategory(msg);
    }
    if (user.action.includes('edit_category-')) {
      saveCategory(chatId, text);
    }
    if (user.action.includes('new_product_') && user.action !== 'new_product_img') {
      addProductNext(chatId, text, user.action.split('_')[2]);
    }
    if (user.action == 'new_product_img') {
      if (msg.photo) {
        addProductNext(chatId, msg.photo.at(-1).file_id, 'img');
      } else {
        bot.sendMessage(chatId, 'Mahsulot rasmini oddiy rasm ko`rinish yuklang');
      }
    }
  }
});
