// testScoreMultiplier.js
const GameState = require('./backend/game/gameState');
const { BOARD_SIZE } = require('./backend/game/constants');

// Create a new game state
const gameState = new GameState('testGame');

// Add players
gameState.addPlayer('player1', 'Player 1');
gameState.addPlayer('player2', 'Player 2');

// Start the game
gameState.startGame();

// Add 'A' to player's rack
gameState.players[0].rack.push({ letter: 'A', value: 1 });

// Set player 1's turn
gameState.players[0].isTurn = true;

// Place a tile on the center square (7,7)
const move = [
  { letter: 'A', value: 1, row: 7, col: 7, isBlank: false }
];

// Place the move
const result = gameState.placeValidMove('player1', move);

// Check if the score multiplier was applied
console.log(`Score for move: ${result.score}`);
console.log(`Bingo bonus: ${result.bingoBonus}`);
console.log(`Total score: ${result.score + result.bingoBonus}`);

// Check if the center square is marked as used
const centerSquare = gameState.board[7][7];
console.log(`Center square used: ${centerSquare.isPremiumUsed}`);