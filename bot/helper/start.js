const { bot } = require('../bot');
const User = require('../../model/user');
const { createKeyboard } = require('../menu/keyboard');

const start = async msg => {
  const chatId = msg.from.id;
  const isUserExists = await User.findOne({ chatId }).lean();

  if (!isUserExists) {
    const newUser = new User({
      name: msg.from.first_name,
      chatId,
      admin: false,
      status: true,
      action: 'request_contact',
    });
    await newUser.save();
    bot.sendMessage(
      chatId,
      `Assalomu alaykum hurmatli ${msg.from.first_name}.📲 Iltimos telefon raqamingizni ulashing.`,
      {
        reply_markup: {
          keyboard: [
            [
              {
                text: 'Telefon Raqam yuborish',
                request_contact: true,
              },
            ],
          ],
          resize_keyboard: true,
        },
      },
    );
  } else {
    await User.findByIdAndUpdate(isUserExists._id, {
      ...isUserExists,
      action: 'menu',
    });
    bot.sendMessage(
      chatId,
      `Menyuni tanlang, ${isUserExists.admin ? 'Admin' : isUserExists.name}`,
      createKeyboard(isUserExists.admin),
    );
  }
};

const requestContact = async msg => {
  const chatId = msg.from.id;
  if (!msg.contact) {
    bot.sendMessage(chatId, '❌ Iltimos raqamni "Telefon raqamni yuborish" tugmasini bosish orqali ulashing');
  }

  if (msg.contact.phone_number) {
    const user = await User.findOne({ chatId }).lean();
    user.phone = msg.contact.phone_number;
    user.admin = msg.contact.phone_number.includes('998900048114');
    user.action = 'menu';
    await User.findByIdAndUpdate(user._id, user, { new: true });
    bot.sendMessage(chatId, `Menyuni tanlang, ${user.admin ? 'Admin' : user.name}`, createKeyboard(user.admin));
  }
};

module.exports = {
  start,
  requestContact,
};
