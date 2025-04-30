// backend/game/gameState.js

const { TILE_DISTRIBUTION, BOARD_SIZE, RACK_SIZE, BOARD_LAYOUT, PREMIUM_MAP } = require('./constants');
const dictionary = require('../utils/dictionary');
const _ = require('lodash');

// --- Helper Function to Create and Shuffle the Tile Bag ---
function createTileBag() {
    const bag = [];
    for (const letterKey in TILE_DISTRIBUTION) {
        if (Object.hasOwnProperty.call(TILE_DISTRIBUTION, letterKey)) {
            const tileInfo = TILE_DISTRIBUTION[letterKey];
            const letter = letterKey === 'BLANK' ? 'BLANK' : letterKey;
            for (let i = 0; i < tileInfo.count; i++) {
                bag.push({ letter: letter, value: tileInfo.value });
            }
        }
    }
    const shuffledBag = _.shuffle(bag);
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
                tile: null,
                isPremiumUsed: false,
                isCenter: (r === 7 && c === 7)
            };
        }
    }
    return board;
}

// --- GameState Class ---
class GameState {
    constructor(gameId) {
        this.gameId = gameId;
        this.players = [];
        this.board = initializeBoard();
        this.tileBag = createTileBag();
        this.currentTurnIndex = -1;
        this.status = 'waiting';
        this.consecutivePasses = 0;
        this.moveHistory = [];
        this.lastMove = null;
        this.isFirstMove = true;
        this.finalScores = null;
        this.maxPlayers = 2;
        console.log(`GameState [${this.gameId}] created. Tile bag size: ${this.tileBag.length}`);
    } // ---> Ensure constructor closing brace is present <---

    // --- Player Management ---
    addPlayer(playerId, username) { // ---> Method definition starts here <---
        console.log(`GameState [${this.gameId}]: Attempting add player ${playerId} (${username}). Status: ${this.status}, Players: ${this.players.length}/${this.maxPlayers}`);
        if (this.status !== 'waiting') { console.warn(`GameState [${this.gameId}]: Add FAILED. Status not 'waiting' (${this.status}).`); return null; }
        if (this.players.length >= this.maxPlayers) { console.warn(`GameState [${this.gameId}]: Add FAILED. Max players (${this.maxPlayers}) reached.`); return null; }
        if (this.players.some(p => p.id === playerId)) { console.warn(`GameState [${this.gameId}]: Add FAILED. Player ID ${playerId} exists.`); return null; }
        if (this.players.some(p => p.username.toLowerCase() === username.toLowerCase())) { console.warn(`GameState [${this.gameId}]: Add FAILED. Username '${username}' exists.`); return null; }
        const player = { id: playerId, username: username, score: 0, rack: [], isTurn: false };
        this.players.push(player);
        console.log(`GameState [${this.gameId}]: Player ${username} added. Total: ${this.players.length}`);
        return player;
    } // ---> Ensure method closing brace is present <---

    // --- Game Start ---
    startGame() {
        const requiredPlayers = this.maxPlayers;
        if (this.players.length < requiredPlayers || this.status !== 'waiting') { console.warn(`GameState [${this.gameId}]: Cannot start. Status: ${this.status}, Players: ${this.players.length}/${requiredPlayers}`); return false; }
        console.log(`GameState [${this.gameId}]: Starting game with ${this.players.length} players.`);
        this.status = 'playing'; this.isFirstMove = true; this.consecutivePasses = 0;
        this.players.forEach(player => { this.drawTiles(player, RACK_SIZE); });
        this.currentTurnIndex = Math.floor(Math.random() * this.players.length);
        if (this.players[this.currentTurnIndex]) { this.players[this.currentTurnIndex].isTurn = true; console.log(`GameState [${this.gameId}]: Game started. Player ${this.players[this.currentTurnIndex].username}'s turn.`); return true; }
        else { console.error(`GameState [${this.gameId}]: Could not assign turn index ${this.currentTurnIndex}`); this.status = 'error'; return false; }
    } // ---> Ensure method closing brace is present <---

