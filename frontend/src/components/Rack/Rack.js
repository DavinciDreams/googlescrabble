import React from 'react';
import Tile from '../Tile/Tile';
import './Rack.css';

// Added comments for exchange selection logic
const Rack = ({
    tiles,
    temporarilyPlacedIndices = [],
    onRackDrop,
    canInteract,
    // --- TODO: Props for exchange selection ---
    // selectedForExchange = [], // Array of indices or letters selected
    // onTileSelect,          // Function to call when a tile is clicked for selection
}) => {
    const playerTiles = Array.isArray(tiles) ? tiles : [];

    // ... (logic for displayTiles and placeholders remains same) ...
     const displayTiles = playerTiles.map((tile, index) => ({
        ...tile,
        originalIndex: index,
        isPlaced: temporarilyPlacedIndices.includes(index),
        // --- TODO: Add selection state ---
        // isSelected: selectedForExchange.includes(index), // Example if using index
    }));
     // ... add placeholders ...


    const handleDrop = (e) => { /* ... logic remains same ... */ };
    const handleDragOver = (e) => { /* ... logic remains same ... */ };
    const handleDragLeave = (e) => { /* ... logic remains same ... */ };

    // --- TODO: Implement Tile Click Handler for Exchange ---
    // const handleTileClick = (tileInfo) => {
    //     if (canInteract && tileInfo && !tileInfo.isPlaced && onTileSelect) {
    //          onTileSelect(tileInfo.originalIndex); // Pass index back to App.js
    //     }
    // };

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
                    <div
                       key={tileInfo ? `tile-${tileInfo.originalIndex}` : `placeholder-${index}`}
                       className={`rack-slot ${tileInfo?.isPlaced ? 'slot-occupied-temp' : ''} ${tileInfo?.isSelected ? 'slot-selected-exchange': ''}` } // Add class for selection
                       // --- TODO: Add onClick handler ---
                       // onClick={() => handleTileClick(tileInfo)}
                    >
                        {tileInfo && !tileInfo.isPlaced ? (
                            <Tile
                                // ... props ...
                                letter={tileInfo.letter}
                                value={tileInfo.value}
                                isDraggable={canInteract}
                                id={`rack-tile-${tileInfo.originalIndex}`}
                                originData={{ type: 'rack', index: tileInfo.originalIndex }}
                                // --- TODO: Add visual indication for selection ---
                                // isSelected={tileInfo.isSelected} // Pass to Tile component if needed
                            />
                        ) : (
                            <div className="empty-slot"></div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Rack;