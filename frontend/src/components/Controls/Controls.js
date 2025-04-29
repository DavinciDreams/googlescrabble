import React from 'react';
import './Controls.css'; // Create this CSS file

const Controls = ({ onPlay, onPass, onExchange, disabled = false }) => {

    // These handlers would typically gather necessary data before calling props
    const handlePlayClick = () => {
        // TODO: Get the currently placed tiles from component state (managed higher up)
        console.log("Play button clicked - need data on placed tiles.");
        // onPlay(placedTilesData);
        alert("Play logic needs implementation (handling temporary placements).");
    };

    const handleExchangeClick = () => {
        // TODO: Get which tiles are selected for exchange from component state
         console.log("Exchange button clicked - need data on selected tiles.");
        // onExchange(selectedTiles);
         alert("Exchange logic needs implementation (selecting tiles).");
    };


    return (
        <div className="game-controls">
            <button onClick={handlePlayClick} disabled={disabled}>
                Play Word
            </button>
            <button onClick={onPass} disabled={disabled}>
                Pass Turn
            </button>
            <button onClick={handleExchangeClick} disabled={disabled}>
                Exchange Tiles
            </button>
             {/* Could add a Shuffle Rack button here too */}
             {/* <button onClick={onShuffle} disabled={disabled}>Shuffle Rack</button> */}
        </div>
    );
};

export default Controls;