    // --- Tile Management ---
    drawTiles(player, numTiles) {
        if (!player || !Array.isArray(player.rack)) { console.error(`GameState [${this.gameId}]: Invalid player object to drawTiles.`); return []; }
        const drawnTiles = []; const numToDraw = Math.min(numTiles, this.tileBag.length);
        for (let i = 0; i < numToDraw; i++) { const tile = this.tileBag.pop(); if (tile) { drawnTiles.push(tile); } else { console.error(/*...*/); break; } }
        player.rack.push(...drawnTiles);
        console.log(`GameState [${this.gameId}]: Player ${player.username} drew ${drawnTiles.length}. Rack: ${player.rack.length}. Bag: ${this.tileBag.length}`);
        return drawnTiles;
    } // ---> Ensure method closing brace is present <---

    // --- Turn and State ---
    _checkTurn(playerId) {
        if (this.status !== 'playing') { return { valid: false, error: 'Game is not currently playing.' }; }
        if (this.players.length === 0 || this.currentTurnIndex < 0 || this.currentTurnIndex >= this.players.length) { return { valid: false, error: 'Game state invalid for turn check.' }; }
        if (this.players[this.currentTurnIndex]?.id !== playerId) { return { valid: false, error: 'Not your turn.' }; }
        return { valid: true };
    } // ---> Ensure method closing brace is present <---

    advanceTurn() {
        if (this.status !== 'playing' || this.players.length <= 1) { if (this.players.length === 1 && this.status === 'playing') { console.log(/*...*/); if(this.players[0]) this.players[0].isTurn = true; } return; }
        if(this.currentTurnIndex >= 0 && this.currentTurnIndex < this.players.length) { this.players[this.currentTurnIndex].isTurn = false; }
        this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
        if(this.players[this.currentTurnIndex]) { this.players[this.currentTurnIndex].isTurn = true; console.log(`GameState [${this.gameId}]: Turn advanced to ${this.players[this.currentTurnIndex].username}.`); }
        else { console.error(/*...*/); this.currentTurnIndex = 0; if(this.players.length > 0 && this.players[0]) this.players[0].isTurn = true; }
    } // ---> Ensure method closing brace is present <---

    // --- Player Actions ---
    passTurn(playerId) {
        const turnCheck = this._checkTurn(playerId); if (!turnCheck.valid) return { success: false, error: turnCheck.error };
        this.consecutivePasses++; console.log(`GameState [${this.gameId}]: Player ${playerId} passed. Passes: ${this.consecutivePasses}`);
        const maxPasses = this.players.length * 3;
        if (this.consecutivePasses >= maxPasses) { console.log(/*...*/); this._endGame('passes'); return { success: true, gameOver: true, finalScores: this.finalScores }; }
        else { this.advanceTurn(); return { success: true, gameOver: false }; }
    } // ---> Ensure method closing brace is present <---

    exchangeTiles(playerId, lettersToExchange) {
        const turnCheck = this._checkTurn(playerId); if (!turnCheck.valid) return { success: false, error: turnCheck.error };
        if (this.tileBag.length < lettersToExchange.length) return { success: false, error: 'Not enough tiles in bag.' };
        const player = this.players[this.currentTurnIndex]; if (!player) return { success: false, error: 'Player not found.' };
        const playerRackLetters = player.rack.map(t => t.letter); const tempRack = [...playerRackLetters]; const actualTilesToRemove = [];
        for (const letter of lettersToExchange) { const indexInTemp = tempRack.indexOf(letter); if (indexInTemp === -1) return { success: false, error: `You do not have: ${letter}` }; tempRack.splice(indexInTemp, 1); let found = false; for(let i = 0; i < player.rack.length; i++) { if(player.rack[i].letter === letter && !actualTilesToRemove.some(t => t === player.rack[i])) { actualTilesToRemove.push(player.rack[i]); found = true; break; } } if (!found) { console.error(/*...*/); return { success: false, error: `Internal error validating ${letter}.` }; } }
        player.rack = player.rack.filter(tile => !actualTilesToRemove.includes(tile)); this.tileBag.push(...actualTilesToRemove);
        this.tileBag = _.shuffle(this.tileBag); this.drawTiles(player, lettersToExchange.length);
        this.consecutivePasses = 0; this.advanceTurn();
        console.log(`GameState [${this.gameId}]: Player ${playerId} exchanged ${lettersToExchange.length} tiles.`);
        return { success: true };
    } // ---> Ensure method closing brace is present <---

