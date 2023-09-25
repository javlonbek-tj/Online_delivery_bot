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
    text: 'Mahsulot narhini kiriting',
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
  let user = await User.findOne({ chatId }).lean();
  let product = await Product.findOne({ status: 0 }).lean();

  if (['title', 'text', 'price', 'img'].includes(slug)) {
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
          { text: '🗑 O`chirish', callback_data: `del_product-${product._id}` },
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
    caption: `<b>${product.title}</b>\n📦 Turkum: ${product.category.title}\n💸 Narhi: ${product.price} so'm\n🔥 Qisqa ma'lumot:\n${product.text}`,
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
      await Product.findByIdAndDelete(id);
      bot.sendMessage(chatId, 'Mahsulot o`chirildi!');
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
    bot.sendMessage(chatId, 'Sizga mahsulot o`chirish mumkin emas!');
  }
};

module.exports = {
  clear_draft_product,
  addProduct,
  addProductNext,
  showProduct,
  deleteProduct,
};
