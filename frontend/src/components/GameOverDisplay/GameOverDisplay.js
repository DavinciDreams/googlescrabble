// frontend/src/components/GameOverDisplay/GameOverDisplay.js
import React from 'react';
import './GameOverDisplay.css'; // Create this CSS file

const GameOverDisplay = ({ finalScores }) => {
    if (!finalScores) {
        return <div className="game-over-display"><h2>Game Over!</h2></div>;
    }

    // Sort scores descending
    const sortedScores = [...finalScores].sort((a, b) => b.finalScore - a.finalScore);

    return (
        <div className="game-over-display">
            <h2>Game Over!</h2>
            <h3>Final Scores:</h3>
            <ol>
                {sortedScores.map((player, index) => (
                    <li key={player.id}>
                        {index + 1}. {player.username}: {player.finalScore} points
                    </li>
                ))}
            </ol>
            {/* Optional: Add a button to play again or return to lobby */}
            {/* <button onClick={onPlayAgain}>Play Again</button> */}
        </div>
    );
};

export default GameOverDisplay;