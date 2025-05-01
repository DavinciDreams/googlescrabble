// backend/game/gameState.js

const { TILE_DISTRIBUTION, BOARD_SIZE, RACK_SIZE, BOARD_LAYOUT, PREMIUM_MAP } = require('./constants');
// Remove dictionary import if only used by helpers
// const dictionary = require('../utils/dictionary');
const _ = require('lodash');
// ---> Import the logic functions <---
const gameLogic = require('./gameLogic');

// --- Helper Functions (createTileBag, initializeBoard) ---
// (Keep these as they are specific to GameState initialization)
function createTileBag() { /* ... */ }
function initializeBoard() { /* ... */ }

// --- GameState Class ---
class GameState {
    constructor(gameId) {
        // ... (constructor properties remain the same) ...
         this.gameId = gameId; this.players = []; this.board = initializeBoard(); this.tileBag = createTileBag();
         this.currentTurnIndex = -1; this.status = 'waiting'; this.consecutivePasses = 0; this.moveHistory = [];
         this.lastMove = null; this.isFirstMove = true; this.finalScores = null; this.maxPlayers = 2;
         console.log(`GameState [${this.gameId}] created. Bag size: ${this.tileBag.length}`);
    }

    // --- Player Management, Game Start, Tile Management, Turn Logic ---
    // (Keep addPlayer, startGame, drawTiles, _checkTurn, advanceTurn, passTurn, exchangeTiles as they modify 'this')
    addPlayer(playerId, username) { /* ... implementation ... */ }
    startGame() { /* ... implementation ... */ }
    drawTiles(player, numTiles) { /* ... implementation ... */ }
    _checkTurn(playerId) { /* ... implementation ... */ }
    advanceTurn() { /* ... implementation ... */ }
    passTurn(playerId) { /* ... implementation ... */ }
    exchangeTiles(playerId, lettersToExchange) { /* ... implementation ... */ }

    // --->>> REFACTORED placeValidMove <<<---
    placeValidMove(playerId, move) {
        const turnCheck = this._checkTurn(playerId);
        if (!turnCheck.valid) return { success: false, error: turnCheck.error };
        const player = this.players[this.currentTurnIndex];
        if (!player) return { success: false, error: 'Internal error: Player not found.' };

        // 1. Validate Tiles in Rack (Remains inside GameState as it needs player.rack)
        const neededTiles = {};
        for (const tile of move) { const requiredLetter = tile.isBlank ? 'BLANK' : tile.letter?.toUpperCase(); if (!requiredLetter) return { success: false, error: 'Invalid tile letter.'}; neededTiles[requiredLetter] = (neededTiles[requiredLetter] || 0) + 1; }
        const currentRack = {}; player.rack.forEach(t => { currentRack[t.letter] = (currentRack[t.letter] || 0) + 1; });
        for (const letter in neededTiles) { if (!currentRack[letter] || currentRack[letter] < neededTiles[letter]) { return { success: false, error: `Not enough '${letter}' tiles.` }; } }
        console.log(`GameState [${this.gameId}]: Rack validation PASSED.`);

        // ---> 2. Call External Placement Validation <---
        const placementValidation = gameLogic.validatePlacement(this.board, move, this.isFirstMove);
        if (!placementValidation.valid) return { success: false, error: placementValidation.error };
        const { orientation, lineCoords } = placementValidation;
        console.log(`GameState [${this.gameId}]: Placement validation PASSED.`);

        // ---> 3. Call External Word Finding & Validation <---
        const formedWordsResult = gameLogic.findFormedWords(this.board, move, orientation, lineCoords);
        if (!formedWordsResult.valid) return { success: false, error: formedWordsResult.error };
        const { wordsData } = formedWordsResult;
        console.log(`GameState [${this.gameId}]: Word validation PASSED.`);

        // ---> 4. Call External Score Calculation <---
        const scoreResult = gameLogic.calculateScore(this.board, move, wordsData, this.isFirstMove);
        const totalScore = scoreResult.score;
        const bingoBonus = scoreResult.bingoBonus;
        console.log(`GameState [${this.gameId}]: Score calculated: ${totalScore}`);

        // --- 5. Update Game State (COMMIT PHASE - Stays in GameState) ---
        const rackTilesToRemove = []; const currentRackCopy = [...player.rack];
        // a. Update board & mark premiums used
        for (const tile of move) {
             const square = this.board[tile.row][tile.col];
             const requiredLetter = tile.isBlank ? 'BLANK' : tile.letter.toUpperCase();
             const rackTileIndex = currentRackCopy.findIndex(t => t.letter === requiredLetter);
             if (rackTileIndex === -1) { return { success: false, error: `Internal error: Tile ${requiredLetter} not found.` }; }
             const [rackTile] = currentRackCopy.splice(rackTileIndex, 1);
             rackTilesToRemove.push(rackTile);
             square.tile = { letter: tile.letter.toUpperCase(), value: rackTile.value };
             if (square.premium && !square.isPremiumUsed) { square.isPremiumUsed = true; }
        }
        // b. Update player score
        player.score += totalScore;
        // c. Remove used tiles from rack
        player.rack = player.rack.filter(tile => !rackTilesToRemove.includes(tile));
        // d. Draw new tiles
        this.drawTiles(player, move.length);
        // e. Update game state properties
        this.consecutivePasses = 0; this.isFirstMove = false;
        this.lastMove = { playerId, move: move.map(m=>({...m})), wordsData, score: totalScore, bingoBonus };
        this.moveHistory.push(this.lastMove);

        // --- 6. Advance Turn ---
        this.advanceTurn();
        // --- 7. Check Game Over ---
        const gameOverInfo = this._checkGameOver(player); // Keep _checkGameOver internal
        if (gameOverInfo.isOver) { return { success: true, score: totalScore, gameOver: true, finalScores: this.finalScores }; }
        else { return { success: true, score: totalScore, gameOver: false }; }
    } // ---> End of placeValidMove method <---


