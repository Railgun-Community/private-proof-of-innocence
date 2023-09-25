/* eslint-disable no-console */
import fs from 'fs';
import { MONGOOSE_DB_URL, setUpMongoose } from './mongoose.test';
import { Config } from '../config/config';
import { promiseTimeout } from '@railgun-community/shared-models';
import { MOCK_LIST_KEYS } from './mocks.test';

const TEST_DB_DIR = 'test.db';
const TEST_MONGO_DB_DIR = 'mongo.test.db';

before(async function run() {
  // Mock pkey
  process.env.pkey =
    '0x0012345678901234567890123456789000123456789012345678901234567890';

  process.env.BASIC_AUTH_USERNAME = 'test-user';
  process.env.BASIC_AUTH_PASSWORD = 'test-pass';

  Config.ENGINE_DB_DIR = TEST_DB_DIR;

  Config.LIST_KEYS = MOCK_LIST_KEYS;

  await promiseTimeout(
    setUpMongoose(),
    2000,
    new Error('Mongoose DB setup timed out - make sure you run ./'),
  );
  Config.MONGODB_URL = MONGOOSE_DB_URL;
});

after(async () => {
  const { warn } = console;
  fs.rm(TEST_DB_DIR, { recursive: true }, () => {
    warn('Error removing test db.');
  });
  fs.rm(TEST_MONGO_DB_DIR, { recursive: true }, () => {
    warn('Error removing mongo test db.');
  });
});
