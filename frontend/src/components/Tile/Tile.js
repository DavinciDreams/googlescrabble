import React from 'react';
import './Tile.css';

// Added 'originData' prop to know where the tile came from (rack index, or board coords)
const Tile = ({ letter, value, isDraggable = false, id, originData }) => {
    const isBlank = letter === 'BLANK';
    // For display purposes, maybe show the assigned letter if it's a placed blank
    // This logic might need refinement depending on how assigned blanks are stored
    const displayLetter = isBlank && value > 0 ? ' ' : (isBlank ? '' : letter);
    const displayValue = isBlank ? '' : value;

    const handleDragStart = (e) => {
        if (isDraggable) {
            console.log(`Dragging tile: ${letter} (id: ${id}, origin: ${JSON.stringify(originData)})`);
            const tileData = JSON.stringify({ letter, value, id, originData }); // Include originData
            e.dataTransfer.setData("application/json", tileData);
            e.dataTransfer.effectAllowed = "move";
            e.currentTarget.classList.add('dragging');
            // Optional: slightly delay hiding the original if needed for visual feel
            // setTimeout(() => { e.target.style.opacity = '0.5'; }, 0);
        } else {
            e.preventDefault();
        }
    };

    const handleDragEnd = (e) => {
         e.currentTarget.classList.remove('dragging');
         // e.target.style.opacity = '1'; // Restore opacity if changed
    };

    return (
        <div
            className={`tile ${isBlank ? 'blank-tile' : ''}`}
            draggable={isDraggable}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            id={id}
            title={isBlank ? "Blank Tile" : `${letter} - ${value} points`} // Tooltip
        >
            <span className="tile-letter">{displayLetter}</span>
            {!isBlank && <span className="tile-value">{displayValue}</span>}
        </div>
    );
};

export default Tile;