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
        origin: process.env.FRONTEND_URL || "*", // Use env var for frontend URL in prod, wildcard for dev
        methods: ["GET", "POST"]
    },
    // Optional: Configure ping settings for connection stability
    // pingTimeout: 60000,
    // pingInterval: 25000
});

// Basic HTTP route for health checks/info
app.get('/', (req, res) => {
    res.send(`Scrabble Server is running!`);
});

// Main Socket.IO Connection Logic
io.on('connection', (socket) => {
    const playerId = socket.id;
    console.log(`User connected: ${playerId}`);

    // --- Join Game Handler ---
    socket.on('joinGame', (data) => {
        if (!data || typeof data.username !== 'string' || data.username.trim().length === 0) { return socket.emit('gameError', { message: 'Invalid username provided.' }); }
        const username = data.username.trim().slice(0, 16);
        const targetGameId = typeof data.gameId === 'string' && data.gameId.trim() ? data.gameId.trim() : null;
        console.log(`Player ${playerId} [${username}] wants to join/create game. Target ID: ${targetGameId || 'None'}`);
        try {
            const { gameId, gameState, error, gameJustStarted } = gameManager.handleJoinRequest(playerId, username, targetGameId);
            if (error || !gameId || !gameState) { return socket.emit('gameError', { message: error || 'Failed to join/create game.' }); }

            socket.join(gameId);
            const playerSpecificState = gameState.getPlayerSpecificState(playerId);
            console.log(`Emitting 'gameJoined' to ${playerId}`);
            socket.emit('gameJoined', playerSpecificState);

            const player = gameState.players.find(p => p.id === playerId);
            if (player) {
                 const playerPublicInfo = { playerId: player.id, username: player.username, score: player.score };
                 socket.to(gameId).emit('playerJoined', playerPublicInfo);
            }

            if (gameJustStarted) {
                console.log(`Server: Game ${gameId} started! Emitting initial specific gameUpdates.`);
                gameState.players.forEach(p => {
                    const stateForThisPlayer = gameState.getPlayerSpecificState(p.id);
                    io.to(p.id).emit('gameUpdate', stateForThisPlayer);
                });
            }
        } catch (err) { console.error(`CRITICAL ERROR joinGame ${playerId}:`, err); socket.emit('gameError', { message: 'Internal server error.' }); }
    }); // ---> End of joinGame handler

    // --- Place Tiles Handler ---
    socket.on('placeTiles', (data) => { // Opening parenthesis for listener
        const { gameId, move } = data || {};
        console.log(`Received 'placeTiles' from ${playerId} for game ${gameId}`);
        if (!gameId || !Array.isArray(move) || move.length === 0) { return socket.emit('gameError', { message: 'Invalid placeTiles data.' }); }

        try { // Opening brace for try
            const gameState = gameManager.getGameState(gameId);
            if (!gameState) return socket.emit('gameError', { message: `Game '${gameId}' not found.` });
            if (gameState.status !== 'playing') return socket.emit('gameError', { message: `Game not active (${gameState.status}).` });

            const result = gameState.placeValidMove(playerId, move);

            if (result.success) {
                console.log(`Player ${playerId} placed move in ${gameId}. Score: ${result.score}.`);
                // Send specific state (with new rack) to the mover
                const moverSpecificState = gameState.getPlayerSpecificState(playerId);
                socket.emit('gameUpdate', moverSpecificState);
                console.log(`   Sent specific gameUpdate to mover ${playerId}`);
                // Send public state to others
                const publicState = gameState.getPublicState();
                socket.to(gameId).emit('gameUpdate', publicState);
                console.log(`   Sent public gameUpdate to others in room ${gameId}`);

                if (result.gameOver) {
                     console.log(`Game ${gameId} ended. Reason: ${result.reason || 'tiles'}`);
                     io.to(gameId).emit('gameOver', { finalScores: result.finalScores, reason: result.reason || 'tiles' });
                }
            } else {
                console.warn(`Invalid move by ${playerId} in ${gameId}: ${result.error}`);
                socket.emit('invalidMove', { message: result.error || 'Invalid move.' });
            }
        } catch (err) { // Opening brace for catch
            // ---> This is the block around line 121 <---
            console.error(`CRITICAL ERROR processing placeTiles for ${playerId}:`, err);
            socket.emit('gameError', { message: 'Internal server error processing move.' });
        } // ---> Closing brace for catch block <---

    }); // ---> Ensure this closing parenthesis and semicolon exist <---

    // --- Pass Turn Handler ---
    socket.on('passTurn', (data) => {
        const { gameId } = data || {};
        console.log(`Received 'passTurn' from ${playerId} for game ${gameId}`);
        if (!gameId) return socket.emit('gameError', { message: 'Game ID missing.' });
        try {
            const gameState = gameManager.getGameState(gameId);
            if (!gameState) return socket.emit('gameError', { message: `Game '${gameId}' not found.` });
            if (gameState.status !== 'playing') return socket.emit('gameError', { message: `Game not active (${gameState.status}).` });
            const result = gameState.passTurn(playerId);
            if (result.success) {
                console.log(`Player ${playerId} passed turn in ${gameId}.`);
                io.to(gameId).emit('gameUpdate', gameState.getPublicState());
                if (result.gameOver) {
                     console.log(`Game ${gameId} ended via passes.`);
                     io.to(gameId).emit('gameOver', { finalScores: result.finalScores, reason: 'passes' });
                 }
            } else { console.warn(`Failed passTurn by ${playerId}: ${result.error}`); socket.emit('gameError', { message: result.error || 'Cannot pass.' }); }
        } catch (err) { console.error(`CRITICAL ERROR passTurn ${playerId}:`, err); socket.emit('gameError', { message: 'Internal server error.' }); }
    }); // ---> End of passTurn handler

    // --- Exchange Tiles Handler ---
    socket.on('exchangeTiles', (data) => {
         const { gameId, tiles } = data || {};
         console.log(`Received 'exchangeTiles' from ${playerId} for ${gameId} with tiles: ${tiles?.join(',')}`);
         if (!gameId || !Array.isArray(tiles) || tiles.length === 0) { return socket.emit('gameError', { message: 'Invalid exchange data.' }); }
         try {
            const gameState = gameManager.getGameState(gameId);
            if (!gameState) return socket.emit('gameError', { message: `Game '${gameId}' not found.` });
            if (gameState.status !== 'playing') return socket.emit('gameError', { message: `Game not active (${gameState.status}).` });
            const result = gameState.exchangeTiles(playerId, tiles);
            if (result.success) {
                console.log(`Player ${playerId} exchanged tiles in ${gameId}.`);
                socket.emit('gameUpdate', gameState.getPlayerSpecificState(playerId)); // Send specific state to exchanger
                socket.to(gameId).emit('gameUpdate', gameState.getPublicState()); // Send public state to others
            } else { console.warn(`Failed exchangeTiles by ${playerId}: ${result.error}`); socket.emit('gameError', { message: result.error || 'Cannot exchange.' }); }
         } catch (err) { console.error(`CRITICAL ERROR exchangeTiles ${playerId}:`, err); socket.emit('gameError', { message: 'Internal server error.' }); }
    }); // ---> End of exchangeTiles handler

    // --- Chat Message Handler ---
    socket.on('chatMessage', (data) => {
        const { gameId, message } = data || {};
        if (!gameId || typeof message !== 'string' || message.trim().length === 0) { return; } // Ignore silently
        const gameState = gameManager.getGameState(gameId);
        const sender = gameState?.players.find(p => p.id === playerId);
        const senderUsername = sender ? sender.username : playerId.substring(0, 6);
        const messageData = { senderId: playerId, senderUsername: senderUsername, text: message.trim().slice(0, 200) };
        console.log(`[${gameId}] Chat from ${senderUsername}: ${messageData.text}`);
        io.to(gameId).emit('newChatMessage', messageData); // Broadcast to all in room
    }); // ---> End of chatMessage handler

    // --- Disconnect Handler ---
    socket.on('disconnect', (reason) => {
        console.log(`User disconnected: ${playerId}. Reason: ${reason}`);
        try {
            const removalInfo = gameManager.removePlayer(playerId);
            if (removalInfo?.gameId && removalInfo.notifyOthers) {
                 const { gameId, updatedGameState, wasGameRemoved, leavingPlayerUsername } = removalInfo;
                 console.log(`Notifying room ${gameId} that ${leavingPlayerUsername || playerId} left.`);
                 const leftPlayerInfo = { playerId: playerId, username: leavingPlayerUsername || 'Player' };
                 io.to(gameId).emit('playerLeft', leftPlayerInfo);
                 if (!wasGameRemoved && updatedGameState) {
                      console.log(`Game ${gameId} updated post-disconnect.`);
                      io.to(gameId).emit('gameUpdate', updatedGameState.getPublicState());
                      if (updatedGameState.status === 'finished' && updatedGameState.finalScores) {
                           console.log(`Game ${gameId} ended because player left.`);
                           io.to(gameId).emit('gameOver', { finalScores: updatedGameState.finalScores, reason: 'player_left' });
                      }
                 } else if (wasGameRemoved) { console.log(`Game ${gameId} removed.`); }
            } else if (removalInfo) { console.log(`Player ${playerId} removed, no notifications.`); }
            else { console.log(`Player ${playerId} disconnected, was not in active game.`); }
        } catch(err) { console.error(`Error processing disconnect for ${playerId}:`, err); }
    }); // ---> End of disconnect handler

}); // ---> End of io.on('connection')

// Start the server
server.listen(PORT, () => {
    console.log(`Server listening on *:${PORT}`);
});