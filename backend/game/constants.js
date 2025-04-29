// Standard Scrabble Tile Distribution and Points (English)
const TILE_DISTRIBUTION = {
    'A': { count: 9, value: 1 }, 'B': { count: 2, value: 3 }, 'C': { count: 2, value: 3 },
    'D': { count: 4, value: 2 }, 'E': { count: 12, value: 1 }, 'F': { count: 2, value: 4 },
    'G': { count: 3, value: 2 }, 'H': { count: 2, value: 4 }, 'I': { count: 9, value: 1 },
    'J': { count: 1, value: 8 }, 'K': { count: 1, value: 5 }, 'L': { count: 4, value: 1 },
    'M': { count: 2, value: 3 }, 'N': { count: 6, value: 1 }, 'O': { count: 8, value: 1 },
    'P': { count: 2, value: 3 }, 'Q': { count: 1, value: 10 }, 'R': { count: 6, value: 1 },
    'S': { count: 4, value: 1 }, 'T': { count: 6, value: 1 }, 'U': { count: 4, value: 1 },
    'V': { count: 2, value: 4 }, 'W': { count: 2, value: 4 }, 'X': { count: 1, value: 8 },
    'Y': { count: 2, value: 4 }, 'Z': { count: 1, value: 10 },
    'BLANK': { count: 2, value: 0 }
};

const BOARD_SIZE = 15;

// Premium Square Types (can represent these in board state)
const PREMIUM_SQUARES = {
    TW: 'Triple Word Score',
    DW: 'Double Word Score',
    TL: 'Triple Letter Score',
    DL: 'Double Letter Score',
    ST: 'Start Square (usually DW)'
};

// Example: Define the actual board layout (can be a 2D array or object)
// 0 = normal, 1=DL, 2=TL, 3=DW, 4=TW
const BOARD_LAYOUT = [
    [4,0,0,1,0,0,0,4,0,0,0,1,0,0,4],
    [0,3,0,0,0,2,0,0,0,2,0,0,0,3,0],
    [0,0,3,0,0,0,1,0,1,0,0,0,3,0,0],
    [1,0,0,3,0,0,0,1,0,0,0,3,0,0,1],
    [0,0,0,0,3,0,0,0,0,0,3,0,0,0,0],
    [0,2,0,0,0,2,0,0,0,2,0,0,0,2,0],
    [0,0,1,0,0,0,1,0,1,0,0,0,1,0,0],
    [4,0,0,1,0,0,0,3,0,0,0,1,0,0,4], // Center is often 3 (DW) or marked specially
    [0,0,1,0,0,0,1,0,1,0,0,0,1,0,0],
    [0,2,0,0,0,2,0,0,0,2,0,0,0,2,0],
    [0,0,0,0,3,0,0,0,0,0,3,0,0,0,0],
    [1,0,0,3,0,0,0,1,0,0,0,3,0,0,1],
    [0,0,3,0,0,0,1,0,1,0,0,0,3,0,0],
    [0,3,0,0,0,2,0,0,0,2,0,0,0,3,0],
    [4,0,0,1,0,0,0,4,0,0,0,1,0,0,4],
];

// Map layout numbers to premium types for easier logic
const PREMIUM_MAP = { 1: 'DL', 2: 'TL', 3: 'DW', 4: 'TW' };


const RACK_SIZE = 7;

module.exports = {
    TILE_DISTRIBUTION,
    BOARD_SIZE,
    PREMIUM_SQUARES,
    BOARD_LAYOUT,
    PREMIUM_MAP,
    RACK_SIZE
};