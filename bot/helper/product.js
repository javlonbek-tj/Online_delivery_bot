const { bot } = require('../bot');
const Product = require('../../model/product');
const User = require('../../model/user');

const clear_draft_product = async () => {
  let products = await Product.find({ status: 0 }).lean();
  if (products) {
    await Promise.all(
      products.map(async product => {
        await Product.findByIdAndRemove(product._id);
      }),
    );
  }
};

const addProduct = async (chatId, category) => {
  const user = await User.findOne({ chatId }).lean();
  const newProduct = new Product({
    category,
  });
  await newProduct.save();
  await User.findByIdAndUpdate(user._id, { ...user, action: 'new_product_title' }, { new: true });
  bot.sendMessage(chatId, `Yangi mahsulot nomini kiriting`);
};

const steps = {
  title: {
    action: 'new_product_price',
    text: 'Mahsulot narxini kiriting',
  },
  price: {
    action: 'new_product_img',
    text: 'Mahsulot rasmini kiriting',
  },
  img: {
    action: 'new_product_text',
    text: 'Mahsulot qisqa ma`lumotini kiriting',
  },
};

const addProductNext = async (chatId, value, slug) => {
  const user = await User.findOne({ chatId }).lean();
  const product = await Product.findOne({ status: 0 }).lean();

  if (['title', 'text', 'price', 'img'].includes(slug)) {
    if (slug === 'price' && isNaN(value)) {
      bot.sendMessage(chatId, 'Mahsulot narxini sonlarda kiriting');
      return;
    }
    product[slug] = value;

    if (slug === 'text') {
      product.status = 1;
      await User.findByIdAndUpdate(user._id, {
        ...user,
        action: 'catalog',
      });
      bot.sendMessage(chatId, 'Yangi mahsulot kiritildi!');
    } else {
      await User.findByIdAndUpdate(user._id, {
        ...user,
        action: steps[slug].action,
      });
      bot.sendMessage(chatId, steps[slug].text);
    }
    await Product.findByIdAndUpdate(product._id, product, { new: true });
  }
};

const showProduct = async (chatId, id, quantity = 1, message_id = null, type = false) => {
  let product = await Product.findById(id).populate(['category']).lean();
  let user = await User.findOne({ chatId }).lean();

  const inline_keyboard = [
    [
      { text: '➖', callback_data: `less_count-${product._id}-${quantity}` },
      { text: quantity, callback_data: quantity },
      { text: '➕', callback_data: `more_count-${product._id}-${quantity}` },
    ],
    user.admin
      ? [
          {
            text: '✏️ Tahrirlash',
            callback_data: `edit_product-${product._id}`,
          },
          { text: '🗑️ O`chirish', callback_data: `del_product-${product._id}` },
        ]
      : [],
    [
      {
        text: `🛒 Savatga qo'shish`,
        callback_data: `add_cart-${product._id}-${quantity}`,
      },
    ],
  ];

  if (message_id > 0 && !type) {
    return bot.editMessageReplyMarkup({ inline_keyboard }, { chat_id: chatId, message_id });
  }
  bot.sendPhoto(chatId, product.img, {
    caption: `<b>${product.title}</b>\n 💸 Narxi: ${product.price} so'm\n🔥 Tavsif: ${product.text}`,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard,
    },
  });
};

const deleteProduct = async (chatId, id, sure) => {
  const user = await User.findOne({ chatId }).lean();
  if (user.admin) {
    if (sure) {
      const product = await Product.findById(id);
      if (product) {
        await Product.findByIdAndRemove(id);
        await bot.sendMessage(chatId, 'Mahsulot o`chirildi!');
        const affectedUsers = await User.find({ 'cart.items.productId': id });
        await User.updateMany({ 'cart.items.productId': id }, { $pull: { 'cart.items': { productId: id } } });

        await Promise.all(
          affectedUsers.map(async affectedUser => {
            const affectedChatId = affectedUser.chatId;
            await bot.sendMessage(
              affectedChatId,
              `Mahsulot "${product.title}" sotuvdan olib tashlandi va o'chirildi. Sizning savatingiz yangilandi.`,
            );
          }),
        );
      } else {
        bot.sendMessage(chatId, 'Mahsulotni o`chirishda xatolik yuz berdi. Iltimos, qaytadan urinib ko`ring.');
      }
    } else {
      bot.sendMessage(chatId, `Mahsulotni o'chirmoqchisiz. Qaroringiz qat'iymi?`, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '❌ Yo`q',
                callback_data: 'catalog',
              },
              {
                text: '✅ Ha',
                callback_data: `rem_product-${id}`,
              },
            ],
          ],
        },
      });
    }
  } else {
    bot.sendMessage(chatId, '🙅‍♂️ Sizga mahsulot o`chirish mumkin emas!');
  }
};

const editProduct = async (chatId, id) => {
  const user = await User.findOne({ chatId }).lean();
  const product = await Product.findById(id).lean();
  await User.findByIdAndUpdate(user._id, { ...user, action: `edit_product_title_${id}` }, { new: true });
  bot.sendMessage(chatId, `${product.title}ga yangi nom bering`);
};

const editProductNext = async (chatId, value, slug, prodId) => {
  const editSteps = {
    title: {
      action: `edit_product_price_${prodId}`,
      text: 'Mahsulot narxini kiriting',
    },
    price: {
      action: `edit_product_img_${prodId}`,
      text: 'Mahsulot rasmini kiriting',
    },
    img: {
      action: `edit_product_text_${prodId}`,
      text: 'Mahsulot qisqa ma`lumotini kiriting',
    },
  };
  const user = await User.findOne({ chatId }).lean();
  const product = await Product.findById(prodId).lean();

  if (['title', 'text', 'price', 'img'].includes(slug)) {
    if (slug === 'price' && isNaN(value)) {
      bot.sendMessage(chatId, 'Mahsulot narxini sonlarda kiriting');
      return;
    }
    product[slug] = value;

    if (slug === 'text') {
      product.status = 1;
      await User.findByIdAndUpdate(user._id, {
        ...user,
        action: 'catalog',
      });
      bot.sendMessage(chatId, 'Mahsulot yangilandi!');
      setTimeout(() => {
        showProduct(chatId, prodId);
      }, 1500);
    } else {
      await User.findByIdAndUpdate(user._id, {
        ...user,
        action: editSteps[slug].action,
      });
      bot.sendMessage(chatId, editSteps[slug].text);
    }
    await Product.findByIdAndUpdate(product._id, product, { new: true });
  }
};

module.exports = {
  clear_draft_product,
  addProduct,
  addProductNext,
  showProduct,
  deleteProduct,
  editProduct,
  editProductNext,
};
