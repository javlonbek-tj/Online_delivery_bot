const { bot } = require('../bot');
const User = require('../../model/user');
const { userKeyboard } = require('../menu/keyboard');
const Product = require('../../model/product');
const { showCategory } = require('./category');
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
    bot.sendMessage(chatId, 'Sizga bunday so`rov mumkin emas', {
      reply_markup: {
        keyboard: userKeyboard,
        resize_keyboard: true,
      },
    });
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
      `✅ Product added to cart:\n\n` +
      `📖 *${product.title}*\n` +
      `💸 *Price*: ${product.price} so'm\n` +
      `📦 *Quantity*: ${quantity}\n` +
      `💲 *Subtotal*: ${quantity * product.price} so'm`;

    // Send the formatted message with Markdown
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    setTimeout(() => {
      showCategory(chatId, product.category);
    }, 2000);
  } catch (error) {
    console.error('Error adding product to cart:', error);
    bot.sendMessage(chatId, '❌ An error occurred while adding the product to the cart. Please try again later.');
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
          text: '🛒 Order',
          callback_data: 'order_cart',
        },
        {
          text: '🗑️ Remove Cart',
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

const removeCart = async chatId => {
  const user = await User.findOne({ chatId });
  await user.clearCart();
  bot.sendMessage(chatId, 'Savat tozalandi');
};

const unfinishedOrder = async chatId => {
  const user = await User.findOne({ chatId }).populate('cart.items.productId').lean();
  const products = user.cart.items.map(item => {
    return { quantity: item.quantity, productId: { ...item.productId } };
  });
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
  bot.sendMessage(chatId, `Mahsulotni buyurtma qilish uchun dostavka manzilini jo'nating`, {
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
  await User.findByIdAndUpdate(
    user._id,
    {
      ...user,
      action: 'end_order',
    },
    { new: true },
  );
  const unfinishedOrder = await Order.findOne({
    user: user._id,
    status: 0,
  })
    .populate(['products.productId'])
    .lean();
  if (unfinishedOrder) {
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
      .populate(['products.productId'])
      .lean();
    const totalPrice = calculateTotalPrice(order.products);
    const { message } = generateCartMessage(order.products, totalPrice, 'Buyurtmadagi', order);
    await removeCart(chatId);
    await bot.sendMessage(chatId, `Buyurtmangiz qabul bo'ldi. Tez orada siz bilan bog'lanamiz.\n\n ${message}`, {
      reply_markup: {
        remove_keyboard: true,
      },
    });
    await bot.sendMessage(
      admin.chatId,
      `Yangi buyurtma.\n\nBuyurtmachi: ${user.name}\nTelefon raqami: ${user.phone}\n\n${message}`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Bekor qilish',
                callback_data: `cancel_order-${order._id}`,
              },
              {
                text: 'Qabul qilish',
                callback_data: `success_order-${order._id}`,
              },
            ],
            [
              {
                text: 'Lokatsiyani olish',
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

  if (admin.admin) {
    const unfinishedOrder = await Order.findById(id).lean();
    const order = await Order.findByIdAndUpdate(
      unfinishedOrder._id,
      { ...unfinishedOrder, status },
      { new: true },
    ).populate(['user', 'products.productId']);
    const totalPrice = calculateTotalPrice(order.products);
    const { message } = generateCartMessage(order.products, totalPrice, 'Buyurtmadagi', order);
    let msg;
    if (status == 2) {
      (msg = `Buyurtmangiz qabul qilindi.\n\n ${message}`),
        {
          reply_markup: {
            remove_keyboard: true,
          },
        };
    }
    if (status == 3) {
      msg = `#${order.orderId} raqamli buyurtmangiz bekor qilindi`;
      await bot.sendMessage(order.user.chatId, msg);
      await bot.sendMessage(admin.chatId, `#${order.orderId} raqamli buyurtma bekor qilindi`);
      await Order.findByIdAndDelete(id);
      return;
    }
    if (status == 4) {
      msg = `#${order.orderId} raqamli buyurtmangiz yakunlandi.`;
      await bot.sendMessage(order.user.chatId, msg);
      await bot.sendMessage(admin.chatId, `#${order.orderId} raqamli buyurtma yakunlandi`);
      await Order.findByIdAndUpdate(id, { ...order, status: 4 });
      return;
    }
    await bot.sendMessage(
      admin.chatId,
      `Yangi buyurtma.\n\nBuyurtmachi: ${order.user.name}\nTelefon raqami: ${order.user.phone}\n\n${message}`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Lokatsiyani olish',
                callback_data: `map_order-${order._id}`,
              },
              {
                text: 'Buyurtmani yakunlash',
                callback_data: `end_order-${order._id}`,
              },
            ],
          ],
        },
      },
    );
  } else {
    bot.sendMessage(chatId, 'Sizga ushbu amal mumkin emas');
  }
};

const showLocation = async (chatId, _id) => {
  const user = await User.findOne({ chatId }).lean();
  if (user.admin) {
    const order = await Order.findById(_id).lean();
    const message = `Buyurtma raqami: ${order.orderId}`;

    const inline_keyboard = [
      [
        {
          text: message,
          callback_data: 'button_action',
        },
        {
          text: 'Buyurtmani yakunlash',
          callback_data: `end_order-${order._id}`,
        },
      ],
    ];

    bot.sendLocation(chatId, order.location.latitude, order.location.longitude, {
      reply_markup: {
        inline_keyboard,
      },
    });
  } else {
    await bot.sendMessage(chatId, 'Sizga bu yerga kirish mumkin emas!');
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
};
