// src/hooks/useGameManager.js
import { useState, useEffect, useCallback } from 'react';
import socketService from '../services/socketService'; // Adjust path if needed

export function useGameManager(socket, myPlayerId) {
    const [gameState, setGameState] = useState(null);
    const [myRack, setMyRack] = useState([]);
    const [messages, setMessages] = useState([]);
    const [isInGame, setIsInGame] = useState(false); // Is player successfully in *any* game?
    const [gameIdToShare, setGameIdToShare] = useState(null);
    const [lastGameError, setLastGameError] = useState(''); // For displaying non-fatal errors

    // Derived states based on gameState
    const isGameOver = gameState?.status === 'finished';
    const currentTurnPlayerId = gameState?.currentTurnPlayerId;

    // Effect to handle socket event listeners for game state changes
    useEffect(() => {
        if (!socket) return; // Don't run if socket isn't ready

        console.log("useGameManager Effect: Setting up listeners for socket:", socket.id);

        // Define handlers within the effect's scope
        const handleGameUpdate = (newGameState) => {
            // Log the raw data received for debugging
            console.log("useGameManager received gameUpdate payload:", newGameState);

            // --- Data Validation ---
            // Ensure the received data looks like a minimal game state object
            if (!newGameState || typeof newGameState !== 'object' || !newGameState.gameId || !Array.isArray(newGameState.players)) {
                console.error("useGameManager received invalid gameUpdate structure:", newGameState);
                // Set an error state that can be displayed in the UI
                setLastGameError("Received invalid game data from server.");
                return; // Stop processing this invalid update
            }

            // --- Update Core Game State ---
            // Always update the main gameState with the latest received state
            setGameState(newGameState);
            console.log(`useGameManager: Updated main gameState for game ${newGameState.gameId}`);

            // --- Update Player's Specific Rack (Conditional) ---
            // Check if this specific update payload includes the 'myRack' field
            // AND that it's a valid array. This indicates it's a specific update
            // meant for this player (e.g., after their own move/exchange, or game start).
            if (newGameState.myRack && Array.isArray(newGameState.myRack)) {
                 console.log(`useGameManager: Found 'myRack' in gameUpdate for player ${myPlayerId}. Updating local rack state.`);
                 console.log("  New myRack data received:", JSON.stringify(newGameState.myRack));
                 // ---> Update the local myRack state <---
                 setMyRack(newGameState.myRack);
            } else {
                // This is expected for public updates received after an opponent's move.
                // Do NOT update myRack in this case, as the public state doesn't contain it.
                console.log(`useGameManager: No specific 'myRack' found in gameUpdate for player ${myPlayerId}. Local rack preserved.`);
            }

            // --- Update Other Relevant State ---
            // Update the game ID used for sharing links/display
            if (newGameState.gameId) {
                setGameIdToShare(newGameState.gameId);
            }

            // Clear any previous non-fatal game errors now that we received a valid update
            setLastGameError('');
        };


        const handleGameJoined = (playerSpecificState) => {
             console.log("useGameManager received gameJoined:", playerSpecificState);
             if (playerSpecificState && Array.isArray(playerSpecificState.players) && Array.isArray(playerSpecificState.myRack) && playerSpecificState.gameId) {
                 setGameState(playerSpecificState);
                 setMyRack(playerSpecificState.myRack); // Set initial rack
                 setIsInGame(true); // Mark as successfully in a game
                 setGameIdToShare(playerSpecificState.gameId); // Set initial share ID
                 setLastGameError(''); // Clear any previous errors
                 console.log("useGameManager State Initialized after gameJoined.");
             } else {
                 console.error("Received invalid state from gameJoined:", playerSpecificState);
                 setIsInGame(false); // Ensure not marked as in game
                 setLastGameError("Received invalid game data joining game."); // Show error
             }
         };

        const handleNewMessage = (message) => { setMessages(prev => [...prev, message]); };
        const handleInvalidMove = (error) => { console.warn("Invalid Move:", error.message); setLastGameError(`Invalid Move: ${error.message || '?'}`); };
        const handleError = (error) => { console.error("Game Error:", error.message); setLastGameError(`Error: ${error.message || '?'}`); }; // Handle generic server errors
        const handlePlayerLeft = (leftPlayerInfo) => { console.log(`Player ${leftPlayerInfo.playerId} left.`); setMessages(prev => [...prev, { system: true, text: `Player ${leftPlayerInfo.username || leftPlayerInfo.playerId.substring(0,6)} has left.`}]); };
        const handleGameOver = (gameOverData) => { console.log(`Game Over! Reason: ${gameOverData.reason}`); setGameState(prev => prev ? { ...prev, status: 'finished', finalScores: gameOverData.finalScores } : null); setGameIdToShare(null); }; // Clear share ID on game over

        // Clear listeners before setting new ones (safety)
        const cleanup = () => {
            console.log("useGameManager Effect: Cleaning up listeners.");
            socketService.removeListener('gameUpdate', handleGameUpdate);
            socketService.removeListener('gameJoined', handleGameJoined);
            socketService.removeListener('newChatMessage', handleNewMessage);
            socketService.removeListener('invalidMove', handleInvalidMove);
            socketService.removeListener('gameError', handleError);
            socketService.removeListener('playerLeft', handlePlayerLeft);
            socketService.removeListener('gameOver', handleGameOver);
        };

        cleanup(); // Clean up previous listeners first

        // Set up new listeners
        socketService.onGameUpdate(handleGameUpdate);
        socketService.onGameJoined(handleGameJoined);
        socketService.onNewChatMessage(handleNewMessage);
        socketService.onInvalidMove(handleInvalidMove);
        socketService.onError(handleError); // Assumes service uses 'gameError'
        socketService.onPlayerLeft(handlePlayerLeft);
        socketService.onGameOver(handleGameOver);

        // Return cleanup function
        return cleanup;

    }, [socket, myPlayerId]); // Rerun effect if socket instance or player ID changes

    // Return the state managed by this hook
    return {
        gameState,
        myRack,
        messages,
        isInGame,
        isGameOver,
        currentTurnPlayerId,
        gameIdToShare,
        lastGameError,
        // Expose setters ONLY if absolutely needed outside the hook (try to avoid)
        // setGameState, setMyRack, setMessages, setIsInGame
        setLastGameError // Allow App to clear errors maybe
    };
}