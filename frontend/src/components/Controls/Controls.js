import React from 'react';
import './Controls.css';

// Directly use handlers passed as props
const Controls = ({
    onPlay,
    onPass,
    onExchange,
    disabled = false,
    // Add props related to exchange button state if needed
    // exchangeDisabled = false // Example: disable if nothing selected
}) => {

    // No internal handlers needed here anymore
    // Logic is handled in App.js which passes the relevant functions (handlePlayMove, etc.)

    return (
        <div className="game-controls">
            {/* Play button uses the main 'disabled' prop */}
            <button onClick={onPlay} disabled={disabled}>
                Play Word
            </button>
            <button onClick={onPass} disabled={disabled}>
                Pass Turn
            </button>
            {/* Exchange button might need its own disabled logic based on selection */}
            <button onClick={onExchange} disabled={disabled /* || exchangeDisabled */ }>
                Exchange Tiles
            </button>
            {/* Optional: <button onClick={onShuffle} disabled={disabled}>Shuffle Rack</button> */}
        </div>
    );
};

export default Controls;