import mongoose from 'mongoose';

export const MONGOOSE_DB_URL = 'mongodb://localhost:27017/test';

let mongooseDB: typeof mongoose;

export const setUpMongoose = async () => {
  const options: mongoose.ConnectOptions = {};
  mongooseDB = await mongoose.connect(MONGOOSE_DB_URL, options);
  mongooseDB.connection.on('error', err => {
    // eslint-disable-next-line no-console
    console.error(err);
  });
  await mongooseDB.connection.dropDatabase();
};

// export const dropDatabase = async () => {
//   // await mongoose.connection.db.dropDatabase();

//   const collections = mongoose.connection.collections;
//   console.log(collections);
//   // await Promise.all(collections.map((collection) => collection.drop()));
// };
