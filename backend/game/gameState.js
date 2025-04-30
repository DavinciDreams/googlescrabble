// backend/game/gameState.js

const { TILE_DISTRIBUTION, BOARD_SIZE, RACK_SIZE, BOARD_LAYOUT, PREMIUM_MAP } = require('./constants');
const dictionary = require('../utils/dictionary'); // Ensure this utility works
const _ = require('lodash'); // Ensure lodash is installed: npm install lodash

// --- Helper Function to Create and Shuffle the Tile Bag ---
function createTileBag() {
    const bag = [];
    console.log("Creating tile bag...");
    for (const letterKey in TILE_DISTRIBUTION) {
        if (Object.hasOwnProperty.call(TILE_DISTRIBUTION, letterKey)) {
            const tileInfo = TILE_DISTRIBUTION[letterKey];
            const letter = letterKey === 'BLANK' ? 'BLANK' : letterKey;
            for (let i = 0; i < tileInfo.count; i++) {
                bag.push({ letter: letter, value: tileInfo.value });
            }
        }
    }
    console.log(`Total tiles before shuffle: ${bag.length}`);
    const shuffledBag = _.shuffle(bag);
    console.log("Tile bag created and shuffled.");
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
    }

    // --- Player Management ---
    addPlayer(playerId, username) {
        console.log(`GameState [${this.gameId}]: Attempting to add player ${playerId} (${username}). Current status: ${this.status}, Current players: ${this.players.length}/${this.maxPlayers}`);

        if (this.status !== 'waiting') {
            console.warn(`GameState [${this.gameId}]: Add player FAILED for ${playerId}. Game status is not 'waiting' (it's '${this.status}').`);
            return null;
        }
        if (this.players.length >= this.maxPlayers) {
            console.warn(`GameState [${this.gameId}]: Add player FAILED for ${playerId}. Max players (${this.maxPlayers}) reached.`);
            return null;
        }
        if (this.players.some(p => p.id === playerId)) {
             console.warn(`GameState [${this.gameId}]: Add player FAILED. Player ID ${playerId} already exists in this game.`);
             return null; // Prevent duplicate adds
        }
        // Case-insensitive username check
        if (this.players.some(p => p.username.toLowerCase() === username.toLowerCase())) {
             console.warn(`GameState [${this.gameId}]: Add player FAILED. Username '${username}' already exists in this game.`);
             return null; // Username taken in this game
         }

        // If all checks pass, create and add the player
        const player = {
            id: playerId,
            username: username,
            score: 0,
            rack: [], // Empty rack initially
            isTurn: false
        };
        this.players.push(player);
        console.log(`GameState [${this.gameId}]: Player ${username} (${playerId}) added successfully. Total players: ${this.players.length}`);
        return player; // Return the added player object
    }

    // --- Game Start ---
    startGame() {
        const requiredPlayers = this.maxPlayers;
        if (this.players.length < requiredPlayers || this.status !== 'waiting') {
            console.warn(`GameState ${this.gameId}: Cannot start game. Status: ${this.status}, Players: ${this.players.length}/${requiredPlayers}`);
            return false; // Indicate game didn't start
        }

        console.log(`GameState [${this.gameId}]: Starting game with ${this.players.length} players.`);
        this.status = 'playing';
        this.isFirstMove = true;
        this.consecutivePasses = 0;

        // Deal initial tiles to each player
        this.players.forEach(player => {
            console.log(`GameState [${this.gameId}]: Dealing initial hand to ${player.username}...`);
            this.drawTiles(player, RACK_SIZE); // Call drawTiles for each player
        });

        // Randomly select starting player
        this.currentTurnIndex = Math.floor(Math.random() * this.players.length);
        if (this.players[this.currentTurnIndex]) { // Ensure player exists
             this.players[this.currentTurnIndex].isTurn = true;
             console.log(`GameState [${this.gameId}]: Game started. Player ${this.players[this.currentTurnIndex].username}'s turn.`);
             return true; // Game started successfully
        } else {
             console.error(`GameState ${this.gameId}: Could not assign turn, invalid index ${this.currentTurnIndex}`);
             this.status = 'error'; // Indicate an error state
             return false; // Game failed to start properly
        }
    }

    // --- Tile Management ---
    /**
     * Draws a specified number of tiles from the bag and adds them to the player's rack.
     * @param {object} player - The player object with a 'rack' array property.
     * @param {number} numTiles - The number of tiles to attempt to draw.
     * @returns {Array} - An array of the tiles actually drawn.
     */
    drawTiles(player, numTiles) {
        if (!player || !Array.isArray(player.rack)) {
             console.error(`GameState [${this.gameId}]: Invalid player object provided to drawTiles.`);
             return []; // Return empty array if player is invalid
        }
        const drawnTiles = [];
        const numToDraw = Math.min(numTiles, this.tileBag.length); // Don't draw more than available
        console.log(`GameState [${this.gameId}]: Player ${player.username} attempting to draw ${numToDraw} tiles. Bag has ${this.tileBag.length}.`);
        for (let i = 0; i < numToDraw; i++) {
            const tile = this.tileBag.pop(); // Remove from end of shuffled bag
            if (tile) { drawnTiles.push(tile); }
            else { console.error(`GameState [${this.gameId}]: tileBag.pop() returned undefined unexpectedly.`); break; }
        }
        player.rack.push(...drawnTiles); // Add the drawn tiles to the player's rack
        console.log(`GameState [${this.gameId}]: Player ${player.username} drew ${drawnTiles.length} tiles. New rack size: ${player.rack.length}. Bag remaining: ${this.tileBag.length}`);
        return drawnTiles; // Return the tiles that were drawn
    }

    // --- Turn and State ---
    _checkTurn(playerId) {
        if (this.status !== 'playing') { return { valid: false, error: 'Game is not currently playing.' }; }
        // Check if currentTurnIndex is valid before accessing players array
        if (this.players.length === 0 || this.currentTurnIndex < 0 || this.currentTurnIndex >= this.players.length) {
            console.warn(`GameState [${this.gameId}]: Turn check failed - invalid index ${this.currentTurnIndex} or no players.`);
            return { valid: false, error: 'Game state invalid for turn check.' };
        }
        if (this.players[this.currentTurnIndex].id !== playerId) {
            return { valid: false, error: 'Not your turn.' };
        }
        return { valid: true };
    }

    advanceTurn() {
        if (this.status !== 'playing' || this.players.length <= 1) {
             if (this.players.length === 1 && this.status === 'playing') {
                 console.log(`GameState [${this.gameId}]: Only one player left, turn not advanced.`);
                 if(this.players[0]) this.players[0].isTurn = true; // Ensure remaining player has turn
             }
             return;
        }
        // Ensure currentTurnIndex is valid before accessing player
        if(this.currentTurnIndex >= 0 && this.currentTurnIndex < this.players.length) {
             this.players[this.currentTurnIndex].isTurn = false;
        }
        this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
        // Ensure the new index is also valid before assigning turn
        if(this.players[this.currentTurnIndex]) {
            this.players[this.currentTurnIndex].isTurn = true;
            console.log(`GameState [${this.gameId}]: Turn advanced to ${this.players[this.currentTurnIndex].username}.`);
        } else {
             // This state indicates a serious problem, maybe reset to 0?
             console.error(`GameState [${this.gameId}]: Failed to advance turn, invalid new index ${this.currentTurnIndex}. Resetting turn to player 0.`);
             this.currentTurnIndex = 0;
             if(this.players.length > 0 && this.players[0]) this.players[0].isTurn = true;
        }
    }

    // --- Player Actions ---
    passTurn(playerId) {
        const turnCheck = this._checkTurn(playerId);
        if (!turnCheck.valid) return { success: false, error: turnCheck.error };

        this.consecutivePasses++;
        console.log(`GameState [${this.gameId}]: Player ${playerId} passed. Consecutive passes: ${this.consecutivePasses}`);

        // Example: 6 passes ends the game for 2 players (adjust as needed)
        const maxPasses = this.players.length * 3;
        if (this.consecutivePasses >= maxPasses) {
            console.log(`GameState [${this.gameId}]: Game ending due to ${this.consecutivePasses} consecutive passes.`);
            this._endGame('passes'); // Ends the game and calculates final scores
            return { success: true, gameOver: true, finalScores: this.finalScores }; // Include final scores
        } else {
            this.advanceTurn();
            return { success: true, gameOver: false };
        }
    }

    exchangeTiles(playerId, lettersToExchange) { // lettersToExchange = ['A', 'BLANK', 'C']
        const turnCheck = this._checkTurn(playerId);
        if (!turnCheck.valid) return { success: false, error: turnCheck.error };
         if (this.tileBag.length < lettersToExchange.length) return { success: false, error: 'Not enough tiles in bag to exchange.' };

        const player = this.players[this.currentTurnIndex];
        if (!player) return { success: false, error: 'Internal error: Current player not found.' };

        const playerRackLetters = player.rack.map(t => t.letter);
        const tempRack = [...playerRackLetters]; // Use copy for validation counts
        const actualTilesToRemove = []; // Store the actual tile objects {letter, value}

        // Validate player has the tiles
        for (const letter of lettersToExchange) {
            const indexInTemp = tempRack.indexOf(letter);
            if (indexInTemp === -1) return { success: false, error: `You do not have the tile: ${letter}` };
            tempRack.splice(indexInTemp, 1); // Remove from temp copy

            // Find corresponding object in real rack, ensuring not to remove the same object instance twice
             let found = false;
             for(let i = 0; i < player.rack.length; i++) {
                 if(player.rack[i].letter === letter && !actualTilesToRemove.some(t => t === player.rack[i])) {
                    actualTilesToRemove.push(player.rack[i]);
                    found = true;
                    break;
                 }
             }
             if (!found) {
                 console.error(`GameState [${this.gameId}]: Tile object mismatch during exchange validation for letter ${letter}.`);
                 return { success: false, error: `Internal error validating tile ${letter}.` };
             }
        }

        // Perform exchange
        player.rack = player.rack.filter(tile => !actualTilesToRemove.includes(tile)); // Remove from actual rack
        this.tileBag.push(...actualTilesToRemove); // Add back to bag
        this.tileBag = _.shuffle(this.tileBag); // Shuffle bag
        this.drawTiles(player, lettersToExchange.length); // Draw new tiles
        this.consecutivePasses = 0; // Exchange resets pass count
        this.advanceTurn();

        console.log(`GameState [${this.gameId}]: Player ${playerId} exchanged ${lettersToExchange.length} tiles.`);
        return { success: true };
    }


    placeValidMove(playerId, move) { // move = [{ letter, value, row, col, isBlank }, ...]
        const turnCheck = this._checkTurn(playerId);
        if (!turnCheck.valid) return { success: false, error: turnCheck.error };

        const player = this.players[this.currentTurnIndex];
        if (!player) return { success: false, error: 'Internal error: Current player not found.' };

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

        // If placement is valid but no words were formed (can happen with adjacent single tiles after first move)
        if (wordsData.length === 0 && move.length > 0 && !this.isFirstMove) {
            return { success: false, error: 'Move must form at least one word.' };
        }
        if (this.isFirstMove && wordsData.length === 0 && move.length > 0) {
             return { success: false, error: 'First move did not form a valid word.' };
        }

        // --- 4. Calculate Score ---
         const scoreResult = this._calculateScore(move, wordsData);
         const totalScore = scoreResult.score;
         const bingoBonus = scoreResult.bingoBonus;

        // --- 5. Update Game State ---
        const rackTilesToRemove = []; // Store actual rack tile objects to remove
        const currentRackCopy = [...player.rack]; // Copy to find specific tile instances

        // a. Update board
        for (const tile of move) {
             const square = this.board[tile.row][tile.col];
             // Find the specific tile object from the rack to get original value (esp. for BLANK)
             const requiredLetter = tile.isBlank ? 'BLANK' : tile.letter.toUpperCase();
             const rackTileIndex = currentRackCopy.findIndex(t => t.letter === requiredLetter);
             if (rackTileIndex === -1) {
                 console.error(`CRITICAL: Could not find required tile ${requiredLetter} in rack copy during board update.`);
                 return { success: false, error: `Internal error: Tile ${requiredLetter} not found in rack.` };
             }
             const [rackTile] = currentRackCopy.splice(rackTileIndex, 1); // Remove from copy
             rackTilesToRemove.push(rackTile); // Add original tile object to remove list

             square.tile = {
                 letter: tile.letter.toUpperCase(), // The letter displayed/used in word
                 value: rackTile.value // The *original* value (0 for blank)
             };
             if (square.premium) square.isPremiumUsed = true; // Mark premium as used
        }
        // b. Update player score
        player.score += totalScore;
        // c. Remove actual tiles from rack using the tracked objects
        player.rack = player.rack.filter(tile => !rackTilesToRemove.includes(tile));
        // d. Draw new tiles
        this.drawTiles(player, move.length);
        // e. Update game state properties
        this.consecutivePasses = 0;
        this.isFirstMove = false;
        this.lastMove = { playerId, move: move.map(m => ({...m})), wordsData, score: totalScore, bingoBonus }; // Store move details
        this.moveHistory.push(this.lastMove);

        // --- 6. Advance Turn ---
        this.advanceTurn();

        // --- 7. Check for Game Over (Post-Move) ---
        // Pass the player *whose rack should be checked* (the one who just moved)
        const gameOverInfo = this._checkGameOver(player);
        if (gameOverInfo.isOver) {
            console.log(`GameState [${this.gameId}]: Game ending. Reason: ${gameOverInfo.reason}`);
             // Return success but also game over flag and final scores
             return { success: true, score: totalScore, gameOver: true, finalScores: this.finalScores };
        } else {
            console.log(`GameState [${this.gameId}]: Player ${playerId} placed move. Score: ${totalScore}.`);
             return { success: true, score: totalScore, gameOver: false };
        }
    }

    // --- Complex Logic Helpers (Private/Internal) ---

    _validatePlacement(move) {
        // Performs detailed placement rule checks.
        if (!move || move.length === 0) return { valid: false, error: 'Move is empty.' };
        let minRow = 15, maxRow = -1, minCol = 15, maxCol = -1;
        const placedCoords = new Set();
        for (const tile of move) {
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

        // Check for gaps using board state AND placed tiles
        const lineCoords = [];
        if (orientation === 'H' || orientation === 'single') {
            for (let c = minCol; c <= maxCol; c++) {
                const coordStr = `${minRow}-${c}`;
                const square = this.board[minRow][c];
                lineCoords.push({ r: minRow, c });
                if (!square.tile && !placedCoords.has(coordStr)) return { valid: false, error: 'Gap found in horizontal placement.' };
            }
        } else { // Vertical
            for (let r = minRow; r <= maxRow; r++) {
                const coordStr = `${r}-${minCol}`;
                const square = this.board[r][minCol];
                lineCoords.push({ r, c: minCol });
                if (!square.tile && !placedCoords.has(coordStr)) return { valid: false, error: 'Gap found in vertical placement.' };
            }
        }

        // Check connectivity
        let isConnected = false; let touchesCenter = false;
        for (const tile of move) {
            const { row, col } = tile;
            if (this.board[row][col].isCenter) touchesCenter = true;
            const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]];
            for (const [dr, dc] of neighbors) {
                const nr = row + dr; const nc = col + dc;
                if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
                    // Must connect to a tile already *on the board*
                    if (this.board[nr][nc].tile !== null) {
                        isConnected = true;
                        break;
                    }
                }
            }
            if (isConnected && !this.isFirstMove) break; // Stop checking once connected (unless first move)
        }

        if (this.isFirstMove) {
            if (!touchesCenter) return { valid: false, error: 'First move must cover the center square.' };
            if (move.length < 2 && BOARD_SIZE > 1) return { valid: false, error: 'First move must be at least two letters long.' };
        } else { // Not first move
            if (!isConnected && move.length > 0) return { valid: false, error: 'Move must connect to existing tiles.' };
        }
        return { valid: true, orientation, lineCoords };
    }

    _findFormedWords(move, orientation, lineCoords) {
        // Finds main word and cross words, validates against dictionary.
        const wordsData = [];
        const tempBoard = _.cloneDeep(this.board);
        const moveCoordsSet = new Set(move.map(t => `${t.row}-${t.col}`));

        // Place move tiles onto temp board
        for (const tile of move) {
             tempBoard[tile.row][tile.col].tile = {
                 letter: tile.letter.toUpperCase(),
                 // Use original value for scoring later, value doesn't affect word finding
                 value: tile.isBlank ? 0 : (TILE_DISTRIBUTION[tile.letter.toUpperCase()]?.value ?? 0),
             };
        }

        // Helper to get word details along an axis from a starting point
        const checkWord = (startTileCoord, axis) => {
             if (!startTileCoord) return;
             let r = startTileCoord.r; let c = startTileCoord.c;

             // Find beginning of the word
             if (axis === 'H') { while (c > 0 && tempBoard[r]?.[c - 1]?.tile) c--; }
             else { while (r > 0 && tempBoard[r - 1]?.[c]?.tile) r--; }

             let currentWord = ''; const currentWordTiles = [];
             let currentPosR = r; let currentPosC = c;

             // Read the word tile by tile
             while (currentPosR < BOARD_SIZE && currentPosC < BOARD_SIZE && tempBoard[currentPosR]?.[currentPosC]?.tile) {
                 const currentSquare = tempBoard[currentPosR][currentPosC];
                 const originalSquare = this.board[currentPosR][currentPosC]; // Need original for premium status
                 currentWord += currentSquare.tile.letter;
                 currentWordTiles.push({
                     letter: currentSquare.tile.letter,
                     // Value will be recalculated during scoring based on original rack tile (for blanks)
                     value: originalSquare.tile ? originalSquare.tile.value : currentSquare.tile.value, // Use original value if existing tile
                     r: currentPosR, c: currentPosC,
                     premium: originalSquare.premium,
                     isPremiumUsed: originalSquare.isPremiumUsed, // Use original premium status
                     isNew: moveCoordsSet.has(`${currentPosR}-${currentPosC}`)
                 });
                 if (axis === 'H') currentPosC++; else currentPosR++;
             }

             // Validate and store if it's a valid word (>1 letter)
             if (currentWord.length > 1) {
                  if (!dictionary.isValidWord(currentWord)) {
                      throw new Error(`Invalid word formed: ${currentWord}`); // Throw error
                  }
                  // Check if this exact word placement was already added
                  const wordKey = currentWord + '-' + currentWordTiles.map(t => `${t.r},${t.c}`).join('|');
                  if (!wordsData.some(wd => wd.key === wordKey)) {
                       wordsData.push({ key: wordKey, word: currentWord, tiles: currentWordTiles });
                  }
             }
         };

        try {
             // Check the main word along the placement axis
             if (lineCoords && lineCoords.length > 0) {
                 checkWord(lineCoords[0], orientation); // Start check from first tile placed in the line
             } else {
                  console.error(`GameState Error: lineCoords empty in _findFormedWords for game ${this.gameId}`);
                  return { valid: false, error: "Internal Error: Could not determine move line." };
             }

             // Check cross words (perpendicular axis) for each tile placed
             const crossAxis = (orientation === 'H') ? 'V' : 'H';
             // Only check cross words if the main placement forms a line or is single
             if (orientation === 'single' || (lineCoords && lineCoords.length >= 1)) {
                 for (const tile of move) {
                      checkWord({ r: tile.row, c: tile.col }, crossAxis);
                 }
             }
        } catch (error) {
             console.error(`Word validation error in game ${this.gameId}: ${error.message}`);
             return { valid: false, error: error.message };
        }

        // A valid move must result in at least one word being added to wordsData
        if (wordsData.length === 0 && move.length > 0) {
             console.warn(`GameState ${this.gameId}: Move by ${playerId} formed no words > 1 letter. Placement might be invalid.`);
             return { valid: false, error: 'Move must form at least one word of length 2 or more.' };
        }

        return { valid: true, wordsData };
    }


    _calculateScore(move, wordsData) {
        // Calculates score considering premiums and bingo.
        let totalScore = 0;

        for (const { word, tiles } of wordsData) {
            let currentWordScore = 0;
            let wordMultiplier = 1;

            for (const tile of tiles) {
                // Value comes from the tile object prepared in _findFormedWords,
                // which should reflect the original tile value (0 for blank)
                let letterScore = tile.value;

                // Apply premiums only if tile is NEW (part of current move)
                // and the premium hasn't been used before on this square
                if (tile.isNew && !tile.isPremiumUsed) {
                    switch (tile.premium) {
                        case 'DL': letterScore *= 2; break;
                        case 'TL': letterScore *= 3; break;
                        case 'DW': wordMultiplier *= 2; break;
                        case 'TW': wordMultiplier *= 3; break;
                    }
                }
                 currentWordScore += letterScore;
             }
             totalScore += (currentWordScore * wordMultiplier);
        }

        // Add Bingo bonus if all 7 tiles were used
        let bingoBonus = 0;
        if (move.length === RACK_SIZE) {
            bingoBonus = 50;
            totalScore += bingoBonus;
            console.log(`GameState ${this.gameId}: Bingo! +50 points.`);
        }

        return { score: totalScore, bingoBonus };
    }

    _checkGameOver(lastPlayer) {
        // Game ends if bag is empty AND one player has used all their tiles
        if (this.tileBag.length === 0 && lastPlayer?.rack.length === 0) {
            this._endGame('tiles'); // End game, calculate final scores
            return { isOver: true, reason: 'tiles' };
        }
        // Pass condition handled in passTurn
        return { isOver: false };
    }

    _endGame(reason) {
         if (this.status === 'finished') return; // Prevent ending twice
         this.status = 'finished';
         console.log(`GameState [${this.gameId}]: Game finished. Reason: ${reason}`);
         let scoreSumOfRacks = 0; let playerWhoFinished = null;

         if (reason === 'tiles') { // Player finished by using last tile
             playerWhoFinished = this.players.find(p => p.rack.length === 0);
         }

         // Adjust scores based on remaining tiles
         for (const player of this.players) {
             const rackValue = player.rack.reduce((sum, tile) => sum + tile.value, 0);
             if (player.rack.length > 0) {
                 player.score -= rackValue; // Subtract remaining tile values from own score
                 scoreSumOfRacks += rackValue; // Add to sum for the player who finished (if applicable)
                 console.log(`GameState [${this.gameId}]: Player ${player.username} loses ${rackValue} points for remaining tiles.`);
             }
         }

         // Add sum to player who finished, if game ended by tiles
         if (playerWhoFinished) {
             playerWhoFinished.score += scoreSumOfRacks;
             console.log(`GameState [${this.gameId}]: Player ${playerWhoFinished.username} gains ${scoreSumOfRacks} points for finishing.`);
         }

         // Store final calculated scores, sorted descending
         this.finalScores = this.players.map(p => ({
             id: p.id,
             username: p.username,
             finalScore: p.score // The final, adjusted score
         })).sort((a, b) => b.finalScore - a.finalScore);

         console.log(`GameState [${this.gameId}]: Final scores calculated:`, JSON.stringify(this.finalScores));
         // Ensure no player has the turn anymore
         this.players.forEach(p => p.isTurn = false);
         this.currentTurnIndex = -1; // No current turn
    }


    // --- State Serialization ---
    getPublicState() {
        // Returns state safe for all players (hides opponent racks)
        return {
            gameId: this.gameId,
            players: this.players.map(p => ({
                id: p.id,
                username: p.username,
                score: p.score,
                rackTileCount: p.rack.length, // Don't send actual tiles
                isTurn: p.isTurn
            })),
            board: this.board, // Send full board state
            tilesRemaining: this.tileBag.length,
            currentTurnPlayerId: (this.currentTurnIndex >= 0 && this.players[this.currentTurnIndex]) ? this.players[this.currentTurnIndex].id : null,
            status: this.status,
            lastMove: this.lastMove, // Include details of the last move for display
            consecutivePasses: this.consecutivePasses,
            finalScores: this.finalScores // Include final scores if game is finished
        };
    }

    getPlayerSpecificState(playerId) {
        // Returns state tailored for one player (includes their rack)
        const publicState = this.getPublicState();
        const player = this.players.find(p => p.id === playerId);
        return {
            ...publicState,
            // Ensure rack is always an array, return a copy
            myRack: player ? [...(player.rack || [])] : []
        };
    }
} 
// End of GameState Class
module.exports = GameState;