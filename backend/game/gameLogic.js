// backend/game/gameLogic.js

const { TILE_DISTRIBUTION, BOARD_SIZE, RACK_SIZE, PREMIUM_MAP } = require('./constants');
const dictionary = require('../utils/dictionary'); // Ensure dictionary is loaded
const _ = require('lodash'); // For cloning if needed within helpers

// --- Placement Validation Logic ---
/**
 * Validates the placement of tiles on the board.
 * Checks bounds, occupation, line formation, and connectivity.
 * @param {Array<Array<object>>} board - The current game board state.
 * @param {Array} move - Array of placed tiles [{ letter, value, row, col, isBlank }, ...]
 * @param {boolean} isFirstMove - Whether this is the first move of the game.
 * @returns {{ valid: boolean, error?: string, orientation?: 'H'|'V'|'single', lineCoords?: Array<{r,c}> }}
 */
function validatePlacement(board, move, isFirstMove) {
    if (!move || move.length === 0) return { valid: false, error: 'Move is empty.' };
    let minRow = BOARD_SIZE, maxRow = -1, minCol = BOARD_SIZE, maxCol = -1;
    const placedCoords = new Set();

    for (const tile of move) {
        const { row, col } = tile;
        // Check bounds
        if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
            return { valid: false, error: `Tile out of bounds (${row}, ${col}).` };
        }
        // Check if square is already occupied by a permanent tile
        if (board[row]?.[col]?.tile !== null) {
            return { valid: false, error: `Square (${row}, ${col}) occupied.` };
        }
        minRow = Math.min(minRow, row); maxRow = Math.max(maxRow, row);
        minCol = Math.min(minCol, col); maxCol = Math.max(maxCol, col);
        placedCoords.add(`${row}-${col}`);
    }

    // Determine orientation
    let orientation = null;
    if (minRow === maxRow && minCol === maxCol) orientation = 'single';
    else if (minRow === maxRow) orientation = 'H';
    else if (minCol === maxCol) orientation = 'V';
    else return { valid: false, error: 'Tiles must be in a single line.' };

    // Check for gaps
    const lineCoords = [];
    if (orientation === 'H' || orientation === 'single') {
        for (let c = minCol; c <= maxCol; c++) {
            const coordStr = `${minRow}-${c}`; const square = board[minRow]?.[c];
            if (!square) return { valid: false, error: 'Internal error: Invalid H coordinate.'};
            lineCoords.push({ r: minRow, c });
            if (!square.tile && !placedCoords.has(coordStr)) return { valid: false, error: 'Gap in horizontal placement.' };
        }
    } else { // Vertical
        for (let r = minRow; r <= maxRow; r++) {
            const coordStr = `${r}-${minCol}`; const square = board[r]?.[minCol];
            if (!square) return { valid: false, error: 'Internal error: Invalid V coordinate.'};
            lineCoords.push({ r, c: minCol });
            if (!square.tile && !placedCoords.has(coordStr)) return { valid: false, error: 'Gap in vertical placement.' };
        }
    }

    // Check connectivity
    let isConnected = false; let touchesCenter = false;
    for (const tile of move) {
        const { row, col } = tile; if (board[row]?.[col]?.isCenter) touchesCenter = true;
        const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of neighbors) {
            const nr = row + dr; const nc = col + dc;
            // Check bounds and if neighbor has an existing tile
            if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc].tile !== null) {
                 isConnected = true; break;
            }
        }
        if (isConnected && !isFirstMove) break; // Optimization
    }

    // Apply first move / connection rules
    if (isFirstMove) {
        if (!touchesCenter) return { valid: false, error: 'First move must cover center.' };
        if (move.length < 2 && BOARD_SIZE > 1) return { valid: false, error: 'First move must be >= 2 letters.' };
    } else {
        if (!isConnected && move.length > 0) return { valid: false, error: 'Move must connect to existing tiles.' };
    }

    return { valid: true, orientation, lineCoords };
}


// --- Word Finding & Validation Logic ---
/**
 * Finds all words formed by placing the 'move' tiles onto the board.
 * Validates each formed word against the dictionary.
 * @param {Array<Array<object>>} board - The current game board state (before the move is placed).
 * @param {Array} move - Array of placed tiles [{ letter, value, row, col, isBlank }, ...]
 * @param {'H' | 'V' | 'single'} orientation - The orientation of the placed tiles.
 * @param {Array} lineCoords - Coordinates along the main placement line.
 * @returns {{ valid: boolean, error?: string, wordsData?: Array<{ key: string, word: string, tiles: Array<{letter, value, r, c, premium, isPremiumUsed, isNew}> }> }}
 */
