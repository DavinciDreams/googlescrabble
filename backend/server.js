// backend/server.js

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const gameManager = require('./game/gameManager'); // Use the game manager

// require('dotenv').config(); // If using .env

const PORT = process.env.PORT || 3001;

const app = express();
const server = http.createServer(app);

// Setup Socket.IO Server
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "*",
        methods: ["GET", "POST"]
    },
    // pingTimeout: 60000,
    // pingInterval: 25000
});

// Basic HTTP route
app.get('/', (req, res) => {
    res.send(`Scrabble Server is running!`);
});

// Main Socket.IO Connection Logic
io.on('connection', (socket) => { // <--- Opening Brace for io.on('connection', ...)
    const playerId = socket.id;
    console.log(`User connected: ${playerId}`);

    // --- Join Game Handler ---
    socket.on('joinGame', (data) => { // <--- Start joinGame handler
        if (!data || typeof data.username !== 'string' || data.username.trim().length === 0) { return socket.emit('gameError', { message: 'Invalid username provided.' }); }
        const username = data.username.trim().slice(0, 16);
        const targetGameId = typeof data.gameId === 'string' && data.gameId.trim() ? data.gameId.trim() : null;
        console.log(`Player ${playerId} [${username}] joining. Target: ${targetGameId || 'None'}`);
        try {
            const { gameId, gameState, error, gameJustStarted } = gameManager.handleJoinRequest(playerId, username, targetGameId);
            if (error || !gameId || !gameState) { return socket.emit('gameError', { message: error || 'Join failed.' }); }
            socket.join(gameId);
            const playerSpecificState = gameState.getPlayerSpecificState(playerId);
            socket.emit('gameJoined', playerSpecificState);
            const player = gameState.players.find(p => p.id === playerId);
            if (player) {
                const playerPublicInfo = { playerId: player.id, username: player.username, score: player.score };
                socket.to(gameId).emit('playerJoined', playerPublicInfo);
            }
            if (gameJustStarted) {
                console.log(`Server: Game ${gameId} started! Emitting initial specific updates.`);
                gameState.players.forEach(p => {
                    const stateForThisPlayer = gameState.getPlayerSpecificState(p.id);
                    io.to(p.id).emit('gameUpdate', stateForThisPlayer);
                });
            }
        } catch (err) { console.error(`CRITICAL joinGame ${playerId}:`, err); socket.emit('gameError', { message: 'Internal server error.' }); }
    }); // <--- End joinGame handler

    // --- Place Tiles Handler ---
    socket.on('placeTiles', (data) => { // <--- Start placeTiles handler
        const { gameId, move } = data || {};
        console.log(`Received 'placeTiles' from ${playerId} for ${gameId}`);
        if (!gameId || !Array.isArray(move) || move.length === 0) { return socket.emit('gameError', { message: 'Invalid placeTiles data.' }); }
        try {
            const gameState = gameManager.getGameState(gameId);
            if (!gameState) return socket.emit('gameError', { message: `Game '${gameId}' not found.` });
            if (gameState.status !== 'playing') return socket.emit('gameError', { message: `Game not active (${gameState.status}).` });
            const result = gameState.placeValidMove(playerId, move);
            if (result.success) {
                console.log(`Player ${playerId} placed move in ${gameId}. Score: ${result.score}.`);
                // Send specific state (including *new* rack) back to the player who moved
                const moverSpecificState = gameState.getPlayerSpecificState(playerId);
                socket.emit('gameUpdate', moverSpecificState);
                console.log(`   Sent specific gameUpdate to mover ${playerId}`);
                // Send public state update to everyone else in the room
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
        } catch (err) { console.error(`CRITICAL placeTiles ${playerId}:`, err); socket.emit('gameError', { message: 'Internal server error.' }); }
    }); // <--- End placeTiles handler

    // --- Pass Turn Handler ---
    socket.on('passTurn', (data) => { // <--- Start passTurn handler
        const { gameId } = data || {};
        console.log(`Received 'passTurn' from ${playerId} for ${gameId}`);
        if (!gameId) return socket.emit('gameError', { message: 'Game ID missing.' });
        try {
            const gameState = gameManager.getGameState(gameId);
            if (!gameState) return socket.emit('gameError', { message: `Game '${gameId}' not found.` });
            if (gameState.status !== 'playing') return socket.emit('gameError', { message: `Game not active (${gameState.status}).` });
            const result = gameState.passTurn(playerId);
            if (result.success) {
                console.log(`Player ${playerId} passed turn in ${gameId}.`);
                io.to(gameId).emit('gameUpdate', gameState.getPublicState()); // Broadcast update
                if (result.gameOver) {
                     console.log(`Game ${gameId} ended via passes.`);
                     io.to(gameId).emit('gameOver', { finalScores: result.finalScores, reason: 'passes' });
                 }
            } else { console.warn(`Failed passTurn by ${playerId}: ${result.error}`); socket.emit('gameError', { message: result.error || 'Cannot pass.' }); }
        } catch (err) { console.error(`CRITICAL passTurn ${playerId}:`, err); socket.emit('gameError', { message: 'Internal server error.' }); }
    }); // <--- End passTurn handler

    // --- Exchange Tiles Handler ---
    socket.on('exchangeTiles', (data) => { // <--- Start exchangeTiles handler
         const { gameId, tiles } = data || {};
         console.log(`Received 'exchangeTiles' from ${playerId} for ${gameId}`);
         if (!gameId || !Array.isArray(tiles) || tiles.length === 0) { return socket.emit('gameError', { message: 'Invalid exchange data.' }); }
         try {
            const gameState = gameManager.getGameState(gameId);
            if (!gameState) return socket.emit('gameError', { message: `Game '${gameId}' not found.` });
            if (gameState.status !== 'playing') return socket.emit('gameError', { message: `Game not active (${gameState.status}).` });
            const result = gameState.exchangeTiles(playerId, tiles);
            if (result.success) {
                console.log(`Player ${playerId} exchanged tiles in ${gameId}.`);
                // Send specific state to exchanger (with new rack)
                socket.emit('gameUpdate', gameState.getPlayerSpecificState(playerId));
                // Send public state to others
                socket.to(gameId).emit('gameUpdate', gameState.getPublicState());
            } else { console.warn(`Failed exchangeTiles by ${playerId}: ${result.error}`); socket.emit('gameError', { message: result.error || 'Cannot exchange.' }); }
         } catch (err) { console.error(`CRITICAL exchangeTiles ${playerId}:`, err); socket.emit('gameError', { message: 'Internal server error.' }); }
    }); // <--- End exchangeTiles handler

    // --- Chat Message Handler ---
    socket.on('chatMessage', (data) => { // <--- Start chatMessage handler
        const { gameId, message } = data || {};
        if (!gameId || typeof message !== 'string' || message.trim().length === 0) { return; }
        const gameState = gameManager.getGameState(gameId);
        const sender = gameState?.players.find(p => p.id === playerId);
        const senderUsername = sender ? sender.username : playerId.substring(0, 6);
        const messageData = { senderId: playerId, senderUsername: senderUsername, text: message.trim().slice(0, 200) };
        console.log(`[${gameId}] Chat from ${senderUsername}: ${messageData.text}`);
        io.to(gameId).emit('newChatMessage', messageData);
    }); // <--- End chatMessage handler

    // --- Disconnect Handler ---
    socket.on('disconnect', (reason) => { // <--- Start disconnect handler
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
            } else if (removalInfo) { console.log(`Player ${playerId} removed, no notifications needed.`); }
            else { console.log(`Player ${playerId} disconnected, was not found in any active game.`); }
        } catch(err) { console.error(`Error processing disconnect for ${playerId}:`, err); }
    }); // <--- End disconnect handler

}); // <--- End of io.on('connection') handler // THIS WAS LIKELY THE ONE CAUSING THE ERROR

// Start the server
server.listen(PORT, () => {
    console.log(`Server listening on *:${PORT}`);
});