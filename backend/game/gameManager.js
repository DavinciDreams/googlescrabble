// backend/game/gameManager.js

const GameState = require('./gameState');
const { v4: uuidv4 } = require('uuid');

const activeGames = new Map(); // Key: gameId, Value: GameState instance
const playerGameMap = new Map(); // Key: playerId, Value: gameId

/**
 * Handles a player's request to join a game.
 * If targetGameId is provided, attempts to join that specific game.
 * Otherwise, finds an available game or creates a new one.
 * CRUCIALLY: If adding the player makes the game ready, it starts the game internally.
 *
 * @param {string} playerId - The socket ID of the player.
 * @param {string} username - The player's chosen username.
 * @param {string | null} targetGameId - The specific game ID the player wants to join, or null.
 * @returns {object} - { gameId: string, gameState: GameState, error?: string, gameJustStarted?: boolean }
 */
function handleJoinRequest(playerId, username, targetGameId = null) {
    let gameJustStarted = false; // Flag to indicate if this join triggered the game start

    // Check if player is already mapped to an active game
    if (playerGameMap.has(playerId)) {
        const existingGameId = playerGameMap.get(playerId);
        if (activeGames.has(existingGameId)) {
            console.log(`Game Manager: Player ${playerId} attempting to join, already in active game ${existingGameId}. Returning existing game.`);
             if (targetGameId && targetGameId !== existingGameId) {
                 return { error: `You are already in game ${existingGameId}. Leave that game first.` };
             }
            // Allow rejoining same game (e.g., after refresh) - return existing state
            return { gameId: existingGameId, gameState: activeGames.get(existingGameId), gameJustStarted: false };
        } else {
            playerGameMap.delete(playerId); // Clean up stale map entry
        }
    }

    let gameToModify = null;
    let gameIdToReturn = null;

    // --- Handle Joining Specific Game ---
    if (targetGameId) {
        console.log(`Game Manager: Player ${playerId} attempting to join specific game ${targetGameId}`);
        gameToModify = activeGames.get(targetGameId);
        gameIdToReturn = targetGameId;

        if (!gameToModify) {
             console.warn(`Game Manager: Join failed for ${playerId}. Game '${targetGameId}' not found.`);
             return { error: `Game with ID '${targetGameId}' not found.` };
        }
        if (gameToModify.status !== 'waiting') {
             console.warn(`Game Manager: Join failed for ${playerId}. Game '${targetGameId}' status is ${gameToModify.status}.`);
             return { error: `Game '${targetGameId}' has already started or is finished.` };
        }
        if (gameToModify.players.length >= gameToModify.maxPlayers) {
              console.warn(`Game Manager: Join failed for ${playerId}. Game '${targetGameId}' is full (${gameToModify.players.length}/${gameToModify.maxPlayers}).`);
              return { error: `Game '${targetGameId}' is full.` };
        }
    }
    // --- Handle Find or Create ---
    else {
        console.log(`Game Manager: Player ${playerId} looking for waiting game or creating new.`);
        let availableGame = null;
        for (const [gameId, gameState] of activeGames.entries()) {
            if (gameState.status === 'waiting' && gameState.players.length < gameState.maxPlayers) {
                availableGame = gameState; // Found one
                gameIdToReturn = gameId;
                break;
            }
        }

        if (availableGame) {
            gameToModify = availableGame;
            console.log(`Game Manager: Found waiting game ${gameIdToReturn} for player ${playerId}.`);
        } else {
            // Create new game
            gameIdToReturn = `game-${uuidv4().substring(0, 8)}`; // Shorter ID
            console.log(`Game Manager: Creating new game ${gameIdToReturn} for player ${playerId} (${username})`);
            gameToModify = new GameState(gameIdToReturn); // Uses default maxPlayers from GameState
            activeGames.set(gameIdToReturn, gameToModify);
        }
    }

    // --- Add Player and Potentially Start Game ---
    if (!gameToModify || !gameIdToReturn) {
         console.error(`Game Manager: Failed to identify game to modify for player ${playerId}.`);
         return { error: 'Internal error finding or creating game.' };
    }

    const player = gameToModify.addPlayer(playerId, username);
    if (player) {
        playerGameMap.set(playerId, gameIdToReturn);
        console.log(`Game Manager: Player ${playerId} added to game ${gameIdToReturn}. Players now: ${gameToModify.players.length}`);

        // Check and Start Game HERE if conditions met
        if (gameToModify.status === 'waiting' && gameToModify.players.length === gameToModify.maxPlayers) {
             console.log(`Game Manager: Game ${gameIdToReturn} is now full. Attempting to start...`);
             if (gameToModify.startGame()) { // startGame deals the tiles
                 console.log(`Game Manager: Game ${gameIdToReturn} started successfully by handleJoinRequest.`);
                 gameJustStarted = true; // Set the flag indicating start
             } else {
                  console.error(`Game Manager: Game ${gameIdToReturn} failed to start even when full.`);
             }
        }
        // Return success, including the gameState (which might now be 'playing')
        return { gameId: gameIdToReturn, gameState: gameToModify, gameJustStarted };

    } else {
         // addPlayer failed
         console.error(`Game Manager: GameState.addPlayer failed for ${playerId} in game ${gameIdToReturn}.`);
         // If we created a new game but failed to add the *first* player, remove the game
         if (gameToModify.players.length === 0 && activeGames.get(gameIdToReturn) === gameToModify) {
             activeGames.delete(gameIdToReturn);
             console.log(`Game Manager: Removed newly created game ${gameIdToReturn} due to initial addPlayer failure.`);
         }
         return { error: `Failed to add player to game ${gameIdToReturn}. Username may be taken.` };
    }
}


