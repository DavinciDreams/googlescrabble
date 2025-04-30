// frontend/src/components/Tile/Tile.js
import React from 'react';
import './Tile.css'; // Import the CSS for styling

/**
 * Renders a single Scrabble tile.
 * Handles display of letter/value, blank tiles, selection state, and drag events.
 * @param {object} props
 * @param {string} props.letter - The letter ('A'-'Z' or 'BLANK').
 * @param {number} props.value - The point value of the tile (0 for BLANK).
 * @param {boolean} [props.isDraggable=false] - Whether the tile can be dragged.
 * @param {string} [props.id] - A unique ID for the tile element (useful for drag/drop tracking).
 * @param {object} [props.originData] - Data indicating where the tile came from ({ type: 'rack'/'board', ... }). Required if draggable.
 * @param {boolean} [props.isSelected=false] - Whether the tile is currently selected (e.g., for exchange).
 */
const Tile = ({
    letter,
    value,
    isDraggable = false,
    id,
    originData,
    isSelected = false
}) => {
    // Determine if it's a blank tile
    const isBlank = letter === 'BLANK' || value === 0;

    const displayLetter = isBlank ? '' : letter?.toUpperCase();
    const displayValue = isBlank ? '' : value;

    // Drag Start Handler
    const handleDragStart = (e) => {
        if (isDraggable && originData) {
            // console.log(`Dragging tile: ${letter} (id: ${id}, origin: ${JSON.stringify(originData)})`);
            const tileData = JSON.stringify({ letter, value, id, originData, isBlank });
            try {
                e.dataTransfer.setData("application/json", tileData);
                e.dataTransfer.effectAllowed = "move";
                setTimeout(() => { e.target?.classList.add('dragging'); }, 0);
            } catch (err) { console.error("Error setting drag data:", err); }
        } else {
            if (!originData && isDraggable) { console.warn("Tile drag prevented: originData prop missing.", { id, letter }); }
            e.preventDefault();
        }
    };

    // Drag End Handler
    const handleDragEnd = (e) => {
         try {} finally { e.target?.classList.remove('dragging'); }
    };

    // Combine CSS classes based on tile state
    const tileClasses = [
        'tile',
        isBlank ? 'blank-tile' : '',
        isSelected ? 'tile-selected-exchange' : '',
        isDraggable ? 'draggable' : '',
    ].filter(Boolean).join(' ');

    return (
        <div
            className={tileClasses}
            draggable={isDraggable}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            id={id}
            title={isBlank ? "Blank Tile (0 points)" : `${displayLetter || '?'} - ${displayValue}pt${isSelected ? ' (Selected)' : ''}`}
        >
            {/* --->>> Display letter and value <<<--- */}
            <span className="tile-letter">{displayLetter}</span>
            {!isBlank && <span className="tile-value">{displayValue}</span>}
        </div>
    );
};

export default Tile;