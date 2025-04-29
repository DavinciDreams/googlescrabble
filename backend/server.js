// backend/server.js

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const gameManager = require('./game/gameManager'); // Import the game manager

const PORT = process.env.PORT || 3001; // Use Render's port or 3001 locally

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*", // Consider restricting in production: e.g., process.env.FRONTEND_URL
        methods: ["GET", "POST"]
    }
});

app.get('/', (req, res) => {
    res.send('Scrabble Server is running!');
});

io.on('connection', (socket) => {
    const playerId = socket.id; // Store player ID
    console.log(`User connected: ${playerId}`);

    socket.on('joinGame', (data) => {
        // Validate input data
        if (!data || typeof data.username !== 'string' || data.username.trim().length === 0) {
            console.error(`Invalid joinGame data from ${playerId}:`, data);
            socket.emit('gameError', { message: 'Invalid username provided.' });
            return;
        }
        const username = data.username.trim();

        console.log(`Player ${playerId} wants to join/create game with username: ${username}`);

        try {
            const { gameId, gameState, error } = gameManager.findOrCreateGame(playerId, username);

            if (error || !gameId || !gameState) {
                console.error(`Failed to process joinGame for ${playerId}: ${error || 'Unknown reason'}`);
                socket.emit('gameError', { message: error || 'Failed to join or create game.' });
                return;
            }

            console.log(`Player ${playerId} joining room ${gameId}`);
            socket.join(gameId); // Join the Socket.IO room

            // Send the initial state *specifically* to the joining player
            const playerSpecificState = gameState.getPlayerSpecificState(playerId);
            console.log(`Emitting 'gameJoined' to ${playerId}`); // Removed state logging for brevity
            socket.emit('gameJoined', playerSpecificState);

            // Notify *other* players in the room that someone joined
            const playerPublicInfo = { playerId: playerId, username: username, score: 0 }; // Get score from state if needed
            console.log(`Emitting 'playerJoined' to room ${gameId}`);
            socket.to(gameId).emit('playerJoined', playerPublicInfo); // Use socket.to to exclude sender

            // Check if the game can start now
            const gameStarted = gameManager.maybeStartGame(gameId);
            if (gameStarted) {
                // If game started, send an update to everyone in the room
                console.log(`Game ${gameId} started! Emitting initial gameUpdate.`);
                // Use gameState.getPublicState() for general updates
                io.to(gameId).emit('gameUpdate', gameState.getPublicState());
            }

        } catch (err) {
            console.error(`CRITICAL ERROR processing joinGame for ${playerId}:`, err);
            socket.emit('gameError', { message: 'Internal server error while joining game.' });
        }
    });

    // --- Placeholder Event Handlers ---
    // TODO: Implement these using gameManager.getGameState(gameId) to get the state
    socket.on('placeTiles', (data) => {
        // 1. Get gameId from data or playerGameMap
        // 2. Get gameState = gameManager.getGameState(gameId)
        // 3. Validate move using gameState and gameLogic
        // 4. If valid, update gameState
        // 5. Emit 'gameUpdate' to room: io.to(gameId).emit('gameUpdate', gameState.getPublicState());
        // 6. Emit 'invalidMove' on error: socket.emit('invalidMove', ...);
        console.log(`Player ${playerId} placed tiles:`, data);
        console.warn("placeTiles handler not fully implemented.");
    });

    socket.on('passTurn', (data) => { // Expect { gameId }
        // Similar logic: get gameId, get gameState, call gameState.passTurn(playerId), emit 'gameUpdate'
        console.log(`Player ${playerId} passed turn.`);
         console.warn("passTurn handler not fully implemented.");
    });

    socket.on('exchangeTiles', (data) => { // Expect { gameId, tiles }
        // Similar logic: get gameId, get gameState, call gameState.exchangeTiles(playerId, tiles), emit 'gameUpdate'
        console.log(`Player ${playerId} wants to exchange tiles:`, data);
         console.warn("exchangeTiles handler not fully implemented.");
    });

    socket.on('chatMessage', (data) => { // Expect { gameId, message }
        if (!data || !data.gameId || !data.message) return;
        const gameId = data.gameId;
        // Basic broadcast, maybe add sender info later
        console.log(`Player ${playerId} sent message in ${gameId}:`, data.message);
        // Use socket.to() to exclude sender from receiving their own message via broadcast
        socket.to(gameId).emit('newChatMessage', { senderId: playerId, /* username? */ text: data.message });
    });


    // Handle disconnections
    socket.on('disconnect', (reason) => {
        console.log(`User disconnected: ${playerId}. Reason: ${reason}`);
        try {
            const removalInfo = gameManager.removePlayer(playerId);

            if (removalInfo && removalInfo.notifyOthers && removalInfo.gameId) {
                 const { gameId, updatedGameState } = removalInfo;
                 console.log(`Notifying room ${gameId} that player ${playerId} left.`);
                 // Notify remaining players
                 io.to(gameId).emit('playerLeft', { playerId: playerId /* add username? */ });
                 // Send update if game state changed (e.g., turn advanced, game ended)
                 if (updatedGameState) {
                      io.to(gameId).emit('gameUpdate', updatedGameState.getPublicState());
                 }
            } else if (removalInfo && removalInfo.wasGameRemoved) {
                 console.log(`Game ${removalInfo.gameId} was removed.`);
            }
        } catch(err) {
             console.error(`Error processing disconnect for ${playerId}:`, err);
        }
    });
});

// Near the bottom where you start the server:
server.listen(PORT, () => {
    // Log the ACTUAL port being used for confirmation
    console.log(`Server listening on *:${PORT}`);
});