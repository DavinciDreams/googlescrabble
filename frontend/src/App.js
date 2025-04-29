import React, { useState, useEffect, useCallback } from 'react';
// Removed: import io from 'socket.io-client'; // No longer needed directly
import './App.css';
import Board from './components/Board/Board';
import Rack from './components/Rack/Rack';
import Controls from './components/Controls/Controls';
import Scoreboard from './components/Scoreboard/Scoreboard';
import GameInfo from './components/GameInfo/GameInfo';
import Chat from './components/Chat/Chat';
import socketService from './services/socketService';


function App() {
    const [isConnected, setIsConnected] = useState(false);
    const [gameState, setGameState] = useState(null);
    const [myRack, setMyRack] = useState([]);
    const [messages, setMessages] = useState([]);
    const [username, setUsername] = useState(''); // Keep state for the input field
    const [isInGame, setIsInGame] = useState(false);
    const [socket, setSocket] = useState(null);

    const [temporaryPlacements, setTemporaryPlacements] = useState([]);
    // Keep state, but acknowledge it's not fully used yet without UI implementation
    const [selectedTilesForExchange, setSelectedTilesForExchange] = useState([]);

    const myPlayerId = socket?.id;
    const myPlayerData = gameState?.players.find(p => p.id === myPlayerId);
    const isMyTurn = myPlayerData?.isTurn || false;

    const temporarilyPlacedRackIndices = temporaryPlacements
        .map(p => p.tile.originData?.type === 'rack' ? p.tile.originData.index : -1)
        .filter(index => index !== -1);


    // --- Socket Connection Effect ---
    useEffect(() => {
       // ... (socket connection logic remains the same) ...
       // Ensure socketService listeners update App state correctly
       // ...
        return () => {
            // ... (cleanup logic remains the same) ...
        };
    }, [socket]);


    // --- Drag and Drop Handlers ---
    const handleTileDropOnBoard = useCallback((tileData, targetRow, targetCol) => {
        // ... (logic remains the same) ...
    }, [isMyTurn, temporaryPlacements]);

    const handleTileDropOnRack = useCallback((tileData) => {
        // ... (logic remains the same) ...
    }, [isMyTurn]);


    // --- Action Handlers ---

    // This function IS used by the form's onSubmit handler below
    const handleJoinGame = (e) => {
        e.preventDefault(); // Prevent default form submission
        if (username.trim() && socket) { // Check socket exists too
            socketService.joinGame({ username: username.trim() });
            // Consider clearing username field after attempting join?
            // setUsername('');
        } else if (!socket) {
             alert("Not connected to server.");
        } else {
            alert("Please enter a username.");
        }
    };

    const handlePlayMove = () => {
        // ... (logic remains the same, uses temporaryPlacements) ...
    };

    const handlePassTurn = () => {
        // ... (logic remains the same) ...
    };

    const handleExchangeTiles = () => {
         if (!isMyTurn) {
              alert("Cannot exchange: Not your turn.");
             return;
         }

         // Use the state variable, even though the UI to populate it isn't built yet
         if (selectedTilesForExchange.length === 0) {
             alert("Select tiles from your rack to exchange first.");
             // TODO: Implement UI for selecting tiles in the Rack component
             // This will involve adding onClick handlers to Tiles in the rack
             // and calling setSelectedTilesForExchange with the selected tile indices/letters.
             return;
         }

        if (gameState?.gameId) {
             console.log("Exchanging tiles:", selectedTilesForExchange);
             // Use the state variable when sending to service
             socketService.exchangeTiles(gameState.gameId, selectedTilesForExchange);
             alert("Exchange requested (UI selection still needed).");
             setTemporaryPlacements([]);
             setSelectedTilesForExchange([]); // Clear selection after request
        }
    };

    const handleSendMessage = (message) => {
         // ... (logic remains the same) ...
    };


    // --- Rendering ---
    const canInteract = isConnected && isInGame && isMyTurn;

    return (
        <div className="App">
            <h1>Real-time Scrabble</h1>
            <p>Connection Status: {isConnected ? 'Connected' : 'Disconnected'}</p>

            {/* Ensure the form uses handleJoinGame */}
            {!isInGame ? (
                <form onSubmit={handleJoinGame}> {/* FIXED: Added onSubmit */}
                    <input
                        type="text"
                        value={username} // Used here
                        onChange={(e) => setUsername(e.target.value)} // Used here (setUsername)
                        placeholder="Enter Username"
                        maxLength="12"
                        required // Make username required
                    />
                    <button type="submit">Join / Create Game</button>
                </form>
            ) : (
                <div className="game-area">
                    <div className="left-panel">
                        {/* ... Scoreboard, GameInfo, Chat ... */}
                         <Scoreboard
                            players={gameState?.players || []}
                            currentPlayerId={gameState?.currentTurnPlayerId}
                         />
                        <GameInfo
                            status={gameState?.status}
                            currentPlayerId={gameState?.currentTurnPlayerId}
                            players={gameState?.players || []}
                            tilesRemaining={gameState?.tilesRemaining ?? '?'}
                         />
                        <Chat messages={messages} onSendMessage={handleSendMessage} />
                    </div>

                    <div className="main-panel">
                         {/* ... Board, Rack ... */}
                          <Board
                             boardData={gameState?.board}
                             temporaryPlacements={temporaryPlacements}
                             onTileDrop={handleTileDropOnBoard}
                             canInteract={canInteract}
                         />
                        <Rack
                            tiles={myRack || []}
                            temporarilyPlacedIndices={temporarilyPlacedRackIndices}
                            onRackDrop={handleTileDropOnRack}
                            canInteract={canInteract}
                         />
                        <Controls
                            onPlay={handlePlayMove}
                            onPass={handlePassTurn}
                            onExchange={handleExchangeTiles}
                            // FIXED: Added parentheses for clarity (no-mixed-operators)
                            disabled={!canInteract || (temporaryPlacements.length === 0 && gameState?.status === 'playing')}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;