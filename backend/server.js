// backend/server.js

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const gameManager = require('./game/gameManager'); // Use the updated game manager

// Ensure environment variables (like PORT, FRONTEND_URL) are potentially loaded
// require('dotenv').config(); // Uncomment if you use a .env file

const PORT = process.env.PORT || 3001; // Use Render's port or 3001 locally

const app = express();
const server = http.createServer(app);

// Setup Socket.IO Server
const io = new Server(server, {
    cors: {
        // Use environment variable for production frontend URL
        // Allow wildcard locally or if env var not set
        origin: process.env.FRONTEND_URL || "*",
        methods: ["GET", "POST"]
    },
    // Optional: Configure ping settings for connection stability
    // pingTimeout: 60000,
    // pingInterval: 25000
});

// Basic HTTP route for health checks/info
app.get('/', (req, res) => {
    // Avoid accessing gameManager internal state directly if possible
    res.send(`Scrabble Server is running!`);
});

// Main Socket.IO Connection Logic
io.on('connection', (socket) => {
    const playerId = socket.id;
    console.log(`User connected: ${playerId}`);

    // --- Join Game Handler ---
    socket.on('joinGame', (data) => {
        // Validate input data
        if (!data || typeof data.username !== 'string' || data.username.trim().length === 0) {
            console.error(`Invalid joinGame data from ${playerId}:`, data);
            return socket.emit('gameError', { message: 'Invalid username provided.' });
        }
        const username = data.username.trim().slice(0, 16); // Limit username length
        const targetGameId = typeof data.gameId === 'string' && data.gameId.trim() ? data.gameId.trim() : null;

        console.log(`Player ${playerId} [${username}] wants to join/create game. Target ID: ${targetGameId || 'None'}`);

        try {
            // Use the gameManager function, check if game started
            const { gameId, gameState, error, gameJustStarted } = gameManager.handleJoinRequest(playerId, username, targetGameId);

            // Handle error or success
            if (error || !gameId || !gameState) {
                console.error(`Failed to process joinGame for ${playerId}: ${error || 'Unknown reason'}`);
                return socket.emit('gameError', { message: error || 'Failed to join or create game.' }); // Send error back
            }

            // Success - Join room and emit events
            console.log(`Player ${playerId} joining room ${gameId}`);
            socket.join(gameId);

            // Send specific state (potentially including dealt rack if game just started)
            const playerSpecificState = gameState.getPlayerSpecificState(playerId);
            console.log(`Emitting 'gameJoined' to ${playerId}`);
            socket.emit('gameJoined', playerSpecificState);

            // Notify other players in the room
            const player = gameState.players.find(p => p.id === playerId);
            if (player) {
                 const playerPublicInfo = { playerId: player.id, username: player.username, score: player.score };
                 console.log(`Emitting 'playerJoined' to room ${gameId} (except sender)`);
                 socket.to(gameId).emit('playerJoined', playerPublicInfo); // Use socket.to to exclude sender
            }

            // If this join action *caused* the game to start, emit the update
            if (gameJustStarted) {
                console.log(`Server: Game ${gameId} started! Emitting initial gameUpdate to room.`);
                const currentPublicState = gameState.getPublicState();
                io.to(gameId).emit('gameUpdate', currentPublicState); // Send public state to all
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
        if (!gameId || !Array.isArray(move) || move.length === 0) { return socket.emit('gameError', { message: 'Invalid data format for placing tiles.' }); }
        try {
            const gameState = gameManager.getGameState(gameId);
            if (!gameState) return socket.emit('gameError', { message: `Game '${gameId}' not found.` });
            if (gameState.status !== 'playing') return socket.emit('gameError', { message: `Game is not active (${gameState.status}).` });
            const result = gameState.placeValidMove(playerId, move);
            if (result.success) {
                console.log(`Player ${playerId} placed move in game ${gameId}. Score: ${result.score}.`);
                io.to(gameId).emit('gameUpdate', gameState.getPublicState());
                if (result.gameOver) {
                     console.log(`Game ${gameId} ended. Reason: ${result.reason || 'tiles'}`);
                     io.to(gameId).emit('gameOver', { finalScores: result.finalScores, reason: result.reason || 'tiles' });
                }
            } else {
                console.warn(`Invalid move by ${playerId} in game ${gameId}: ${result.error}`);
                socket.emit('invalidMove', { message: result.error || 'Invalid move.' });
            }
        } catch (err) { console.error(/*...*/); socket.emit('gameError', { message: 'Internal server error processing move.' }); }
    });

    // --- Pass Turn Handler ---
    socket.on('passTurn', (data) => {
        const { gameId } = data || {};
        console.log(`Received 'passTurn' from ${playerId} for game ${gameId}`);
        if (!gameId) return socket.emit('gameError', { message: 'Game ID missing for passTurn.' });
        try {
            const gameState = gameManager.getGameState(gameId);
            if (!gameState) return socket.emit('gameError', { message: `Game '${gameId}' not found.` });
            if (gameState.status !== 'playing') return socket.emit('gameError', { message: `Game is not active (${gameState.status}).` });
            const result = gameState.passTurn(playerId);
            if (result.success) {
                console.log(`Player ${playerId} passed turn in game ${gameId}.`);
                io.to(gameId).emit('gameUpdate', gameState.getPublicState());
                if (result.gameOver) {
                     console.log(`Game ${gameId} ended due to consecutive passes.`);
                     io.to(gameId).emit('gameOver', { finalScores: result.finalScores, reason: 'passes' });
                 }
            } else {
                console.warn(`Failed passTurn by ${playerId} in game ${gameId}: ${result.error}`);
                socket.emit('gameError', { message: result.error || 'Cannot pass turn now.' });
            }
        } catch (err) { console.error(/*...*/); socket.emit('gameError', { message: 'Internal server error processing pass.' }); }
    });

    // --- Exchange Tiles Handler ---
    socket.on('exchangeTiles', (data) => {
         const { gameId, tiles } = data || {}; // Expect tiles = ['A', 'B', 'BLANK']
         console.log(`Received 'exchangeTiles' from ${playerId} for game ${gameId} with tiles: ${tiles?.join(',')}`);
         if (!gameId || !Array.isArray(tiles) || tiles.length === 0) { return socket.emit('gameError', { message: 'Invalid data for exchanging tiles.' }); }
         try {
            const gameState = gameManager.getGameState(gameId);
            if (!gameState) return socket.emit('gameError', { message: `Game '${gameId}' not found.` });
            if (gameState.status !== 'playing') return socket.emit('gameError', { message: `Game is not active (${gameState.status}).` });
            const result = gameState.exchangeTiles(playerId, tiles);
            if (result.success) {
                console.log(`Player ${playerId} exchanged tiles in game ${gameId}.`);
                // Send specific update TO THE PLAYER with their new rack
                socket.emit('gameUpdate', gameState.getPlayerSpecificState(playerId));
                // Send general public update TO OTHERS in the room
                socket.to(gameId).emit('gameUpdate', gameState.getPublicState());
            } else {
                 console.warn(`Failed exchangeTiles by ${playerId} in game ${gameId}: ${result.error}`);
                 socket.emit('gameError', { message: result.error || 'Cannot exchange tiles now.' });
            }
         } catch (err) { console.error(/*...*/); socket.emit('gameError', { message: 'Internal server error processing exchange.' }); }
    });

    // --- Chat Message Handler ---
    socket.on('chatMessage', (data) => {
        const { gameId, message } = data || {};
        if (!gameId || typeof message !== 'string' || message.trim().length === 0) { console.warn(`Invalid chat msg data from ${playerId}`); return; }
        const gameState = gameManager.getGameState(gameId);
        const sender = gameState?.players.find(p => p.id === playerId);
        const senderUsername = sender ? sender.username : playerId.substring(0, 6);
        const messageData = { senderId: playerId, senderUsername: senderUsername, text: message.trim().slice(0, 200) };
        console.log(`[${gameId}] Chat from ${senderUsername} (${playerId}): ${messageData.text}`);
        io.to(gameId).emit('newChatMessage', messageData); // Broadcast including sender
    });

    // --- Disconnect Handler ---
    socket.on('disconnect', (reason) => {
        console.log(`User disconnected: ${playerId}. Reason: ${reason}`);
        try {
            const removalInfo = gameManager.removePlayer(playerId);
            if (removalInfo && removalInfo.gameId && removalInfo.notifyOthers) {
                 const { gameId, updatedGameState, wasGameRemoved, leavingPlayerUsername } = removalInfo;
                 console.log(`Notifying room ${gameId} that player ${leavingPlayerUsername || playerId} left.`);
                 const leftPlayerInfo = { playerId: playerId, username: leavingPlayerUsername || 'Player' };
                 io.to(gameId).emit('playerLeft', leftPlayerInfo); // Notify others
                 if (!wasGameRemoved && updatedGameState) {
                      console.log(`Game ${gameId} updated after player left. Broadcasting update.`);
                      io.to(gameId).emit('gameUpdate', updatedGameState.getPublicState());
                      if (updatedGameState.status === 'finished' && updatedGameState.finalScores) {
                           console.log(`Game ${gameId} ended because player left.`);
                           io.to(gameId).emit('gameOver', { finalScores: updatedGameState.finalScores, reason: 'player_left' });
                      }
                 } else if (wasGameRemoved) { console.log(`Game ${gameId} was removed as it became empty.`); }
            } else if (removalInfo) { console.log(`Player ${playerId} removed, no notifications needed.`); }
            else { console.log(`Player ${playerId} disconnected, was not found in any active game.`); }
        } catch(err) { console.error(`Error processing disconnect for ${playerId}:`, err); }
    });
}); // End of io.on('connection')

// Start the server
server.listen(PORT, () => {
    console.log(`Server listening on *:${PORT}`);
});