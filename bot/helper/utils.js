const calculateTotalPrice = products => {
  let totalPrice = 0;

  products.forEach(product => {
    const subtotal = product.productId.price * product.quantity;
    totalPrice += subtotal;
  });

  return totalPrice;
};

const generateCartMessage = (products, totalPrice, value, order) => {
  let message = '';
  // Check if the value is 'Buyurtmadagi' and orderId is not null
  if (value === 'Buyurtmadagi' && order !== null) {
    let status = '';
    switch (order.status) {
      case 1:
        status = 'Tekshiruvda';
        break;
      case 2:
        status = 'Qabul qilingan';
        break;
      case 3:
        status = 'Bekor qilingan';
        break;
      case 4:
        status = 'Yakunlangan';
        break;
      default:
        status = 'Tugatilmagan';
    }
    message += ` Buyurtma raqami: #${order.orderId}\n`;
    message += ` Buyurtma holati: ${status}\n\n`;
  }

  message += `🛒 ${value} mahsulotlar:\n\n`;
  let inline_keyboard = [];

  products.forEach(product => {
    message += `📖 Mahsulot: ${product.productId.title}\n`;
    message += `💰 Narxi: ${product.productId.price} so'm\n`;
    message += `📦 Soni: ${product.quantity}\n`;
    message += '\n';

    const productInlineKeyboard = [
      [
        {
          text: `❌ Remove ${product.productId.title} from cart`,
          callback_data: `remove_cart-${product.productId._id}`,
        },
      ],
    ];
    inline_keyboard.push(...productInlineKeyboard);
  });

  message += `💲 Jami: ${totalPrice} so'm\n`;

  return { message, inline_keyboard };
};

module.exports = {
  calculateTotalPrice,
  generateCartMessage,
};
