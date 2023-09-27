const { bot } = require('./bot');
const User = require('../model/user');
const { start, requestContact } = require('./helper/start');
const { getAllUsers, getCart, acceptedOrder, getOrders } = require('./helper/users');
const { getAllCategories, newCategory, saveCategory } = require('./helper/category');
const { addProductNext, editProductNext } = require('./helper/product');

bot.on('message', async msg => {
  const chatId = msg.from.id;
  const text = msg.text;
  const user = await User.findOne({ chatId }).lean();

  if (text === '/start' || text === '/menu') {
    return start(msg);
  }
  if (user) {
    if (user.action === 'request_contact' && !user.phone) {
      if (text) {
        bot.sendMessage(chatId, "Iltimos, 'Telefon raqamni yuborish' tugmasini bosish orqali ulashing.", {
          reply_markup: {
            keyboard: [
              [
                {
                  text: 'Telefon Raqam yuborish',
                  request_contact: true,
                },
              ],
            ],
            resize_keyboard: true,
          },
        });
      } else {
        requestContact(msg);
      }
    }
    if (text === 'Foydalanuvchilar') {
      getAllUsers(msg);
      return;
    }
    if (text === 'Katalog') {
      getAllCategories(chatId, 1);
      return;
    }
    if (text === 'Savat') {
      getCart(chatId);
    }
    if (text === 'Buyurtmalarim' || text === 'Buyurtmalar') {
      getOrders(chatId);
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
    if (user.action.includes('edit_product_') && user.action !== 'edit_product_img') {
      const action = user.action;
      const prodId = action.split('_')[3];
      editProductNext(chatId, text, user.action.split('_')[2], prodId);
    }
    if (user.action == 'edit_product_img') {
      if (msg.photo) {
        editProductNext(chatId, msg.photo.at(-1).file_id, 'img');
      } else {
        bot.sendMessage(chatId, 'Mahsulot rasmini oddiy rasm ko`rinishida yuklang');
      }
    }

    if (msg.location && user.action == 'order') {
      acceptedOrder(chatId, msg.location);
    }
  }
});
