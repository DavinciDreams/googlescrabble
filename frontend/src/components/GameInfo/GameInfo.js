import React from 'react';
import './GameInfo.css'; // Create this CSS file

const GameInfo = ({ status, currentPlayerId, players = [], tilesRemaining }) => {

    const currentPlayer = players.find(p => p.id === currentPlayerId);
    const turnInfo = currentPlayer ? `${currentPlayer.username}'s Turn` : 'Waiting...';

    let gameStatusText = '';
    switch(status) {
        case 'waiting':
            gameStatusText = 'Waiting for players to join...';
            break;
        case 'playing':
            gameStatusText = turnInfo;
            break;
        case 'finished':
            // TODO: Determine winner based on final scores
            gameStatusText = 'Game Over!';
            break;
        default:
            gameStatusText = 'Loading...';
    }


    return (
        <div className="game-info">
            <h2>Game Info</h2>
            <p>Status: <span className="info-value">{gameStatusText}</span></p>
            <p>Tiles Remaining: <span className="info-value">{tilesRemaining}</span></p>
            {/* Add more info as needed, e.g., last move details */}
        </div>
    );
};

export default GameInfo;