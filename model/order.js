const { Schema, model } = require('mongoose');

const Order = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    orderId: Number,
    products: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: 'Product',
        },
        quantity: Number,
      },
    ],
    location: {
      latitude: Number,
      longitude: Number,
    },
    status: {
      type: Number,
      default: 0,
      /*
      0 - tugatilmagan buyurtma
      1 - tekshiruvda
      2 - qabul qilingan
      3 - bekor qilingan
      4 - yakunlangan
    */
    },
  },
  {
    timestamps: true,
  },
);

module.exports = model('Order', Order);
