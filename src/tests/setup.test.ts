/* eslint-disable no-console */
import fs from 'fs';
import { MONGOOSE_DB_URL, setUpMongoose } from './mongoose.test';
import { Config } from '../config/config';
import { promiseTimeout } from '@railgun-community/shared-models';

const TEST_DB_DIR = 'test.db';

before(async function run() {
  Config.ENGINE_DB_DIR = TEST_DB_DIR;

  await promiseTimeout(
    setUpMongoose(),
    2000,
    new Error('Mongoose DB setup timed out'),
  );
  Config.MONGODB_URL = MONGOOSE_DB_URL;
});

after(async () => {
  const { warn } = console;
  fs.rm(TEST_DB_DIR, { recursive: true }, () => {
    warn('Error removing test db.');
  });
});
