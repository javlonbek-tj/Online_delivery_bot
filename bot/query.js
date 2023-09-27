const { bot } = require('./bot');
const {
  addCategory,
  paginationCategory,
  showCategory,
  removeCategory,
  editCategory,
  getAllCategories,
} = require('./helper/category');
const { showProduct, addProduct, deleteProduct, editProduct } = require('./helper/product');
const {
  addToCartProd,
  deleteFromCart,
  removeCart,
  unfinishedOrder,
  changeOrder,
  showLocation,
  getCart,
} = require('./helper/users');

bot.on('callback_query', async query => {
  try {
    const message_id = query.message.message_id;
    const { data } = query;
    const chatId = query.from.id;
    let id = data.split('-');

    await bot.answerCallbackQuery(query.id, {
      cache_time: 0.5,
    });
    if (data === 'add_category') {
      addCategory(chatId);
    }
    if (['next_category', 'back_category'].includes(data)) {
      paginationCategory(chatId, data, message_id);
    }
    if (data.includes('del_category-')) {
      removeCategory(chatId, id[1]);
    }
    if (data.includes('edit_category-')) {
      editCategory(chatId, id[1]);
    }
    if (data.includes('add_product-')) {
      bot.deleteMessage(chatId, message_id);
      addProduct(chatId, id[1]);
    }
    if (data.includes('more_count-')) {
      showProduct(chatId, id[1], +id[2] + 1, message_id);
    }
    if (data.includes('less_count-')) {
      if (id[2] > 1) {
        showProduct(chatId, id[1], +id[2] - 1, message_id);
      }
    }
    if (data.includes('del_product-')) {
      deleteProduct(chatId, id[1]);
    }

    if (data.includes('rem_product-')) {
      deleteProduct(chatId, id[1], true);
    }
    if (data.includes('add_cart-')) {
      addToCartProd(chatId, id[1], id[2]);
    }
    if (data.includes('edit_product-')) {
      editProduct(chatId, id[1]);
    }
    if (data.includes('remove_cart-')) {
      deleteFromCart(chatId, id[1]);
    }
    if (data.includes('remove_cart_all')) {
      removeCart(chatId);
    }
    if (data.includes('order_cart')) {
      unfinishedOrder(chatId);
    }
    if (data.includes('success_order-')) {
      changeOrder(chatId, id[1], 2);
      return;
    }
    if (data.includes('cancel_order-')) {
      changeOrder(chatId, id[1], 3);
      return;
    }
    if (data.includes('map_order-')) {
      return showLocation(chatId, id[1]);
    }
    if (data.includes('accept_order-')) {
      return changeOrder(chatId, id[1], 4);
    }
    if (data.includes('see_cart')) {
      getCart(chatId);
    }

    id = data.split('_');
    if (data.includes('category_')) {
      showCategory(chatId, id[1], 1, message_id);
    }
    if (data.includes('product_')) {
      bot.deleteMessage(chatId, message_id);
      showProduct(chatId, id[1]);
    }
    if (data === 'catalog') {
      getAllCategories(chatId);
    }
  } catch (err) {
    console.log(err);
  }
});
