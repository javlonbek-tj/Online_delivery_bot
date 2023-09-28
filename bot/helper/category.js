const { bot } = require('../bot');
const User = require('../../model/user');
const Category = require('../../model/category');
const Product = require('../../model/product');
const { clear_draft_product } = require('../helper/product');

const getAllCategories = async (chatId, page = 1, message_id = null, type = false) => {
  clear_draft_product(); // Delete unfinished products
  const user = await User.findOne({ chatId }).lean();
  const limit = 5;
  const skip = (page - 1) * limit;
  if (page == 1) {
    await User.findByIdAndUpdate(user._id, { ...user, action: 'category-1' }, { new: true });
  }
  const categories = await Category.find().skip(skip).limit(limit).lean();
  if (categories.length == 0 && skip > 0) {
    page--;
    await User.findByIdAndUpdate(user._id, { ...user, action: `category-${page}` }, { new: true });
    getAllCategories(chatId, page);
    return;
  }
  const list = categories.map(category => [
    {
      text: category.title,
      callback_data: `category_${category._id}`,
    },
  ]);
  const inline_keyboard = [
    ...list,
    [
      {
        text: 'Orqaga',
        callback_data: page > 1 ? 'back_category' : page,
      },
      {
        text: page,
        callback_data: '0',
      },
      {
        text: 'Keyingi',
        callback_data: limit == categories.length ? 'next_category' : page,
      },
    ],
    user.admin
      ? [
          {
            text: 'Yangi kategoriya',
            callback_data: 'add_category',
          },
        ]
      : [],
  ];
  if (message_id > 0) {
    bot.editMessageReplyMarkup(
      {
        inline_keyboard,
      },
      { chat_id: chatId, message_id },
    );
  } else {
    bot.sendMessage(chatId, '🗒 Kategoriyalar ro`yxati:', {
      reply_markup: {
        remove_keyboard: true,
        inline_keyboard,
      },
    });
  }
};

const addCategory = async chatId => {
  const user = await User.findOne({ chatId }).lean();

  if (user.admin) {
    await User.findByIdAndUpdate(user._id, { ...user, action: 'add_category' }, { new: true });
    bot.sendMessage(chatId, 'Yangi kategoriya nomini kiriting');
  } else {
    bot.sendMessage(chatId, '🙅‍♂️ Sizga bunday so`rov mumkin emas!');
  }
};

const newCategory = async msg => {
  const chatId = msg.from.id;
  const text = msg.text;
  let user = await User.findOne({ chatId }).lean();
  if (user.admin && user.action === 'add_category') {
    const newCatogory = new Category({
      title: text,
    });
    await newCatogory.save();
    await User.findByIdAndUpdate(user._id, { ...user, action: 'category' });
    getAllCategories(chatId);
  } else {
    bot.sendMessage(chatId, '🙅‍♂️ Sizga bunday so`rov mumkin emas!');
  }
};

const paginationCategory = async (chatId, action, message_id = null) => {
  const user = await User.findOne({ chatId }).lean();
  let page = 1;
  if (user.action.includes('category-')) {
    page = +user.action.split('-')[1];
    if (action == 'back_category' && page > 1) {
      page--;
    }
  }
  if (action == 'next_category') {
    page++;
  }
  await User.findByIdAndUpdate(user._id, { ...user, action: `category-${page}` }, { new: true });
  getAllCategories(chatId, page, message_id);
};

const showCategory = async (chatId, id, page = 1, message_id = null) => {
  const category = await Category.findById(id).lean();
  const user = await User.findOne({ chatId }).lean();
  await User.findByIdAndUpdate(user._id, { ...user, action: `category_${category._id}` }, { new: true });
  let limit = 5;
  let skip = (page - 1) * limit;
  let products = await Product.find({ category: category._id, status: 1 })
    .skip(skip)
    .limit(limit)
    .sort({ _id: -1 })
    .lean();

  let list = products.map(product => [
    {
      text: product.title,
      callback_data: `product_${product._id}`,
    },
  ]);
  const userKeyboards = [];
  const adminKeyboards = [
    [
      {
        text: 'Yangi mahsulot',
        callback_data: `add_product-${category._id}`,
      },
    ],
    [
      {
        text: '✏️ Turkumni tahrirlash',
        callback_data: `edit_category-${category._id}`,
      },
      {
        text: '🗑️Turkumni o`chirish',
        callback_data: `del_category-${category._id}`,
      },
    ],
  ];
  const keyboards = user.admin ? adminKeyboards : userKeyboards;
  const inline_keyboard = [
    ...list,
    [
      { text: 'Ortga', callback_data: page > 1 ? 'back_product' : page },
      { text: page, callback_data: '0' },
      {
        text: 'Keyingi',
        callback_data: limit == products.length ? 'next_product' : page,
      },
    ],
    ...keyboards,
  ];
  if (message_id > 0) {
    bot.editMessageText(`${category.title} turkumidagi mahsulotlar ro'yxati:`, {
      chat_id: chatId,
      message_id,
      reply_markup: {
        remove_keyboard: true,
        inline_keyboard,
      },
    });
  } else {
    bot.sendMessage(chatId, `${category.title} turkumidagi mahsulotlar ro'yxati:`, {
      reply_markup: {
        remove_keyboard: true,
        inline_keyboard,
      },
    });
  }
};

const removeCategory = async (chatId, id) => {
  const user = await User.findOne({ chatId }).lean();
  const category = await Category.findById(id).lean();
  if (user.action !== 'del_category') {
    await User.findByIdAndUpdate(user._id, { ...user, action: 'del_category' }, { new: true });
    bot.sendMessage(chatId, `Siz ${category.title} turkumni o'chirmoqchisiz. Qaroringiz qat'iymi?`, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '❌ Bekor qilish',
              callback_data: `category_${category._id}`,
            },
            {
              text: '✅ O`chirish',
              callback_data: `del_category-${category._id}`,
            },
          ],
        ],
      },
    });
  } else {
    const products = await Product.find({ category: category._id }).select(['_id']).lean();

    await Promise.all(
      products.map(async product => {
        await Product.findByIdAndRemove(product._id);
      }),
    );

    await Category.findByIdAndRemove(id);

    bot.sendMessage(
      chatId,
      `${category.title} turkumi o'chirildi.
Menyudan tanlang`,
    );
  }
};

const editCategory = async (chatId, id) => {
  const user = await User.findOne({ chatId }).lean();
  const category = await Category.findById(id).lean();

  await User.findByIdAndUpdate(user._id, { ...user, action: `edit_category-${id}` }, { new: true });

  bot.sendMessage(chatId, `${category.title} turkumga yangi nom bering`);
};

const saveCategory = async (chatId, title) => {
  const user = await User.findOne({ chatId }).lean();
  const id = user.action.split('-')[1];
  await User.findByIdAndUpdate(user._id, { ...user, action: 'catalog' }, { new: true });
  const category = await Category.findById(id).lean();
  await Category.findByIdAndUpdate(id, { ...category, title }, { new: true });
  bot.sendMessage(chatId, `Turkum yangilandi.\nMenyudan tanlang`);
};

module.exports = {
  getAllCategories,
  addCategory,
  newCategory,
  paginationCategory,
  showCategory,
  removeCategory,
  editCategory,
  saveCategory,
};
