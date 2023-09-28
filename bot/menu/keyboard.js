const adminKeyboard = [
  [
    {
      text: 'Foydalanuvchilar',
    },
    {
      text: 'Katalog',
    },
  ],
  [
    { text: 'Savat' },
    {
      text: 'Buyurtmalar',
    },
  ],
];

const userKeyboard = [
  [
    {
      text: 'Katalog',
    },
    {
      text: 'Savat',
    },
  ],
  [
    {
      text: 'Buyurtmalarim',
    },
  ],
];

function createKeyboard(isAdmin) {
  const keyboard = isAdmin ? adminKeyboard : userKeyboard;
  return {
    reply_markup: {
      keyboard: keyboard,
      resize_keyboard: true,
    },
  };
}

module.exports = {
  adminKeyboard,
  userKeyboard,
  createKeyboard,
};
