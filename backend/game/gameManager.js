// backend/game/gameManager.js

const GameState = require('./gameState'); // Import the GameState class
const { v4: uuidv4 } = require('uuid'); // For generating unique game IDs (run: npm install uuid)

// Store active games. Key: gameId, Value: GameState instance
const activeGames = new Map();
// Store mapping from player ID to their game ID for quick lookup
const playerGameMap = new Map();

/**
 * Finds an available game waiting for players or creates a new one.
 * Adds the player to the selected game.
 *
 * @param {string} playerId - The socket ID of the player.
 * @param {string} username - The player's chosen username.
 * @returns {object} - { gameId: string, gameState: GameState, error?: string }
 */
function findOrCreateGame(playerId, username) {
    // Check if player is already in a game
    if (playerGameMap.has(playerId)) {
        const existingGameId = playerGameMap.get(playerId);
        if (activeGames.has(existingGameId)) {
             console.log(`Player ${playerId} trying to join, but already in game ${existingGameId}`);
             return { gameId: existingGameId, gameState: activeGames.get(existingGameId) }; // Rejoin maybe? Or return error? For now, let them rejoin state.
        } else {
            // Map exists but game doesn't - cleanup map
            playerGameMap.delete(playerId);
        }
    }

    let availableGameId = null;
    let gameToJoin = null;

    // Look for a waiting game (e.g., only 1 player)
    for (const [gameId, gameState] of activeGames.entries()) {
        // Define 'waiting' criteria (e.g., status is 'waiting' and not full)
        if (gameState.status === 'waiting' && gameState.players.length < 2) { // Simple 2-player logic for now
            availableGameId = gameId;
            gameToJoin = gameState;
            break;
        }
    }

    if (gameToJoin && availableGameId) {
        // Found a waiting game, add player
        console.log(`Game Manager: Adding player ${playerId} (${username}) to existing game ${availableGameId}`);
        const player = gameToJoin.addPlayer(playerId, username);
        if (player) {
            playerGameMap.set(playerId, availableGameId);
            return { gameId: availableGameId, gameState: gameToJoin };
        } else {
            // Should not happen if checks above are correct, but handle defensively
             console.error(`Game Manager: Failed to add player ${playerId} to game ${availableGameId} despite finding it.`);
             return { error: 'Failed to add player to waiting game.' };
        }
    } else {
        // No waiting games found, create a new one
        const newGameId = `game-${uuidv4()}`;
        console.log(`Game Manager: Creating new game ${newGameId} for player ${playerId} (${username})`);
        const newGameState = new GameState(newGameId);
        const player = newGameState.addPlayer(playerId, username);

        if (player) {
            activeGames.set(newGameId, newGameState);
            playerGameMap.set(playerId, newGameId);
            return { gameId: newGameId, gameState: newGameState };
        } else {
             console.error(`Game Manager: Failed to add player ${playerId} to newly created game ${newGameId}.`);
             return { error: 'Failed to create game or add player.' };
        }
    }
}

/**
 * Retrieves the GameState object for a given game ID.
 * @param {string} gameId - The ID of the game.
 * @returns {GameState | undefined} - The GameState instance or undefined if not found.
 */
function getGameState(gameId) {
    return activeGames.get(gameId);
}

/**
 * Starts a game if it has enough players.
 * Should be called after a player joins.
 * @param {string} gameId - The ID of the game to potentially start.
 * @returns {boolean} - True if the game was started, false otherwise.
 */
function maybeStartGame(gameId) {
     const gameState = activeGames.get(gameId);
     // Example: Start game if 2 players are present and it's waiting
     if (gameState && gameState.status === 'waiting' && gameState.players.length === 2) {
        console.log(`Game Manager: Starting game ${gameId}`);
        return gameState.startGame(); // startGame should handle setting status, turns, etc.
     }
     return false;
 }


/**
 * Removes a player from their game upon disconnection.
 * @param {string} playerId - The socket ID of the disconnecting player.
 * @returns {{ gameId: string, wasGameRemoved: boolean, remainingPlayers: Array } | null} - Info about the game or null if player wasn't found.
 */
function removePlayer(playerId) {
    const gameId = playerGameMap.get(playerId);
    if (!gameId) {
        console.log(`Game Manager: Player ${playerId} disconnected, but was not mapped to a game.`);
        return null;
    }

    const gameState = activeGames.get(gameId);
    if (!gameState) {
        console.log(`Game Manager: Player ${playerId} disconnected, game ${gameId} not found in active games.`);
        playerGameMap.delete(playerId); // Clean up map entry
        return null;
    }

    console.log(`Game Manager: Removing player ${playerId} from game ${gameId}`);
    const playerIndex = gameState.players.findIndex(p => p.id === playerId);

    if (playerIndex === -1) {
        console.warn(`Game Manager: Player ${playerId} not found in game state for ${gameId} during removal.`);
        playerGameMap.delete(playerId); // Clean up map entry
        return null;
    }

    // Store info before removing
    const leavingPlayer = gameState.players[playerIndex];
    const wasCurrentTurn = leavingPlayer.isTurn;

    // Remove the player from the game state
    gameState.players.splice(playerIndex, 1);
    playerGameMap.delete(playerId); // Remove from mapping

    // Handle game state changes due to player leaving
    if (gameState.players.length === 0) {
        console.log(`Game Manager: Game ${gameId} is empty, removing.`);
        activeGames.delete(gameId);
        return { gameId, wasGameRemoved: true, remainingPlayers: [] };
    } else {
        // If the game was playing and the leaving player had the turn, advance it
        if (gameState.status === 'playing') {
            if (wasCurrentTurn) {
                 // Adjust currentTurnIndex carefully if the leaving player was before the next player in the array
                if (playerIndex < gameState.currentTurnIndex) {
                    gameState.currentTurnIndex = (gameState.currentTurnIndex - 1 + gameState.players.length) % gameState.players.length; // Adjust index backward
                } else {
                     // If the leaving player was the last in array and had turn, wrap to 0
                     gameState.currentTurnIndex %= gameState.players.length;
                }
                 // Make the new current player's turn true (if players remain)
                if(gameState.players.length > 0) {
                    gameState.players[gameState.currentTurnIndex].isTurn = true;
                }
                console.log(`Game Manager: Player ${playerId} left on their turn. New turn index: ${gameState.currentTurnIndex}`);
             } else {
                 // If leaving player was not the current turn, we might need to adjust the index if they were before the current player
                 if (playerIndex < gameState.currentTurnIndex) {
                     gameState.currentTurnIndex = (gameState.currentTurnIndex - 1 + gameState.players.length) % gameState.players.length;
                 }
                 // Ensure index is still valid
                  gameState.currentTurnIndex %= gameState.players.length;
             }
             // TODO: Implement game over logic if only one player remains in a 'playing' game?
             if (gameState.players.length < 2) { // Example: End game if only one left
                 console.log(`Game Manager: Only one player left in game ${gameId}. Ending game.`);
                 gameState.status = 'finished';
                 // Assign winner or handle scoring?
             }
        }

        // Return info about the removal
        return {
            gameId,
            wasGameRemoved: false,
            remainingPlayers: gameState.players.map(p => ({ id: p.id, username: p.username })), // Return public info
            notifyOthers: true, // Flag to notify others in server.js
            updatedGameState: gameState // Pass back the updated state
        };
    }
}

module.exports = {
    findOrCreateGame,
    getGameState,
    maybeStartGame,
    removePlayer,
};