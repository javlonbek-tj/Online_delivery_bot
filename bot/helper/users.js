const { bot } = require('../bot');
const User = require('../../model/user');
const { userKeyboard, adminKeyboard, createKeyboard } = require('../menu/keyboard');
const Product = require('../../model/product');
const Order = require('../../model/order');
const { calculateTotalPrice, generateCartMessage } = require('./utils');

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
    bot.sendMessage(chatId, '🙅‍♂️ Sizga bunday so`rov mumkin emas', createKeyboard(false));
  }
};

const addToCartProd = async (chatId, prodId, quantity) => {
  try {
    const product = await Product.findById(prodId).lean();
    const user = await User.findOne({ chatId });

    // Add the product to the user's cart
    await user.addToCart(prodId, quantity);

    // Format the "Add to cart" message
    const message =
      `✅ Mahsulot savatga qo'shildi:\n\n` +
      `📖 *${product.title}*\n` +
      `💸 *Narxi*: ${product.price} so'm\n` +
      `📦 *Soni*: ${quantity}\n` +
      `💲 *Jami*: ${quantity * product.price} so'm`;

    // Send the formatted message with Markdown
    bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Savatni ko'rish",
              callback_data: 'see_cart',
            },
            {
              text: 'Orqaga',
              callback_data: `category_${product.category}`,
            },
          ],
        ],
      },
    });
  } catch (error) {
    bot.sendMessage(chatId, "❌ Xatolik sodir bo'ldi. Iltimos qaytadan urinib ko'ring.");
  }
};

const getCart = async chatId => {
  const user = await User.findOne({ chatId }).populate('cart.items.productId');
  const products = user.cart.items;

  if (products.length === 0) {
    // Send a message to the user indicating that the cart is empty
    bot.sendMessage(chatId, "🛒 Savat bo'sh.");
  } else {
    const totalPrice = calculateTotalPrice(products);
    const { message, inline_keyboard } = generateCartMessage(products, totalPrice, 'Savatchadagi');

    // Add inline keyboard for "Order" and "Remove Cart" options
    const mainInlineKeyboard = [
      [
        {
          text: '🛒 Buyurtma berish',
          callback_data: 'order_cart',
        },
        {
          text: '🗑️ Savatni tozalash',
          callback_data: 'remove_cart_all',
        },
      ],
    ];

    // Push the main inline keyboard into the inline_keyboard array
    inline_keyboard.push(...mainInlineKeyboard);

    // Send the cart contents with the total price as a message to the user
    bot.sendMessage(chatId, message, {
      reply_markup: {
        inline_keyboard,
      },
    });
  }
};

const deleteFromCart = async (chatId, prodId) => {
  const user = await User.findOne({ chatId });
  await user.removeFromCart(prodId);
  getCart(chatId);
};

const removeCart = async (chatId, afterOrder = null) => {
  const user = await User.findOne({ chatId });
  await user.clearCart();
  if (!afterOrder) bot.sendMessage(chatId, 'Savat tozalandi');
};

const unfinishedOrder = async chatId => {
  const user = await User.findOne({ chatId }).populate('cart.items.productId').lean();
  const products = user.cart.items.map(item => {
    return { quantity: item.quantity, productId: { ...item.productId } };
  });
  await Order.deleteMany({ status: 0 }); // Delete old unfinished orders
  const order = new Order({
    user: user._id,
    products,
  });
  await order.save();
  await User.findByIdAndUpdate(
    user._id,
    {
      ...user,
      action: 'order',
    },
    { new: true },
  );
  bot.sendMessage(chatId, `📍 Mahsulotni buyurtma qilish uchun yetkazib berish manzilini jo'nating`, {
    reply_markup: {
      keyboard: [
        [
          {
            text: 'Lokatsiyani jo`natish',
            request_location: true,
          },
        ],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
};

const acceptedOrder = async (chatId, location) => {
  const user = await User.findOne({ chatId }).lean();
  const admin = await User.findOne({ admin: true }).lean();
  const unfinishedOrder = await Order.findOne({
    user: user._id,
    status: 0,
  })
    .populate(['products.productId'])
    .lean();
  if (unfinishedOrder) {
    await User.findByIdAndUpdate(
      user._id,
      {
        ...user,
        action: 'accept_order',
      },
      { new: true },
    );
    const lastOrder = await Order.findOne({ status: { $ne: 0 } }).sort({ createdAt: -1 });
    const orderId = lastOrder?.orderId ? Number(lastOrder.orderId) + 1 : 1;
    const order = await Order.findByIdAndUpdate(
      unfinishedOrder._id,
      {
        ...unfinishedOrder,
        orderId,
        location,
        status: 1,
      },
      { new: true },
    )
      .populate(['products.productId', 'user'])
      .lean();
    const totalPrice = calculateTotalPrice(order.products);
    const { message } = generateCartMessage(order.products, totalPrice, 'Buyurtmadagi', order);
    await removeCart(chatId, true);
    await bot.sendMessage(
      chatId,
      `Buyurtmangiz qabul bo'ldi.⏰ Tez orada siz bilan bog'lanamiz.\n\n${message}`,
      createKeyboard(false),
    );
    await bot.sendMessage(
      admin.chatId,
      `Yangi buyurtma.\n\nBuyurtmachi: ${user.name}\nTelefon raqami: ${user.phone}\n\n${message}`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '❌ Bekor qilish',
                callback_data: `cancel_order-${order._id}`,
              },
              {
                text: '✅ Qabul qilish',
                callback_data: `success_order-${order._id}`,
              },
            ],
            [
              {
                text: '📍 Lokatsiyani olish',
                callback_data: `map_order-${order._id}`,
              },
            ],
          ],
        },
      },
    );
  }
};

