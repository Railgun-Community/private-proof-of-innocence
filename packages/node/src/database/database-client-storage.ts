import { MongoClient } from 'mongodb';

export class DatabaseClientStorage {
  static client?: MongoClient;
}
