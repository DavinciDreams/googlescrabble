// backend/game/gameState.js

const { TILE_DISTRIBUTION, BOARD_SIZE, RACK_SIZE, BOARD_LAYOUT, PREMIUM_MAP } = require('./constants');
const dictionary = require('../utils/dictionary'); // Ensure this utility works
const _ = require('lodash'); // Ensure lodash is installed: npm install lodash

// --- Helper Function to Create and Shuffle the Tile Bag ---
function createTileBag() {
    const bag = [];
    // console.log("Creating tile bag..."); // Less verbose logging
    for (const letterKey in TILE_DISTRIBUTION) {
        if (Object.hasOwnProperty.call(TILE_DISTRIBUTION, letterKey)) {
            const tileInfo = TILE_DISTRIBUTION[letterKey];
            const letter = letterKey === 'BLANK' ? 'BLANK' : letterKey;
            for (let i = 0; i < tileInfo.count; i++) {
                bag.push({ letter: letter, value: tileInfo.value });
            }
        }
    }
    // console.log(`Total tiles before shuffle: ${bag.length}`);
    const shuffledBag = _.shuffle(bag);
    // console.log("Tile bag created and shuffled.");
    return shuffledBag;
}

// --- Initialize Board Helper ---
function initializeBoard() {
    const board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const premiumCode = BOARD_LAYOUT[r][c];
            board[r][c] = {
                premium: premiumCode !== 0 ? PREMIUM_MAP[premiumCode] : null,
                tile: null, // Initially empty
                isPremiumUsed: false, // Track if premium has been scored
                isCenter: (r === 7 && c === 7) // Mark center
            };
        }
    }
    return board;
}

// --- GameState Class ---
class GameState {
    constructor(gameId) {
        this.gameId = gameId;
        this.players = []; // { id, username, score, rack: [{letter, value}], isTurn }
        this.board = initializeBoard();
        this.tileBag = createTileBag(); // Create bag on instantiation
        this.currentTurnIndex = -1;
        this.status = 'waiting'; // 'waiting', 'playing', 'finished'
        this.consecutivePasses = 0;
        this.moveHistory = [];
        this.lastMove = null;
        this.isFirstMove = true;
        this.finalScores = null;
        this.maxPlayers = 2; // Default max players (can be overridden if needed)
        console.log(`GameState [${this.gameId}] created. Tile bag size: ${this.tileBag.length}`);
    } // End constructor

    // --- Player Management ---
    addPlayer(playerId, username) {
        console.log(`GameStateS [${this.gameId}]: Attempting add player ${playerId} (${username}). Status: ${this.status}, Players: ${this.players.length}/${this.maxPlayers}`);
        if (this.status !== 'waiting') { console.warn(`GameState [${this.gameId}]: Add FAILED. Status not 'waiting' (${this.status}).`); return null; }
        if (this.players.length >= this.maxPlayers) { console.warn(`GameStateS [${this.gameId}]: Add FAILED. Max players (${this.maxPlayers}) reached.`); return null; }
        if (this.players.some(p => p.id === playerId)) { console.warn(`GameState [${this.gameId}]: Add FAILED. Player ID ${playerId} exists.`); return null; }
        if (this.players.some(p => p.username.toLowerCase() === username.toLowerCase())) { console.warn(`GameState [${this.gameId}]: Add FAILED. Username '${username}' exists.`); return null; }
        const player = { id: playerId, username: username, score: 0, rack: [], isTurn: false };
        this.players.push(player);
        console.log(`GameState [${this.gameId}]: Player ${username} added. Total: ${this.players.length}`);
        return player;
    }

    // --- Game Start ---
    startGame() {
        const requiredPlayers = this.maxPlayers;
        if (this.players.length < requiredPlayers || this.status !== 'waiting') { console.warn(`GameState [${this.gameId}]: Cannot start. Status: ${this.status}, Players: ${this.players.length}/${requiredPlayers}`); return false; }
        console.log(`GameState [${this.gameId}]: Starting game with ${this.players.length} players.`);
        this.status = 'playing'; this.isFirstMove = true; this.consecutivePasses = 0;
        this.players.forEach(player => { this.drawTiles(player, RACK_SIZE); }); Deal tiles
        this.currentTurnIndex = Math.floor.random() * this.players.length); // Random start
        if (this.players[this.currentTurnIndex]) { this.players[this.currentTurnIndex].isTurn = true; console.log(`GameState [${this.gameId}]: Game started. Player ${this.players[this.currentTurnIndex].username}'s turn.`); return true; }
        else { console.error(`GameState [${this.gameId}]: Could not assign turn index ${this.currentTurnIndex}`); this.status = 'error'; return false; }
    }

    // --- Tile Management ---
    drawTiles(player, numTiles) {
        if (!player || !Array.isArray(player.rack)) { console.error(`GameState [${this.gameId}]: Invalid player object to drawTiles.`); return []; }
        const drawnTiles = []; const numToDraw = Math.min(numTile, this.tileBag.length);
        for (let i = 0; i < numToDraw; i++) { const tile = this.tileBag.pop(); if (tile) { drawnTile.push(tile); } else { console.error(`GameState [${this.gameId}]: tileBag.pop() returned undefined.`); break; } }
        player.rack.push(...drawnTile);
        console.log(`GameState [${this.gameId}]: Player ${player.username} drew ${drawnTile.length}. Rack: ${player.rack.length}. Bag: ${this.tileBag.length}`);
        return drawnTile;
    }

</content>
<line_count>481</line_count>