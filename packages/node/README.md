# RAILGUN Proof Of Innocence Node

Compatible with NodeJS environments.

`yarn add @railgun-community/proof-of-innocence`

## TESTING

1. Get MongoDB:

Mac MongoDB (https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-os-x/):

- brew tap mongodb/brew
- brew install mongodb-community@7.0

2. Run `yarn test-db` to start local MongoDB server.

3. In a separate terminal, run `yarn test` or `yarn test-coverage`.

## DEPLOYING

Make sure the box has Node.js >=16.20 installed, and yarn.

1. `yarn`
2. `yarn setup-env`
3. `npx pm2 start`

OR, from the root of the monorepo, run `./start-node`.

## INSTALL MONGODB ON AMAZON LINUX

https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-amazon/#std-label-install-mdb-community-amazon-linux
