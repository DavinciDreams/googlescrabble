// frontend/src/components/Rack/Rack.js
import React from 'react';
import Tile from '../Tile/Tile'; // Import Tile component
import './Rack.css'; // Ensure this CSS file exists and is styled

// Define RACK_SIZE constant locally if not imported
const RACK_SIZE = 7;

/**
 * Displays the player's tile rack and handles selection for exchange.
 * @param {object} props
 * @param {Array} props.tiles - Array of tile objects [{letter, value}] received from App state.
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
    console.log("Rack Component - Received tiles prop:", JSON.stringify(tiles));
    // Ensure tiles is always an array
    const playerTiles = Array.isArray(tiles) ? tiles : [];

    // Create display tiles array, marking placed and selected status based on indices
    const displayTiles = playerTiles.map((tile, index) => ({
        ...tile, // tile object should be { letter: 'A', value: 1 }
        originalIndex: index, // Store the original index before placeholders
        isPlaced: temporarilyPlacedIndices.includes(index), // Is this tile currently on the board temp?
        isSelected: selectedForExchange.includes(index), // Is this tile currently selected for exchange?
    }));

    // Add placeholder objects for visual consistency if rack has fewer than 7 tiles
    const placeholdersNeeded = RACK_SIZE - displayTiles.length;
    for (let i = 0; i < placeholdersNeeded; i++) {
        displayTiles.push({ isPlaceholder: true, key: `placeholder-${i}` });
    }
    console.log("Rack Component - displayTiles array before render:", JSON.stringify(displayTiles, null, 2));

    // --- Drop Handling ---
    const handleDrop = (e) => {
        if (!canInteract || !onRackDrop) return;
        e.preventDefault(); e.currentTarget.classList.remove('drag-over');
        const tileDataString = e.dataTransfer.getData("application/json");
        if (tileDataString) {
            try {
                const tileData = JSON.parse(tileDataString);
                if (tileData.originData?.type === 'board') { onRackDrop(tileData); }
                 else { console.log("Rack: Tile dropped originated from rack, ignoring drop on rack itself."); }
            } catch (error) { console.error("Rack: Failed to parse dropped tile data:", error); }
        }
    };
    const handleDragOver = (e) => { if (!canInteract) return; e.preventDefault(); e.currentTarget.classList.add('drag-over'); };
    const handleDragLeave = (e) => { e.currentTarget.classList.remove('drag-over'); };

    // --- Tile Click Handler for Exchange Selection ---
    const handleTileClick = (tileInfo) => {
        if (canInteract && tileInfo && !tileInfo.isPlaceholder && !tileInfo.isPlaced && onTileSelect) {
             console.log("Rack: Tile clicked for selection - index:", tileInfo.originalIndex);
             onTileSelect(tileInfo.originalIndex); // Pass the original index back to App
        } else if (tileInfo?.isPlaced) {
             console.log("Rack: Cannot select tile already placed on board.");
        }
    };

    return (
        <div className="player-rack" onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} title="Your tile rack">
            <h3>Your Rack</h3>
            <div className="rack-tiles">
                {displayTiles.map((tileInfo) => (
                    <div
                       key={tileInfo.isPlaceholder ? tileInfo.key : `slot-${tileInfo.originalIndex}`}
                       className={`rack-slot ${tileInfo?.isPlaced ? 'slot-occupied-temp' : ''} ${tileInfo?.isSelected ? 'slot-selected-exchange' : ''} ${canInteract && !tileInfo?.isPlaced && !tileInfo?.isPlaceholder ? 'selectable' : ''}`}
                       onClick={() => handleTileClick(tileInfo)}
                       title={canInteract && !tileInfo?.isPlaced && !tileInfo?.isPlaceholder ? "Click to select/deselect for exchange" : (tileInfo?.isPlaced ? "Tile on board" : "")}
                    >
                        {/* --->>> Render Tile if it's real and not on board <<<--- */}
                        {tileInfo && !tileInfo.isPlaceholder && !tileInfo.isPlaced ? (
                            <Tile
                                letter={tileInfo.letter} // Pass letter
                                value={tileInfo.value}   // Pass value
                                isDraggable={canInteract && !tileInfo.isSelected} // Prevent dragging selected tiles
                                id={`rack-tile-${tileInfo.originalIndex}`}
                                originData={{ type: 'rack', index: tileInfo.originalIndex }}
                                isSelected={tileInfo.isSelected} // Pass selection state
                            />
                        ) : (
                            <div className="empty-slot"></div> // Placeholder
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Rack;