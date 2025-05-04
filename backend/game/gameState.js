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
        console.log(`GameState [${this.gameId}]: Attempting add player ${playerId} (${username}). Status: ${this.status}, Players: ${this.players.length}/${this.maxPlayers}`);
        if (this.status !== 'waiting') { console.warn(`GameState [${this.gameId}]: Add FAILED. Status not 'waiting' (${this.status}).`); return null; }
        if (this.players.length >= this.maxPlayers) { console.warn(`GameState [${this.gameId}]: Add FAILED. Max players (${this.maxPlayers}) reached.`); return null; }
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
        this.players.forEach(player => { this.drawTiles(player, RACK_SIZE); }); // Deal tiles
        this.currentTurnIndex = Math.floor(Math.random() * this.players.length); // Random start
        if (this.players[this.currentTurnIndex]) { this.players[this.currentTurnIndex].isTurn = true; console.log(`GameState [${this.gameId}]: Game started. Player ${this.players[this.currentTurnIndex].username}'s turn.`); return true; }
        else { console.error(`GameState [${this.gameId}]: Could not assign turn index ${this.currentTurnIndex}`); this.status = 'error'; return false; }
    }

    // --- Tile Management ---
    drawTiles(player, numTiles) {
        if (!player || !Array.isArray(player.rack)) { console.error(`GameState [${this.gameId}]: Invalid player object to drawTiles.`); return []; }
        const drawnTiles = []; const numToDraw = Math.min(numTiles, this.tileBag.length);
        for (let i = 0; i < numToDraw; i++) { const tile = this.tileBag.pop(); if (tile) { drawnTiles.push(tile); } else { console.error(`GameState [${this.gameId}]: tileBag.pop() returned undefined.`); break; } }
        player.rack.push(...drawnTiles);
        console.log(`GameState [${this.gameId}]: Player ${player.username} drew ${drawnTiles.length}. Rack: ${player.rack.length}. Bag: ${this.tileBag.length}`);
        return drawnTiles;
    }

    // --- Turn and State ---
    _checkTurn(playerId) {
        if (this.status !== 'playing') { return { valid: false, error: 'Game is not currently playing.' }; }
        if (this.players.length === 0 || this.currentTurnIndex < 0 || this.currentTurnIndex >= this.players.length) { return { valid: false, error: 'Game state invalid for turn check.' }; }
        if (this.players[this.currentTurnIndex]?.id !== playerId) { return { valid: false, error: 'Not your turn.' }; }
        return { valid: true };
    }

    advanceTurn() {
        if (this.status !== 'playing' || this.players.length <= 1) { if (this.players.length === 1 && this.status === 'playing') { console.log(`GameState [${this.gameId}]: Only one player left, turn not advanced.`); if(this.players[0]) this.players[0].isTurn = true; } return; }
        if(this.currentTurnIndex >= 0 && this.currentTurnIndex < this.players.length) { this.players[this.currentTurnIndex].isTurn = false; }
        this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
        if(this.players[this.currentTurnIndex]) { this.players[this.currentTurnIndex].isTurn = true; console.log(`GameState [${this.gameId}]: Turn advanced to ${this.players[this.currentTurnIndex].username}.`); }
        else { console.error(`GameState [${this.gameId}]: Failed to advance turn, invalid new index ${this.currentTurnIndex}. Resetting turn.`); this.currentTurnIndex = 0; if(this.players.length > 0 && this.players[0]) this.players[0].isTurn = true; }
    }

    // --- Player Actions ---
    passTurn(playerId) {
        const turnCheck = this._checkTurn(playerId); if (!turnCheck.valid) return { success: false, error: turnCheck.error };
        this.consecutivePasses++; console.log(`GameState [${this.gameId}]: Player ${playerId} passed. Passes: ${this.consecutivePasses}`);
        const maxPasses = this.players.length * 3;
        if (this.consecutivePasses >= maxPasses) { console.log(`GameState [${this.gameId}]: Game ending via passes.`); this._endGame('passes'); return { success: true, gameOver: true, finalScores: this.finalScores }; }
        else { this.advanceTurn(); return { success: true, gameOver: false }; }
    }

    exchangeTiles(playerId, lettersToExchange) {
        const turnCheck = this._checkTurn(playerId); if (!turnCheck.valid) return { success: false, error: turnCheck.error };
        if (this.tileBag.length < lettersToExchange.length) return { success: false, error: 'Not enough tiles in bag.' };
        const player = this.players[this.currentTurnIndex]; if (!player) return { success: false, error: 'Player not found.' };
        const playerRackLetters = player.rack.map(t => t.letter); const tempRack = [...playerRackLetters]; const actualTilesToRemove = [];
        for (const letter of lettersToExchange) { const indexInTemp = tempRack.indexOf(letter); if (indexInTemp === -1) return { success: false, error: `You do not have: ${letter}` }; tempRack.splice(indexInTemp, 1); let found = false; for(let i = 0; i < player.rack.length; i++) { if(player.rack[i].letter === letter && !actualTilesToRemove.some(t => t === player.rack[i])) { actualTilesToRemove.push(player.rack[i]); found = true; break; } } if (!found) { console.error(`GameState [${this.gameId}]: Tile object mismatch during exchange for ${letter}.`); return { success: false, error: `Internal error validating ${letter}.` }; } }
        player.rack = player.rack.filter(tile => !actualTilesToRemove.includes(tile)); this.tileBag.push(...actualTilesToRemove);
        this.tileBag = _.shuffle(this.tileBag); this.drawTiles(player, lettersToExchange.length);
        this.consecutivePasses = 0; this.advanceTurn();
        console.log(`GameState [${this.gameId}]: Player ${playerId} exchanged ${lettersToExchange.length} tiles.`);
        return { success: true };
    }

        // --- placeValidMove with Added Rack Validation Logging ---
        placeValidMove(playerId, move) {
            const turnCheck = this._checkTurn(playerId);
            if (!turnCheck.valid) return { success: false, error: turnCheck.error };
            const player = this.players[this.currentTurnIndex];
            if (!player) return { success: false, error: 'Internal error: Current player not found.' };
    
            // --- 1. Validate Tiles in Rack ---
            console.log(`--- Rack Validation Start for Player ${playerId} [${this.gameId}] ---`);
            console.log('Move Data Received:', JSON.stringify(move, null, 2)); // Pretty print move data
            console.log('Server-Side Rack BEFORE Validation:', JSON.stringify(player.rack, null, 2)); // Pretty print current rack on server
    
            const neededTiles = {}; // Example: { 'A': 1, 'BLANK': 1 }
            for (const tile of move) {
                // Determine the required tile type from the rack (BLANK or specific letter)
                const requiredLetter = tile.isBlank ? 'BLANK' : tile.letter?.toUpperCase();
                // Basic check if letter is valid
                if (!requiredLetter) {
                    console.error(`GameState [${this.gameId}]: Invalid move data - tile missing letter property:`, JSON.stringify(tile));
                    return { success: false, error: 'Move contains invalid tile data (missing letter).' };
                }
                neededTiles[requiredLetter] = (neededTiles[requiredLetter] || 0) + 1;
            }
            console.log('Needed Tiles Count:', JSON.stringify(neededTiles));
    
            // Count tiles currently in the player's rack on the server
            const currentRackCount = {};
            console.log('Counting Server Rack Contents...');
            player.rack.forEach((tileInRack, index) => {
                // Log each tile being counted
                console.log(`  Rack[${index}]: { letter: '${tileInRack.letter}', value: ${tileInRack.value} }`);
                if (tileInRack.letter) { // Ensure letter exists
                    currentRackCount[tileInRack.letter] = (currentRackCount[tileInRack.letter] || 0) + 1;
                } else {
                     console.warn(`  WARNING: Tile at index ${index} in server rack has no letter property!`, tileInRack);
                }
            });
            console.log('Counted Server Rack:', JSON.stringify(currentRackCount));
    
            // Compare needed tiles count vs current rack count
            for (const letter in neededTiles) {
                const neededCount = neededTiles[letter];
                const hasCount = currentRackCount[letter] || 0; // Default to 0 if letter not in rack
                console.log(`Checking Requirement: Need ${neededCount} of '${letter}', Have ${hasCount}`);
                if (hasCount < neededCount) {
                    // ---> Log the exact failure point <---
                    console.warn(`Rack Validation FAIL: Player ${playerId} needs ${neededCount} of '${letter}', but server rack only has ${hasCount}.`);
                    console.log('--- Rack Validation End ---');
                    return { success: false, error: `You don't have enough '${letter}' tiles.` }; // Send error back
                }
            }
            // If loop completes, validation passed
            console.log('Rack validation PASSED.');
            console.log(`--- Rack Validation End ---`);
            // --- End Rack Validation ---
    
    
            // --- 2. Validate Placement ---
            const placementValidation = this._validatePlacement(move);
            if (!placementValidation.valid) return { success: false, error: placementValidation.error };
            const { orientation, lineCoords } = placementValidation;
            console.log(`GameState [${this.gameId}]: Placement validation PASSED. Orientation: ${orientation}`);
    
            // --- 3. Validate Words ---
            const formedWordsResult = this._findFormedWords(move, orientation, lineCoords);
            if (!formedWordsResult.valid) return { success: false, error: formedWordsResult.error };
            const { wordsData } = formedWordsResult;
            if (wordsData.length === 0 && move.length > 0) return { success: false, error: 'Move must form at least one word.' };
            console.log(`GameState [${this.gameId}]: Word validation PASSED. Words: ${wordsData.map(w=>w.word).join(', ')}`);
    
            // --- 4. Calculate Score ---
            const scoreResult = this._calculateScore(move, wordsData);
            const totalScore = scoreResult.score;
            const bingoBonus = scoreResult.bingoBonus;
            console.log(`GameState [${this.gameId}]: Score calculated: ${totalScore} (Bingo: ${bingoBonus})`);
    
            // --- 5. Update State ---
            const rackTilesToRemove = [];
            const currentRackCopy = [...player.rack];
            // a. Update board
            for (const tile of move) {
                 const square = this.board[tile.row][tile.col];
                 const requiredLetter = tile.isBlank ? 'BLANK' : tile.letter.toUpperCase();
                 const rackTileIndex = currentRackCopy.findIndex(t => t.letter === requiredLetter);
                 if (rackTileIndex === -1) { console.error(`CRITICAL INTERNAL ERROR: Tile ${requiredLetter} not found in rack copy.`); return { success: false, error: `Internal error: Tile ${requiredLetter} not found.` }; }
                 const [rackTile] = currentRackCopy.splice(rackTileIndex, 1);
                 rackTilesToRemove.push(rackTile);
                 square.tile = { letter: tile.letter.toUpperCase(), value: rackTile.value };
                 // Premium squares are now marked as used during score calculation
            }
            // b. Update player score
            player.score += totalScore;
            // c. Remove used tiles from actual rack
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
            const gameOverInfo = this._checkGameOver(player);
            if (gameOverInfo.isOver) {
                console.log(`GameState [${this.gameId}]: Game ending after move by ${player.username}. Reason: ${gameOverInfo.reason}`);
                 return { success: true, score: totalScore, gameOver: true, finalScores: this.finalScores };
            } else {
                console.log(`GameState [${this.gameId}]: Player ${playerId} placed move. Score: ${totalScore}. New total: ${player.score}`);
                 return { success: true, score: totalScore, gameOver: false };
            }
        } // End placeValidMove

    // --- Complex Logic Helpers ---

    _validatePlacement(move) {
        if (!move || move.length === 0) return { valid: false, error: 'Move is empty.' };
        let minRow = 15, maxRow = -1, minCol = 15, maxCol = -1;
        const placedCoords = new Set();
        for (const tile of move) {
            const { row, col } = tile;
            if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return { valid: false, error: `Tile out of bounds (${row}, ${col}).` };
            if (this.board[row]?.[col]?.tile !== null) return { valid: false, error: `Square (${row}, ${col}) occupied.` };
            minRow = Math.min(minRow, row); maxRow = Math.max(maxRow, row);
            minCol = Math.min(minCol, col); maxCol = Math.max(maxCol, col);
            placedCoords.add(`${row}-${col}`);
        }
        let orientation = null;
        if (minRow === maxRow && minCol === maxCol) orientation = 'single';
        else if (minRow === maxRow) orientation = 'H';
        else if (minCol === maxCol) orientation = 'V';
        else return { valid: false, error: 'Tiles must be in a single line.' };

        const lineCoords = [];
        if (orientation === 'H' || orientation === 'single') {
            for (let c = minCol; c <= maxCol; c++) {
                const coordStr = `${minRow}-${c}`; const square = this.board[minRow]?.[c];
                if (!square) return { valid: false, error: 'Internal error: Invalid H coordinate.'};
                lineCoords.push({ r: minRow, c });
                if (!square.tile && !placedCoords.has(coordStr)) return { valid: false, error: 'Gap in horizontal placement.' };
            }
        } else { // Vertical
            for (let r = minRow; r <= maxRow; r++) {
                const coordStr = `${r}-${minCol}`; const square = this.board[r]?.[minCol];
                if (!square) return { valid: false, error: 'Internal error: Invalid V coordinate.'};
                lineCoords.push({ r, c: minCol });
                if (!square.tile && !placedCoords.has(coordStr)) return { valid: false, error: 'Gap in vertical placement.' };
            }
        }

        let isConnected = false; let touchesCenter = false;
        for (const tile of move) {
            const { row, col } = tile; if (this.board[row]?.[col]?.isCenter) touchesCenter = true;
            const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]];
            for (const [dr, dc] of neighbors) {
                const nr = row + dr; const nc = col + dc;
                if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && this.board[nr][nc].tile !== null) { isConnected = true; break; }
            }
            if (isConnected && !this.isFirstMove) break;
        }

        if (this.isFirstMove) {
            if (!touchesCenter) return { valid: false, error: 'First move must cover center.' };
            if (move.length < 2 && BOARD_SIZE > 1) return { valid: false, error: 'First move must be >= 2 letters.' };
        } else {
            if (!isConnected && move.length > 0) return { valid: false, error: 'Move must connect to existing tiles.' };
        }
        return { valid: true, orientation, lineCoords };
    }

    _findFormedWords(move, orientation, lineCoords) {
        // --->>> Keep ONLY the first declaration <<<---
        const moveCoordsSet = new Set(move.map(t => `${t.row}-${t.col}`)); // Use t.row and t.col        console.log("_findFormedWords - moveCoordsSet:", Array.from(moveCoordsSet)); // Log the set contents

        const wordsData = [];
        const tempBoard = _.cloneDeep(this.board);
        // --->>> DELETE THIS LINE <<<---
        // const moveCoordsSet = new Set(move.map(t => `${t.r}-${t.c}`)); // Remove duplicate declaration

        // Place tiles on temp board
        for (const tile of move) {
            if(tempBoard[tile.row]?.[tile.col]) {
                 tempBoard[tile.row][tile.col].tile = { letter: tile.letter.toUpperCase(), value: tile.value };
            } else { return { valid: false, error: "Internal Error: Invalid coordinate during word find." }; }
        }

        const checkWord = (startTileCoord, axis) => {
            if (!startTileCoord) return; let r = startTileCoord.r; let c = startTileCoord.c;
            if (axis === 'H') { while (c > 0 && tempBoard[r]?.[c - 1]?.tile) c--; } else { while (r > 0 && tempBoard[r - 1]?.[c]?.tile) r--; }
            let currentWord = ''; const currentWordTiles = []; let currentPosR = r; let currentPosC = c;
            let containsNewTile = false; // Reset for each word check

            while (currentPosR < BOARD_SIZE && currentPosC < BOARD_SIZE && tempBoard[currentPosR]?.[currentPosC]?.tile) {
                const currentSquare = tempBoard[currentPosR][currentPosC];
                const originalSquare = this.board[currentPosR][currentPosC];
                const originalTileValue = originalSquare.tile ? originalSquare.tile.value : TILE_DISTRIBUTION[currentSquare.tile.letter]?.value ?? 0;

                const coordStr = `${currentPosR}-${currentPosC}`;
                const isNew = moveCoordsSet.has(coordStr); // Use the single moveCoordsSet defined above
                if (isNew) containsNewTile = true;

                // ---> ADDED LOG INSIDE LOOP (as requested before) <---
                console.log(`  _findFormedWords: Checking tile ${currentSquare.tile.letter} @(${currentPosR},${currentPosC}). CoordStr: ${coordStr}. Is in moveCoordsSet? ${isNew}`);

                currentWord += currentSquare.tile.letter;
                currentWordTiles.push({
                    letter: currentSquare.tile.letter,
                    value: originalTileValue,
                    r: currentPosR, c: currentPosC,
                    premium: originalSquare.premium,
                    isPremiumUsed: originalSquare.isPremiumUsed,
                    isNew: isNew // Assign calculated flag
                });
                if (axis === 'H') currentPosC++; else currentPosR++;
            }

            // Only add word if > 1 letter AND contains a new tile
            if (currentWord.length > 1 && containsNewTile) {
                 if (!dictionary.isValidWord(currentWord)) throw new Error(`Invalid word: ${currentWord}`);
                 const wordKey = `${currentWord}-${axis}-${r},${c}`;
                 if (!wordsData.some(wd => wd.key === wordKey)) {
                      console.log(`   Found valid word: ${currentWord} (Key: ${wordKey})`);
                      wordsData.push({ key: wordKey, word: currentWord, tiles: currentWordTiles });
                 }
            }
        }; // End checkWord

        try {
             if (!lineCoords || lineCoords.length === 0) throw new Error("Internal: lineCoords missing.");
             checkWord(lineCoords[0], orientation); // Check main word
             const crossAxis = (orientation === 'H') ? 'V' : 'H';
             // Check cross words if needed
             if (orientation === 'single' || lineCoords.length >= 1) {
                 for (const tile of move) { checkWord({ r: tile.row, c: tile.col }, crossAxis); }
             }
        } catch (error) { console.error(`Word validation error: ${error.message}`); return { valid: false, error: error.message }; }

        if (wordsData.length === 0 && move.length > 0) { return { valid: false, error: 'Move must form word >= 2 letters.' }; }
        return { valid: true, wordsData };
    } // End _findFormedWords
    _calculateScore(move, wordsData) {
        let totalScore = 0;
        console.log(`GameState [${this.gameId}]: === Score Calculation Start ===`);
        console.log(`Calculating score for ${wordsData.length} word(s). Move Length: ${move.length}`);

        for (const { word, tiles } of wordsData) { // Iterate each word formed
            let currentWordScore = 0;
            let wordMultiplier = 1; // Multiplier specific to this word
            console.log(`  Scoring word: ${word}`);

            for (const tile of tiles) { // Iterate each tile within that word
                let letterScore = tile.value; // Base value (0 for blank)

                // --->>> Check if tile is new and apply premiums <<<---
                if (tile.isNew) {
                    const square = this.board[tile.r][tile.c]; // Get board square state

                    // ---> Log the state BEFORE checking premium application <---
                    console.log(`    Checking premiums for NEW tile ${tile.letter} @(${tile.r},${tile.c}): Premium=${square?.premium}, Used=${square?.isPremiumUsed}, isFirstMove=${this.isFirstMove}`);

                    // Check if premium exists and is unused
                    if (square.premium && !square.isPremiumUsed) {
                        console.log(`        Premium detected and unused! Applying: ${square.premium}`);
                        switch (square.premium) {
                            case 'DL':
                                letterScore *= 2;
                                console.log(`          DL applied -> Letter Score now: ${letterScore}`);
                                break;
                            case 'TL':
                                letterScore *= 3;
                                console.log(`          TL applied -> Letter Score now: ${letterScore}`);
                                break;
                            case 'DW':
                                wordMultiplier *= 2;
                                console.log(`          DW applied -> Word Multiplier for '${word}' now: x${wordMultiplier}`);
                                break;
                            case 'TW':
                                wordMultiplier *= 3;
                                console.log(`          TW applied -> Word Multiplier for '${word}' now: x${wordMultiplier}`);
                                break;
                        }
                        // Center square bonus (counts as DW on first move), only if not already DW/TW
                        if (square.isCenter && this.isFirstMove && square.premium !== 'DW' && square.premium !== 'TW') {
                            wordMultiplier *= 2;
                            console.log(`          Center bonus (DW) applied -> Word Multiplier for '${word}' now: x${wordMultiplier}`);
                        }
                    } else if (square.premium && square.isPremiumUsed) {
                        // Log if premium exists but was already used
                        console.log(`        Premium ${square.premium} at (${tile.r},${tile.c}) was already used.`);
                    } else {
                        // Log if no premium on the square
                        // console.log(`        No premium on square (${tile.r},${tile.c}).`); // Can make logs verbose
                    }
                } else {
                    // Log tiles that are part of the word but not newly placed
                    console.log(`    Skipping premiums for OLD tile ${tile.letter} @(${tile.r},${tile.c})`);
                }
                // --->>> End Premium Check Logic <<<---

                currentWordScore += letterScore; // Add letter's score to word total

            } // End loop through tiles in the word

            // Apply the total word multiplier for this word
            const finalWordScore = currentWordScore * wordMultiplier;
            console.log(`  Word: ${word}, Base: ${currentWordScore}, Multiplier: x${wordMultiplier}, Final Word Score: ${finalWordScore}`);
            totalScore += finalWordScore;

        } // End loop through wordsData

        // Add Bingo bonus if applicable
        let bingoBonus = 0;
        if (move.length === RACK_SIZE) {
            bingoBonus = 50;
            totalScore += bingoBonus;
            console.log(`Bingo bonus applied! +50 points.`);
        }

        console.log(`=== Score Calculation End === Total Score: ${totalScore}`);
        return { score: totalScore, bingoBonus };
    } // ---> End of _calculateScore method
   // --->>> End Score Calculation Helper <<<---
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
         console.log(`GameState [${this.gameId}]: Game finished. Reason: ${reason}`);
         let scoreSumOfRacks = 0; let playerWhoFinished = null;
         if (reason === 'tiles') playerWhoFinished = this.players.find(p => p.rack.length === 0);

         for (const player of this.players) {
             const rackValue = player.rack.reduce((sum, tile) => sum + tile.value, 0);
             if (player.rack.length > 0) { player.score -= rackValue; scoreSumOfRacks += rackValue; console.log(`GameState [${this.gameId}]: ${player.username} loses ${rackValue} pts.`); }
         }
         if (playerWhoFinished) { playerWhoFinished.score += scoreSumOfRacks; console.log(`GameState [${this.gameId}]: ${playerWhoFinished.username} gains ${scoreSumOfRacks} pts.`); }

         this.finalScores = this.players.map(p => ({ id: p.id, username: p.username, finalScore: p.score }))
                            .sort((a, b) => b.finalScore - a.finalScore); // Sort descending
         console.log(`GameState [${this.gameId}]: Final scores:`, JSON.stringify(this.finalScores));
         this.players.forEach(p => p.isTurn = false); this.currentTurnIndex = -1;
    }


    // --- State Serialization ---
    getPublicState() {
        return {
            gameId: this.gameId,
            players: this.players.map(p => ({ id: p.id, username: p.username, score: p.score, rackTileCount: p.rack.length, isTurn: p.isTurn })),
            board: this.board,
            tilesRemaining: this.tileBag.length,
            currentTurnPlayerId: (this.currentTurnIndex >= 0 && this.players[this.currentTurnIndex]) ? this.players[this.currentTurnIndex].id : null,
            status: this.status,
            lastMove: this.lastMove,
            consecutivePasses: this.consecutivePasses,
            finalScores: this.finalScores
        };
    }

    getPlayerSpecificState(playerId) {
        const publicState = this.getPublicState();
        const player = this.players.find(p => p.id === playerId);
        return { ...publicState, myRack: player ? [...(player.rack || [])] : [] };
    }
} // End of GameState Class

module.exports = GameState;