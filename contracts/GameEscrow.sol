// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title GameEscrow
 * @dev Escrow contract for P2P games with USDT stakes
 * 
 * Security model:
 * - Owner (cold wallet): Can withdraw commissions, change settings, set operator
 * - Operator (hot wallet on server): Can only complete games, cannot withdraw funds
 */
contract GameEscrow is Ownable, ReentrancyGuard {
    IERC20 public usdt;
    uint256 public commission = 500; // 5% (basis 10000)
    uint256 public totalCommission;
    
    // Operator address (hot wallet for backend)
    address public operator;
    
    struct Game {
        address player1;
        address player2;
        uint256 stake;
        bool completed;
        address winner;
    }
    
    mapping(uint256 => Game) public games;
    uint256 public gameCounter;
    
    // User balances for deposits
    mapping(address => uint256) public balances;
    
    // Events
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event GameCreated(uint256 indexed gameId, address indexed player1, uint256 stake);
    event GameJoined(uint256 indexed gameId, address indexed player2);
    event GameCompleted(uint256 indexed gameId, address indexed winner, uint256 payout, uint256 commission);
    event GameCancelled(uint256 indexed gameId, address indexed player1);
    event CommissionUpdated(uint256 oldCommission, uint256 newCommission);
    event CommissionWithdrawn(address indexed to, uint256 amount);
    event OperatorUpdated(address indexed oldOperator, address indexed newOperator);
    
    /**
     * @dev Modifier to restrict access to owner or operator
     */
    modifier onlyOperatorOrOwner() {
        require(msg.sender == owner() || msg.sender == operator, "Not authorized");
        _;
    }
    
    constructor(address _usdt) Ownable(msg.sender) {
        require(_usdt != address(0), "Invalid USDT address");
        usdt = IERC20(_usdt);
    }
    
    /**
     * @dev Set operator address (only owner)
     * @param _operator New operator address (set to address(0) to disable)
     */
    function setOperator(address _operator) external onlyOwner {
        emit OperatorUpdated(operator, _operator);
        operator = _operator;
    }
    
    /**
     * @dev Deposit USDT into the platform
     * @param _amount Amount of USDT to deposit
     */
    function deposit(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be > 0");
        require(usdt.transferFrom(msg.sender, address(this), _amount), "Transfer failed");
        balances[msg.sender] += _amount;
        emit Deposit(msg.sender, _amount);
    }
    
    /**
     * @dev Withdraw USDT from the platform
     * @param _amount Amount of USDT to withdraw
     */
    function withdraw(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be > 0");
        require(balances[msg.sender] >= _amount, "Insufficient balance");
        balances[msg.sender] -= _amount;
        require(usdt.transfer(msg.sender, _amount), "Transfer failed");
        emit Withdraw(msg.sender, _amount);
    }
    
    /**
     * @dev Create a new game with a stake
     * @param _stake Amount of USDT to stake
     * @return gameId The ID of the created game
     */
    function createGame(uint256 _stake) external returns (uint256) {
        require(_stake > 0, "Stake must be > 0");
        require(balances[msg.sender] >= _stake, "Insufficient balance");
        
        balances[msg.sender] -= _stake;
        
        uint256 gameId = gameCounter++;
        games[gameId] = Game({
            player1: msg.sender,
            player2: address(0),
            stake: _stake,
            completed: false,
            winner: address(0)
        });
        
        emit GameCreated(gameId, msg.sender, _stake);
        return gameId;
    }
    
    /**
     * @dev Join an existing game
     * @param _gameId ID of the game to join
     */
    function joinGame(uint256 _gameId) external {
        Game storage game = games[_gameId];
        require(game.player1 != address(0), "Game does not exist");
        require(game.player2 == address(0), "Game already full");
        require(!game.completed, "Game already completed");
        require(msg.sender != game.player1, "Cannot join own game");
        require(balances[msg.sender] >= game.stake, "Insufficient balance");
        
        balances[msg.sender] -= game.stake;
        game.player2 = msg.sender;
        
        emit GameJoined(_gameId, msg.sender);
    }
    
    /**
     * @dev Complete a game and distribute winnings (owner or operator)
     * @param _gameId ID of the game to complete
     * @param _winner Address of the winner
     */
    function completeGame(uint256 _gameId, address _winner) external onlyOperatorOrOwner {
        Game storage game = games[_gameId];
        require(!game.completed, "Game already completed");
        require(game.player2 != address(0), "Game not started");
        require(_winner == game.player1 || _winner == game.player2, "Invalid winner");
        
        uint256 totalPot = game.stake * 2;
        uint256 commissionAmount = (totalPot * commission) / 10000;
        uint256 payout = totalPot - commissionAmount;
        
        game.completed = true;
        game.winner = _winner;
        
        balances[_winner] += payout;
        totalCommission += commissionAmount;
        
        emit GameCompleted(_gameId, _winner, payout, commissionAmount);
    }
    
    /**
     * @dev Cancel a game (only if not started)
     * @param _gameId ID of the game to cancel
     */
    function cancelGame(uint256 _gameId) external {
        Game storage game = games[_gameId];
        require(game.player1 == msg.sender, "Not game creator");
        require(game.player2 == address(0), "Game already started");
        require(!game.completed, "Game already completed");
        
        balances[game.player1] += game.stake;
        game.completed = true;
        
        emit GameCancelled(_gameId, msg.sender);
    }
    
    /**
     * @dev Refund a stuck game - returns stakes to both players (owner or operator only)
     * Use this for games that started but couldn't complete normally
     * @param _gameId ID of the game to refund
     */
    function refundStuckGame(uint256 _gameId) external onlyOperatorOrOwner {
        Game storage game = games[_gameId];
        require(!game.completed, "Game already completed");
        require(game.player1 != address(0), "Game does not exist");
        
        // Refund player1
        balances[game.player1] += game.stake;
        
        // Refund player2 if they joined
        if (game.player2 != address(0)) {
            balances[game.player2] += game.stake;
        }
        
        game.completed = true;
        
        emit GameCancelled(_gameId, game.player1);
    }
    
    /**
     * @dev Update commission rate (only owner)
     * @param _commission New commission rate (basis 10000, max 1500 = 15%)
     */
    function setCommission(uint256 _commission) external onlyOwner {
        require(_commission <= 1500, "Max 15%");
        emit CommissionUpdated(commission, _commission);
        commission = _commission;
    }
    
    /**
     * @dev Withdraw accumulated commissions (only owner)
     * @param _amount Amount of commissions to withdraw
     */
    function withdrawCommission(uint256 _amount) external onlyOwner nonReentrant {
        require(_amount <= totalCommission, "Insufficient commission");
        totalCommission -= _amount;
        require(usdt.transfer(owner(), _amount), "Transfer failed");
        emit CommissionWithdrawn(owner(), _amount);
    }
    
    /**
     * @dev Get user balance
     * @param _user Address of the user
     * @return User's balance in the contract
     */
    function getBalance(address _user) external view returns (uint256) {
        return balances[_user];
    }
    
    /**
     * @dev Get game details
     * @param _gameId ID of the game
     * @return Game struct with all details
     */
    function getGame(uint256 _gameId) external view returns (Game memory) {
        return games[_gameId];
    }
    
    /**
     * @dev Get commission rate as percentage
     * @return Commission rate in basis points (e.g., 500 = 5%)
     */
    function getCommissionRate() external view returns (uint256) {
        return commission;
    }
    
    /**
     * @dev Get operator address
     * @return Current operator address
     */
    function getOperator() external view returns (address) {
        return operator;
    }
    
    /**
     * @dev Get contract statistics for admin dashboard
     * @return _totalCommission Total accumulated commission
     * @return _gameCounter Total number of games created
     * @return _commission Current commission rate
     * @return _operator Current operator address
     */
    function getStats() external view returns (
        uint256 _totalCommission,
        uint256 _gameCounter,
        uint256 _commission,
        address _operator
    ) {
        return (totalCommission, gameCounter, commission, operator);
    }
}
