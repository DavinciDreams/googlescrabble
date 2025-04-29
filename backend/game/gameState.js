const { TILE_DISTRIBUTION, BOARD_SIZE, RACK_SIZE, BOARD_LAYOUT, PREMIUM_MAP } = require('./constants');
const _ = require('lodash'); // Requires: npm install lodash

// Function to create the initial tile bag
function createTileBag() {
    const bag = [];
    for (const letter in TILE_DISTRIBUTION) {
        const tileInfo = TILE_DISTRIBUTION[letter];
        for (let i = 0; i < tileInfo.count; i++) {
            bag.push({ letter: letter, value: tileInfo.value });
        }
    }
    return _.shuffle(bag); // Use lodash to shuffle
}

// Function to initialize the board
function initializeBoard() {
    const board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
    // Add premium square info (optional, could be checked dynamically via constants)
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const premiumCode = BOARD_LAYOUT[r][c];
            if (premiumCode !== 0) {
                board[r][c] = { premium: PREMIUM_MAP[premiumCode], tile: null }; // Store premium type
            } else {
                 board[r][c] = { premium: null, tile: null };
            }
        }
    }
    return board;
}


class GameState {
    constructor(gameId) {
        this.gameId = gameId;
        this.players = []; // { id: socket.id, username: 'name', score: 0, rack: [], isTurn: false }
        this.board = initializeBoard();
        this.tileBag = createTileBag();
        this.currentTurnIndex = -1; // No one's turn until game starts
        this.status = 'waiting'; // 'waiting', 'playing', 'finished'
        this.consecutivePasses = 0;
        this.moveHistory = []; // Optional: Store history of moves
        this.lastMove = null; // Optional: Details of the last move for scoring/challenges
    }

    addPlayer(playerId, username) {
        if (this.players.length < 4 && this.status === 'waiting') { // Limit players (e.g., max 4)
             const player = {
                 id: playerId,
                 username: username,
                 score: 0,
                 rack: [],
                 isTurn: false
             };
             this.players.push(player);
             console.log(`Player ${username} (${playerId}) added to game ${this.gameId}`);
             return player;
        }
        console.log(`Failed to add player ${username} (${playerId}) to game ${this.gameId}. Limit reached or game started.`);
        return null;
    }

    startGame() {
        if (this.players.length >= 2 && this.status === 'waiting') { // Need at least 2 players
            this.status = 'playing';
            this.players.forEach(player => {
                this.drawInitialTiles(player);
            });
            this.currentTurnIndex = 0; // First player's turn
            this.players[this.currentTurnIndex].isTurn = true;
            console.log(`Game ${this.gameId} started with players: ${this.players.map(p => p.username).join(', ')}`);
            return true;
        }
        console.log(`Failed to start game ${this.gameId}. Need at least 2 players.`);
        return false;
    }

    drawTiles(player, numTiles) {
        const drawnTiles = [];
        for (let i = 0; i < numTiles && this.tileBag.length > 0; i++) {
            drawnTiles.push(this.tileBag.pop());
        }
        player.rack.push(...drawnTiles);
        console.log(`Player ${player.username} drew ${drawnTiles.length} tiles. Bag remaining: ${this.tileBag.length}`);
        return drawnTiles;
    }

     drawInitialTiles(player) {
        this.drawTiles(player, RACK_SIZE);
    }


    // --- Placeholder Methods for Game Logic ---
    // These would likely call functions from gameLogic.js

    validateAndPlaceMove(playerId, move) {
        // TODO: Call validation logic from gameLogic.js
        // If valid: update board, player score, player rack (draw new tiles)
        // If invalid: return error
        console.warn("validateAndPlaceMove not implemented");
        return { success: false, message: "Not implemented" };
    }

    passTurn(playerId) {
        // TODO: Check if it's the player's turn
        // Increment consecutivePasses
        // Check for end game by passes
        // Advance turn
        console.warn("passTurn not implemented");
        this.advanceTurn(); // Basic turn advance for now
        return { success: true };
    }

    exchangeTiles(playerId, tilesToExchange) {
         // TODO: Check turn, check if tiles are in rack, check if enough tiles in bag
         // Return tiles to bag, shuffle bag, draw new tiles, advance turn
        console.warn("exchangeTiles not implemented");
        this.advanceTurn(); // Basic turn advance for now
         return { success: true };
    }

    advanceTurn() {
        if (this.status !== 'playing') return;

        this.players[this.currentTurnIndex].isTurn = false;
        this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
        this.players[this.currentTurnIndex].isTurn = true;
        this.consecutivePasses = 0; // Reset passes if turn advanced normally (should be reset on successful move/exchange)
        console.log(`Turn advanced to player: ${this.players[this.currentTurnIndex].username}`);

        // TODO: Add end game checks here (bag empty + rack empty, max passes)
    }

    getPublicState() {
        // Return a version of the state safe to send to all clients
        // (e.g., don't send other players' racks directly if rules hide them)
        // For simplicity now, we send most things, but hide racks of others.
         return {
             gameId: this.gameId,
             players: this.players.map(p => ({ // Send score, username, tile count, isTurn
                 id: p.id,
                 username: p.username,
                 score: p.score,
                 rackTileCount: p.rack.length, // Don't send actual tiles
                 isTurn: p.isTurn
             })),
             board: this.board, // Send the full board state
             tilesRemaining: this.tileBag.length,
             currentTurnPlayerId: this.players[this.currentTurnIndex]?.id, // Handle case before start
             status: this.status,
             lastMove: this.lastMove // Send details of last move
         };
    }

     getPlayerSpecificState(playerId) {
        // Return state tailored for a specific player (includes their rack)
        const publicState = this.getPublicState();
        const player = this.players.find(p => p.id === playerId);
        return {
            ...publicState,
            myRack: player ? player.rack : [] // Include the specific player's rack
        };
    }
}

module.exports = GameState;