function findFormedWords(board, move, orientation, lineCoords) {
    const wordsData = [];
    const tempBoard = _.cloneDeep(board); // Clone to simulate move placement
    const moveCoordsSet = new Set(move.map(t => `${t.r}-${t.c}`));

    // Place move tiles onto temp board for word checking
    for (const tile of move) {
        if (tempBoard[tile.row]?.[tile.col]) {
            tempBoard[tile.row][tile.col].tile = {
                letter: tile.letter.toUpperCase(),
                value: tile.value // Value needed for tile objects, score logic uses original board though
            };
        } else { return { valid: false, error: "Internal Error: Invalid coordinate during word find." }; }
    }

    // Helper to check a word along an axis from a start point
    const checkWord = (startCoord, axis) => {
        if (!startCoord) return; let r = startCoord.r; let c = startCoord.c;
        // Find beginning
        if (axis === 'H') { while (c > 0 && tempBoard[r]?.[c - 1]?.tile) c--; }
        else { while (r > 0 && tempBoard[r - 1]?.[c]?.tile) r--; }
        // Read word
        let currentWord = ''; const currentWordTiles = []; let currentPosR = r; let currentPosC = c;
        let containsNewTile = false;
        while (currentPosR < BOARD_SIZE && currentPosC < BOARD_SIZE && tempBoard[currentPosR]?.[currentPosC]?.tile) {
            const currentSquare = tempBoard[currentPosR][currentPosC];
            const originalSquare = board[currentPosR][currentPosC]; // Use original board for premium/value info
            const isNew = moveCoordsSet.has(`${currentPosR}-${currentPosC}`);
            if (isNew) containsNewTile = true;

            currentWord += currentSquare.tile.letter;
            currentWordTiles.push({
                letter: currentSquare.tile.letter,
                // Use original tile value if exists, else lookup (crucial for blanks)
                value: originalSquare.tile ? originalSquare.tile.value : (TILE_DISTRIBUTION[currentSquare.tile.letter]?.value ?? 0),
                r: currentPosR, c: currentPosC,
                premium: originalSquare.premium,
                isPremiumUsed: originalSquare.isPremiumUsed,
                isNew: isNew
            });
            if (axis === 'H') currentPosC++; else currentPosR++;
        }
        // Validate and store if > 1 letter and contains new tile
        if (currentWord.length > 1 && containsNewTile) {
             if (!dictionary.isValidWord(currentWord)) throw new Error(`Invalid word: ${currentWord}`);
             const wordKey = `${currentWord}-${axis}-${r},${c}`;
             if (!wordsData.some(wd => wd.key === wordKey)) wordsData.push({ key: wordKey, word: currentWord, tiles: currentWordTiles });
        }
    };

    try {
         if (!lineCoords || lineCoords.length === 0) throw new Error("Internal: lineCoords missing.");
         checkWord(lineCoords[0], orientation); // Check main word
         const crossAxis = (orientation === 'H') ? 'V' : 'H';
         if (orientation === 'single' || lineCoords.length >= 1) {
             for (const tile of move) { checkWord({ r: tile.row, c: tile.col }, crossAxis); } // Check cross words
         }
    } catch (error) { console.error(`Word validation error: ${error.message}`); return { valid: false, error: error.message }; }

    // A valid move must form at least one word
    if (wordsData.length === 0 && move.length > 0) return { valid: false, error: 'Move must form word >= 2 letters.' };
    return { valid: true, wordsData };
}


// --- Scoring Logic ---
/**
 * Calculates score based on tile values, premium squares used *by this move*, and bingo bonus.
 * @param {Array<Array<object>>} board - The game board state *before* the move was placed.
 * @param {Array} move - Array of placed tiles [{ letter, value, row, col, isBlank }, ...]
 * @param {Array} wordsData - Array from findFormedWords [{ word, tiles: [{letter, value, r, c, premium, isPremiumUsed, isNew}, ...] }, ...]
 * @param {boolean} isFirstMove - Whether this is the first move of the game.
 * @returns {{ score: number, bingoBonus: number }}
 */
function calculateScore(board, move, wordsData, isFirstMove) {
    let totalScore = 0;
    console.log(`Calculating score for ${wordsData.length} word(s).`);
    for (const { word, tiles } of wordsData) {
        let currentWordScore = 0;
        let wordMultiplier = 1;
        console.log(`  Scoring word: ${word}`);
        for (const tile of tiles) {
            let letterScore = tile.value; // Value from _findFormedWords (original value)
            // Apply premiums only if tile is NEW and premium is unused on board
            if (tile.isNew) {
                const originalSquare = board[tile.r][tile.c]; // Check original board
                if (originalSquare.premium && !originalSquare.isPremiumUsed) {
                    console.log(`    Tile ${tile.letter} @(${tile.r},${tile.c}) hit premium: ${originalSquare.premium}`);
                    switch (originalSquare.premium) {
                        case 'DL': letterScore *= 2; console.log(`      DL -> ${letterScore}`); break;
                        case 'TL': letterScore *= 3; console.log(`      TL -> ${letterScore}`); break;
                        case 'DW': wordMultiplier *= 2; console.log(`      DW -> Word x${wordMultiplier}`); break;
                        case 'TW': wordMultiplier *= 3; console.log(`      TW -> Word x${wordMultiplier}`); break;
                    }
                    // Center square counts as DW on first move only
                    if (originalSquare.isCenter && isFirstMove && originalSquare.premium !== 'DW' && originalSquare.premium !== 'TW') {
                        wordMultiplier *= 2; console.log(`      Center bonus (DW) -> Word x${wordMultiplier}`);
                    }
                }
            }
            currentWordScore += letterScore;
        }
        const finalWordScore = currentWordScore * wordMultiplier;
        console.log(`  Word: ${word}, Base: ${currentWordScore}, Multiplier: x${wordMultiplier}, Final: ${finalWordScore}`);
        totalScore += finalWordScore;
    }
    let bingoBonus = 0;
    if (move.length === RACK_SIZE) { bingoBonus = 50; totalScore += bingoBonus; console.log(`Bingo! +50 points.`); }
    return { score: totalScore, bingoBonus };
}


module.exports = {
    validatePlacement,
    findFormedWords,
    calculateScore,
};