import React from 'react';
import Tile from '../Tile/Tile';
import './Rack.css';

const Rack = ({
    tiles,
    temporarilyPlacedIndices = [],
    onRackDrop,
    canInteract,
    selectedForExchange = [], // Array of originalIndex numbers
    onTileSelect, // Function (receives originalIndex)
}) => {
    const playerTiles = Array.isArray(tiles) ? tiles : [];

    const displayTiles = playerTiles.map((tile, index) => ({
        ...tile,
        originalIndex: index,
        isPlaced: temporarilyPlacedIndices.includes(index),
        isSelected: selectedForExchange.includes(index), // Check if selected
    }));

    const placeholdersNeeded = 7 - displayTiles.length;
    for (let i = 0; i < placeholdersNeeded; i++) {
        displayTiles.push({ isPlaceholder: true, key: `placeholder-${i}` });
    }

    const handleDrop = (e) => { if (!canInteract) return; e.preventDefault(); /* ... rest of drop logic ... */
        const tileDataString = e.dataTransfer.getData("application/json");
        if (tileDataString) {
            try {
                const tileData = JSON.parse(tileDataString);
                if (tileData.originData?.type === 'board') {
                    onRackDrop(tileData);
                }
            } catch (error) { console.error("Failed to parse dropped tile data on rack:", error); }
        }
         e.currentTarget.classList.remove('drag-over');
    };
    const handleDragOver = (e) => { if (!canInteract) return; e.preventDefault(); e.currentTarget.classList.add('drag-over');};
    const handleDragLeave = (e) => { e.currentTarget.classList.remove('drag-over'); };

    const handleTileClick = (tileInfo) => {
        if (canInteract && tileInfo && !tileInfo.isPlaceholder && !tileInfo.isPlaced && onTileSelect) {
             onTileSelect(tileInfo.originalIndex); // Call handler from App
        }
    };

    return (
        <div className="player-rack" onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
            <h3>Your Rack</h3>
            <div className="rack-tiles">
                {displayTiles.map((tileInfo) => (
                    <div
                       key={tileInfo.isPlaceholder ? tileInfo.key : `slot-${tileInfo.originalIndex}`}
                       className={`rack-slot ${tileInfo?.isPlaced ? 'slot-occupied-temp' : ''} ${tileInfo?.isSelected ? 'slot-selected-exchange' : ''} ${canInteract && !tileInfo?.isPlaced && !tileInfo?.isPlaceholder ? 'selectable' : ''}`}
                       onClick={() => handleTileClick(tileInfo)}
                       title={canInteract && !tileInfo?.isPlaced && !tileInfo?.isPlaceholder ? "Click to select/deselect for exchange" : ""}
                    >
                        {tileInfo && !tileInfo.isPlaceholder && !tileInfo.isPlaced ? (
                            <Tile
                                letter={tileInfo.letter}
                                value={tileInfo.value}
                                // Allow dragging if interactable AND tile is NOT selected for exchange
                                // Prevents dragging tiles intended for exchange
                                isDraggable={canInteract && !tileInfo.isSelected}
                                id={`rack-tile-${tileInfo.originalIndex}`}
                                originData={{ type: 'rack', index: tileInfo.originalIndex }}
                                // Pass selection state for visual feedback
                                isSelected={tileInfo.isSelected}
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