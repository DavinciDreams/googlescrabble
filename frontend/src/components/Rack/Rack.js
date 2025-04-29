import React from 'react';
import Tile from '../Tile/Tile';
import './Rack.css';

// Added temporarilyPlacedIndices, onRackDrop, canInteract
const Rack = ({ tiles, temporarilyPlacedIndices = [], onRackDrop, canInteract }) => {
    const playerTiles = Array.isArray(tiles) ? tiles : [];

    const displayTiles = playerTiles.map((tile, index) => ({
        ...tile,
        originalIndex: index, // Keep track of original position
        isPlaced: temporarilyPlacedIndices.includes(index) // Mark if temporarily placed on board
    }));

    // Add placeholders visually if needed, but keep track of real tiles
    const placeholdersNeeded = 7 - displayTiles.length;
    for (let i = 0; i < placeholdersNeeded; i++) {
        displayTiles.push(null); // Use null as a placeholder visually
    }

    // --- Drop Handling for Returning Tiles to Rack ---
    const handleDrop = (e) => {
         if (!canInteract) return;
        e.preventDefault();
        const tileDataString = e.dataTransfer.getData("application/json");
         if (tileDataString) {
            try {
                const tileData = JSON.parse(tileDataString);
                // Only handle drops originating from the board (returning a temp tile)
                if (tileData.originData?.type === 'board') {
                    console.log("Tile dropped back onto rack:", tileData);
                    onRackDrop(tileData); // Call handler passed from App
                }
            } catch (error) {
                console.error("Failed to parse dropped tile data on rack:", error);
            }
        }
         e.currentTarget.classList.remove('drag-over');
    };

    const handleDragOver = (e) => {
         if (!canInteract) return;
        // Allow drop only if a tile is dragged over the rack area
        e.preventDefault();
         e.currentTarget.classList.add('drag-over');
    };

     const handleDragLeave = (e) => {
         e.currentTarget.classList.remove('drag-over');
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
                {displayTiles.map((tileInfo, index) => (
                    <div key={index} className={`rack-slot ${tileInfo?.isPlaced ? 'slot-occupied-temp' : ''}`}>
                        {tileInfo && !tileInfo.isPlaced ? ( // Only render if not temporarily placed elsewhere
                            <Tile
                                letter={tileInfo.letter}
                                value={tileInfo.value}
                                isDraggable={canInteract} // Draggable only if interactable
                                id={`rack-tile-${tileInfo.originalIndex}`}
                                originData={{ type: 'rack', index: tileInfo.originalIndex }} // Origin is rack index
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