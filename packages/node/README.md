# RAILGUN Proof Of Innocence Node

This is the Node.js package for the RAILGUN Proof of Innocence system, providing the necessary tools and functionalities for privacy-enhanced blockchain transactions.

## Installation

To add the RAILGUN POI Node package to your project:

```bash
yarn add @railgun-community/proof-of-innocence
```

## Testing

### Prerequisites

- MongoDB

For macOS, follow this guide to install MongoDB.
For Amazon Linux, see the installation guide.

### Running Tests

Start the MongoDB server locally:

```bash
yarn test-db
```

In a separate terminal, run the tests:

```bash
yarn test
yarn test-coverage
```

## Deploying

Ensure Node.js >=16.20 and yarn are installed.

Run the following commands:

```bash
yarn
yarn setup-env
npx pm2 start
```

Alternatively, from the root of the monorepo, run ./start-node.

## Contributing

Contributions are highly appreciated. Please follow our contribution guidelines.

## License

This package is part of the RAILGUN POI project and is subject to its license terms.
