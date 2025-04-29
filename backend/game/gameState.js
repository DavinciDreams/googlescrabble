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
            // Store value for non-blanks, use letter 'BLANK' for blanks
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
                tile: null, // Initially empty
                isPremiumUsed: false // Track if premium has been scored
            };
        }
    }
    // Mark center square specifically if needed (e.g., for first move validation)
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
        this.isFirstMove = true; // Track if the first move has been made
        this.finalScores = null; // Store final scores when game ends
    }

    // --- Player Management ---

    addPlayer(playerId, username) {
        if (this.players.length >= 4 || this.status !== 'waiting') {
            console.warn(`GameState ${this.gameId}: Cannot add player ${username}. Max players reached or game not waiting.`);
            return null;
        }
        if (this.players.some(p => p.id === playerId || p.username === username)) {
             console.warn(`GameState ${this.gameId}: Player ${username} (${playerId}) already exists.`);
             // Find and return existing player if ID matches? For now, prevent duplicate adds.
             return this.players.find(p => p.id === playerId);
        }

        const player = {
            id: playerId,
            username: username,
            score: 0,
            rack: [], // Will be filled at game start
            isTurn: false
        };
        this.players.push(player);
        console.log(`GameState ${this.gameId}: Player ${username} (${playerId}) added.`);
        return player;
    }

    startGame() {
        if (this.players.length < 2 || this.status !== 'waiting') {
            console.warn(`GameState ${this.gameId}: Cannot start game. Status: ${this.status}, Players: ${this.players.length}`);
            return false;
        }
        this.status = 'playing';
        this.players.forEach(player => {
            this.drawTiles(player, RACK_SIZE); // Draw initial tiles
        });
        this.currentTurnIndex = Math.floor(Math.random() * this.players.length); // Random start player
        this.players[this.currentTurnIndex].isTurn = true;
        this.isFirstMove = true;
        console.log(`GameState ${this.gameId}: Game started. Player ${this.players[this.currentTurnIndex].username}'s turn.`);
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
             console.log(`GameState ${this.gameId}: Player ${player.username} drew ${drawnTiles.length} tiles. Rack size: ${player.rack.length}. Bag remaining: ${this.tileBag.length}`);
        } else {
             console.error(`GameState ${this.gameId}: Invalid player object provided to drawTiles.`);
        }
        return drawnTiles;
    }

    // --- Turn and State ---

    _checkTurn(playerId) {
         if (this.status !== 'playing') {
            return { valid: false, error: 'Game is not currently playing.' };
        }
        if (this.players.length === 0 || this.currentTurnIndex < 0) {
             return { valid: false, error: 'Game has not started or no players found.' };
        }
        if (this.players[this.currentTurnIndex]?.id !== playerId) {
            return { valid: false, error: 'Not your turn.' };
        }
        return { valid: true };
    }

    advanceTurn() {
        if (this.status !== 'playing' || this.players.length === 0) return;

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
        if (!turnCheck.valid) {
            return { success: false, error: turnCheck.error };
        }

        this.consecutivePasses++;
        console.log(`GameState ${this.gameId}: Player ${playerId} passed. Consecutive passes: ${this.consecutivePasses}`);

        // Check for game end by passes (e.g., 3 full rounds of passes for 2 players = 6)
        const maxPasses = this.players.length * 2 + 2; // Example threshold
        if (this.consecutivePasses >= maxPasses) {
            console.log(`GameState ${this.gameId}: Game ending due to ${this.consecutivePasses} consecutive passes.`);
            this._endGame('passes');
            return { success: true, gameOver: true };
        } else {
            this.advanceTurn();
            return { success: true, gameOver: false };
        }
    }

    exchangeTiles(playerId, lettersToExchange) { // lettersToExchange = ['A', 'BLANK', 'C']
        const turnCheck = this._checkTurn(playerId);
        if (!turnCheck.valid) {
            return { success: false, error: turnCheck.error };
        }
         if (this.tileBag.length < lettersToExchange.length) {
            return { success: false, error: 'Not enough tiles in bag to exchange.' };
        }

        const player = this.players[this.currentTurnIndex];
        const playerRackLetters = player.rack.map(t => t.letter);
        const tempRack = [...playerRackLetters];
        const actualTilesToRemove = []; // Store the actual tile objects being removed

        // Validate player has the tiles
        for (const letter of lettersToExchange) {
            const indexInTemp = tempRack.indexOf(letter);
            if (indexInTemp === -1) {
                return { success: false, error: `You do not have the tile: ${letter}` };
            }
            tempRack.splice(indexInTemp, 1); // Remove from temp copy for validation
            // Find the corresponding *object* in the real rack to put back later
             const tileObjIndex = player.rack.findIndex((tile, idx) => tile.letter === letter && !actualTilesToRemove.some(removedTile => removedTile === player.rack[idx]));
             if (tileObjIndex !== -1) {
                 actualTilesToRemove.push(player.rack[tileObjIndex]);
             } else {
                 // This shouldn't happen if the first check passed, but indicates a logic error
                 console.error(`GameState ${this.gameId}: Tile object mismatch during exchange validation for letter ${letter}.`);
                 return { success: false, error: `Internal error validating tile ${letter}.` };
             }
        }

        // Perform exchange
        // 1. Remove validated tiles from actual rack
         player.rack = player.rack.filter(tile => !actualTilesToRemove.includes(tile));

        // 2. Add exchanged tiles back to bag
        this.tileBag.push(...actualTilesToRemove);

        // 3. Shuffle bag
        this.tileBag = _.shuffle(this.tileBag);

        // 4. Draw new tiles
        this.drawTiles(player, lettersToExchange.length);

        // 5. Reset passes and advance turn
        this.consecutivePasses = 0;
        this.advanceTurn();

        console.log(`GameState ${this.gameId}: Player ${playerId} exchanged ${lettersToExchange.length} tiles.`);
        return { success: true };
    }


    placeValidMove(playerId, move) { // move = [{ letter: 'A', value: 1, row: 7, col: 7, isBlank: false }, ...] value/isBlank added client-side temp
        const turnCheck = this._checkTurn(playerId);
        if (!turnCheck.valid) {
            return { success: false, error: turnCheck.error };
        }

        const player = this.players[this.currentTurnIndex];

        // --- 1. Preliminary Move Checks & Tile Validation ---
        if (!move || move.length === 0) return { success: false, error: 'No tiles placed.' };

        // Check rack contents (handle blanks properly)
        const neededTiles = {}; // Count needed tiles {'A': 1, 'B': 2, 'BLANK': 1}
        for (const tile of move) {
            // If it's a blank being played as a letter, we need a 'BLANK' tile from the rack.
            const requiredLetter = tile.isBlank ? 'BLANK' : tile.letter.toUpperCase();
            neededTiles[requiredLetter] = (neededTiles[requiredLetter] || 0) + 1;
        }

        const currentRack = {}; // Count rack contents {'A': 1, 'B': 2, 'BLANK': 1}
        player.rack.forEach(t => {
            currentRack[t.letter] = (currentRack[t.letter] || 0) + 1;
        });

        for (const letter in neededTiles) {
            if (!currentRack[letter] || currentRack[letter] < neededTiles[letter]) {
                 return { success: false, error: `You don't have enough '${letter}' tiles.` };
            }
        }

         // --- 2. Placement Validation (Connectivity, Line, Board State) ---
         const placementValidation = this._validatePlacement(move);
         if (!placementValidation.valid) {
             return { success: false, error: placementValidation.error };
         }
         const { orientation, lineCoords } = placementValidation;


        // --- 3. Word Formation & Dictionary Check ---
        const formedWordsResult = this._findFormedWords(move, orientation, lineCoords);
        if (!formedWordsResult.valid) {
             return { success: false, error: formedWordsResult.error }; // E.g., "Invalid word found: XYZ"
        }
        const { wordsData } = formedWordsResult; // wordsData = [{ word: 'HI', score: 5, tiles: [...] }, ...]


        // --- 4. Calculate Score ---
         const scoreResult = this._calculateScore(move, wordsData);
         const totalScore = scoreResult.score;
         const bingoBonus = scoreResult.bingoBonus;


        // --- 5. Update Game State (Board, Score, Rack) ---
        // a. Update board & mark premiums used
        for (const tile of move) {
             const square = this.board[tile.row][tile.col];
            // Store the *assigned* letter for blanks, keep value 0
            square.tile = {
                letter: tile.letter.toUpperCase(), // Store the played letter
                value: tile.isBlank ? 0 : (TILE_DISTRIBUTION[tile.letter.toUpperCase()]?.value ?? 0), // Original value, 0 for blank
            };
            if (square.premium) {
                 square.isPremiumUsed = true; // Mark premium as used for this square
             }
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
                     removedFromRack.push(...tempRack.splice(i, 1)); // Remove and store
                     count--;
                 }
             }
         }
        player.rack = tempRack; // Assign the modified rack back

        // d. Draw new tiles
        this.drawTiles(player, move.length);

        // e. Update game state properties
        this.consecutivePasses = 0;
        this.isFirstMove = false; // Mark first move as done
        this.lastMove = { playerId, move, wordsData, score: totalScore, bingoBonus }; // Store move details
        this.moveHistory.push(this.lastMove);

        // --- 6. Advance Turn ---
        this.advanceTurn();

        // --- 7. Check for Game Over (Post-Move) ---
        const gameOverInfo = this._checkGameOver(player); // Check if the move ended the game
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
        // Checks:
        // 1. Tiles are within bounds (0-14).
        // 2. Target squares are currently empty.
        // 3. Tiles form a single horizontal or vertical line (no L-shapes, no gaps).
        // 4. Connection:
        //    - If first move: At least one tile must be on the center square (7,7).
        //    - If not first move: At least one placed tile must be adjacent (horizontally or vertically) to an existing tile.
        // Returns { valid: boolean, error?: string, orientation?: 'H'|'V'|'single', lineCoords?: Array<{r,c}> }

        if (!move || move.length === 0) return { valid: false, error: 'Move is empty.' };

        let minRow = 15, maxRow = -1, minCol = 15, maxCol = -1;
        const placedCoords = new Set(); // Store "row-col" strings

        for (const tile of move) {
            const { row, col } = tile;
            if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
                return { valid: false, error: `Tile placement out of bounds (${row}, ${col}).` };
            }
            if (this.board[row][col].tile !== null) {
                return { valid: false, error: `Square (${row}, ${col}) is already occupied.` };
            }
            minRow = Math.min(minRow, row);
            maxRow = Math.max(maxRow, row);
            minCol = Math.min(minCol, col);
            maxCol = Math.max(maxCol, col);
            placedCoords.add(`${row}-${col}`);
        }

        let orientation = null;
        if (minRow === maxRow && minCol === maxCol) orientation = 'single'; // Single tile
        else if (minRow === maxRow) orientation = 'H'; // Horizontal
        else if (minCol === maxCol) orientation = 'V'; // Vertical
        else return { valid: false, error: 'Tiles must be placed in a single line (horizontally or vertically).' };

        // Check for gaps in the line
        const lineCoords = [];
        if (orientation === 'H' || orientation === 'single') {
             for (let c = minCol; c <= maxCol; c++) {
                 lineCoords.push({ r: minRow, c });
                 if (!placedCoords.has(`${minRow}-${c}`) && !this.board[minRow][c].tile) {
                     return { valid: false, error: 'Gap found in horizontal placement.' };
                 }
             }
         } else if (orientation === 'V') { // Vertical
             for (let r = minRow; r <= maxRow; r++) {
                  lineCoords.push({ r, c: minCol });
                 if (!placedCoords.has(`${r}-${minCol}`) && !this.board[r][minCol].tile) {
                     return { valid: false, error: 'Gap found in vertical placement.' };
                 }
             }
         }

        // Check connectivity
        let isConnected = false;
        let touchesCenter = false;
         for (const tile of move) {
            const { row, col } = tile;
            if (row === 7 && col === 7) touchesCenter = true;
            // Check adjacent squares (up, down, left, right)
            const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]];
            for (const [dr, dc] of neighbors) {
                 const nr = row + dr;
                 const nc = col + dc;
                 if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
                     if (this.board[nr][nc].tile !== null) { // Check if adjacent to existing tile
                         isConnected = true;
                         break;
                     }
                 }
             }
             if (isConnected) break; // No need to check further if already connected
         }

        if (this.isFirstMove) {
             if (!touchesCenter) {
                 return { valid: false, error: 'First move must cover the center square.' };
             }
         } else { // Not the first move
             if (!isConnected && move.length > 0) { // Need connection if it's not the first move
                 return { valid: false, error: 'Move must connect to existing tiles.' };
             }
         }

        return { valid: true, orientation, lineCoords };
    }

    _findFormedWords(move, orientation, lineCoords) {
        // Finds the main word and any cross words formed by the move.
        // Validates all found words against the dictionary.
        // Returns { valid: boolean, error?: string, wordsData?: Array<{ word: string, tiles: Array<{...}> }> }

        const wordsData = []; // Store { word: 'STR', tiles: [{letter, value, r, c, isNew: true/false}, ...] }
        const tempBoard = _.cloneDeep(this.board); // Create a temporary board state

        // Place move tiles onto the temp board for easier checking
         for (const tile of move) {
             tempBoard[tile.row][tile.col].tile = {
                 letter: tile.letter.toUpperCase(),
                 value: tile.isBlank ? 0 : (TILE_DISTRIBUTION[tile.letter.toUpperCase()]?.value ?? 0),
             };
         }

        const checkWord = (tileCoords, axis) => { // axis = 'H' or 'V'
            if (!tileCoords || tileCoords.length === 0) return;

            let start, end, fixedCoord;
             if (axis === 'H') { // Horizontal word
                fixedCoord = tileCoords[0].r;
                 start = tileCoords[0].c;
                 while (start > 0 && tempBoard[fixedCoord][start - 1].tile) start--;
                 end = tileCoords[tileCoords.length - 1].c;
                 while (end < BOARD_SIZE - 1 && tempBoard[fixedCoord][end + 1].tile) end++;
            } else { // Vertical word
                 fixedCoord = tileCoords[0].c;
                 start = tileCoords[0].r;
                 while (start > 0 && tempBoard[start - 1][fixedCoord].tile) start--;
                 end = tileCoords[tileCoords.length - 1].r;
                 while (end < BOARD_SIZE - 1 && tempBoard[end + 1][fixedCoord].tile) end++;
            }

            if (end - start === 0 && tileCoords.length === 1 && move.length > 1) return; // Single letter cross-word is only valid if move itself was > 1 tile

            let word = '';
             const wordTiles = [];
             const moveCoordsSet = new Set(move.map(t => `${t.row}-${t.col}`)); // Quick lookup for new tiles

             for (let i = start; i <= end; i++) {
                 const r = (axis === 'H') ? fixedCoord : i;
                 const c = (axis === 'H') ? i : fixedCoord;
                 const square = tempBoard[r][c];
                 if (!square || !square.tile) continue; // Should not happen if bounds check is correct

                 word += square.tile.letter;
                 wordTiles.push({
                     ...square.tile,
                     r,
                     c,
                     premium: square.premium,
                     isPremiumUsed: square.isPremiumUsed,
                     isNew: moveCoordsSet.has(`${r}-${c}`), // Mark if part of the current move
                 });
             }

            if (word.length > 1) {
                 if (!dictionary.isValidWord(word)) {
                     throw new Error(`Invalid word formed: ${word}`); // Throw error to be caught
                 }
                 // Avoid adding duplicate words if single tile forms H and V word
                 if (!wordsData.some(wd => wd.word === word && wd.tiles.length === wordTiles.length)) {
                      wordsData.push({ word, tiles: wordTiles });
                 }
            }
         };

        try {
             // Check main word along the placement axis
             if (orientation === 'H' || orientation === 'V') {
                 checkWord(lineCoords, orientation);
             } else { // Single tile move - check both H and V if connected
                 checkWord(lineCoords, 'H');
                 checkWord(lineCoords, 'V');
             }


            // Check cross words perpendicular to the placement axis
             const crossAxis = (orientation === 'H') ? 'V' : 'H';
             for (const tile of move) {
                // Only check cross if single tile or perpendicular axis
                 if (orientation !== 'single' && crossAxis !== orientation) {
                     checkWord([{ r: tile.row, c: tile.col }], crossAxis);
                 } else if(orientation === 'single'){
                      // If single tile, we already checked both axis above
                 } else {
                     // If orientation matches crossAxis (e.g. V move, check V cross-words)
                     // This is handled by the main checkWord call above
                 }
             }

             // If the move was just a single tile, but didn't form any words > 1 letter
             if (move.length === 1 && wordsData.length === 0) {
                 // This check might be too strict depending on rules interpretation.
                 // Usually a single tile needs to form *some* word with adjacent tiles.
                 // If placement validation ensures connectivity, this might be okay.
                 // For now, allow single tile placement if connectivity is met.
             }


        } catch (error) {
             console.error(`Word validation error: ${error.message}`);
             return { valid: false, error: error.message };
        }

        return { valid: true, wordsData };
    }


    _calculateScore(move, wordsData) {
        // Calculates score based on tile values, premium squares used *by this move*, and bingo bonus.
        // wordsData = [{ word: 'HI', tiles: [{letter, value, r, c, premium, isPremiumUsed, isNew}, ...] }, ...]

        let totalScore = 0;
        const moveCoordsSet = new Set(move.map(t => `${t.row}-${t.col}`));

        for (const { word, tiles } of wordsData) {
            let currentWordScore = 0;
            let wordMultiplier = 1;

            for (const tile of tiles) {
                let letterScore = tile.value; // Base value (0 for blanks)

                // Apply letter premiums only if the tile is NEW and premium is NOT already used
                if (tile.isNew && !tile.isPremiumUsed) {
                    switch (tile.premium) {
                        case 'DL': letterScore *= 2; break;
                        case 'TL': letterScore *= 3; break;
                        case 'DW': wordMultiplier *= 2; break;
                        case 'TW': wordMultiplier *= 3; break;
                    }
                     // Handle center square bonus if applicable (often counts as DW)
                     if (tile.r === 7 && tile.c === 7 && this.isFirstMove) {
                         // Assuming center is DW for first move
                         wordMultiplier *= 2;
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
        // Check if the game ended because the last player emptied their rack and the bag is empty
        if (this.tileBag.length === 0 && lastPlayer.rack.length === 0) {
            this._endGame('tiles');
            return { isOver: true, reason: 'tiles' };
        }
        // Other end conditions (like passes) are checked elsewhere
        return { isOver: false };
    }

    _endGame(reason) {
         if (this.status === 'finished') return; // Prevent ending twice

         this.status = 'finished';
         console.log(`GameState ${this.gameId}: Game finished. Reason: ${reason}`);

         // Calculate final score adjustments
         let scoreSumOfRacks = 0;
         let playerWhoFinished = null;

         if (reason === 'tiles') { // Player finished by using last tile
             // Find the player with the empty rack (should be the last player)
             playerWhoFinished = this.players.find(p => p.rack.length === 0);
         }

        for (const player of this.players) {
             const rackValue = player.rack.reduce((sum, tile) => sum + tile.value, 0);
             if (player.rack.length > 0) {
                 player.score -= rackValue; // Subtract remaining tile values from score
                 scoreSumOfRacks += rackValue; // Add to sum for the player who finished
             }
         }

         if (playerWhoFinished) {
             playerWhoFinished.score += scoreSumOfRacks; // Add sum to player who finished
         }

         // Store final scores
         this.finalScores = this.players.map(p => ({
             id: p.id,
             username: p.username,
             finalScore: p.score
         }));

         console.log(`GameState ${this.gameId}: Final scores calculated:`, this.finalScores);
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
            board: this.board, // Send full board state (including premiums, used status)
            tilesRemaining: this.tileBag.length,
            currentTurnPlayerId: this.players[this.currentTurnIndex]?.id,
            status: this.status,
            lastMove: this.lastMove, // Include details of the last move
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
            myRack: player ? player.rack : [] // Include the specific player's rack
        };
    }
}

module.exports = GameState;