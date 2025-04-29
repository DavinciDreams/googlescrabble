import React from 'react';
import Tile from '../Tile/Tile';
import './Rack.css'; // Ensure this CSS file exists

/**
 * Displays the player's tile rack and handles selection for exchange.
 * @param {object} props
 * @param {Array} props.tiles - Array of tile objects in the rack.
 * @param {Array} [props.temporarilyPlacedIndices=[]] - Indices of rack tiles currently on the board.
 * @param {Function} props.onRackDrop - Callback when a tile is dropped back onto the rack.
 * @param {boolean} props.canInteract - Whether the player can interact with the rack.
 * @param {Array} [props.selectedForExchange=[]] - Array of selected originalIndex numbers.
 * @param {Function} props.onTileSelect - Callback function (receives originalIndex) when a tile is clicked for selection.
 */
const Rack = ({
    tiles,
    temporarilyPlacedIndices = [],
    onRackDrop,
    canInteract,
    selectedForExchange = [], // Expects array of originalIndex numbers
    onTileSelect,
}) => {
    const playerTiles = Array.isArray(tiles) ? tiles : [];

    // Create display tiles, marking placed and selected status
    const displayTiles = playerTiles.map((tile, index) => ({
        ...tile,
        originalIndex: index, // Store the original index before placeholders
        isPlaced: temporarilyPlacedIndices.includes(index),
        isSelected: selectedForExchange.includes(index), // Check if index is selected
    }));

    // Add placeholders for visual consistency
    const placeholdersNeeded = 7 - displayTiles.length;
    for (let i = 0; i < placeholdersNeeded; i++) {
        // Use a unique key structure for placeholders
        displayTiles.push({ isPlaceholder: true, key: `placeholder-${i}` });
    }

    // --- Drop Handling --- (No changes needed here)
    const handleDrop = (e) => { if (!canInteract) return; /* ... */ };
    const handleDragOver = (e) => { if (!canInteract) return; /* ... */ };
    const handleDragLeave = (e) => { /* ... */ };

    // --- Tile Click Handler for Exchange Selection ---
    const handleTileClick = (tileInfo) => {
        // Allow selection only if interaction is enabled, it's a real tile (not placeholder),
        // it's not already placed on the board, and the callback function exists.
        if (canInteract && tileInfo && !tileInfo.isPlaceholder && !tileInfo.isPlaced && onTileSelect) {
             console.log("Tile clicked for selection:", tileInfo.originalIndex);
             onTileSelect(tileInfo.originalIndex); // Pass the original index back to App
        } else if (tileInfo?.isPlaced) {
             console.log("Cannot select tile already placed on board.");
        }
    };

    return (
        <div
            className="player-rack"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
        >
            <h3>Your Rack</h3>
            <div className="rack-tiles">
                {displayTiles.map((tileInfo) => (
                    <div
                       // Use a consistent key based on whether it's a real tile or placeholder
                       key={tileInfo.isPlaceholder ? tileInfo.key : `slot-${tileInfo.originalIndex}`}
                       className={`
                            rack-slot
                            ${tileInfo?.isPlaced ? 'slot-occupied-temp' : ''}
                            ${tileInfo?.isSelected ? 'slot-selected-exchange' : ''}
                            ${canInteract && !tileInfo?.isPlaced && !tileInfo?.isPlaceholder ? 'selectable' : ''}
                       `}
                       // Attach the click handler
                       onClick={() => handleTileClick(tileInfo)}
                       title={canInteract && !tileInfo?.isPlaced && !tileInfo?.isPlaceholder ? "Click to select/deselect for exchange" : ""}
                    >
                        {tileInfo && !tileInfo.isPlaceholder && !tileInfo.isPlaced ? ( // Render only if it's a real tile not placed on board
                            <Tile
                                letter={tileInfo.letter}
                                value={tileInfo.value}
                                // Only allow dragging if interactable AND not currently selected for exchange? (Optional decision)
                                isDraggable={canInteract /* && !tileInfo.isSelected */}
                                id={`rack-tile-${tileInfo.originalIndex}`}
                                originData={{ type: 'rack', index: tileInfo.originalIndex }}
                                // Optionally pass isSelected to Tile if it needs specific styling
                                // isSelected={tileInfo.isSelected}
                            />
                        ) : (
                            // Show empty slot if placeholder OR if tile is temporarily on board
                            <div className="empty-slot"></div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Rack;