    placeValidMove(playerId, move) {
        const turnCheck = this._checkTurn(playerId); if (!turnCheck.valid) return { success: false, error: turnCheck.error };
        const player = this.players[this.currentTurnIndex]; if (!player) return { success: false, error: 'Internal error: Current player not found.' };
        // 1. Validate Rack
        const neededTiles = {}; for (const tile of move) { const requiredLetter = tile.isBlank ? 'BLANK' : tile.letter?.toUpperCase(); if (!requiredLetter) return { success: false, error: 'Move has invalid tile letter.'}; neededTiles[requiredLetter] = (neededTiles[requiredLetter] || 0) + 1; }
        const currentRack = {}; player.rack.forEach(t => { currentRack[t.letter] = (currentRack[t.letter] || 0) + 1; });
        for (const letter in neededTiles) { if (!currentRack[letter] || currentRack[letter] < neededTiles[letter]) { console.warn(/*...*/); return { success: false, error: `You don't have enough '${letter}' tiles.` }; } }
        console.log(`GameState [${this.gameId}]: Rack validation PASSED.`);
        // 2. Validate Placement
        const placementValidation = this._validatePlacement(move); if (!placementValidation.valid) return { success: false, error: placementValidation.error };
        const { orientation, lineCoords } = placementValidation; console.log(`GameState [${this.gameId}]: Placement validation PASSED. Orientation: ${orientation}`);
        // 3. Validate Words
        const formedWordsResult = this._findFormedWords(move, orientation, lineCoords); if (!formedWordsResult.valid) return { success: false, error: formedWordsResult.error };
        const { wordsData } = formedWordsResult; if (wordsData.length === 0 && move.length > 0) return { success: false, error: 'Move must form word.' };
        console.log(`GameState [${this.gameId}]: Word validation PASSED. Words: ${wordsData.map(w=>w.word).join(', ')}`);
        // 4. Calculate Score
        const scoreResult = this._calculateScore(move, wordsData); const totalScore = scoreResult.score; const bingoBonus = scoreResult.bingoBonus; console.log(`GameState [${this.gameId}]: Score calculated: ${totalScore} (Bingo: ${bingoBonus})`);
        // 5. Update State
        const rackTilesToRemove = []; const currentRackCopy = [...player.rack];
        for (const tile of move) { /* Update board, track tiles to remove from rack, mark premiums used */
            const square = this.board[tile.row][tile.col]; const requiredLetter = tile.isBlank ? 'BLANK' : tile.letter.toUpperCase(); const rackTileIndex = currentRackCopy.findIndex(t => t.letter === requiredLetter); if (rackTileIndex === -1) { /*...*/ return { success: false, error: /*...*/ }; } const [rackTile] = currentRackCopy.splice(rackTileIndex, 1); rackTilesToRemove.push(rackTile); square.tile = { letter: tile.letter.toUpperCase(), value: rackTile.value }; if (square.premium && !square.isPremiumUsed) { square.isPremiumUsed = true; }
        }
        player.score += totalScore; player.rack = player.rack.filter(tile => !rackTilesToRemove.includes(tile));
        this.drawTiles(player, move.length); this.consecutivePasses = 0; this.isFirstMove = false; this.lastMove = { playerId, move: move.map(m=>({...m})), wordsData, score: totalScore, bingoBonus }; this.moveHistory.push(this.lastMove);
        // 6. Advance Turn
        this.advanceTurn();
        // 7. Check Game Over
        const gameOverInfo = this._checkGameOver(player);
        if (gameOverInfo.isOver) { console.log(/*...*/); return { success: true, score: totalScore, gameOver: true, finalScores: this.finalScores }; }
        else { console.log(/*...*/); return { success: true, score: totalScore, gameOver: false }; }
    } // ---> Ensure method closing brace is present <---

