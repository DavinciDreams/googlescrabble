// backend/game/gameState.js

const { TILE_DISTRIBUTION, BOARD_SIZE, RACK_SIZE, BOARD_LAYOUT, PREMIUM_MAP } = require('./constants');
const dictionary = require('../utils/dictionary');
const _ = require('lodash'); // For shuffling and deep cloning

// --- Helper Functions ---

function createTileBag() {
    const bag = [];
    for (const letter in TILE_DISTRIBUTION) {
        const tileInfo = TILE_DISTRIBUTION[letter];
        for (let i = 0; i < tileInfo.count; i++) {
            bag.push({ letter: letter === 'BLANK' ? 'BLANK' : letter, value: tileInfo.value });
        }
    }
    return _.shuffle(bag);
}

function initializeBoard() {
    const board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const premiumCode = BOARD_LAYOUT[r][c];
            board[r][c] = {
                premium: premiumCode !== 0 ? PREMIUM_MAP[premiumCode] : null,
                tile: null,
                isPremiumUsed: false
            };
        }
    }
    board[7][7].isCenter = true;
    return board;
}

// --- GameState Class ---

class GameState {
    constructor(gameId) {
        this.gameId = gameId;
        this.players = []; // { id: socket.id, username: 'name', score: 0, rack: [], isTurn: false }
        this.board = initializeBoard();
        this.tileBag = createTileBag();
        this.currentTurnIndex = -1;
        this.status = 'waiting'; // 'waiting', 'playing', 'finished'
        this.consecutivePasses = 0;
        this.moveHistory = [];
        this.lastMove = null;
        this.isFirstMove = true;
        this.finalScores = null;
        // Example: Define max players for this game instance
        this.maxPlayers = 2; // Or 3, or 4
    }

    // --- Player Management ---

    addPlayer(playerId, username) {
        // --- ADDED LOGGING START ---
        console.log(`GameState [${this.gameId}]: Attempting to add player ${playerId} (${username}). Current status: ${this.status}, Current players: ${this.players.length}/${this.maxPlayers}`);

        // Check game status and player count
        if (this.status !== 'waiting') {
            console.warn(`GameState [${this.gameId}]: Add player FAILED for ${playerId}. Game status is not 'waiting' (it's '${this.status}').`);
            return null; // Return null on failure
        }
         if (this.players.length >= this.maxPlayers) {
            console.warn(`GameState [${this.gameId}]: Add player FAILED for ${playerId}. Max players (${this.maxPlayers}) reached.`);
            return null; // Return null on failure
        }

        // Check for existing player ID or username
        if (this.players.some(p => p.id === playerId)) {
             console.warn(`GameState [${this.gameId}]: Add player FAILED. Player ID ${playerId} already exists in this game.`);
             // Decide: return null to prevent duplicate, or return existing player? Returning null for now.
             return null;
        }
        if (this.players.some(p => p.username.toLowerCase() === username.toLowerCase())) {
             console.warn(`GameState [${this.gameId}]: Add player FAILED. Username '${username}' already exists in this game.`);
             // Maybe emit specific error 'username taken' from server.js?
             return null; // Return null on failure
         }
        // --- ADDED LOGGING END ---

        // If all checks pass, create and add the player
        const player = {
            id: playerId,
            username: username,
            score: 0,
            rack: [],
            isTurn: false
        };
        this.players.push(player);
        // --- ADDED LOGGING ---
        console.log(`GameState [${this.gameId}]: Player ${username} (${playerId}) added successfully. Total players: ${this.players.length}`);
        // --- ADDED LOGGING ---
        return player; // Return the player object on success
    }

    startGame() {
        // Use this.maxPlayers defined in constructor or default to 2
        const requiredPlayers = this.maxPlayers;
        if (this.players.length < requiredPlayers || this.status !== 'waiting') {
            console.warn(`GameState ${this.gameId}: Cannot start game. Status: ${this.status}, Players: ${this.players.length}/${requiredPlayers}`);
            return false;
        }
        this.status = 'playing';
        this.players.forEach(player => {
            this.drawTiles(player, RACK_SIZE);
        });
        this.currentTurnIndex = Math.floor(Math.random() * this.players.length);
        this.players[this.currentTurnIndex].isTurn = true;
        this.isFirstMove = true;
        console.log(`GameState ${this.gameId}: Game started with ${this.players.length} players. Player ${this.players[this.currentTurnIndex].username}'s turn.`);
        return true;
    }

    // --- Tile Management ---

