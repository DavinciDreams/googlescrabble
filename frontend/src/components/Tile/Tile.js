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
    originData, // { type: 'rack', index: number } or { type: 'board', row: number, col: number }
    isSelected = false // For exchange highlight
}) => {
    // Determine if it's a blank tile
    const isBlank = letter === 'BLANK' || value === 0; // Check both just in case

    // Display logic: Show assigned letter if placed, otherwise empty for blank
    // Note: For a placed blank, the parent component (Square) might pass the *assigned* letter
    // This component currently just renders based on the 'letter' prop.
    const displayLetter = isBlank ? '' : letter?.toUpperCase(); // Ensure uppercase
    const displayValue = isBlank ? '' : value;

    // Drag Start Handler
    const handleDragStart = (e) => {
        // Only allow dragging if explicitly set and originData is provided
        if (isDraggable && originData) {
            console.log(`Dragging tile: ${letter} (id: ${id}, origin: ${JSON.stringify(originData)})`);
            const tileData = JSON.stringify({ letter, value, id, originData, isBlank }); // Include isBlank info
            try {
                e.dataTransfer.setData("application/json", tileData);
                e.dataTransfer.effectAllowed = "move";
                // Use setTimeout to allow the browser to render the drag image before potentially hiding/styling the original
                setTimeout(() => {
                    e.target?.classList.add('dragging');
                }, 0);
            } catch (err) {
                console.error("Error setting drag data:", err);
            }
        } else {
            if (!originData && isDraggable) {
                console.warn("Tile drag prevented: originData prop is missing.", { id, letter });
            }
            e.preventDefault(); // Prevent dragging if not draggable or misconfigured
        }
    };

    // Drag End Handler
    const handleDragEnd = (e) => {
         // Ensure the dragging class is removed regardless of how drag ends
         e.target?.classList.remove('dragging');
    };

    // Combine CSS classes based on tile state
    const tileClasses = [
        'tile',
        isBlank ? 'blank-tile' : '',
        isSelected ? 'tile-selected-exchange' : '', // Class for exchange selection highlight
        isDraggable ? 'draggable' : '', // Class if draggable
    ].filter(Boolean).join(' '); // Filter out empty strings and join

    return (
        <div
            className={tileClasses}
            draggable={isDraggable}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            id={id} // Assign ID if provided
            // Tooltip to show letter and points
            title={isBlank ? "Blank Tile (0 points)" : `${displayLetter || 'Unknown'} - ${displayValue} point${displayValue !== 1 ? 's' : ''}`}
        >
            {/* Display the letter */}
            <span className="tile-letter">{displayLetter}</span>
            {/* Display the value only for non-blank tiles */}
            {!isBlank && <span className="tile-value">{displayValue}</span>}
        </div>
    );
};

export default Tile;