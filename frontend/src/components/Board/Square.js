// frontend/src/components/Square/Square.js
import React from 'react';
import Tile from '../Tile/Tile'; // Import Tile to display placed tiles
import './Square.css'; // Ensure CSS is imported

// Function to get CSS class for background/text color based on premium type
const getPremiumClass = (premium) => {
    switch (premium) {
        case 'TW': return 'triple-word';
        case 'DW': return 'double-word';
        case 'TL': return 'triple-letter';
        case 'DL': return 'double-letter';
        default: return 'normal';
    }
};

// Function to get the display text for premium squares
const getPremiumText = (premium) => {
     switch (premium) {
         case 'TW': return 'TRIPLE WORD';
         case 'DW': return 'DOUBLE WORD';
         case 'TL': return 'TRIPLE LETTER';
         case 'DL': return 'DOUBLE LETTER';
         default: return '';
     }
 };

/**
 * Renders a single square on the Scrabble board.
 * Displays premium info, center star, or the placed tile.
 * Handles drag & drop events for placing tiles.
 *
 * @param {object} props
 * @param {object} props.squareData - Data for the square { premium?, tile?, isPremiumUsed?, isCenter?, tempTile? }
 * @param {number} props.row - Row index of the square.
 * @param {number} props.col - Column index of the square.
 * @param {Function} props.onTileDrop - Callback when a valid tile is dropped.
 * @param {boolean} [props.canDrop=true] - Whether dropping is currently allowed on this square.
 */
const Square = ({ squareData, row, col, onTileDrop, canDrop = true }) => {
    // Extract properties safely using optional chaining
    const isCenterSquare = squareData?.isCenter;
    const premium = squareData?.premium;
    const tile = squareData?.tile; // Permanent tile from gameState
    const tempTile = squareData?.tempTile; // Temporary tile from App state during placement

    // Determine what tile to render (temporary takes precedence)
    const tileToRender = tempTile || tile;
    // A square is considered visually empty if no permanent or temporary tile exists
    const isEmpty = !tileToRender;

    // Build CSS classes
    const squareClasses = [
        'square',
        getPremiumClass(premium), // Applies color class based on premium
        isEmpty ? 'empty' : 'occupied', // 'empty' or 'occupied' based on tileToRender
        isCenterSquare ? 'center-square' : '', // Special class for center
        tempTile ? 'temporary' : '' // Class if holding a temporary tile
    ].filter(Boolean).join(' ');

    // --- Drag and Drop Handlers ---
    const handleDrop = (e) => {
        if (!canDrop) return; // Prevent drop if not allowed
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over'); // Remove hover effect
        const tileDataString = e.dataTransfer.getData("application/json");
        if (tileDataString && onTileDrop) {
            try {
                const tileData = JSON.parse(tileDataString);
                // Only allow drop if the square is visually empty (no permanent or temp tile already)
                // OR if it holds a temporary tile (allow replacing temp tile)
                if (isEmpty || tempTile) {
                     // Prevent dropping onto a square with a *permanent* tile
                    if(!tile) {
                         onTileDrop(tileData, row, col); // Call handler passed from App/Board
                    } else {
                         console.warn(`Square ${row},${col} has permanent tile, drop rejected.`);
                    }
                }
            } catch (error) {
                console.error("Square: Failed to parse dropped tile data:", error);
            }
        }
    };

    const handleDragOver = (e) => {
        // Allow drop only if allowed AND (square is empty OR holds only a temporary tile)
        if (canDrop && (isEmpty || tempTile)) {
           e.preventDefault(); // Necessary to indicate droppable target
           e.currentTarget.classList.add('drag-over'); // Add hover effect
        }
    };

    const handleDragLeave = (e) => {
        e.currentTarget.classList.remove('drag-over'); // Remove hover effect
    };
    // --- End Drag and Drop Handlers ---


    // Only temporary tiles *on the board* can be dragged back to rack
    const isTileDraggable = !!tempTile;

    return (
        <div
            className={squareClasses}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            data-row={row} // Useful for debugging or potentially event delegation
            data-col={col}
            // Add tooltip showing premium type
            title={premium ? getPremiumText(premium) : (isCenterSquare ? 'Center Square' : '')}
        >
            {/* Conditionally render Premium Text OR Center Star if the square is empty */}
            {isEmpty && premium && (
                <span className="premium-text">{getPremiumText(premium)}</span>
            )}
            {isEmpty && isCenterSquare && !premium && ( // Show star only if center AND no other premium text
                <span className="center-star">★</span>
            )}

            {/* Render Tile component if a permanent or temporary tile exists */}
            {tileToRender && (
                <Tile
                    letter={tileToRender.letter}
                    value={tileToRender.value}
                    isDraggable={isTileDraggable} // Only temp tiles on board are draggable
                    id={`board-tile-${row}-${col}`} // Unique ID for board tiles
                    originData={{ type: 'board', row, col }} // Identify source as board square
                 />
            )}
        </div>
    );
};

export default Square;