// backend/game/gameManager.js

const GameState = require('./gameState'); // Import the GameState class
const { v4: uuidv4 } = require('uuid'); // For generating unique game IDs (run: npm install uuid)

// Store active games. Key: gameId, Value: GameState instance
const activeGames = new Map();
// Store mapping from player ID to their game ID for quick lookup
const playerGameMap = new Map();

/**
 * Handles a player's request to join a game.
 * If targetGameId is provided, attempts to join that specific game.
 * Otherwise, finds an available game or creates a new one.
 *
 * @param {string} playerId - The socket ID of the player.
 * @param {string} username - The player's chosen username.
 * @param {string | null} targetGameId - The specific game ID the player wants to join, or null.
 * @returns {object} - { gameId: string, gameState: GameState, error?: string }
 */
function handleJoinRequest(playerId, username, targetGameId = null) {
    // Check if player is already in a game (handle re-connection/duplicate join attempt)
    if (playerGameMap.has(playerId)) {
        const existingGameId = playerGameMap.get(playerId);
        if (activeGames.has(existingGameId)) {
            console.log(`Game Manager: Player ${playerId} attempting to join, but already in game ${existingGameId}. Returning existing game.`);
            // If they provided a *different* targetGameId, return an error.
             if (targetGameId && targetGameId !== existingGameId) {
                 return { error: `You are already in game ${existingGameId}. Leave that game first.` };
             }
            return { gameId: existingGameId, gameState: activeGames.get(existingGameId) };
        } else {
            playerGameMap.delete(playerId); // Clean up stale map entry
        }
    }

    // --- Handle Joining Specific Game ---
    if (targetGameId) {
        console.log(`Game Manager: Player ${playerId} attempting to join specific game ${targetGameId}`);
        const specificGame = activeGames.get(targetGameId);
        if (!specificGame) {
             console.warn(`Game Manager: Join failed for ${playerId}. Game '${targetGameId}' not found.`);
            return { error: `Game with ID '${targetGameId}' not found.` };
        }
        if (specificGame.status !== 'waiting') {
             console.warn(`Game Manager: Join failed for ${playerId}. Game '${targetGameId}' status is ${specificGame.status}.`);
            return { error: `Game '${targetGameId}' has already started or is finished.` };
        }
        if (specificGame.players.length >= specificGame.maxPlayers) {
             console.warn(`Game Manager: Join failed for ${playerId}. Game '${targetGameId}' is full (${specificGame.players.length}/${specificGame.maxPlayers}).`);
            return { error: `Game '${targetGameId}' is full.` };
        }

        // Attempt to add player to the specific game state
        const player = specificGame.addPlayer(playerId, username);
        if (player) {
            playerGameMap.set(playerId, targetGameId);
            console.log(`Game Manager: Player ${playerId} successfully joined specific game ${targetGameId}`);
            return { gameId: targetGameId, gameState: specificGame };
        } else {
             // addPlayer failed (e.g., username taken in that game) - GameState log should explain why
             // Retrieve specific reason from GameState if possible, otherwise use generic message
             console.error(`Game Manager: GameState.addPlayer failed for ${playerId} in specific game ${targetGameId}.`);
            return { error: `Failed to join game '${targetGameId}'. Username might be taken in that game.` }; // Provide more specific error if addPlayer returns one
        }
    }
    // --- Handle Find or Create (if no specific game ID given) ---
    else {
        console.log(`Game Manager: Player ${playerId} looking for waiting game or creating new.`);
        let availableGameId = null;
        let gameToJoin = null;

        // Find a game that is 'waiting' and has room
        for (const [gameId, gameState] of activeGames.entries()) {
            if (gameState.status === 'waiting' && gameState.players.length < gameState.maxPlayers) {
                availableGameId = gameId;
                gameToJoin = gameState;
                break;
            }
        }

        if (gameToJoin && availableGameId) {
            // Found a waiting game
            console.log(`Game Manager: Adding player ${playerId} (${username}) to waiting game ${availableGameId}`);
            const player = gameToJoin.addPlayer(playerId, username);
            if (player) {
                playerGameMap.set(playerId, availableGameId);
                return { gameId: availableGameId, gameState: gameToJoin };
            } else {
                 console.error(`Game Manager: GameState.addPlayer failed for ${playerId} in waiting game ${availableGameId}.`);
                return { error: 'Failed to add player to waiting game.' }; // Provide more specific error if addPlayer returns one
            }
        } else {
            // No suitable waiting games, create a new one
            const newGameId = `game-${uuidv4().substring(0, 8)}`; // Shorter, more shareable ID
            console.log(`Game Manager: Creating new game ${newGameId} for player ${playerId} (${username})`);
            const newGameState = new GameState(newGameId); // GameState constructor should set default maxPlayers
            const player = newGameState.addPlayer(playerId, username);

            if (player) {
                activeGames.set(newGameId, newGameState);
                playerGameMap.set(playerId, newGameId);
                return { gameId: newGameId, gameState: newGameState };
            } else {
                 // This should ideally not fail for the first player unless username invalid?
                 console.error(`Game Manager: Failed to add initial player ${playerId} to newly created game ${newGameId}.`);
                 return { error: 'Failed to create game or add initial player.' }; // Provide more specific error if addPlayer returns one
            }
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
     // Start game if waiting and has reached max players
     if (gameState && gameState.status === 'waiting' && gameState.players.length === gameState.maxPlayers) {
        console.log(`Game Manager: Starting game ${gameId} as it has ${gameState.players.length} players.`);
        return gameState.startGame();
     }
     return false;
 }


/**
 * Removes a player from their game upon disconnection.
 * Handles game state updates like advancing turns or ending the game.
 * @param {string} playerId - The socket ID of the disconnecting player.
 * @returns {{ gameId: string, wasGameRemoved: boolean, remainingPlayers: Array, notifyOthers: boolean, updatedGameState: GameState | null } | null} - Info about the game or null if player wasn't found.
 */
function removePlayer(playerId) {
    const gameId = playerGameMap.get(playerId);
    if (!gameId) {
        // Player wasn't mapped, maybe disconnected before joining fully
        return null;
    }

    const gameState = activeGames.get(gameId);
    playerGameMap.delete(playerId); // Remove from mapping regardless of game state

    if (!gameState) {
        console.log(`Game Manager: Player ${playerId} disconnected, game ${gameId} not found in active games (already removed?).`);
        return null;
    }

    console.log(`Game Manager: Removing player ${playerId} from game ${gameId}`);
    const playerIndex = gameState.players.findIndex(p => p.id === playerId);

    if (playerIndex === -1) {
        console.warn(`Game Manager: Player ${playerId} not found in game state for ${gameId} during removal.`);
        // If player not found but game exists, check if game is now empty
        if (gameState.players.length === 0) {
             console.log(`Game Manager: Game ${gameId} became empty after player lookup failed, removing.`);
             activeGames.delete(gameId);
             return { gameId, wasGameRemoved: true, remainingPlayers: [], notifyOthers: false, updatedGameState: null };
        }
        return null; // Player wasn't in the list, nothing more to do for them
    }

    // Store info before removing
    const leavingPlayer = gameState.players[playerIndex];
    const wasCurrentTurn = leavingPlayer.isTurn;

    // Remove the player from the game state
    gameState.players.splice(playerIndex, 1);

    // Handle game state changes due to player leaving
    if (gameState.players.length === 0) {
        // Game is empty, remove it
        console.log(`Game Manager: Game ${gameId} is now empty, removing.`);
        activeGames.delete(gameId);
        return { gameId, wasGameRemoved: true, remainingPlayers: [], notifyOthers: false, updatedGameState: null };
    } else {
        // Game continues, adjust turn if necessary
        let turnAdvanced = false;
        if (gameState.status === 'playing') {
            // Recalculate currentTurnIndex based on remaining players
            if (wasCurrentTurn) {
                 // If the leaving player had the turn, the next player (or wrapping around) gets it
                 // The modulo operator handles the wrap-around correctly after splice
                gameState.currentTurnIndex %= gameState.players.length;
                gameState.players[gameState.currentTurnIndex].isTurn = true; // Assign turn
                console.log(`Game Manager: Player ${playerId} left on their turn. New turn assigned to ${gameState.players[gameState.currentTurnIndex].username}.`);
                turnAdvanced = true;
             } else {
                 // If leaving player was not the current turn, adjust index if they were before the current player
                 // Find the ID of the player who *currently* has the turn
                 const currentPlayerIdBeforeRemoval = gameState.players[gameState.currentTurnIndex]?.id;
                 // If the current player still exists, find their *new* index
                 const newCurrentTurnIndex = gameState.players.findIndex(p => p.id === currentPlayerIdBeforeRemoval);

                 if (newCurrentTurnIndex !== -1) {
                     gameState.currentTurnIndex = newCurrentTurnIndex;
                     // Ensure isTurn is still true for the correct player
                     gameState.players.forEach((p, index) => p.isTurn = (index === newCurrentTurnIndex));
                 } else {
                      // Should not happen if wasCurrentTurn was false, indicates state inconsistency
                      console.error(`Game Manager: Current turn player ID ${currentPlayerIdBeforeRemoval} not found after removing ${playerId}. Resetting turn.`);
                      // Fallback: just assign turn to index 0
                      gameState.currentTurnIndex = 0;
                       if(gameState.players.length > 0) gameState.players[0].isTurn = true;
                       turnAdvanced = true; // Consider this an advancement
                 }
             }

             // Check if the game should end because only one player remains
             if (gameState.players.length < 2) {
                 console.log(`Game Manager: Only one player left in playing game ${gameId}. Ending game.`);
                 gameState._endGame('player_left'); // Call internal end game method
             }
        }

        // Return info about the removal
        return {
            gameId,
            wasGameRemoved: false,
            remainingPlayers: gameState.players.map(p => ({ id: p.id, username: p.username })),
            notifyOthers: true, // Let server.js know to notify remaining players
            updatedGameState: gameState // Pass back the modified state
        };
    }
}


module.exports = {
    handleJoinRequest,
    getGameState,
    maybeStartGame,
    removePlayer,
    // Consider adding functions to get game list or specific game details if needed later
};