    drawTiles(player, numTiles) {
        const drawnTiles = [];
        for (let i = 0; i < numTiles && this.tileBag.length > 0; i++) {
            drawnTiles.push(this.tileBag.pop());
        }
        if (player && player.rack) {
            player.rack.push(...drawnTiles);
             // Avoid logging sensitive rack details frequently if possible
             // console.log(`GameState ${this.gameId}: Player ${player.username} drew ${drawnTiles.length} tiles. Rack size: ${player.rack.length}. Bag remaining: ${this.tileBag.length}`);
        } else {
             console.error(`GameState ${this.gameId}: Invalid player object provided to drawTiles.`);
        }
        return drawnTiles;
    }

    // --- Turn and State ---

    _checkTurn(playerId) {
         if (this.status !== 'playing') { return { valid: false, error: 'Game is not currently playing.' }; }
         if (this.players.length === 0 || this.currentTurnIndex < 0) { return { valid: false, error: 'Game has not started or no players found.' }; }
         if (this.players[this.currentTurnIndex]?.id !== playerId) { return { valid: false, error: 'Not your turn.' }; }
        return { valid: true };
    }

    advanceTurn() {
        if (this.status !== 'playing' || this.players.length <= 1) {
            // Don't advance if game ended or only one player left
            if (this.players.length === 1 && this.status === 'playing') {
                 // Maybe end game here? For now, just don't advance.
                 console.log(`GameState ${this.gameId}: Only one player left, turn not advanced.`);
                 this.players[0].isTurn = true; // Ensure the remaining player knows it's their turn
            }
             return;
        }

        if(this.currentTurnIndex >= 0 && this.currentTurnIndex < this.players.length) {
             this.players[this.currentTurnIndex].isTurn = false;
        }
        this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
        this.players[this.currentTurnIndex].isTurn = true;
        console.log(`GameState ${this.gameId}: Turn advanced to ${this.players[this.currentTurnIndex].username}.`);
    }

    // --- Player Actions ---

    passTurn(playerId) {
        const turnCheck = this._checkTurn(playerId);
        if (!turnCheck.valid) return { success: false, error: turnCheck.error };

        this.consecutivePasses++;
        console.log(`GameState ${this.gameId}: Player ${playerId} passed. Consecutive passes: ${this.consecutivePasses}`);

        // Example: 6 passes ends the game (adjust as needed)
        const maxPasses = this.players.length * 3; // e.g., 3 rounds of passing
        if (this.consecutivePasses >= maxPasses) {
            console.log(`GameState ${this.gameId}: Game ending due to ${this.consecutivePasses} consecutive passes.`);
            this._endGame('passes');
            return { success: true, gameOver: true };
        } else {
            this.advanceTurn();
            return { success: true, gameOver: false };
        }
    }

    exchangeTiles(playerId, lettersToExchange) {
        const turnCheck = this._checkTurn(playerId);
        if (!turnCheck.valid) return { success: false, error: turnCheck.error };
         if (this.tileBag.length < lettersToExchange.length) return { success: false, error: 'Not enough tiles in bag to exchange.' };

        const player = this.players[this.currentTurnIndex];
        const playerRackLetters = player.rack.map(t => t.letter);
        const tempRack = [...playerRackLetters];
        const actualTilesToRemove = [];

        for (const letter of lettersToExchange) {
            const indexInTemp = tempRack.indexOf(letter);
            if (indexInTemp === -1) return { success: false, error: `You do not have the tile: ${letter}` };
            tempRack.splice(indexInTemp, 1);
             const tileObjIndex = player.rack.findIndex((tile, idx) => tile.letter === letter && !actualTilesToRemove.some(removedTile => removedTile === player.rack[idx]));
             if (tileObjIndex !== -1) actualTilesToRemove.push(player.rack[tileObjIndex]);
             else { console.error(`GameState ${this.gameId}: Tile object mismatch during exchange validation.`); return { success: false, error: `Internal error validating tile ${letter}.` }; }
        }

        player.rack = player.rack.filter(tile => !actualTilesToRemove.includes(tile));
        this.tileBag.push(...actualTilesToRemove);
        this.tileBag = _.shuffle(this.tileBag);
        this.drawTiles(player, lettersToExchange.length);
        this.consecutivePasses = 0;
        this.advanceTurn();

        console.log(`GameState ${this.gameId}: Player ${playerId} exchanged ${lettersToExchange.length} tiles.`);
        return { success: true };
    }