    // --- Game Ending Logic (Stays in GameState) ---
    _checkGameOver(lastPlayer) {
        if (this.tileBag.length === 0 && lastPlayer?.rack.length === 0) {
            this._endGame('tiles'); return { isOver: true, reason: 'tiles' };
        } return { isOver: false };
    }
    _endGame(reason) {
         if (this.status === 'finished') return; this.status = 'finished'; console.log(/*...*/); let scoreSumOfRacks = 0; let playerWhoFinished = null; if (reason === 'tiles') playerWhoFinished = this.players.find(p => p.rack.length === 0);
         for (const player of this.players) { const rackValue = player.rack.reduce((sum, tile) => sum + tile.value, 0); if (player.rack.length > 0) { player.score -= rackValue; scoreSumOfRacks += rackValue; /*...*/ } }
         if (playerWhoFinished) { playerWhoFinished.score += scoreSumOfRacks; /*...*/ }
         this.finalScores = this.players.map(p => ({ id: p.id, username: p.username, finalScore: p.score })).sort((a, b) => b.finalScore - a.finalScore);
         console.log(/*...*/); this.players.forEach(p => p.isTurn = false); this.currentTurnIndex = -1;
    }


    // --- State Serialization (Stays in GameState) ---
    getPublicState() {
        return {
            gameId: this.gameId, players: this.players.map(p => ({ id: p.id, username: p.username, score: p.score, rackTileCount: p.rack.length, isTurn: p.isTurn })),
            board: this.board, tilesRemaining: this.tileBag.length, currentTurnPlayerId: (this.currentTurnIndex >= 0 && this.players[this.currentTurnIndex]) ? this.players[this.currentTurnIndex].id : null,
            status: this.status, lastMove: this.lastMove, consecutivePasses: this.consecutivePasses, finalScores: this.finalScores
        };
    }
    getPlayerSpecificState(playerId) {
        const publicState = this.getPublicState(); const player = this.players.find(p => p.id === playerId);
        return { ...publicState, myRack: player ? [...(player.rack || [])] : [] };
    }

} // ---> End of GameState Class <---

module.exports = GameState;