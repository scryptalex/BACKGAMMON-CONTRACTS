import { ethers } from "hardhat";

// Real USDT on Polygon Mainnet
const POLYGON_USDT_ADDRESS = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("========================================");
  console.log("POLYGON MAINNET DEPLOYMENT");
  console.log("========================================");
  console.log("Deploying contracts with the account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account MATIC balance:", ethers.formatEther(balance), "MATIC");
  
  if (balance < ethers.parseEther("0.1")) {
    console.error("WARNING: Low MATIC balance. Deployment may fail.");
    console.error("Please send at least 0.1 MATIC to", deployer.address);
  }

  console.log("\nUsing real USDT address:", POLYGON_USDT_ADDRESS);

  // Deploy GameEscrow with real USDT
  console.log("\nDeploying GameEscrow...");
  const GameEscrow = await ethers.getContractFactory("GameEscrow");
  const gameEscrow = await GameEscrow.deploy(POLYGON_USDT_ADDRESS);
  await gameEscrow.waitForDeployment();
  const gameEscrowAddress = await gameEscrow.getAddress();
  console.log("GameEscrow deployed to:", gameEscrowAddress);

  // Summary
  console.log("\n========================================");
  console.log("DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("Network:         Polygon Mainnet (137)");
  console.log("USDT Address:    ", POLYGON_USDT_ADDRESS);
  console.log("GameEscrow:      ", gameEscrowAddress);
  console.log("Owner:           ", deployer.address);
  console.log("========================================");

  console.log("\n📋 NEXT STEPS:");
  console.log("1. Verify contract on PolygonScan:");
  console.log(`   npx hardhat verify --network polygon ${gameEscrowAddress} "${POLYGON_USDT_ADDRESS}"`);
  console.log("\n2. Add to Render (Backend) Environment Variables:");
  console.log(`   GAME_ESCROW_ADDRESS=${gameEscrowAddress}`);
  console.log(`   RPC_URL=https://polygon-rpc.com`);
  console.log(`   BACKEND_PRIVATE_KEY=<your-operator-wallet-private-key>`);
  console.log("\n3. Add to Vercel (Frontend) Environment Variables:");
  console.log(`   NEXT_PUBLIC_CONTRACT_ADDRESS=${gameEscrowAddress}`);
  console.log("\n4. Set operator (hot wallet) for backend:");
  console.log("   Call setOperator(<operator-address>) from owner wallet");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
