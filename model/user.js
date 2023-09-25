const { Schema, model } = require('mongoose');

const User = new Schema(
  {
    name: String,
    chatId: Number,
    phone: String,
    admin: {
      type: Boolean,
      default: false,
    },
    action: String,
    status: {
      type: Boolean,
      default: true,
    },
    cart: {
      items: [
        {
          productId: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
          },
          quantity: {
            type: Number,
          },
        },
      ],
    },
  },
  {
    timestamps: true,
  },
);

User.methods.addToCart = function (prodId, quantity) {
  const cartProductIndex = this.cart.items.findIndex(cp => {
    return cp.productId.toString() === prodId.toString();
  });
  const qty = quantity || 1;
  let newQuantity = qty;
  const updatedCartItems = [...this.cart.items];
  if (cartProductIndex > 0) {
    newQuantity = this.cart.items[cartProductIndex].quantity + qty;
    updatedCartItems[cartProductIndex].quantity = newQuantity;
  } else {
    updatedCartItems.push({
      productId: product._id,
      quantity: newQuantity,
    });
  }
  const updatedCart = {
    items: updatedCartItems,
  };
  this.cart = updatedCart;
  return this.save();
};

User.methods.removeFromCart = function (prodId) {
  const updatedCartItems = this.cart.items.filter(item => {
    return item.productId.toString() !== prodId.toString();
  });
  this.cart.items = updatedCartItems;
  return this.save();
};

module.exports = model('User', User);
