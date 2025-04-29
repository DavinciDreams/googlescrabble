import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import Board from './components/Board/Board';
import Rack from './components/Rack/Rack';
import Controls from './components/Controls/Controls';
import Scoreboard from './components/Scoreboard/Scoreboard';
import GameInfo from './components/GameInfo/GameInfo';
import Chat from './components/Chat/Chat';
import socketService from './services/socketService';


function App() {
    // --- State Variables ---
    const [isConnected, setIsConnected] = useState(false);
    const [gameState, setGameState] = useState(null);
    const [myRack, setMyRack] = useState([]);
    const [messages, setMessages] = useState([]);
    const [username, setUsername] = useState('');
    const [isInGame, setIsInGame] = useState(false);
    const [socket, setSocket] = useState(null);
    const [temporaryPlacements, setTemporaryPlacements] = useState([]);
    const [selectedTilesForExchange, setSelectedTilesForExchange] = useState([]);
    const [joinError, setJoinError] = useState(''); // State for join form errors

    // --- Derived State ---
    const myPlayerId = socket?.id;
    const myPlayerData = gameState?.players.find(p => p.id === myPlayerId);
    const isMyTurn = myPlayerData?.isTurn || false;

    const temporarilyPlacedRackIndices = temporaryPlacements
        .map(p => p.tile.originData?.type === 'rack' ? p.tile.originData.index : -1)
        .filter(index => index !== -1);


    // --- Socket Connection Effect ---
    useEffect(() => {
        const currentSocket = socketService.getSocketInstance();
        setSocket(currentSocket); // Used here

        const handleConnect = () => {
            console.log("Socket connected in App:", currentSocket.id);
            setIsConnected(true); // Used here
        };
        const handleDisconnect = () => {
            console.log("Socket disconnected in App");
            setIsConnected(false); // Used here
            // Reset game state on disconnect
            setIsInGame(false);    // Used here
            setGameState(null);   // Used here
            setMyRack([]);      // Used here
            setTemporaryPlacements([]);
            setJoinError(''); // Clear join error on disconnect
        };
         const handleGameUpdate = (newGameState) => {
             console.log("App received gameUpdate:", newGameState);
             setGameState(newGameState); // Used here
             if (newGameState.status === 'playing') {
                 setTemporaryPlacements([]);
             }
         };
         const handleGameJoined = (playerSpecificState) => {
             console.log("App received gameJoined:", playerSpecificState);
             setGameState(playerSpecificState); // Used here
             setMyRack(playerSpecificState.myRack); // Used here
             setIsInGame(true); // Used here
             setTemporaryPlacements([]);
             setJoinError(''); // Clear join error on successful join
         };
         const handleNewMessage = (message) => {
            setMessages(prev => [...prev, message]); // Used here
         };
         const handleInvalidMove = (error) => {
             console.error("Invalid Move:", error.message);
             alert(`Invalid Move: ${error.message}`); // Keep alert for invalid moves for now, or replace with better UI
             setTemporaryPlacements([]);
         };
         const handleError = (error) => {
              console.error("Game Error:", error.message);
              // Consider replacing this alert too
              alert(`Error: ${error.message}`);
         };


        if (currentSocket) {
             // --- Setup Listeners ---
            currentSocket.on('connect', handleConnect);
            currentSocket.on('disconnect', handleDisconnect);
            socketService.onGameUpdate(handleGameUpdate);
            socketService.onGameJoined(handleGameJoined);
            socketService.onNewChatMessage(handleNewMessage);
            socketService.onInvalidMove(handleInvalidMove);
            socketService.onError(handleError);

            if (currentSocket.connected) {
                 handleConnect();
             } else {
                 socketService.connect();
             }
        }

        // --- Cleanup Listeners ---
        return () => {
            console.log("Cleaning up App listeners...");
             if (currentSocket) {
                currentSocket.off('connect', handleConnect);
                currentSocket.off('disconnect', handleDisconnect);
                socketService.removeListener('gameUpdate', handleGameUpdate);
                socketService.removeListener('gameJoined', handleGameJoined);
                socketService.removeListener('newChatMessage', handleNewMessage);
                socketService.removeListener('invalidMove', handleInvalidMove);
                socketService.removeListener('onError', handleError);
             }
        };
    // ESLint might still warn about setters here, but they are used in the handlers defined above.
    // It's generally safe to ignore these specific no-unused-vars warnings if they appear for setters used in useEffect handlers.
    }, [socket]);


    // --- Drag and Drop Handlers ---
    const handleTileDropOnBoard = useCallback((tileData, targetRow, targetCol) => {
        if (!isMyTurn) return;

        if (temporaryPlacements.some(p => p.row === targetRow && p.col === targetCol)) {
             console.warn("Target square already has a temporary tile.");
             return;
        }

        setTemporaryPlacements(prevPlacements => {
            const existingPlacementIndex = prevPlacements.findIndex(p => p.tile.id === tileData.id);
            let updatedPlacements = [...prevPlacements];
            if (existingPlacementIndex > -1) {
                updatedPlacements.splice(existingPlacementIndex, 1);
            }
            updatedPlacements.push({ row: targetRow, col: targetCol, tile: tileData });
            return updatedPlacements;
        });

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMyTurn, temporaryPlacements]);

    const handleTileDropOnRack = useCallback((tileData) => {
         if (!isMyTurn) return;

         if (tileData.originData?.type === 'board') {
              setTemporaryPlacements(prevPlacements =>
                  prevPlacements.filter(p => !(p.row === tileData.originData.row && p.col === tileData.originData.col))
             );
         }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMyTurn]);


    // --- Action Handlers ---
    const handleJoinGame = (e) => {
        console.time("handleJoinGame Execution");
        console.log("handleJoinGame start");
        e.preventDefault();
        setJoinError(''); // Clear previous error

        // Validation checks
        if (!username.trim()) {
            setJoinError("Please enter a username."); // Set error state
            console.log("handleJoinGame end - validation failed (username)");
            console.timeEnd("handleJoinGame Execution");
            return; // Stop execution
        }
        // Check socket connection state
        if (!socket || !isConnected) {
            setJoinError("Not connected to server. Please wait or refresh."); // Set error state
            console.log("handleJoinGame end - not connected");
            console.timeEnd("handleJoinGame Execution");
            return; // Stop execution
        }

        // If validation passes:
        console.log("Calling socketService.joinGame...");
        socketService.joinGame({ username: username.trim() });
        console.log("Called socketService.joinGame.");
        // Optionally clear username field after successful submission attempt
        // setUsername('');

        console.log("handleJoinGame end");
        console.timeEnd("handleJoinGame Execution");
    };

    const handlePlayMove = () => {
        if (!isMyTurn || temporaryPlacements.length === 0) {
            // Maybe use a non-blocking notification instead of alert here too
            alert("Cannot play: Not your turn or no tiles placed.");
            return;
        }
        const moveData = temporaryPlacements.map(p => ({
            letter: p.tile.letter,
            value: p.tile.value,
            row: p.row,
            col: p.col
        }));

        console.log("Submitting move:", moveData);
        if (gameState?.gameId) {
            socketService.placeTiles({ gameId: gameState.gameId, move: moveData });
        } else {
             console.error("Cannot play move, no game ID found.");
        }
    };

    const handlePassTurn = () => {
        if (!isMyTurn) {
             alert("Cannot pass: Not your turn."); // Consider replacing alert
            return;
        }
        if (gameState?.gameId) {
            socketService.passTurn(gameState.gameId);
            setTemporaryPlacements([]);
        }
    };

    const handleExchangeTiles = () => {
         if (!isMyTurn) {
              alert("Cannot exchange: Not your turn."); // Consider replacing alert
             return;
         }
         if (selectedTilesForExchange.length === 0) {
             // TODO: Replace alert with UI feedback near the rack/exchange button
             alert("Select tiles from your rack to exchange first.");
             return;
         }
        if (gameState?.gameId) {
             console.log("Exchanging tiles:", selectedTilesForExchange);
             socketService.exchangeTiles(gameState.gameId, selectedTilesForExchange);
             setTemporaryPlacements([]);
             setSelectedTilesForExchange([]);
        }
    };

    const handleSendMessage = (message) => {
         if (gameState?.gameId && message.trim()) {
            socketService.sendChatMessage(gameState.gameId, message.trim());
         }
    };


    // --- Rendering ---
    const canInteract = isConnected && isInGame && isMyTurn;

    return (
        <div className="App">
            <h1>Real-time Scrabble</h1>
            <p>Connection Status: {isConnected ? 'Connected' : 'Disconnected'}</p>

            {!isInGame ? (
                <form onSubmit={handleJoinGame}>
                    <input
                        type="text"
                        value={username}
                        // Clear error message when user types in the username field
                        onChange={(e) => { setUsername(e.target.value); setJoinError(''); }}
                        placeholder="Enter Username"
                        maxLength="12"
                        required // HTML5 validation can also help
                    />
                    <button type="submit" disabled={!isConnected}> {/* Disable button if not connected */}
                      Join / Create Game
                    </button>
                    {/* Display the join error message */}
                    {joinError && <p style={{ color: 'red', marginTop: '10px', fontWeight: 'bold' }}>{joinError}</p>}
                </form>
            ) : (
                <div className="game-area">
                   <div className="left-panel">
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
                            // TODO: Add props/handlers for selecting tiles for exchange
                         />
                        <Controls
                            onPlay={handlePlayMove}
                            onPass={handlePassTurn}
                            onExchange={handleExchangeTiles}
                            // Disable controls if not interactable, or Play button if no temps placed
                            disabled={!canInteract || (temporaryPlacements.length === 0 && gameState?.status === 'playing')}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;