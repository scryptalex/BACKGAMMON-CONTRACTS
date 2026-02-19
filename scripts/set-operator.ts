import { ethers } from "hardhat";

async function main() {
  // Get the operator address from command line argument or env
  const operatorAddress = process.env.OPERATOR_ADDRESS;
  const contractAddress = process.env.GAME_ESCROW_ADDRESS;
  
  if (!operatorAddress) {
    console.error("ERROR: Set OPERATOR_ADDRESS environment variable");
    console.error("Usage: OPERATOR_ADDRESS=0x... GAME_ESCROW_ADDRESS=0x... npx hardhat run scripts/set-operator.ts --network polygon");
    process.exit(1);
  }
  
  if (!contractAddress) {
    console.error("ERROR: Set GAME_ESCROW_ADDRESS environment variable");
    process.exit(1);
  }

  const [owner] = await ethers.getSigners();
  console.log("Setting operator with owner account:", owner.address);

  // Connect to deployed contract
  const GameEscrow = await ethers.getContractFactory("GameEscrow");
  const gameEscrow = GameEscrow.attach(contractAddress);

  // Check current operator
  const currentOperator = await gameEscrow.getOperator();
  console.log("Current operator:", currentOperator);

  if (currentOperator.toLowerCase() === operatorAddress.toLowerCase()) {
    console.log("Operator is already set to this address. No action needed.");
    return;
  }

  // Set new operator
  console.log("Setting new operator to:", operatorAddress);
  const tx = await gameEscrow.setOperator(operatorAddress);
  console.log("Transaction sent:", tx.hash);
  
  await tx.wait();
  console.log("Transaction confirmed!");

  // Verify
  const newOperator = await gameEscrow.getOperator();
  console.log("New operator set:", newOperator);
  
  console.log("\n========================================");
  console.log("OPERATOR SET SUCCESSFULLY");
  console.log("========================================");
  console.log("Contract:  ", contractAddress);
  console.log("Operator:  ", newOperator);
  console.log("Owner:     ", owner.address);
  console.log("========================================");
  console.log("\nNow add BACKEND_PRIVATE_KEY to Render with the operator's private key");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