    placeValidMove(playerId, move) { // move = [{ letter, value, row, col, isBlank }, ...]
        const turnCheck = this._checkTurn(playerId);
        if (!turnCheck.valid) return { success: false, error: turnCheck.error };

        const player = this.players[this.currentTurnIndex];

        // --- 1. Validate Tiles in Rack ---
        const neededTiles = {};
        for (const tile of move) {
            const requiredLetter = tile.isBlank ? 'BLANK' : tile.letter.toUpperCase();
            neededTiles[requiredLetter] = (neededTiles[requiredLetter] || 0) + 1;
        }
        const currentRack = {};
        player.rack.forEach(t => { currentRack[t.letter] = (currentRack[t.letter] || 0) + 1; });
        for (const letter in neededTiles) {
            if (!currentRack[letter] || currentRack[letter] < neededTiles[letter]) {
                 return { success: false, error: `You don't have enough '${letter}' tiles.` };
            }
        }

         // --- 2. Placement Validation ---
         const placementValidation = this._validatePlacement(move);
         if (!placementValidation.valid) return { success: false, error: placementValidation.error };
         const { orientation, lineCoords } = placementValidation;

        // --- 3. Word Formation & Dictionary Check ---
        const formedWordsResult = this._findFormedWords(move, orientation, lineCoords);
        if (!formedWordsResult.valid) return { success: false, error: formedWordsResult.error };
        const { wordsData } = formedWordsResult;

        // --- Handle case where no words are formed (e.g., single tile placement not connecting) ---
        // This might happen if connectivity check allows adjacent placement without forming a word > 1 letter
        if (wordsData.length === 0 && !this.isFirstMove) {
             // Re-check connectivity more strictly? Or assume validation passed means okay?
             // If placement validation requires forming a word, this shouldn't happen.
             // If just connectivity is required, this might be valid but score 0?
             // For now, let's treat it as an invalid move if no words > 1 letter formed after first move.
             console.warn(`GameState ${this.gameId}: Move by ${playerId} formed no words.`);
             // return { success: false, error: 'Move must form at least one word.' }; // Uncomment if required
        }


        // --- 4. Calculate Score ---
         const scoreResult = this._calculateScore(move, wordsData);
         const totalScore = scoreResult.score;
         const bingoBonus = scoreResult.bingoBonus;

        // --- 5. Update Game State ---
        // a. Update board
        for (const tile of move) {
             const square = this.board[tile.row][tile.col];
             square.tile = { letter: tile.letter.toUpperCase(), value: tile.isBlank ? 0 : tile.value }; // Use value from move (client calculated?) or re-lookup? Re-lookup is safer: TILE_DISTRIBUTION[tile.letter.toUpperCase()]?.value ?? 0
             if (square.premium) square.isPremiumUsed = true;
        }
        // b. Update player score
        player.score += totalScore;
        // c. Remove tiles from rack
         const tempRack = [...player.rack];
         const removedFromRack = [];
         for (const tileNeededLetter of Object.keys(neededTiles)) {
              let count = neededTiles[tileNeededLetter];
              for (let i = tempRack.length - 1; i >= 0 && count > 0; i--) {
                  if (tempRack[i].letter === tileNeededLetter) {
                      removedFromRack.push(...tempRack.splice(i, 1));
                      count--;
                  }
              }
          }
         player.rack = tempRack;
        // d. Draw new tiles
        this.drawTiles(player, move.length);
        // e. Update game state properties
        this.consecutivePasses = 0;
        this.isFirstMove = false;
        this.lastMove = { playerId, move, wordsData, score: totalScore, bingoBonus };
        this.moveHistory.push(this.lastMove);

        // --- 6. Advance Turn ---
        this.advanceTurn();

        // --- 7. Check for Game Over (Post-Move) ---
        const gameOverInfo = this._checkGameOver(player);
        if (gameOverInfo.isOver) {
            console.log(`GameState ${this.gameId}: Game ending. Reason: ${gameOverInfo.reason}`);
             return { success: true, score: totalScore, gameOver: true, finalScores: this.finalScores };
        } else {
            console.log(`GameState ${this.gameId}: Player ${playerId} placed move. Score: ${totalScore}.`);
             return { success: true, score: totalScore, gameOver: false };
        }
    }

    // --- Complex Logic Helpers (Private/Internal) ---

