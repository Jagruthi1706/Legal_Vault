import hardhat from 'hardhat';
const { ethers, network } = hardhat;

async function main() {
  const [deployer] = await ethers.getSigners();
  const networkInfo = await ethers.provider.getNetwork();

  console.log('Network:', network.name);
  console.log('Chain ID:', networkInfo.chainId.toString());
  console.log('Deploying LegalVault with account:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Deployer balance (wei):', balance.toString());

  const LegalVault = await ethers.getContractFactory('LegalVault');
  const legalVault = await LegalVault.deploy();
  await legalVault.waitForDeployment();

  const targetAddress = await legalVault.getAddress();
  const owner = await legalVault.owner();

  console.log('LegalVault deployed to:', targetAddress);
  console.log('Contract owner:', owner);
  console.log('Owner matches deployer:', owner.toLowerCase() === deployer.address.toLowerCase());
  console.log('');
  console.log('Set these in backend/.env:');
  console.log(`BLOCKCHAIN_CONTRACT_ADDRESS=${targetAddress}`);
  console.log(`BLOCKCHAIN_CHAIN_ID=${networkInfo.chainId.toString()}`);
  if (Number(networkInfo.chainId) === 11155111) {
    console.log(`Explorer: https://sepolia.etherscan.io/address/${targetAddress}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
