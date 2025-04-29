import { io } from 'socket.io-client';

// Determine the backend server URL based on environment
// In development, this relies on the "proxy" setting in package.json to forward requests.
// In production, replace 'YOUR_PRODUCTION_SERVER_URL' with your actual deployed server URL.
const SOCKET_URL = process.env.NODE_ENV === 'production'
    ? 'http://localhost:3001' // Replace with your production backend URL
    : 'http://localhost:3001'; // Assuming backend runs on 3001 locally if no proxy or direct connection needed

// Create the socket instance
// We configure it to not connect automatically; we'll call connect() explicitly.
const socket = io(SOCKET_URL, {
    autoConnect: false,         // Don't connect automatically on load
    reconnectionAttempts: 5,    // Try to reconnect 5 times
    reconnectionDelay: 2000,    // Wait 2 seconds between attempts
    transports: ['websocket'], // Prefer WebSocket transport
});


// --- Basic Connection Logging ---
// These listeners are set up once within the service for general debugging.
socket.on("connect", () => {
  console.log("Socket Service: Connected - ID:", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log("Socket Service: Disconnected - Reason:", reason);
  // Handle potential cleanup or UI updates on disconnect if needed globally
});

socket.on("connect_error", (err) => {
  console.error("Socket Service: Connection Error -", err.message, err.data || '');
  // Handle connection errors (e.g., server down, network issue)
});

socket.on("reconnect_attempt", (attempt) => {
    console.log(`Socket Service: Reconnect attempt ${attempt}...`);
});

socket.on("reconnect_failed", () => {
    console.error("Socket Service: Reconnection failed.");
    // Notify user?
});


// --- Connection Management ---
/**
 * Explicitly attempts to connect the socket if not already connected.
 */
const connect = () => {
    if (socket.disconnected) {
        console.log("Socket Service: Attempting to connect...");
        socket.connect();
    } else {
        console.log("Socket Service: Already connected or connecting.");
    }
};

/**
 * Explicitly disconnects the socket if connected.
 */
const disconnect = () => {
    if (socket.connected) {
        console.log("Socket Service: Disconnecting...");
        socket.disconnect();
    } else {
         console.log("Socket Service: Already disconnected.");
    }
};

// --- Event Emitters (Client -> Server) ---
// Functions to send data/commands to the backend.

/**
 * Sends a request to join or create a game.
 * @param {object} data - Typically { username: string }
 */
const joinGame = (data) => {
    console.log('Socket Service: Emitting joinGame', data);
    socket.emit('joinGame', data);
};

/**
 * Sends the player's intended move (placed tiles) to the server for validation.
 * @param {object} moveData - Typically { gameId: string, move: Array<{letter: string, value: number, row: number, col: number}> }
 */
const placeTiles = (moveData) => {
    console.log('Socket Service: Emitting placeTiles', moveData);
    socket.emit('placeTiles', moveData);
};

/**
 * Notifies the server that the current player is passing their turn.
 * @param {string} gameId - The ID of the game.
 */
const passTurn = (gameId) => {
    console.log('Socket Service: Emitting passTurn', { gameId });
    socket.emit('passTurn', { gameId }); // Send as object if server expects { gameId }
};

/**
 * Sends a request to exchange tiles from the player's rack.
 * @param {string} gameId - The ID of the game.
 * @param {Array<string>} tiles - An array of tile letters to exchange (e.g., ['A', 'B', 'C']).
 */
const exchangeTiles = (gameId, tiles) => {
    console.log('Socket Service: Emitting exchangeTiles', { gameId, tiles });
    socket.emit('exchangeTiles', { gameId, tiles });
};

/**
 * Sends a chat message to the server to be broadcast to the game room.
 * @param {string} gameId - The ID of the game room.
 * @param {string} message - The chat message text.
 */
const sendChatMessage = (gameId, message) => {
    console.log('Socket Service: Emitting chatMessage', { gameId, message });
    socket.emit('chatMessage', { gameId, message });
};


// --- Event Listeners (Server -> Client) ---
// Functions for components to subscribe to events from the backend.

/**
 * Subscribes to updates for the main game state.
 * @param {(newGameState: object) => void} callback - Function to call with the updated game state.
 */
const onGameUpdate = (callback) => {
    socket.on('gameUpdate', callback);
};

/**
 * Subscribes to notifications when the player successfully joins a game.
 * Provides the initial player-specific state (including their rack).
 * @param {(playerSpecificState: object) => void} callback - Function to call with the initial state.
 */
const onGameJoined = (callback) => {
    socket.on('gameJoined', callback);
};

/**
 * Subscribes to notifications when any player joins the game room (after initial join).
 * @param {(playerInfo: object) => void} callback - Function to call with info like { playerId, username }.
 */
const onPlayerJoined = (callback) => {
    socket.on('playerJoined', callback); // Assuming server emits this separately
};

/**
 * Subscribes to notifications when a player leaves the game room.
 * @param {(leaveInfo: object) => void} callback - Function to call with info like { playerId, username, reason }.
 */
 const onPlayerLeft = (callback) => {
    socket.on('playerLeft', callback); // Assuming server emits this
};

/**
 * Subscribes to new chat messages broadcast by the server.
 * @param {(messageData: object) => void} callback - Function to call with message data like { sender: string, text: string }.
 */
const onNewChatMessage = (callback) => {
    socket.on('newChatMessage', callback);
};

/**
 * Subscribes to notifications about an invalid move attempted by the player.
 * @param {(errorData: object) => void} callback - Function to call with error info like { message: string }.
 */
const onInvalidMove = (callback) => {
    socket.on('invalidMove', callback);
};

/**
 * Subscribes to notifications about the game ending.
 * @param {(endGameData: object) => void} callback - Function to call with end game details (winner, final scores).
 */
 const onGameOver = (callback) => {
    socket.on('gameOver', callback); // Assuming server emits this
};

/**
 * Subscribes to generic error messages from the server related to the game.
 * @param {(errorData: object) => void} callback - Function to call with error info like { message: string }.
 */
const onError = (callback) => {
    // Use a consistent event name, e.g., 'gameError'
    socket.on('gameError', callback);
};

// --- Listener Removal ---
/**
 * Unsubscribes a specific callback function from a server event.
 * Essential for cleanup when components unmount.
 * @param {string} eventName - The name of the event to unsubscribe from.
 * @param {Function} callback - The specific callback function instance that was used to subscribe.
 */
const removeListener = (eventName, callback) => {
    if (callback) {
         console.log(`Socket Service: Removing listener for ${eventName}`);
        socket.off(eventName, callback);
    } else {
        // If no specific callback is provided, remove all listeners for the event
        // Use cautiously, might affect other parts of the app unexpectedly.
         console.warn(`Socket Service: Removing ALL listeners for ${eventName}. Specify a callback for targeted removal.`);
        socket.off(eventName);
    }
};


// --- Expose Socket Instance (Helper) ---
/**
 * Returns the raw socket.io client instance.
 * Useful for accessing properties like socket.id or for advanced use cases.
 * @returns {Socket} The socket.io-client instance.
 */
const getSocketInstance = () => {
    return socket;
};


// --- Exported Service Object ---
// Bundles all functions into a single object for easy import.
const socketService = {
    // Connection Management
    connect,
    disconnect,

    // Event Emitters
    joinGame,
    placeTiles,
    passTurn,
    exchangeTiles,
    sendChatMessage,

    // Event Listeners (Subscription)
    onGameUpdate,
    onGameJoined,
    onPlayerJoined,
    onPlayerLeft,
    onNewChatMessage,
    onInvalidMove,
    onGameOver,
    onError,

    // Listener Removal
    removeListener,

    // Instance Access
    getSocketInstance
};

export default socketService;