    // --- Complex Logic Helpers ---
    _validatePlacement(move) {
        if (!move || move.length === 0) return { valid: false, error: 'Move is empty.' };
        let minRow = 15, maxRow = -1, minCol = 15, maxCol = -1; const placedCoords = new Set();
        for (const tile of move) { const { row, col } = tile; if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return { valid: false, error: `Tile out of bounds (${row}, ${col}).` }; if (this.board[row]?.[col]?.tile !== null) return { valid: false, error: `Square (${row}, ${col}) occupied.` }; minRow = Math.min(minRow, row); maxRow = Math.max(maxRow, row); minCol = Math.min(minCol, col); maxCol = Math.max(maxCol, col); placedCoords.add(`${row}-${col}`); }
        let orientation = null; if (minRow === maxRow && minCol === maxCol) orientation = 'single'; else if (minRow === maxRow) orientation = 'H'; else if (minCol === maxCol) orientation = 'V'; else return { valid: false, error: 'Tiles must be in a single line.' };
        const lineCoords = []; if (orientation === 'H' || orientation === 'single') { for (let c = minCol; c <= maxCol; c++) { const coordStr = `${minRow}-${c}`; const square = this.board[minRow]?.[c]; if (!square) return { valid: false, error: 'Invalid H coordinate.'}; lineCoords.push({ r: minRow, c }); if (!square.tile && !placedCoords.has(coordStr)) return { valid: false, error: 'Gap in horizontal placement.' }; } } else { for (let r = minRow; r <= maxRow; r++) { const coordStr = `${r}-${minCol}`; const square = this.board[r]?.[minCol]; if (!square) return { valid: false, error: 'Invalid V coordinate.'}; lineCoords.push({ r, c: minCol }); if (!square.tile && !placedCoords.has(coordStr)) return { valid: false, error: 'Gap in vertical placement.' }; } }
        let isConnected = false; let touchesCenter = false; for (const tile of move) { const { row, col } = tile; if (this.board[row]?.[col]?.isCenter) touchesCenter = true; const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]]; for (const [dr, dc] of neighbors) { const nr = row + dr; const nc = col + dc; if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && this.board[nr][nc].tile !== null) { isConnected = true; break; } } if (isConnected && !this.isFirstMove) break; }
        if (this.isFirstMove) { if (!touchesCenter) return { valid: false, error: 'First move must cover center.' }; if (move.length < 2 && BOARD_SIZE > 1) return { valid: false, error: 'First move must be >= 2 letters.' }; } else { if (!isConnected && move.length > 0) return { valid: false, error: 'Move must connect to existing tiles.' }; }
        return { valid: true, orientation, lineCoords };
    } // ---> Ensure method closing brace is present <---

    _findFormedWords(move, orientation, lineCoords) {
        const wordsData = []; const tempBoard = _.cloneDeep(this.board); const moveCoordsSet = new Set(move.map(t => `${t.r}-${t.c}`));
        for (const tile of move) { tempBoard[tile.row][tile.col].tile = { letter: tile.letter.toUpperCase(), value: tile.value }; }
        const checkWord = (startTileCoord, axis) => { if (!startTileCoord) return; let r = startTileCoord.r; let c = startTileCoord.c; if (axis === 'H') { while (c > 0 && tempBoard[r]?.[c - 1]?.tile) c--; } else { while (r > 0 && tempBoard[r - 1]?.[c]?.tile) r--; } let currentWord = ''; const currentWordTiles = []; let currentPosR = r; let currentPosC = c; while (currentPosR < BOARD_SIZE && currentPosC < BOARD_SIZE && tempBoard[currentPosR]?.[currentPosC]?.tile) { const currentSquare = tempBoard[currentPosR][currentPosC]; const originalSquare = this.board[currentPosR][currentPosC]; const originalTileValue = originalSquare.tile ? originalSquare.tile.value : TILE_DISTRIBUTION[currentSquare.tile.letter]?.value ?? 0; currentWord += currentSquare.tile.letter; currentWordTiles.push({ letter: currentSquare.tile.letter, value: originalTileValue, r: currentPosR, c: currentPosC, premium: originalSquare.premium, isPremiumUsed: originalSquare.isPremiumUsed, isNew: moveCoordsSet.has(`${currentPosR}-${currentPosC}`) }); if (axis === 'H') currentPosC++; else currentPosR++; } if (currentWord.length > 1) { if (!dictionary.isValidWord(currentWord)) throw new Error(`Invalid word: ${currentWord}`); const wordKey = `${currentWord}-${axis}-${r},${c}`; if (!wordsData.some(wd => wd.key === wordKey)) wordsData.push({ key: wordKey, word: currentWord, tiles: currentWordTiles }); } };
        try { if (!lineCoords || lineCoords.length === 0) throw new Error("Internal: lineCoords missing."); checkWord(lineCoords[0], orientation); const crossAxis = (orientation === 'H') ? 'V' : 'H'; if (orientation === 'single' || lineCoords.length >= 1) { for (const tile of move) { checkWord({ r: tile.row, c: tile.col }, crossAxis); } } } catch (error) { console.error(/*...*/); return { valid: false, error: error.message }; }
        if (wordsData.length === 0 && move.length > 0) return { valid: false, error: 'Move must form word >= 2 letters.' };
        return { valid: true, wordsData };
    } // ---> Ensure method closing brace is present <---

    _calculateScore(move, wordsData) {
        let totalScore = 0; console.log(`GameState [${this.gameId}]: Calculating score for ${wordsData.length} word(s).`);
        for (const { word, tiles } of wordsData) { let currentWordScore = 0; let wordMultiplier = 1; console.log(`  Scoring word: ${word}`); for (const tile of tiles) { let letterScore = tile.value; if (tile.isNew) { const originalSquare = this.board[tile.r][tile.c]; if (originalSquare.premium && !originalSquare.isPremiumUsed) { console.log(/*...*/); switch (originalSquare.premium) { case 'DL': letterScore *= 2; break; case 'TL': letterScore *= 3; break; case 'DW': wordMultiplier *= 2; break; case 'TW': wordMultiplier *= 3; break; } if (originalSquare.isCenter && this.isFirstMove) { wordMultiplier *= 2; } } } currentWordScore += letterScore; } const finalWordScore = currentWordScore * wordMultiplier; console.log(`  Word: ${word}, Base: ${currentWordScore}, Multiplier: x${wordMultiplier}, Final: ${finalWordScore}`); totalScore += finalWordScore; }
        let bingoBonus = 0; if (move.length === RACK_SIZE) { bingoBonus = 50; totalScore += bingoBonus; console.log(/*...*/); }
        return { score: totalScore, bingoBonus };
    } // ---> Ensure method closing brace is present <---

    _checkGameOver(lastPlayer) {
        if (this.tileBag.length === 0 && lastPlayer?.rack.length === 0) { this._endGame('tiles'); return { isOver: true, reason: 'tiles' }; }
        return { isOver: false };
    } // ---> Ensure method closing brace is present <---

    _endGame(reason) {
         if (this.status === 'finished') return; this.status = 'finished'; console.log(/*...*/); let scoreSumOfRacks = 0; let playerWhoFinished = null; if (reason === 'tiles') playerWhoFinished = this.players.find(p => p.rack.length === 0);
         for (const player of this.players) { const rackValue = player.rack.reduce((sum, tile) => sum + tile.value, 0); if (player.rack.length > 0) { player.score -= rackValue; scoreSumOfRacks += rackValue; console.log(/*...*/); } }
         if (playerWhoFinished) { playerWhoFinished.score += scoreSumOfRacks; console.log(/*...*/); }
         this.finalScores = this.players.map(p => ({ id: p.id, username: p.username, finalScore: p.score })).sort((a, b) => b.finalScore - a.finalScore);
         console.log(`GameState [${this.gameId}]: Final scores:`, JSON.stringify(this.finalScores)); this.players.forEach(p => p.isTurn = false); this.currentTurnIndex = -1;
    } // ---> Ensure method closing brace is present <---


    // --- State Serialization ---
    getPublicState() {
        return {
            gameId: this.gameId, players: this.players.map(p => ({ id: p.id, username: p.username, score: p.score, rackTileCount: p.rack.length, isTurn: p.isTurn })),
            board: this.board, tilesRemaining: this.tileBag.length, currentTurnPlayerId: (this.currentTurnIndex >= 0 && this.players[this.currentTurnIndex]) ? this.players[this.currentTurnIndex].id : null,
            status: this.status, lastMove: this.lastMove, consecutivePasses: this.consecutivePasses, finalScores: this.finalScores
        };
    } // ---> Ensure method closing brace is present <---

    getPlayerSpecificState(playerId) {
        const publicState = this.getPublicState(); const player = this.players.find(p => p.id === playerId);
        return { ...publicState, myRack: player ? [...(player.rack || [])] : [] };
    } // ---> Ensure method closing brace is present <---

} // ---> Ensure FINAL closing brace for the class is present <---

module.exports = GameState;