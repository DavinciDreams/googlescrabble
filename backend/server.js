const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
// TODO: Import game logic/management functions later
// const gameManager = require('./game/gameManager');

const app = express();
const server = http.createServer(app);

// Configure Socket.IO
const io = new Server(server, {
    cors: {
        origin: "*", // Allow connections from any origin for now (adjust for production)
        methods: ["GET", "POST"]
    }
});

// Basic route (optional, useful for health checks)
app.get('/', (req, res) => {
    res.send('Scrabble Server is running!');
});

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`); // You are seeing this

    // --- THIS IS THE BLOCK TO DEBUG ---
    socket.on('joinGame', (data) => {
        // You are seeing this log:
        console.log(`Player ${socket.id} wants to join/create game with data:`, data);

        // --- WHAT HAPPENS NEXT? ---
        // TODO: Logic to find or create a game, add player
        // Are you actually calling functions to manage games? (e.g., gameManager)
        // Does this logic work correctly? Add logs inside it.

        // Example placeholder logic (REPLACE WITH YOUR ACTUAL LOGIC):
        const tempGameId = 'game123'; // Placeholder
        const playerAdded = true; // Placeholder
        const initialGameState = { /* some placeholder state */ }; // Placeholder

        if (playerAdded && tempGameId) {
            console.log(`Attempting to add player ${socket.id} to room ${tempGameId}`); // <-- ADD LOG
            socket.join(tempGameId); // Join the Socket.IO room for broadcast

            console.log(`Attempting to emit 'gameJoined' to ${socket.id}`); // <-- ADD LOG
            // ---> THIS EMIT IS CRITICAL <---
            // Are you emitting the 'gameJoined' event correctly?
            // Does 'getPlayerSpecificState' exist and return valid data?
            // Replace placeholder 'initialGameState' with your actual game state object
            socket.emit('gameJoined', initialGameState /* gameState.getPlayerSpecificState(socket.id) */);

            console.log(`Attempting to emit 'playerJoined' to room ${tempGameId}`); // <-- ADD LOG
            // Notify others in the room (optional but good)
            // Replace placeholder data with actual player info
            io.to(tempGameId).emit('playerJoined', { playerId: socket.id, username: data.username });

        } else {
            console.error(`Failed to add player ${socket.id} to a game.`); // <-- ADD LOG
            // Emit an error back if joining/creation failed
            socket.emit('gameError', { message: 'Failed to join or create game.' }); // <-- ARE YOU EMITTING ERRORS?
        }
    });
    // --- END OF BLOCK TO DEBUG ---

    socket.on('placeTiles', (data) => {
        // TODO: Validate move, update game state, broadcast update
        console.log(`Player ${socket.id} placed tiles:`, data);
        // Example: const isValid = gameLogic.validateMove(gameId, socket.id, data.move);
        // Example: if (isValid) { ... update state ... io.to(gameId).emit('gameUpdate', newGameState); }
        // Example: else { socket.emit('invalidMove', { message: '...' }); }
    });

    socket.on('passTurn', () => {
         // TODO: Update game state (change turn), broadcast update
        console.log(`Player ${socket.id} passed turn.`);
    });

    socket.on('exchangeTiles', (tilesToExchange) => {
         // TODO: Validate exchange, update rack/bag, broadcast update
        console.log(`Player ${socket.id} wants to exchange tiles:`, tilesToExchange);
    });

    socket.on('chatMessage', (message) => {
        // TODO: Broadcast message to others in the same game room
        console.log(`Player ${socket.id} sent message:`, message);
        // Example: io.to(gameId).emit('newChatMessage', { sender: socket.id, text: message });
    });


    // Handle disconnections
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        // TODO: Remove player from game, notify others, handle game ending if necessary
        // Example: gameManager.removePlayer(socket.id);
    });
});

// Near the top/middle where you define PORT:
const PORT = process.env.PORT || 3001; // Use Render's port or 3001 locally

// Near the bottom where you start the server:
server.listen(PORT, () => {
    // Log the ACTUAL port being used for confirmation
    console.log(`Server listening on *:${PORT}`);
});