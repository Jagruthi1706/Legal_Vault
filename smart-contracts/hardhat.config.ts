import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import * as dotenv from 'dotenv';

// Load env from smart-contracts/.env and fallback to backend/.env when present.
dotenv.config();
dotenv.config({ path: '../backend/.env' });

const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || process.env.SEPOLIA_RPC_URL || '';
const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY || process.env.SEPOLIA_PRIVATE_KEY || '';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.21',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 31337,
    },
    sepolia: {
      url: rpcUrl || 'https://rpc.sepolia.org',
      chainId: 11155111,
      accounts: privateKey ? [privateKey] : [],
    },
  },
};

export default config;
