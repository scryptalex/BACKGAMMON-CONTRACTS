import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Deploy MockUSDT first (for testnet)
  console.log("\n1. Deploying MockUSDT...");
  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  const mockUSDT = await MockUSDT.deploy();
  await mockUSDT.waitForDeployment();
  const mockUSDTAddress = await mockUSDT.getAddress();
  console.log("MockUSDT deployed to:", mockUSDTAddress);

  // Deploy GameEscrow
  console.log("\n2. Deploying GameEscrow...");
  const GameEscrow = await ethers.getContractFactory("GameEscrow");
  const gameEscrow = await GameEscrow.deploy(mockUSDTAddress);
  await gameEscrow.waitForDeployment();
  const gameEscrowAddress = await gameEscrow.getAddress();
  console.log("GameEscrow deployed to:", gameEscrowAddress);

  // Summary
  console.log("\n========================================");
  console.log("Deployment Summary:");
  console.log("========================================");
  console.log("MockUSDT:    ", mockUSDTAddress);
  console.log("GameEscrow:  ", gameEscrowAddress);
  console.log("Owner:       ", deployer.address);
  console.log("========================================");

  // Save deployment addresses
  console.log("\nEnvironment Variables for .env:");
  console.log(`USDT_ADDRESS=${mockUSDTAddress}`);
  console.log(`CONTRACT_ADDRESS=${gameEscrowAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
