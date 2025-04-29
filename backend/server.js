// backend/server.js

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const gameManager = require('./game/gameManager'); // Import the game manager

const PORT = process.env.PORT || 3001; // Use Render's port or 3001 locally

const app = express();
const server = http.createServer(app);

// Setup Socket.IO Server
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "*", // Use env var for frontend URL in prod, wildcard for dev
        methods: ["GET", "POST"]
    },
    // Optional: Add pingTimeout and pingInterval if needed for stability
    // pingTimeout: 60000, // Disconnect if no pong received after 60 seconds
    // pingInterval: 25000  // Send ping every 25 seconds
});

// Basic HTTP route (optional)
app.get('/', (req, res) => {
    res.send('Scrabble Server is running!');
});

// Main Socket.IO Connection Logic
io.on('connection', (socket) => {
    const playerId = socket.id; // Store player ID
    console.log(`User connected: ${playerId}`);

    // --- Join Game Handler ---
    socket.on('joinGame', (data) => {
        if (!data || typeof data.username !== 'string' || data.username.trim().length === 0) {
            console.error(`Invalid joinGame data from ${playerId}:`, data);
            return socket.emit('gameError', { message: 'Invalid username provided.' });
        }
        const username = data.username.trim().slice(0, 16); // Limit username length

        console.log(`Player ${playerId} [${username}] wants to join/create game.`);

        try {
            // Use gameManager to find/create game and add player
            const { gameId, gameState, error } = gameManager.findOrCreateGame(playerId, username);

            if (error || !gameId || !gameState) {
                console.error(`Failed to process joinGame for ${playerId}: ${error || 'Unknown reason'}`);
                return socket.emit('gameError', { message: error || 'Failed to join or create game.' });
            }

            console.log(`Player ${playerId} joining room ${gameId}`);
            socket.join(gameId); // Join the Socket.IO room

            // Send initial state specifically to the joining player
            const playerSpecificState = gameState.getPlayerSpecificState(playerId);
            console.log(`Emitting 'gameJoined' to ${playerId}`);
            socket.emit('gameJoined', playerSpecificState);

            // Notify *other* players in the room
            const player = gameState.players.find(p => p.id === playerId); // Get player details
            const playerPublicInfo = player ? { playerId: player.id, username: player.username, score: player.score } : { playerId };
            console.log(`Emitting 'playerJoined' to room ${gameId}`);
            socket.to(gameId).emit('playerJoined', playerPublicInfo);

            // Check if the game can start
            const gameStarted = gameManager.maybeStartGame(gameId);
            if (gameStarted) {
                console.log(`Game ${gameId} started! Emitting initial gameUpdate.`);
                io.to(gameId).emit('gameUpdate', gameState.getPublicState()); // Send public state to all
            }

        } catch (err) {
            console.error(`CRITICAL ERROR processing joinGame for ${playerId}:`, err);
            socket.emit('gameError', { message: 'Internal server error while joining game.' });
        }
    });

    // --- Place Tiles Handler ---
    socket.on('placeTiles', (data) => {
        const { gameId, move } = data || {};
        console.log(`Received 'placeTiles' from ${playerId} for game ${gameId}`);

        if (!gameId || !Array.isArray(move) || move.length === 0) {
            return socket.emit('gameError', { message: 'Invalid data format for placing tiles.' });
        }

        try {
            const gameState = gameManager.getGameState(gameId);
            if (!gameState) return socket.emit('gameError', { message: 'Game not found.' });
            if (gameState.status !== 'playing') return socket.emit('gameError', { message: `Game is not active (${gameState.status}).` });

            // Delegate move validation and execution to GameState
            const result = gameState.placeValidMove(playerId, move);

            if (result.success) {
                console.log(`Player ${playerId} placed move in game ${gameId}. Score: ${result.score}.`);
                // Broadcast the updated public state
                io.to(gameId).emit('gameUpdate', gameState.getPublicState());

                // Check if the move ended the game
                if (result.gameOver) {
                     console.log(`Game ${gameId} ended. Reason: ${result.reason || 'tiles'}`);
                     io.to(gameId).emit('gameOver', { finalScores: result.finalScores, reason: result.reason || 'tiles' });
                }
            } else {
                console.warn(`Invalid move by ${playerId} in game ${gameId}: ${result.error}`);
                socket.emit('invalidMove', { message: result.error || 'Invalid move.' });
            }
        } catch (err) {
            console.error(`CRITICAL ERROR processing placeTiles for ${playerId} in game ${gameId}:`, err);
            socket.emit('gameError', { message: 'Internal server error processing move.' });
        }
    });

    // --- Pass Turn Handler ---
    socket.on('passTurn', (data) => {
        const { gameId } = data || {};
        console.log(`Received 'passTurn' from ${playerId} for game ${gameId}`);

        if (!gameId) return socket.emit('gameError', { message: 'Game ID missing.' });

        try {
            const gameState = gameManager.getGameState(gameId);
            if (!gameState) return socket.emit('gameError', { message: 'Game not found.' });
            if (gameState.status !== 'playing') return socket.emit('gameError', { message: `Game is not active (${gameState.status}).` });

            // Delegate to GameState
            const result = gameState.passTurn(playerId);

            if (result.success) {
                console.log(`Player ${playerId} passed turn in game ${gameId}.`);
                io.to(gameId).emit('gameUpdate', gameState.getPublicState());

                if (result.gameOver) {
                     console.log(`Game ${gameId} ended due to consecutive passes.`);
                     io.to(gameId).emit('gameOver', { finalScores: gameState.finalScores, reason: 'passes' });
                 }
            } else {
                console.warn(`Failed passTurn by ${playerId} in game ${gameId}: ${result.error}`);
                socket.emit('gameError', { message: result.error || 'Cannot pass turn now.' });
            }
        } catch (err) {
            console.error(`CRITICAL ERROR processing passTurn for ${playerId} in game ${gameId}:`, err);
            socket.emit('gameError', { message: 'Internal server error processing pass.' });
        }
    });

    // --- Exchange Tiles Handler ---
    socket.on('exchangeTiles', (data) => {
         const { gameId, tiles } = data || {}; // Expect tiles = ['A', 'B', 'BLANK']
         console.log(`Received 'exchangeTiles' from ${playerId} for game ${gameId}`);

         if (!gameId || !Array.isArray(tiles) || tiles.length === 0) {
            return socket.emit('gameError', { message: 'Invalid data for exchanging tiles.' });
        }

         try {
            const gameState = gameManager.getGameState(gameId);
            if (!gameState) return socket.emit('gameError', { message: 'Game not found.' });
            if (gameState.status !== 'playing') return socket.emit('gameError', { message: `Game is not active (${gameState.status}).` });

            // Delegate to GameState
            const result = gameState.exchangeTiles(playerId, tiles);

            if (result.success) {
                console.log(`Player ${playerId} exchanged tiles in game ${gameId}.`);
                // Send specific update to the player with their new rack
                socket.emit('gameUpdate', gameState.getPlayerSpecificState(playerId));
                // Send general update to others (without the specific rack)
                socket.to(gameId).emit('gameUpdate', gameState.getPublicState());
            } else {
                 console.warn(`Failed exchangeTiles by ${playerId} in game ${gameId}: ${result.error}`);
                socket.emit('gameError', { message: result.error || 'Cannot exchange tiles now.' });
            }
         } catch (err) {
             console.error(`CRITICAL ERROR processing exchangeTiles for ${playerId} in game ${gameId}:`, err);
             socket.emit('gameError', { message: 'Internal server error processing exchange.' });
         }
    });

    // --- Chat Message Handler ---
    socket.on('chatMessage', (data) => {
        const { gameId, message } = data || {};
        if (!gameId || typeof message !== 'string' || message.trim().length === 0) return;

        // Find username associated with playerId (optional but good for UI)
        const gameState = gameManager.getGameState(gameId);
        const sender = gameState?.players.find(p => p.id === playerId);
        const senderUsername = sender ? sender.username : '???'; // Fallback

        const messageData = {
            senderId: playerId,
            senderUsername: senderUsername, // Add username
            text: message.trim().slice(0, 200) // Limit message length
        };

        console.log(`[${gameId}] Chat from ${senderUsername} (${playerId}): ${messageData.text}`);
        // Broadcast to everyone in the room including the sender
        io.to(gameId).emit('newChatMessage', messageData);
    });

    // --- Disconnect Handler ---
    socket.on('disconnect', (reason) => {
        console.log(`User disconnected: ${playerId}. Reason: ${reason}`);
        try {
            // Use gameManager to handle player removal and potential game state changes
            const removalInfo = gameManager.removePlayer(playerId);

            if (removalInfo && removalInfo.gameId) {
                 const { gameId, updatedGameState, wasGameRemoved } = removalInfo;
                 console.log(`Notifying room ${gameId} that player ${playerId} left.`);

                 // Prepare data about the leaving player
                 const leftPlayerInfo = { playerId: playerId /* Add username if available */ };

                 // Notify remaining players someone left
                 io.to(gameId).emit('playerLeft', leftPlayerInfo);

                 // If game wasn't removed and state was updated (e.g., turn change, game end)
                 if (!wasGameRemoved && updatedGameState) {
                      io.to(gameId).emit('gameUpdate', updatedGameState.getPublicState());
                       // Check if the game ended because only one player was left
                      if (updatedGameState.status === 'finished' && updatedGameState.finalScores) {
                           io.to(gameId).emit('gameOver', { finalScores: updatedGameState.finalScores, reason: 'player_left' });
                      }
                 } else if (wasGameRemoved) {
                    console.log(`Game ${gameId} was removed as it became empty.`);
                    // No one left in the room to notify
                 }
            }
        } catch(err) {
             console.error(`Error processing disconnect for ${playerId}:`, err);
        }
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server listening on *:${PORT}`);
});