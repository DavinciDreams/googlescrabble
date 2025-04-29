import React from 'react';
import './Scoreboard.css'; // Create this CSS file

const Scoreboard = ({ players = [], currentPlayerId }) => {
    return (
        <div className="scoreboard">
            <h2>Scores</h2>
            <ul>
                {players.map((player) => (
                    <li key={player.id} className={player.id === currentPlayerId ? 'current-turn' : ''}>
                        <span className="player-name">
                            {player.username}
                            {player.id === currentPlayerId ? ' (Turn)' : ''}
                        </span>
                        <span className="player-score">{player.score}</span>
                         {/* Optionally show tile count for others */}
                         {/* <span className="player-tile-count">({player.rackTileCount} tiles)</span> */}
                    </li>
                ))}
            </ul>
             {/* FIXED: Added parentheses for clarity (no-mixed-operators) */}
             {/* Render paragraph only if the condition is true */}
             {( !players || players.length === 0 ) && <p>Waiting for players...</p>}
        </div>
    );
};

export default Scoreboard;