    _validatePlacement(move) {
        // ... (Keep existing _validatePlacement implementation) ...
         if (!move || move.length === 0) return { valid: false, error: 'Move is empty.' };
        let minRow = 15, maxRow = -1, minCol = 15, maxCol = -1;
        const placedCoords = new Set();
        for (const tile of move) { /* Check bounds, check empty */
            const { row, col } = tile;
             if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return { valid: false, error: `Tile placement out of bounds (${row}, ${col}).` };
             if (this.board[row][col].tile !== null) return { valid: false, error: `Square (${row}, ${col}) is already occupied.` };
             minRow = Math.min(minRow, row); maxRow = Math.max(maxRow, row);
             minCol = Math.min(minCol, col); maxCol = Math.max(maxCol, col);
             placedCoords.add(`${row}-${col}`);
        }
        let orientation = null;
        if (minRow === maxRow && minCol === maxCol) orientation = 'single';
        else if (minRow === maxRow) orientation = 'H';
        else if (minCol === maxCol) orientation = 'V';
        else return { valid: false, error: 'Tiles must be placed in a single line.' };
        const lineCoords = [];
        if (orientation === 'H' || orientation === 'single') { /* Check horizontal gaps */
             for (let c = minCol; c <= maxCol; c++) {
                  lineCoords.push({ r: minRow, c });
                  if (!placedCoords.has(`${minRow}-${c}`) && !this.board[minRow][c].tile) return { valid: false, error: 'Gap found in horizontal placement.' };
              }
         } else if (orientation === 'V') { /* Check vertical gaps */
              for (let r = minRow; r <= maxRow; r++) {
                   lineCoords.push({ r, c: minCol });
                   if (!placedCoords.has(`${r}-${minCol}`) && !this.board[r][minCol].tile) return { valid: false, error: 'Gap found in vertical placement.' };
               }
         }
        let isConnected = false; let touchesCenter = false;
         for (const tile of move) { /* Check connectivity to existing tiles or center */
            const { row, col } = tile;
             if (row === 7 && col === 7) touchesCenter = true;
             const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]];
             for (const [dr, dc] of neighbors) {
                  const nr = row + dr; const nc = col + dc;
                  if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && this.board[nr][nc].tile !== null) { isConnected = true; break; }
              }
              if (isConnected) break;
         }
        if (this.isFirstMove) { if (!touchesCenter) return { valid: false, error: 'First move must cover the center square.' }; }
        else { if (!isConnected && move.length > 0) return { valid: false, error: 'Move must connect to existing tiles.' }; }
        return { valid: true, orientation, lineCoords };
    }

    _findFormedWords(move, orientation, lineCoords) {
        // ... (Keep existing _findFormedWords implementation) ...
         const wordsData = []; const tempBoard = _.cloneDeep(this.board);
         for (const tile of move) { tempBoard[tile.row][tile.col].tile = { letter: tile.letter.toUpperCase(), value: tile.isBlank ? 0 : TILE_DISTRIBUTION[tile.letter.toUpperCase()]?.value ?? 0 }; }
         const moveCoordsSet = new Set(move.map(t => `${t.row}-${t.col}`));
         const checkWord = (tileCoords, axis) => { /* ... logic to find word bounds, build word, check dict, add to wordsData if valid ... */
             if (!tileCoords || tileCoords.length === 0) return; let start, end, fixedCoord;
             if (axis === 'H') { fixedCoord = tileCoords[0].r; start = tileCoords[0].c; while (start > 0 && tempBoard[fixedCoord][start - 1].tile) start--; end = tileCoords[tileCoords.length - 1].c; while (end < BOARD_SIZE - 1 && tempBoard[fixedCoord][end + 1].tile) end++; }
             else { fixedCoord = tileCoords[0].c; start = tileCoords[0].r; while (start > 0 && tempBoard[start - 1][fixedCoord].tile) start--; end = tileCoords[tileCoords.length - 1].r; while (end < BOARD_SIZE - 1 && tempBoard[end + 1][fixedCoord].tile) end++; }
             if (end - start === 0 && move.length > 1 && tileCoords.length === 1) return; // Avoid single-letter cross words unless move is single tile
             let word = ''; const wordTiles = [];
             for (let i = start; i <= end; i++) {
                 const r = (axis === 'H') ? fixedCoord : i; const c = (axis === 'H') ? i : fixedCoord;
                 const square = tempBoard[r][c]; if (!square || !square.tile) continue;
                 word += square.tile.letter;
                 wordTiles.push({ ...square.tile, r, c, premium: this.board[r][c].premium, isPremiumUsed: this.board[r][c].isPremiumUsed, isNew: moveCoordsSet.has(`${r}-${c}`) });
             }
             if (word.length > 1) {
                 if (!dictionary.isValidWord(word)) { throw new Error(`Invalid word formed: ${word}`); }
                 if (!wordsData.some(wd => wd.word === word && JSON.stringify(wd.tiles.map(t=>`${t.r}-${t.c}`)) === JSON.stringify(wordTiles.map(t=>`${t.r}-${t.c}`)))) { wordsData.push({ word, tiles: wordTiles }); } // Avoid duplicates based on coordinates
             }
         };
         try {
              if (orientation === 'H' || orientation === 'V') checkWord(lineCoords, orientation);
              else checkWord(lineCoords, 'H'); checkWord(lineCoords, 'V'); // Check both for single
              const crossAxis = (orientation === 'H') ? 'V' : 'H';
              for (const tile of move) { if (orientation !== 'single') checkWord([{ r: tile.row, c: tile.col }], crossAxis); }
         } catch (error) { console.error(`Word validation error: ${error.message}`); return { valid: false, error: error.message }; }
         if (this.isFirstMove && wordsData.length === 0 && move.length > 0) { return { valid: false, error: 'First move must form a valid word.' };} // Require word on first move
         return { valid: true, wordsData };
    }


    _calculateScore(move, wordsData) {
        // ... (Keep existing _calculateScore implementation) ...
        let totalScore = 0; const moveCoordsSet = new Set(move.map(t => `${t.row}-${t.col}`));
         for (const { word, tiles } of wordsData) {
             let currentWordScore = 0; let wordMultiplier = 1;
             for (const tile of tiles) {
                 let letterScore = tile.value;
                 if (tile.isNew && !tile.isPremiumUsed) { // Apply premiums only if tile is new and premium wasn't used before
                     switch (tile.premium) {
                         case 'DL': letterScore *= 2; break;
                         case 'TL': letterScore *= 3; break;
                         case 'DW': wordMultiplier *= 2; break;
                         case 'TW': wordMultiplier *= 3; break;
                     }
                     // Handle center square bonus explicitly if needed (e.g., if it acts as DW always)
                     if (tile.r === 7 && tile.c === 7 && this.isFirstMove) {
                          // Default Scrabble center is DW
                           wordMultiplier *= 2;
                     }
                 }
                 currentWordScore += letterScore;
             }
             totalScore += (currentWordScore * wordMultiplier);
         }
         let bingoBonus = 0;
         if (move.length === RACK_SIZE) { bingoBonus = 50; totalScore += bingoBonus; console.log(`GameState ${this.gameId}: Bingo! +50 points.`); }
         return { score: totalScore, bingoBonus };
    }

    _checkGameOver(lastPlayer) {
        if (this.tileBag.length === 0 && lastPlayer?.rack.length === 0) {
            this._endGame('tiles');
            return { isOver: true, reason: 'tiles' };
        }
        return { isOver: false };
    }

    _endGame(reason) {
         if (this.status === 'finished') return;
         this.status = 'finished';
         console.log(`GameState ${this.gameId}: Game finished. Reason: ${reason}`);
         let scoreSumOfRacks = 0; let playerWhoFinished = null;
         if (reason === 'tiles') playerWhoFinished = this.players.find(p => p.rack.length === 0);
         for (const player of this.players) {
             const rackValue = player.rack.reduce((sum, tile) => sum + tile.value, 0);
             if (player.rack.length > 0) { player.score -= rackValue; scoreSumOfRacks += rackValue; }
         }
         if (playerWhoFinished) playerWhoFinished.score += scoreSumOfRacks;
         this.finalScores = this.players.map(p => ({ id: p.id, username: p.username, finalScore: p.score }));
         console.log(`GameState ${this.gameId}: Final scores calculated:`, this.finalScores);
    }


    // --- State Serialization ---

    getPublicState() {
        return {
            gameId: this.gameId,
            players: this.players.map(p => ({ id: p.id, username: p.username, score: p.score, rackTileCount: p.rack.length, isTurn: p.isTurn })),
            board: this.board,
            tilesRemaining: this.tileBag.length,
            currentTurnPlayerId: this.players[this.currentTurnIndex]?.id,
            status: this.status,
            lastMove: this.lastMove,
            consecutivePasses: this.consecutivePasses,
            finalScores: this.finalScores
        };
    }

    getPlayerSpecificState(playerId) {
        const publicState = this.getPublicState();
        const player = this.players.find(p => p.id === playerId);
        return { ...publicState, myRack: player ? player.rack : [] };
    }
}

module.exports = GameState;