import mongoose from 'mongoose';

export const MONGOOSE_DB_URL = 'mongodb://localhost:27017/test';

export const setUpMongoose = async () => {
  const options: mongoose.ConnectOptions = {};
  const mongooseDB = await mongoose.connect(MONGOOSE_DB_URL, options);
  mongooseDB.connection.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error(err);
  });
};

export const dropDatabase = async () => {
  await mongoose.connection.dropDatabase();
};
