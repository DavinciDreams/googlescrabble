// frontend/src/components/Rack/Rack.js
import React from 'react';
import Tile from '../Tile/Tile'; // Import Tile component
import './Rack.css'; // Ensure this CSS file exists and is styled

/**
 * Displays the player's tile rack and handles selection for exchange.
 * @param {object} props
 * @param {Array} props.tiles - Array of tile objects [{letter, value}] in the rack.
 * @param {Array} [props.temporarilyPlacedIndices=[]] - Indices of rack tiles currently placed on the board.
 * @param {Function} props.onRackDrop - Callback function when a tile is dropped back onto the rack area.
 * @param {boolean} props.canInteract - Whether the player can currently interact (drag/select) with the rack.
 * @param {Array} [props.selectedForExchange=[]] - Array of originalIndex numbers of tiles selected for exchange.
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
    // Ensure tiles is always an array, even if null/undefined is passed initially
    const playerTiles = Array.isArray(tiles) ? tiles : [];

    // Create display tiles array, marking placed and selected status based on indices
    const displayTiles = playerTiles.map((tile, index) => ({
        ...tile,
        originalIndex: index, // Store the original index before placeholders are added
        isPlaced: temporarilyPlacedIndices.includes(index), // Is this tile currently on the board temp?
        isSelected: selectedForExchange.includes(index), // Is this tile currently selected for exchange?
    }));

    // Add placeholder objects for visual consistency if rack has fewer than 7 tiles
    const placeholdersNeeded = RACK_SIZE - displayTiles.length; // Use RACK_SIZE constant if available, else 7
    for (let i = 0; i < placeholdersNeeded; i++) {
        displayTiles.push({ isPlaceholder: true, key: `placeholder-${i}` });
    }

    // --- Drop Handling: For tiles dragged back from the board ---
    const handleDrop = (e) => {
        if (!canInteract || !onRackDrop) return; // Check if interaction allowed and handler exists
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over'); // Remove visual feedback
        const tileDataString = e.dataTransfer.getData("application/json");
        if (tileDataString) {
            try {
                const tileData = JSON.parse(tileDataString);
                // Only handle drops originating from the board (returning a temp tile)
                if (tileData.originData?.type === 'board') {
                    console.log("Rack: Tile dropped back onto rack:", tileData);
                    onRackDrop(tileData); // Call handler passed from App
                } else {
                     console.log("Rack: Tile dropped originated from rack, ignoring drop on rack itself.");
                }
            } catch (error) {
                console.error("Rack: Failed to parse dropped tile data:", error);
            }
        }
    };

    // Add visual feedback when dragging over rack area
    const handleDragOver = (e) => {
        if (!canInteract) return;
        // Allow drop only if a tile is dragged over
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    };

    const handleDragLeave = (e) => {
        e.currentTarget.classList.remove('drag-over');
    };

    // --- Tile Click Handler for Exchange Selection ---
    const handleTileClick = (tileInfo) => {
        // Allow selection only if:
        // - Interaction is generally allowed (player's turn, connected etc.)
        // - It's a real tile (not a placeholder)
        // - The tile is not already placed on the board
        // - The onTileSelect callback function is provided
        if (canInteract && tileInfo && !tileInfo.isPlaceholder && !tileInfo.isPlaced && onTileSelect) {
             console.log("Rack: Tile clicked for selection - index:", tileInfo.originalIndex);
             onTileSelect(tileInfo.originalIndex); // Pass the original index back to App
        } else if (tileInfo?.isPlaced) {
             console.log("Rack: Cannot select tile already placed on board.");
             // Optionally provide feedback to user (e.g., brief message)
        }
    };

    return (
        <div
            className="player-rack"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            title="Your tile rack"
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
                       // Attach the click handler for selection
                       onClick={() => handleTileClick(tileInfo)}
                       title={canInteract && !tileInfo?.isPlaced && !tileInfo?.isPlaceholder ? "Click to select/deselect for exchange" : (tileInfo?.isPlaced ? "Tile on board" : "")}
                    >
                        {/* Render Tile only if it's a real tile AND not currently placed on board */}
                        {tileInfo && !tileInfo.isPlaceholder && !tileInfo.isPlaced ? (
                            <Tile
                                letter={tileInfo.letter}
                                value={tileInfo.value}
                                // Allow dragging only if interaction allowed AND tile NOT selected for exchange
                                isDraggable={canInteract && !tileInfo.isSelected}
                                id={`rack-tile-${tileInfo.originalIndex}`} // Unique ID based on original position
                                originData={{ type: 'rack', index: tileInfo.originalIndex }} // Identify source
                                // Pass selection state for visual feedback within Tile component
                                isSelected={tileInfo.isSelected}
                            />
                        ) : (
                            // Show empty slot if it's a placeholder OR if the tile is placed on board
                            <div className="empty-slot"></div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// Define RACK_SIZE constant if not imported from elsewhere
const RACK_SIZE = 7;

export default Rack;