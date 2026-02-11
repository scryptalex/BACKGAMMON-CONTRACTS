// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDT
 * @dev Mock USDT token for testing purposes
 */
contract MockUSDT is ERC20 {
    uint8 private _decimals = 6; // USDT uses 6 decimals
    
    constructor() ERC20("Mock USDT", "USDT") {
        // Mint 1 million USDT to deployer
        _mint(msg.sender, 1_000_000 * 10**_decimals);
    }
    
    function decimals() public view override returns (uint8) {
        return _decimals;
    }
    
    /**
     * @dev Mint tokens to any address (for testing)
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    
    /**
     * @dev Faucet function - anyone can get 1000 USDT for testing
     */
    function faucet() external {
        _mint(msg.sender, 1000 * 10**_decimals);
    }
}
