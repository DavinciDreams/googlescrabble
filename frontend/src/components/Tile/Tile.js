import React from 'react';
import './Tile.css';

// Added 'isSelected' prop for visual feedback during exchange selection
const Tile = ({
    letter,
    value,
    isDraggable = false,
    id,
    originData, // { type: 'rack', index: number } or { type: 'board', row: number, col: number }
    isSelected = false // For exchange highlight
}) => {
    const isBlank = letter === 'BLANK';
    // Handle display for assigned blanks (if backend stores assigned letter, use that)
    // For now, blanks just look empty until placed maybe
    const displayLetter = isBlank ? '' : letter;
    const displayValue = isBlank ? '' : value;

    const handleDragStart = (e) => {
        if (isDraggable) {
            // Make sure originData is attached
            if (!originData) {
                console.error("Tile drag started without originData!", { id, letter });
                e.preventDefault(); // Prevent dragging improperly configured tile
                return;
            }
            const tileData = JSON.stringify({ letter, value, id, originData });
            e.dataTransfer.setData("application/json", tileData);
            e.dataTransfer.effectAllowed = "move";
            // Add slight delay to class adding for smoother visual transition
            setTimeout(() => e.target?.classList.add('dragging'), 0);
        } else {
            e.preventDefault();
        }
    };

    const handleDragEnd = (e) => {
         // Use try/finally to ensure class is removed even if errors occur
         try {
             // Any cleanup needed after drag ends
         } finally {
            e.target?.classList.remove('dragging');
         }
    };

    return (
        <div
            className={`tile ${isBlank ? 'blank-tile' : ''} ${isSelected ? 'tile-selected-exchange' : ''}`} // Add selection class
            draggable={isDraggable}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            id={id}
            title={isBlank ? "Blank Tile" : `${letter} - ${value} points`}
        >
            <span className="tile-letter">{displayLetter}</span>
            {!isBlank && <span className="tile-value">{displayValue}</span>}
        </div>
    );
};

export default Tile;