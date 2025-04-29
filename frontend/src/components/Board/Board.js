import React from 'react';
import Square from './Square';
import './Board.css';

// Added onTileDrop prop, temporaryPlacements, canInteract
const Board = ({ boardData, temporaryPlacements = [], onTileDrop, canInteract }) => {
    if (!boardData) {
        return <div className="board-loading">Loading Board...</div>;
    }

    // Create a map for quick lookup of temporary placements
    const tempPlacementMap = new Map();
    temporaryPlacements.forEach(p => {
        tempPlacementMap.set(`${p.row}-${p.col}`, p.tile);
    });

    return (
        <div className="scrabble-board">
            {boardData.map((row, rowIndex) => (
                <div key={rowIndex} className="board-row">
                    {row.map((squareData, colIndex) => {
                        // Find if there's a temporary tile for this square
                        const tempTile = tempPlacementMap.get(`${rowIndex}-${colIndex}`);
                        // Merge permanent square data with temporary tile info
                        const displaySquareData = {
                            ...squareData, // Contains premium, permanent tile (if any)
                            tempTile: tempTile // Add temporary tile info
                        };

                        return (
                            <Square
                                key={`${rowIndex}-${colIndex}`}
                                squareData={displaySquareData}
                                row={rowIndex}
                                col={colIndex}
                                onTileDrop={onTileDrop} // Pass the handler down
                                canDrop={canInteract && !squareData.tile} // Can drop if interactable and no permanent tile
                            />
                        );
                    })}
                </div>
            ))}
        </div>
    );
};

export default Board;