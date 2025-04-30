// backend/game/gameManager.js

const GameState = require('./gameState');
const { v4: uuidv4 } = require('uuid');

const activeGames = new Map(); // Key: gameId, Value: GameState instance
const playerGameMap = new Map(); // Key: playerId, Value: gameId

/**
 * Handles a player's request to join a game.
 * If targetGameId is provided, attempts to join that specific game.
 * Otherwise, finds an available game or creates a new one.
 * @param {string} playerId - The socket ID of the player.
 * @param {string} username - The player's chosen username.
 * @param {string | null} targetGameId - The specific game ID the player wants to join, or null.
 * @returns {object} - { gameId: string, gameState: GameState, error?: string }
 */
function handleJoinRequest(playerId, username, targetGameId = null) {
    // Check if player is already mapped to an active game
    if (playerGameMap.has(playerId)) {
        const existingGameId = playerGameMap.get(playerId);
        if (activeGames.has(existingGameId)) {
            console.log(`Game Manager: Player ${playerId} attempting to join, already in active game ${existingGameId}.`);
             if (targetGameId && targetGameId !== existingGameId) {
                 return { error: `You are already in game ${existingGameId}. Leave that game first.` };
             }
            return { gameId: existingGameId, gameState: activeGames.get(existingGameId) }; // Allow rejoining same game
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
        // Use game instance properties for checks
        if (specificGame.status !== 'waiting') {
             console.warn(`Game Manager: Join failed for ${playerId}. Game '${targetGameId}' status is ${specificGame.status}.`);
            return { error: `Game '${targetGameId}' has already started or is finished.` };
        }
        if (specificGame.players.length >= specificGame.maxPlayers) {
             console.warn(`Game Manager: Join failed for ${playerId}. Game '${targetGameId}' is full (${specificGame.players.length}/${specificGame.maxPlayers}).`);
            return { error: `Game '${targetGameId}' is full.` };
        }

        // Attempt to add player via GameState method
        const player = specificGame.addPlayer(playerId, username);
        if (player) {
            playerGameMap.set(playerId, targetGameId);
            console.log(`Game Manager: Player ${playerId} successfully joined specific game ${targetGameId}`);
            return { gameId: targetGameId, gameState: specificGame };
        } else {
             // GameState.addPlayer failed (log inside GameState should explain why)
             console.error(`Game Manager: GameState.addPlayer failed for ${playerId} in specific game ${targetGameId}.`);
             return { error: `Failed to join game '${targetGameId}'. Username might be taken.` };
        }
    }
    // --- Handle Find or Create ---
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
                return { error: 'Failed to add player to waiting game.' };
            }
        } else {
            // Create a new game
            const newGameId = `game-${uuidv4().substring(0, 8)}`;
            console.log(`Game Manager: Creating new game ${newGameId} for player ${playerId} (${username})`);
            const newGameState = new GameState(newGameId);
            const player = newGameState.addPlayer(playerId, username);

            if (player) {
                activeGames.set(newGameId, newGameState);
                playerGameMap.set(playerId, newGameId);
                return { gameId: newGameId, gameState: newGameState };
            } else {
                 console.error(`Game Manager: Failed to add initial player ${playerId} to newly created game ${newGameId}.`);
                 return { error: 'Failed to create game or add initial player.' };
            }
        }
    }
}

/** Retrieves the GameState object for a given game ID. */
function getGameState(gameId) {
    return activeGames.get(gameId);
}

/** Attempts to start a game if conditions are met. */
function maybeStartGame(gameId) {
     const gameState = activeGames.get(gameId);
     if (gameState && gameState.status === 'waiting' && gameState.players.length === gameState.maxPlayers) {
        console.log(`Game Manager: Attempting to start game ${gameId}...`);
        return gameState.startGame();
     }
     return false;
 }

/** Removes a player and handles game state adjustments or cleanup. */
function removePlayer(playerId) {
    const gameId = playerGameMap.get(playerId);
    if (!gameId) { return null; }

    const gameState = activeGames.get(gameId);
    playerGameMap.delete(playerId); // Remove mapping

    if (!gameState) { return null; } // Game already removed

    console.log(`Game Manager: Removing player ${playerId} from game ${gameId}`);
    const playerIndex = gameState.players.findIndex(p => p.id === playerId);

    if (playerIndex === -1) {
        if (gameState.players.length === 0) {
             console.log(`Game Manager: Game ${gameId} empty after player ${playerId} not found in list, removing.`);
             activeGames.delete(gameId);
             return { gameId, wasGameRemoved: true, remainingPlayers: [], notifyOthers: false, updatedGameState: null, leavingPlayerUsername: null };
        }
        return null;
    }

    const leavingPlayer = gameState.players[playerIndex];
    const leavingPlayerUsername = leavingPlayer.username;
    const wasCurrentTurn = leavingPlayer.isTurn;

    gameState.players.splice(playerIndex, 1); // Remove player

    if (gameState.players.length === 0) {
        console.log(`Game Manager: Game ${gameId} is now empty, removing game.`);
        activeGames.delete(gameId);
        return { gameId, wasGameRemoved: true, remainingPlayers: [], notifyOthers: false, updatedGameState: null, leavingPlayerUsername };
    } else {
        // Game continues, adjust turn? End game?
        if (gameState.status === 'playing') {
             const oldTurnIndex = gameState.currentTurnIndex;
             if (wasCurrentTurn) {
                 gameState.currentTurnIndex %= gameState.players.length;
                 if(gameState.players[gameState.currentTurnIndex]) gameState.players[gameState.currentTurnIndex].isTurn = true;
                 console.log(`Game Manager: Player ${leavingPlayerUsername} left on turn. New turn: ${gameState.players[gameState.currentTurnIndex]?.username}.`);
             } else {
                 if (playerIndex < oldTurnIndex) gameState.currentTurnIndex--;
                 gameState.currentTurnIndex = (gameState.currentTurnIndex + gameState.players.length) % gameState.players.length; // Ensure positive index
                 if(gameState.players[gameState.currentTurnIndex]) gameState.players[gameState.currentTurnIndex].isTurn = true;
                 else { /* Error handling if player not found */ }
             }
             if (gameState.players.length < 2) {
                 console.log(`Game Manager: Only one player left in playing game ${gameId}. Ending game.`);
                 gameState._endGame('player_left');
             }
        } else if (gameState.status === 'waiting') {
              gameState.currentTurnIndex = -1; // Reset turn index if game was waiting
        }

        return { gameId, wasGameRemoved: false, remainingPlayers: gameState.players.map(p => ({ id: p.id, username: p.username })), notifyOthers: true, updatedGameState: gameState, leavingPlayerUsername };
    }
}

module.exports = {
    handleJoinRequest,
    getGameState,
    maybeStartGame,
    removePlayer,
};