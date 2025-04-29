import React from 'react';
import Tile from '../Tile/Tile';
import './Square.css';

const getPremiumClass = (premium) => { /* ... (keep existing function) ... */ };
const getPremiumText = (premium) => { /* ... (keep existing function) ... */ };

// Added onTileDrop prop
const Square = ({ squareData, row, col, onTileDrop, canDrop = true }) => {
    const isCenterSquare = row === 7 && col === 7;
    const premium = squareData?.premium;
    const tile = squareData?.tile; // This represents *confirmed* tiles from gameState
    const tempTile = squareData?.tempTile; // Represents *temporary* tile from App state

    const squareClasses = [
        'square',
        getPremiumClass(premium),
        (tile || tempTile) ? 'occupied' : 'empty', // Occupied if confirmed OR temp tile exists
        isCenterSquare ? 'center-square' : '',
        tempTile ? 'temporary' : '' // Add class for temporary tiles
    ].filter(Boolean).join(' ');

    const handleDrop = (e) => {
        if (!canDrop) return; // Check if dropping is allowed (e.g., not opponent's turn)
        e.preventDefault();
        const tileDataString = e.dataTransfer.getData("application/json");
        if (tileDataString) {
            try {
                const tileData = JSON.parse(tileDataString);
                console.log(`Tile dropped on square ${row}, ${col}:`, tileData);
                // Prevent dropping onto an already permanently occupied square
                if (!tile) {
                    onTileDrop(tileData, row, col); // Call handler passed from App
                } else {
                    console.warn("Cannot drop on permanently occupied square.");
                }
            } catch (error) {
                console.error("Failed to parse dropped tile data:", error);
            }
        }
         e.currentTarget.classList.remove('drag-over'); // Remove hover effect
    };

    const handleDragOver = (e) => {
        if (!canDrop) return;
        // Allow drop only if the square is empty or holds a *temporary* tile (can replace temp)
        if (!tile) {
           e.preventDefault(); // Necessary to allow dropping
            e.currentTarget.classList.add('drag-over'); // Add hover effect
        }
    };

    const handleDragLeave = (e) => {
        e.currentTarget.classList.remove('drag-over'); // Remove hover effect
    };

    // Decide which tile to render: temporary takes precedence over permanent for display here
    const tileToRender = tempTile || tile;
    const isDraggable = !!tempTile; // Only temporary tiles on the board are draggable

    return (
        <div
            className={squareClasses}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave} // Add drag leave handler
            data-row={row}
            data-col={col}
        >
            {!tileToRender && premium && (
                <span className="premium-text">{getPremiumText(premium)}</span>
            )}
            {tileToRender && (
                <Tile
                    letter={tileToRender.letter}
                    value={tileToRender.value}
                    isDraggable={isDraggable} // Temp tiles can be dragged off/around
                    id={`board-tile-${row}-${col}`}
                    originData={{ type: 'board', row, col }} // Origin is this board square
                 />
            )}
             {isCenterSquare && !tileToRender && <span className="center-star">★</span>}
        </div>
    );
};

export default Square;