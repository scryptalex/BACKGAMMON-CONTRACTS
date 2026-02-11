import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { GameEscrow, MockUSDT } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("GameEscrow", function () {
  const INITIAL_BALANCE = ethers.parseUnits("10000", 6); // 10000 USDT
  const STAKE_AMOUNT = ethers.parseUnits("100", 6); // 100 USDT
  
  async function deployContractsFixture() {
    const [owner, player1, player2, player3] = await ethers.getSigners();
    
    // Deploy MockUSDT
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    const mockUSDT = await MockUSDT.deploy();
    
    // Deploy GameEscrow
    const GameEscrow = await ethers.getContractFactory("GameEscrow");
    const gameEscrow = await GameEscrow.deploy(await mockUSDT.getAddress());
    
    // Mint USDT to players
    await mockUSDT.mint(player1.address, INITIAL_BALANCE);
    await mockUSDT.mint(player2.address, INITIAL_BALANCE);
    await mockUSDT.mint(player3.address, INITIAL_BALANCE);
    
    return { gameEscrow, mockUSDT, owner, player1, player2, player3 };
  }
  
  describe("Deployment", function () {
    it("Should set the right USDT token address", async function () {
      const { gameEscrow, mockUSDT } = await loadFixture(deployContractsFixture);
      expect(await gameEscrow.usdt()).to.equal(await mockUSDT.getAddress());
    });
    
    it("Should set the right owner", async function () {
      const { gameEscrow, owner } = await loadFixture(deployContractsFixture);
      expect(await gameEscrow.owner()).to.equal(owner.address);
    });
    
    it("Should set default commission to 5%", async function () {
      const { gameEscrow } = await loadFixture(deployContractsFixture);
      expect(await gameEscrow.commission()).to.equal(500n); // 500 basis points = 5%
    });
  });
  
  describe("Deposits", function () {
    it("Should allow users to deposit USDT", async function () {
      const { gameEscrow, mockUSDT, player1 } = await loadFixture(deployContractsFixture);
      const depositAmount = ethers.parseUnits("500", 6);
      
      await mockUSDT.connect(player1).approve(await gameEscrow.getAddress(), depositAmount);
      await expect(gameEscrow.connect(player1).deposit(depositAmount))
        .to.emit(gameEscrow, "Deposit")
        .withArgs(player1.address, depositAmount);
      
      expect(await gameEscrow.getBalance(player1.address)).to.equal(depositAmount);
    });
    
    it("Should revert deposit with zero amount", async function () {
      const { gameEscrow, player1 } = await loadFixture(deployContractsFixture);
      await expect(gameEscrow.connect(player1).deposit(0))
        .to.be.revertedWith("Amount must be > 0");
    });
  });
  
  describe("Withdrawals", function () {
    it("Should allow users to withdraw USDT", async function () {
      const { gameEscrow, mockUSDT, player1 } = await loadFixture(deployContractsFixture);
      const depositAmount = ethers.parseUnits("500", 6);
      const withdrawAmount = ethers.parseUnits("200", 6);
      
      await mockUSDT.connect(player1).approve(await gameEscrow.getAddress(), depositAmount);
      await gameEscrow.connect(player1).deposit(depositAmount);
      
      await expect(gameEscrow.connect(player1).withdraw(withdrawAmount))
        .to.emit(gameEscrow, "Withdraw")
        .withArgs(player1.address, withdrawAmount);
      
      expect(await gameEscrow.getBalance(player1.address)).to.equal(depositAmount - withdrawAmount);
    });
    
    it("Should revert withdrawal with insufficient balance", async function () {
      const { gameEscrow, mockUSDT, player1 } = await loadFixture(deployContractsFixture);
      const depositAmount = ethers.parseUnits("100", 6);
      const withdrawAmount = ethers.parseUnits("200", 6);
      
      await mockUSDT.connect(player1).approve(await gameEscrow.getAddress(), depositAmount);
      await gameEscrow.connect(player1).deposit(depositAmount);
      
      await expect(gameEscrow.connect(player1).withdraw(withdrawAmount))
        .to.be.revertedWith("Insufficient balance");
    });
  });
  
  describe("Game Creation", function () {
    it("Should allow creating a game", async function () {
      const { gameEscrow, mockUSDT, player1 } = await loadFixture(deployContractsFixture);
      
      // Deposit first
      await mockUSDT.connect(player1).approve(await gameEscrow.getAddress(), STAKE_AMOUNT);
      await gameEscrow.connect(player1).deposit(STAKE_AMOUNT);
      
      // Create game
      await expect(gameEscrow.connect(player1).createGame(STAKE_AMOUNT))
        .to.emit(gameEscrow, "GameCreated")
        .withArgs(0n, player1.address, STAKE_AMOUNT);
      
      const game = await gameEscrow.getGame(0);
      expect(game.player1).to.equal(player1.address);
      expect(game.stake).to.equal(STAKE_AMOUNT);
      expect(game.completed).to.equal(false);
    });
    
    it("Should revert game creation with insufficient balance", async function () {
      const { gameEscrow, player1 } = await loadFixture(deployContractsFixture);
      await expect(gameEscrow.connect(player1).createGame(STAKE_AMOUNT))
        .to.be.revertedWith("Insufficient balance");
    });
  });
  
  describe("Joining Games", function () {
    it("Should allow joining a game", async function () {
      const { gameEscrow, mockUSDT, player1, player2 } = await loadFixture(deployContractsFixture);
      
      // Player 1 deposits and creates game
      await mockUSDT.connect(player1).approve(await gameEscrow.getAddress(), STAKE_AMOUNT);
      await gameEscrow.connect(player1).deposit(STAKE_AMOUNT);
      await gameEscrow.connect(player1).createGame(STAKE_AMOUNT);
      
      // Player 2 deposits and joins game
      await mockUSDT.connect(player2).approve(await gameEscrow.getAddress(), STAKE_AMOUNT);
      await gameEscrow.connect(player2).deposit(STAKE_AMOUNT);
      
      await expect(gameEscrow.connect(player2).joinGame(0))
        .to.emit(gameEscrow, "GameJoined")
        .withArgs(0n, player2.address);
      
      const game = await gameEscrow.getGame(0);
      expect(game.player2).to.equal(player2.address);
    });
    
    it("Should revert if joining own game", async function () {
      const { gameEscrow, mockUSDT, player1 } = await loadFixture(deployContractsFixture);
      const doubleStake = STAKE_AMOUNT * 2n;
      
      await mockUSDT.connect(player1).approve(await gameEscrow.getAddress(), doubleStake);
      await gameEscrow.connect(player1).deposit(doubleStake);
      await gameEscrow.connect(player1).createGame(STAKE_AMOUNT);
      
      await expect(gameEscrow.connect(player1).joinGame(0))
        .to.be.revertedWith("Cannot join own game");
    });
    
    it("Should revert if game is already full", async function () {
      const { gameEscrow, mockUSDT, player1, player2, player3 } = await loadFixture(deployContractsFixture);
      
      // Setup players
      await mockUSDT.connect(player1).approve(await gameEscrow.getAddress(), STAKE_AMOUNT);
      await gameEscrow.connect(player1).deposit(STAKE_AMOUNT);
      await mockUSDT.connect(player2).approve(await gameEscrow.getAddress(), STAKE_AMOUNT);
      await gameEscrow.connect(player2).deposit(STAKE_AMOUNT);
      await mockUSDT.connect(player3).approve(await gameEscrow.getAddress(), STAKE_AMOUNT);
      await gameEscrow.connect(player3).deposit(STAKE_AMOUNT);
      
      // Create and fill game
      await gameEscrow.connect(player1).createGame(STAKE_AMOUNT);
      await gameEscrow.connect(player2).joinGame(0);
      
      // Try to join again
      await expect(gameEscrow.connect(player3).joinGame(0))
        .to.be.revertedWith("Game already full");
    });
  });
  
  describe("Game Completion", function () {
    it("Should complete game and distribute winnings", async function () {
      const { gameEscrow, mockUSDT, owner, player1, player2 } = await loadFixture(deployContractsFixture);
      
      // Setup and start game
      await mockUSDT.connect(player1).approve(await gameEscrow.getAddress(), STAKE_AMOUNT);
      await gameEscrow.connect(player1).deposit(STAKE_AMOUNT);
      await mockUSDT.connect(player2).approve(await gameEscrow.getAddress(), STAKE_AMOUNT);
      await gameEscrow.connect(player2).deposit(STAKE_AMOUNT);
      
      await gameEscrow.connect(player1).createGame(STAKE_AMOUNT);
      await gameEscrow.connect(player2).joinGame(0);
      
      // Complete game with player1 as winner
      const totalPot = STAKE_AMOUNT * 2n; // 200 USDT
      const commission = (totalPot * 500n) / 10000n; // 5% = 10 USDT
      const payout = totalPot - commission; // 190 USDT
      
      await expect(gameEscrow.connect(owner).completeGame(0, player1.address))
        .to.emit(gameEscrow, "GameCompleted")
        .withArgs(0n, player1.address, payout, commission);
      
      expect(await gameEscrow.getBalance(player1.address)).to.equal(payout);
      expect(await gameEscrow.totalCommission()).to.equal(commission);
    });
    
    it("Should revert if non-owner tries to complete game", async function () {
      const { gameEscrow, mockUSDT, player1, player2 } = await loadFixture(deployContractsFixture);
      
      await mockUSDT.connect(player1).approve(await gameEscrow.getAddress(), STAKE_AMOUNT);
      await gameEscrow.connect(player1).deposit(STAKE_AMOUNT);
      await mockUSDT.connect(player2).approve(await gameEscrow.getAddress(), STAKE_AMOUNT);
      await gameEscrow.connect(player2).deposit(STAKE_AMOUNT);
      
      await gameEscrow.connect(player1).createGame(STAKE_AMOUNT);
      await gameEscrow.connect(player2).joinGame(0);
      
      await expect(gameEscrow.connect(player1).completeGame(0, player1.address))
        .to.be.revertedWithCustomError(gameEscrow, "OwnableUnauthorizedAccount");
    });
  });
  
  describe("Game Cancellation", function () {
    it("Should allow cancelling a game that hasn't started", async function () {
      const { gameEscrow, mockUSDT, player1 } = await loadFixture(deployContractsFixture);
      
      await mockUSDT.connect(player1).approve(await gameEscrow.getAddress(), STAKE_AMOUNT);
      await gameEscrow.connect(player1).deposit(STAKE_AMOUNT);
      await gameEscrow.connect(player1).createGame(STAKE_AMOUNT);
      
      expect(await gameEscrow.getBalance(player1.address)).to.equal(0n);
      
      await expect(gameEscrow.connect(player1).cancelGame(0))
        .to.emit(gameEscrow, "GameCancelled")
        .withArgs(0n, player1.address);
      
      expect(await gameEscrow.getBalance(player1.address)).to.equal(STAKE_AMOUNT);
    });
    
    it("Should revert cancellation if game already started", async function () {
      const { gameEscrow, mockUSDT, player1, player2 } = await loadFixture(deployContractsFixture);
      
      await mockUSDT.connect(player1).approve(await gameEscrow.getAddress(), STAKE_AMOUNT);
      await gameEscrow.connect(player1).deposit(STAKE_AMOUNT);
      await mockUSDT.connect(player2).approve(await gameEscrow.getAddress(), STAKE_AMOUNT);
      await gameEscrow.connect(player2).deposit(STAKE_AMOUNT);
      
      await gameEscrow.connect(player1).createGame(STAKE_AMOUNT);
      await gameEscrow.connect(player2).joinGame(0);
      
      await expect(gameEscrow.connect(player1).cancelGame(0))
        .to.be.revertedWith("Game already started");
    });
  });
  
  describe("Commission Management", function () {
    it("Should allow owner to change commission", async function () {
      const { gameEscrow, owner } = await loadFixture(deployContractsFixture);
      
      await expect(gameEscrow.connect(owner).setCommission(1000))
        .to.emit(gameEscrow, "CommissionUpdated")
        .withArgs(500n, 1000n);
      
      expect(await gameEscrow.commission()).to.equal(1000n); // 10%
    });
    
    it("Should revert if commission exceeds 15%", async function () {
      const { gameEscrow, owner } = await loadFixture(deployContractsFixture);
      
      await expect(gameEscrow.connect(owner).setCommission(1600))
        .to.be.revertedWith("Max 15%");
    });
    
    it("Should allow owner to withdraw commissions", async function () {
      const { gameEscrow, mockUSDT, owner, player1, player2 } = await loadFixture(deployContractsFixture);
      
      // Play a game to generate commission
      await mockUSDT.connect(player1).approve(await gameEscrow.getAddress(), STAKE_AMOUNT);
      await gameEscrow.connect(player1).deposit(STAKE_AMOUNT);
      await mockUSDT.connect(player2).approve(await gameEscrow.getAddress(), STAKE_AMOUNT);
      await gameEscrow.connect(player2).deposit(STAKE_AMOUNT);
      
      await gameEscrow.connect(player1).createGame(STAKE_AMOUNT);
      await gameEscrow.connect(player2).joinGame(0);
      await gameEscrow.connect(owner).completeGame(0, player1.address);
      
      const commission = await gameEscrow.totalCommission();
      
      const ownerBalanceBefore = await mockUSDT.balanceOf(owner.address);
      
      await expect(gameEscrow.connect(owner).withdrawCommission(commission))
        .to.emit(gameEscrow, "CommissionWithdrawn")
        .withArgs(owner.address, commission);
      
      expect(await mockUSDT.balanceOf(owner.address)).to.equal(ownerBalanceBefore + commission);
      expect(await gameEscrow.totalCommission()).to.equal(0n);
    });
  });
});
