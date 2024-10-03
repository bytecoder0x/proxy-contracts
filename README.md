# proxy-contracts

## Overview

This repository contains Solidity smart contracts for an upgradeable ETH vault behind a proxy.

## Smart Contracts

1. **Proxy**: Keeps the implementation and admin addresses in the EIP-1967 slots and forwards all other calls to the implementation with `delegatecall`. Only admin can upgrade the implementation and change the admin.
2. **VaultV1**: ETH vault where users deposit and withdraw. It uses `initialize` instead of a constructor.
3. **VaultV2**: Next version of the vault with a deposit limit per user.

## Technologies Used

- **Solidity**: 0.8.27, with the optimizer enabled.
- **Hardhat Framework**: development, testing and deployment.
- **OpenZeppelin Contracts**: `StorageSlot` and `Initializable`.

## Running the Project

1. Clone the repository.
2. Install dependencies using `npm install`.
3. Create a `.env` file from `.env.example` and fill it in.
4. Compile the smart contracts using `npx hardhat compile`.
5. Run tests using `npx hardhat test`.
6. Deploy using `npx hardhat run scripts/deployProxy.ts --network arbitrumSepolia`.
7. Put the proxy address in `scripts/upgradeVault.ts` and upgrade using `npx hardhat run scripts/upgradeVault.ts --network arbitrumSepolia`.
