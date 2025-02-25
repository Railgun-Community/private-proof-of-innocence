[![POI Node Unit Tests](https://github.com/Railgun-Community/private-proof-of-innocence/actions/workflows/poi-node-unit-tests.yml/badge.svg?branch=main)](https://github.com/Railgun-Community/private-proof-of-innocence/actions)

# RAILGUN Private Proof Of Innocence

This repository contains the codebase for the RAILGUN Private Proofs of Innocence (PPOI) Node and Dashboard, compatible with NodeJS environments.

## Introduction

Private Proofs of Innocence is a tool to give cryptographic assurance that tokens entering the RAILGUN smart contract are not from a known list of interactions, or actors considered undesirable by respective wallet providers.

## Installation

To use the RAILGUN PPOI Node package in your project:

```bash
yarn add @railgun-community/proof-of-innocence
```

## Requirements

- Node.js version 16.20.x or higher
- Yarn package manager
- MongoDB

## Deployment

### POI Node

- Ensure the server meets the above requirements.
- Run ./start-node to deploy the POI Node.

### POI Dashboard

- Ensure the server meets the requirements (excluding MongoDB).
- Run ./start-dash to deploy the POI Dashboard.

## Contributing

Contributions to the RAILGUN POI project are welcome! Please refer to our contribution guidelines for more information.

## Documentation

For more detailed information about the project, please refer to the documentation.

## License

This project is licensed under [GPL-3.0-only].

## Support and Community

If you have any questions or need support, please join our community forum or Discord server.