/** Retrieves the GameState object for a given game ID. */
function getGameState(gameId) {
    return activeGames.get(gameId);
}

/**
 * Removes a player and handles game state adjustments or cleanup.
 * @param {string} playerId - The socket ID of the disconnecting player.
 * @returns {{ gameId: string, wasGameRemoved: boolean, remainingPlayers: Array, notifyOthers: boolean, updatedGameState: GameState | null, leavingPlayerUsername: string | null } | null}
 */
function removePlayer(playerId) {
    const gameId = playerGameMap.get(playerId);
    if (!gameId) { return null; } // Player not found in map

    const gameState = activeGames.get(gameId);
    playerGameMap.delete(playerId); // Remove mapping

    if (!gameState) {
        console.log(`Game Manager: Player ${playerId} disconnected, game ${gameId} not found (already removed?).`);
        return null;
    }

    console.log(`Game Manager: Removing player ${playerId} from game ${gameId}`);
    const playerIndex = gameState.players.findIndex(p => p.id === playerId);

    if (playerIndex === -1) {
        console.warn(`Game Manager: Player ${playerId} not found in game state for ${gameId} during removal.`);
        if (gameState.players.length === 0) { // If game is now empty anyway
             console.log(`Game Manager: Game ${gameId} empty after player ${playerId} not found in list, removing game.`);
             activeGames.delete(gameId);
             return { gameId, wasGameRemoved: true, remainingPlayers: [], notifyOthers: false, updatedGameState: null, leavingPlayerUsername: null };
        }
        return null;
    }

    // Store info *before* removing
    const leavingPlayer = gameState.players[playerIndex];
    const leavingPlayerUsername = leavingPlayer.username;
    const wasCurrentTurn = leavingPlayer.isTurn;

    // Remove the player
    gameState.players.splice(playerIndex, 1);

    // --- Handle Game State Changes ---
    if (gameState.players.length === 0) {
        // Game is empty, remove it
        console.log(`Game Manager: Game ${gameId} is now empty, removing game.`);
        activeGames.delete(gameId);
        return { gameId, wasGameRemoved: true, remainingPlayers: [], notifyOthers: false, updatedGameState: null, leavingPlayerUsername };
    } else {
        // Game continues, adjust turn? End game?
        if (gameState.status === 'playing') {
            // Recalculate currentTurnIndex based on remaining players
             const oldTurnIndex = gameState.currentTurnIndex;
             if (wasCurrentTurn) {
                 // If the leaving player had the turn, the next player gets it
                 gameState.currentTurnIndex %= gameState.players.length; // Modulo handles wrap-around after splice
                 if(gameState.players[gameState.currentTurnIndex]) gameState.players[gameState.currentTurnIndex].isTurn = true;
                 console.log(`Game Manager: Player ${leavingPlayerUsername} left on turn. New turn: ${gameState.players[gameState.currentTurnIndex]?.username}.`);
             } else {
                 // If leaver was *before* the current turn player, the current index shifts down
                 // Ensure index remains valid after potential shift
                 if (playerIndex < oldTurnIndex) gameState.currentTurnIndex = (oldTurnIndex - 1 + gameState.players.length) % gameState.players.length;
                 else gameState.currentTurnIndex %= gameState.players.length;

                 // Ensure the correct player has isTurn=true
                  if(gameState.players.length > 0 && gameState.currentTurnIndex >= 0 && gameState.players[gameState.currentTurnIndex]) {
                    gameState.players.forEach((p, idx) => p.isTurn = (idx === gameState.currentTurnIndex));
                  } else { // Fallback if index is somehow invalid
                     gameState.currentTurnIndex = 0;
                     if(gameState.players.length > 0 && gameState.players[0]) gameState.players[0].isTurn = true;
                  }
             }

             // Check if only one player remains -> end game
             if (gameState.players.length < 2) { // Assuming 2 is minimum for playing
                 console.log(`Game Manager: Only one player left in playing game ${gameId}. Ending game.`);
                 gameState._endGame('player_left'); // End the game and calculate scores
             }
        } else if (gameState.status === 'waiting') {
             // If game was waiting, turn index should remain -1 or reset
              gameState.currentTurnIndex = -1;
        }

        return {
            gameId,
            wasGameRemoved: false,
            remainingPlayers: gameState.players.map(p => ({ id: p.id, username: p.username })),
            notifyOthers: true, // Let server.js know to notify
            updatedGameState: gameState, // Pass back the modified state
            leavingPlayerUsername
        };
    }
}


module.exports = {
    handleJoinRequest,
    getGameState,
    // maybeStartGame, // Removed as start logic moved into handleJoinRequest
    removePlayer,
};