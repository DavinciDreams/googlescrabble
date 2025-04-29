import React from 'react';
import './Controls.css';

/**
 * Game action buttons.
 * @param {object} props
 * @param {Function} props.onPlay - Callback function for playing a move.
 * @param {Function} props.onPass - Callback function for passing the turn.
 * @param {Function} props.onExchange - Callback function for initiating tile exchange.
 * @param {boolean} [props.disabled=false] - General disable flag (e.g., not connected, not turn).
 * @param {boolean} [props.playDisabled=false] - Specific flag to disable Play (e.g., no tiles placed).
 * @param {boolean} [props.exchangeDisabled=false] - Specific flag to disable Exchange (e.g., no tiles selected).
 */
const Controls = ({
    onPlay,
    onPass,
    onExchange,
    disabled = false,        // General disabled state
    playDisabled = false,    // Specific disable for Play button
    exchangeDisabled = false // Specific disable for Exchange button
}) => {

    return (
        <div className="game-controls">
            {/* Play is disabled if general OR specific play condition met */}
            <button
                onClick={onPlay}
                disabled={disabled || playDisabled}
                title={disabled ? "Cannot interact now" : (playDisabled ? "Place tiles on board first" : "Submit placed tiles")}
            >
                Play Word
            </button>

            {/* Pass is only disabled by the general state */}
            <button
                onClick={onPass}
                disabled={disabled}
                title={disabled ? "Cannot interact now" : "Pass your turn"}
            >
                Pass Turn
            </button>

            {/* Exchange is disabled if general OR specific exchange condition met */}
            <button
                onClick={onExchange}
                disabled={disabled || exchangeDisabled}
                title={disabled ? "Cannot interact now" : (exchangeDisabled ? "Select tiles from rack first" : "Exchange selected tiles")}
            >
                Exchange Tiles
            </button>

            {/* Optional Shuffle button (could be added later) */}
            {/* <button onClick={onShuffle} disabled={disabled}>Shuffle Rack</button> */}
        </div>
    );
};

export default Controls;