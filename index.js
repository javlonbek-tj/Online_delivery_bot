const express = require('express');
const mongoConnect = require('./config/mongo');
const app = express();
require('dotenv').config();

app.use(express.json());

require('./bot/bot');

const PORT = process.env.PORT || 3006;

async function startServer() {
  await mongoConnect();

  app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
  });
}

startServer();