const changeOrder = async (chatId, id, status) => {
  const admin = await User.findOne({ chatId }).lean();
  const unfinishedOrder = await Order.findById(id).lean();
  if (!unfinishedOrder) {
    return bot.sendMessage(admin.chatId, `Buyurtma topilmadi`);
  }
  if (admin.admin) {
    const order = await Order.findByIdAndUpdate(
      unfinishedOrder._id,
      { ...unfinishedOrder, status },
      { new: true },
    ).populate(['user', 'products.productId']);
    const totalPrice = calculateTotalPrice(order.products);
    const { message } = generateCartMessage(order.products, totalPrice, 'Buyurtmadagi', order);
    let msg;
    if (status == 2) {
      await bot.sendMessage(
        order.user.chatId,
        `Buyurtmangiz qabul qilindi.\n⏰ Tez orada mahsulotingiz yetkazib beriladi.`,
        createKeyboard(false),
      );
      await bot.sendMessage(
        admin.chatId,
        `Yangi buyurtma.\n\nBuyurtmachi: ${order.user.name}\nTelefon raqami: ${order.user.phone}\n\n${message}`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '📍 Lokatsiyani olish',
                  callback_data: `map_order-${order._id}`,
                },
                {
                  text: '🔚 Buyurtmani yakunlash',
                  callback_data: `accept_order-${order._id}`,
                },
              ],
            ],
          },
        },
      );
      return;
    }
    if (status == 3) {
      msg = `❌ #${order.orderId} raqamli buyurtmangiz bekor qilindi`;
      await bot.sendMessage(order.user.chatId, msg, createKeyboard(false));
      await bot.sendMessage(
        admin.chatId,
        `❌ #${order.orderId} raqamli buyurtma bekor qilindi`,
        createKeyboard(admin.admin),
      );
      return;
    }
    if (status == 4 && order.status != 4) {
      msg = `#${order.orderId} raqamli buyurtmangiz yakunlandi.`;
      await bot.sendMessage(order.user.chatId, msg, createKeyboard(false));
      await bot.sendMessage(admin.chatId, `#${order.orderId} raqamli buyurtma yakunlandi`, createKeyboard(admin.admin));
      await Order.findByIdAndUpdate(id, { ...order, status: 4 });
      await User.findByIdAndUpdate(order.user._id, { ...order.user, action: 'end_order' });
      return;
    }
    bot.sendMessage(admin.chatId, 'Buyurtma yakunlangan', createKeyboard(admin.admin));
  } else {
    bot.sendMessage(chatId, '🙅‍♂️ Sizga ushbu amal mumkin emas');
  }
};

const showLocation = async (chatId, _id) => {
  const user = await User.findOne({ chatId }).lean();
  if (user.admin) {
    const order = await Order.findById(_id).lean();
    const message = `Buyurtma raqami: #${order.orderId}`;

    const inline_keyboard = [
      [
        {
          text: message,
          callback_data: 'button_action',
        },
        {
          text: 'Buyurtmani yakunlash',
          callback_data: `accept_order-${order._id}`,
        },
      ],
    ];

    bot.sendLocation(chatId, order.location.latitude, order.location.longitude, {
      reply_markup: {
        inline_keyboard,
      },
    });
  } else {
    await bot.sendMessage(chatId, '🙅‍♂️ Sizga bu yerga kirish mumkin emas!');
  }
};

const getOrders = async chatId => {
  try {
    const user = await User.findOne({ chatId }).lean();
    const userOrders = await Order.find({ status: { $in: [1, 2, 3, 4] }, user: user._id }).populate([
      'user',
      'products.productId',
    ]);
    const allOrders = await Order.find({ status: { $in: [2] } }).populate(['user', 'products.productId']);
    if (user.admin) {
      if (allOrders.length === 0) {
        await bot.sendMessage(chatId, 'Buyurtmalar mavjud emas');
      } else {
        for (const order of allOrders) {
          const totalPrice = calculateTotalPrice(order.products);
          const { message } = generateCartMessage(order.products, totalPrice, 'Buyurtmadagi', order);
          const keyboard = {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '📍 Lokatsiyani olish',
                    callback_data: `map_order-${order._id}`,
                  },
                  {
                    text: '🔚 Buyurtmani yakunlash',
                    callback_data: `accept_order-${order._id}`,
                  },
                ],
              ],
            },
          };
          const isAcceptedOrder = order.status == 2 ? keyboard : null;
          await bot.sendMessage(chatId, message, isAcceptedOrder);
        }
      }
    } else {
      if (userOrders.length === 0) {
        await bot.sendMessage(chatId, 'Sizda hali buyurtmalar mavjud emas');
      } else {
        for (const order of userOrders) {
          const totalPrice = calculateTotalPrice(order.products);
          const { message } = generateCartMessage(order.products, totalPrice, 'Buyurtmadagi', order);

          await bot.sendMessage(chatId, message);
        }
      }
    }
  } catch (e) {
    console.log(e);
  }
};

module.exports = {
  getAllUsers,
  addToCartProd,
  getCart,
  deleteFromCart,
  removeCart,
  unfinishedOrder,
  acceptedOrder,
  changeOrder,
  showLocation,
  getOrders,
};
