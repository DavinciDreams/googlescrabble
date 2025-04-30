// frontend/src/App.js

import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import Board from './components/Board/Board';
import Rack from './components/Rack/Rack'; // Ensure Rack import is correct
import Controls from './components/Controls/Controls';
import Scoreboard from './components/Scoreboard/Scoreboard';
import GameInfo from './components/GameInfo/GameInfo';
import Chat from './components/Chat/Chat';
import socketService from './services/socketService';
import GameOverDisplay from './components/GameOverDisplay/GameOverDisplay'; // Ensure this component exists

function App() {
    // --- State Variables ---
    const [isConnected, setIsConnected] = useState(false);
    const [gameState, setGameState] = useState(null); // Holds the full game state from server
    const [myRack, setMyRack] = useState([]); // Holds array of {letter, value} objects
    const [messages, setMessages] = useState([]); // Chat messages [{ system?, senderId?, senderUsername?, text }]
    const [username, setUsername] = useState('');
    const [joinGameId, setJoinGameId] = useState(''); // State for optional Game ID input
    const [isInGame, setIsInGame] = useState(false);
    const [socket, setSocket] = useState(null);
    const [temporaryPlacements, setTemporaryPlacements] = useState([]); // Tiles on board before submit: { row, col, tile: { letter, value, id, originData, isBlank? } }
    const [selectedTilesForExchange, setSelectedTilesForExchange] = useState([]); // Stores originalIndex numbers of rack tiles selected
    const [joinError, setJoinError] = useState(''); // Error during join process
    const [lastGameError, setLastGameError] = useState(''); // Non-fatal errors during gameplay
    const [gameIdToShare, setGameIdToShare] = useState(null); // Current game ID for sharing
    const [copySuccess, setCopySuccess] = useState(''); // Feedback for copy button

    // --- Derived State ---
    const myPlayerId = socket?.id;
    const myPlayerData = (gameState && gameState.players)
        ? gameState.players.find(p => p.id === myPlayerId)
        : null;
    const isMyTurn = myPlayerData?.isTurn || false;
    const isGameOver = gameState?.status === 'finished';
    // Define canInteract early
    const canInteract = isConnected && isInGame && isMyTurn && !isGameOver;

    // Indices of rack tiles currently placed on the board temporarily
    const temporarilyPlacedRackIndices = temporaryPlacements
        .map(p => p.tile.originData?.type === 'rack' ? p.tile.originData.index : -1)
        .filter(index => index !== -1);


    // --- Socket Connection & Event Handling Effect ---
    useEffect(() => {
        const currentSocket = socketService.getSocketInstance();
        setSocket(currentSocket);

        // --- Define Event Handlers ---
        const handleConnect = () => { setIsConnected(true); setLastGameError(''); console.log("handleConnect triggered"); };
        const handleDisconnect = () => { setIsConnected(false); setIsInGame(false); setGameState(null); setMyRack([]); setTemporaryPlacements([]); setGameIdToShare(null); setJoinError('Disconnected. Please refresh.'); console.log("handleDisconnect triggered");};

        const handleGameUpdate = (newGameState) => {
            console.log("App received gameUpdate:", newGameState);
             // Basic validation of received state
             if (!newGameState || !newGameState.gameId || !Array.isArray(newGameState.players)) {
                 console.error("Received invalid gameUpdate structure:", newGameState);
                 setLastGameError("Received invalid data from server.");
                 return;
             }
            setGameState(newGameState);
             // Update local rack ONLY if this update payload contains it specifically for us (e.g., after exchange)
            if (newGameState.myRack && Array.isArray(newGameState.myRack)) {
                 setMyRack(newGameState.myRack);
                 console.log("App: Updated local rack from specific gameUpdate.");
            }
            // Clear temps/selection if not our turn or game not playing
            const newMyPlayer = newGameState.players.find(p => p.id === myPlayerId);
            if (!newMyPlayer?.isTurn || newGameState.status !== 'playing') {
                 setTemporaryPlacements([]);
                 setSelectedTilesForExchange([]);
            }
            setLastGameError(''); // Clear previous errors on successful update
            if (newGameState.gameId) setGameIdToShare(newGameState.gameId);
        };

        const handleGameJoined = (playerSpecificState) => {
             console.log("App received gameJoined:", playerSpecificState);
             // Validate received state structure
             if (playerSpecificState && Array.isArray(playerSpecificState.players) && Array.isArray(playerSpecificState.myRack) && playerSpecificState.gameId) {
                 setGameState(playerSpecificState);
                 setMyRack(playerSpecificState.myRack); // Set initial rack
                 setIsInGame(true);
                 setTemporaryPlacements([]);
                 setSelectedTilesForExchange([]); // Clear selections
                 setJoinError('');
                 setLastGameError('');
                 setGameIdToShare(playerSpecificState.gameId); // Set share ID
             } else {
                 console.error("Received invalid state from gameJoined:", playerSpecificState);
                 setJoinError("Received invalid game data from server.");
                 setIsInGame(false); // Ensure we don't proceed if join data is bad
             }
         };

        const handleNewMessage = (message) => { setMessages(prev => [...prev, message]); };
        const handleInvalidMove = (error) => { console.warn("Invalid Move:", error.message); setLastGameError(`Invalid Move: ${error.message || 'Unknown reason'}`); setTemporaryPlacements([]); }; // Clear temps on invalid move
        const handleError = (error) => { console.error("Game Error:", error.message); setLastGameError(`Error: ${error.message || 'An unknown error occurred.'}`); }; // Display general errors too
        const handlePlayerLeft = (leftPlayerInfo) => { // { playerId, username }
             console.log(`Player ${leftPlayerInfo.username || leftPlayerInfo.playerId} left the game.`);
             setMessages(prev => [...prev, { system: true, text: `Player ${leftPlayerInfo.username || leftPlayerInfo.playerId.substring(0,6)} has left.`}]);
             // Subsequent gameUpdate will refresh player list/turn etc.
        };
         const handleGameOver = (gameOverData) => { // { finalScores, reason }
             console.log(`Game Over! Reason: ${gameOverData.reason}`, gameOverData.finalScores);
             setGameState(prev => prev ? { ...prev, status: 'finished', finalScores: gameOverData.finalScores } : null);
             setTemporaryPlacements([]);
             setSelectedTilesForExchange([]);
             // Optionally clear gameIdToShare here? Or leave it for reference?
        };

        // --- Setup Listeners ---
        if (currentSocket) {
            console.log("useEffect: Setting up listeners for socket:", currentSocket.id);
            // Remove potential old listeners before adding new ones
            currentSocket.off('connect', handleConnect); currentSocket.on('connect', handleConnect);
            currentSocket.off('disconnect', handleDisconnect); currentSocket.on('disconnect', handleDisconnect);
            socketService.removeListener('gameUpdate', handleGameUpdate); socketService.onGameUpdate(handleGameUpdate);
            socketService.removeListener('gameJoined', handleGameJoined); socketService.onGameJoined(handleGameJoined);
            socketService.removeListener('newChatMessage', handleNewMessage); socketService.onNewChatMessage(handleNewMessage);
            socketService.removeListener('invalidMove', handleInvalidMove); socketService.onInvalidMove(handleInvalidMove);
            socketService.removeListener('gameError', handleError); socketService.onError(handleError);
            socketService.removeListener('playerLeft', handlePlayerLeft); socketService.onPlayerLeft(handlePlayerLeft);
            socketService.removeListener('gameOver', handleGameOver); socketService.onGameOver(handleGameOver);

            if (currentSocket.connected) { console.log("useEffect: Socket already connected."); handleConnect(); }
            else { console.log("useEffect: Socket not connected, attempting connection..."); socketService.connect(); }
        } else { console.log("useEffect: No socket instance yet."); }

        // --- Cleanup Listeners ---
        return () => {
             console.log("useEffect: Cleaning up listeners...");
             if (currentSocket) {
                 currentSocket.off('connect', handleConnect);
                 currentSocket.off('disconnect', handleDisconnect);
                 socketService.removeListener('gameUpdate', handleGameUpdate);
                 socketService.removeListener('gameJoined', handleGameJoined);
                 socketService.removeListener('newChatMessage', handleNewMessage);
                 socketService.removeListener('invalidMove', handleInvalidMove);
                 socketService.removeListener('onError', handleError);
                 socketService.removeListener('playerLeft', handlePlayerLeft);
                 socketService.removeListener('gameOver', handleGameOver);
             }
        };
    // Added gameState dependency for gameIdToShare update within effect
    }, [socket, myPlayerId, gameState]);


    // --- Drag and Drop Handlers ---
    const handleTileDropOnBoard = useCallback((tileData, targetRow, targetCol) => {
        if (!canInteract) return;
        if (temporaryPlacements.some(p => p.row === targetRow && p.col === targetCol)) { console.warn("Target square already has a temporary tile."); return; }
        // Clear exchange selection if player starts placing tiles
        if (selectedTilesForExchange.length > 0) setSelectedTilesForExchange([]);
        setTemporaryPlacements(prevPlacements => {
            const existingPlacementIndex = prevPlacements.findIndex(p => p.tile.id === tileData.id);
            let updatedPlacements = [...prevPlacements];
            if (existingPlacementIndex > -1) { updatedPlacements.splice(existingPlacementIndex, 1); }
            // Determine isBlank based on original tile from rack if possible
            let isBlank = false;
             if (tileData.originData?.type === 'rack') { isBlank = myRack[tileData.originData.index]?.letter === 'BLANK'; }
             else { isBlank = tileData.value === 0; } // Fallback
            updatedPlacements.push({ row: targetRow, col: targetCol, tile: {...tileData, isBlank} });
            return updatedPlacements;
        });
    }, [canInteract, temporaryPlacements, selectedTilesForExchange.length, myRack]); // Added myRack dependency

    const handleTileDropOnRack = useCallback((tileData) => {
         if (!canInteract) return;
         if (tileData.originData?.type === 'board') {
              setTemporaryPlacements(prevPlacements =>
                  prevPlacements.filter(p => !(p.row === tileData.originData.row && p.col === tileData.originData.col))
              );
         }
    }, [canInteract]);


    // --- Action Handlers ---
    const handleJoinGame = useCallback((e) => {
        console.time("handleJoinGame Execution"); console.log("handleJoinGame start");
        if (e) e.preventDefault(); setJoinError('');
        if (!username.trim()) { setJoinError("Please enter a username."); console.timeEnd("handleJoinGame Execution"); return; }
        if (!socket || !isConnected) { setJoinError("Not connected to server."); console.timeEnd("handleJoinGame Execution"); return; }
        const joinData = { username: username.trim() };
        const targetGameId = joinGameId.trim();
        if (targetGameId) { joinData.gameId = targetGameId; console.log(`Attempting to join specific game: ${targetGameId}`); }
        else { console.log("Attempting to find or create game..."); }
        socketService.joinGame(joinData);
        console.log("Called socketService.joinGame with data:", joinData); console.log("handleJoinGame end");
        console.timeEnd("handleJoinGame Execution");
    }, [username, joinGameId, socket, isConnected]);

    const handlePlayMove = useCallback(() => {
        if (!canInteract || temporaryPlacements.length === 0) { setLastGameError("Cannot play: Not your turn or no tiles placed."); return; }
        // Basic line validation
        let minRow = 15, maxRow = -1, minCol = 15, maxCol = -1;
        temporaryPlacements.forEach(p => { minRow = Math.min(minRow, p.row); maxRow = Math.max(maxRow, p.row); minCol = Math.min(minCol, p.col); maxCol = Math.max(maxCol, p.col); });
        if (minRow !== maxRow && minCol !== maxCol) { setLastGameError("Tiles must be placed in a single row or column."); return; }
        // Prepare move data, including isBlank info based on originData/rack check
        const moveData = temporaryPlacements.map(p => {
             let isBlank = false;
             if (p.tile.originData?.type === 'rack') { isBlank = myRack[p.tile.originData.index]?.letter === 'BLANK'; }
             else { isBlank = p.tile.value === 0; }
             return { letter: p.tile.letter.toUpperCase(), value: p.tile.value, isBlank: isBlank, row: p.row, col: p.col };
        });
        console.log("Submitting move:", moveData);
        if (gameState?.gameId) { setLastGameError(''); socketService.placeTiles({ gameId: gameState.gameId, move: moveData }); }
        else { console.error("Cannot play move, no game ID found."); setLastGameError("Error: Could not determine Game ID."); }
    }, [canInteract, temporaryPlacements, gameState, myRack]);

    const handlePassTurn = useCallback(() => {
        if (!canInteract) { setLastGameError("Cannot pass: Not your turn."); return; }
        if (gameState?.gameId) { setLastGameError(''); socketService.passTurn(gameState.gameId); setTemporaryPlacements([]); setSelectedTilesForExchange([]); }
    }, [canInteract, gameState]);

    const handleExchangeTiles = useCallback(() => {
         if (!canInteract) { setLastGameError("Cannot exchange: Not your turn."); return; }
         if (selectedTilesForExchange.length === 0) { setLastGameError("Select tiles from your rack to exchange first."); return; }
         // Map selected *indices* back to tile *letters* from the current rack state
         const lettersToExchange = selectedTilesForExchange
             .map(index => myRack[index]?.letter) // Get the letter using the stored index
             .filter(Boolean); // Filter out any potential undefined/null if index somehow invalid
         // Double-check if mapping was successful
         if (lettersToExchange.length !== selectedTilesForExchange.length) {
             console.error("Error: Mismatch finding letters for exchange indices.", { selectedIndices: selectedTilesForExchange, currentRack: myRack });
             setLastGameError("Error preparing tiles for exchange. Please try deselecting and reselecting.");
             return;
         }
         if (gameState?.gameId) {
             setLastGameError(''); console.log("Requesting exchange for tile letters:", lettersToExchange);
             // ---> Emit the event with the array of LETTERS <---
             socketService.exchangeTiles(gameState.gameId, lettersToExchange);
             setTemporaryPlacements([]); // Clear any temps
             setSelectedTilesForExchange([]); // Clear the selection state immediately
        } else {
             console.error("Cannot exchange tiles, no game ID found.");
             setLastGameError("Error: Could not determine Game ID for exchange.");
        }
    }, [canInteract, gameState, selectedTilesForExchange, myRack]); // Depends on selection and rack

    const handleSendMessage = useCallback((message) => {
         if (gameState?.gameId && message.trim()) { socketService.sendChatMessage(gameState.gameId, message.trim()); }
    }, [gameState]);

    // --- Handler for Tile Selection for Exchange ---
    const handleTileSelectForExchange = useCallback((rackIndex) => {
        if (!canInteract) return; // Can only select on your turn
        // Cannot select tiles for exchange if any tiles are already placed on the board
        if (temporaryPlacements.length > 0) {
             setLastGameError("Clear board placements before selecting tiles for exchange.");
             return;
        }
        // Update the selection state (array of indices)
        setSelectedTilesForExchange(prevSelectedIndices => {
            if (prevSelectedIndices.includes(rackIndex)) {
                // If already selected, remove the index
                return prevSelectedIndices.filter(index => index !== rackIndex);
            } else {
                // If not selected, add the index
                return [...prevSelectedIndices, rackIndex];
            }
        });
        setLastGameError(''); // Clear any previous errors when selection changes
    }, [canInteract, temporaryPlacements.length]); // Depends on interaction state and board state


    // --- Helper for Copying Game ID ---
    const copyGameIdToClipboard = useCallback(() => {
        if (!gameIdToShare) return;
        navigator.clipboard.writeText(gameIdToShare).then(() => { setCopySuccess('Copied!'); setTimeout(() => setCopySuccess(''), 2000); })
        .catch(err => { console.error('Failed to copy game ID: ', err); setCopySuccess('Failed!'); setTimeout(() => setCopySuccess(''), 2000); });
    }, [gameIdToShare]);


    // --- Rendering ---
    return (
        <div className="App">
            <h1>Real-time Scrabble</h1>
            <p>Connection Status: {isConnected ? <span style={{color: 'green', fontWeight: 'bold'}}>Connected</span> : <span style={{color: 'red', fontWeight: 'bold'}}>Disconnected</span>}</p>

            {/* Show Join Form OR Game Area OR Loading Indicator */}
            {!isInGame && !isGameOver ? (
                 <div className="join-form-container">
                    <form onSubmit={handleJoinGame} className="join-form">
                         <div className="form-group">
                            <label htmlFor="username">Username:</label>
                            <input id="username" type="text" value={username} onChange={(e) => { setUsername(e.target.value); setJoinError(''); }} placeholder="Enter Username" maxLength="16" required />
                         </div>
                         <div className="form-group">
                            <label htmlFor="gameIdInput">Game ID (Optional):</label>
                            <input id="gameIdInput" type="text" value={joinGameId} onChange={(e) => setJoinGameId(e.target.value)} placeholder="Enter Game ID to join" />
                         </div>
                         <button type="submit" disabled={!isConnected} onClick={() => console.log("DEBUG: Join Button Clicked!")} >
                             {joinGameId.trim() ? 'Join Specific Game' : 'Join / Create Game'}
                         </button>
                         {joinError && <p className="error-message join-error">{joinError}</p>}
                    </form>
                 </div>
            ) : gameState ? ( // Only render game area if gameState exists
                 <div className="game-area">
                    {/* Display Game Over screen as an overlay or section */}
                    {isGameOver && <GameOverDisplay finalScores={gameState.finalScores} />}

                    <div className="left-panel">
                         {/* Share Section appears only when in game and not over */}
                         {gameIdToShare && !isGameOver && (
                             <div className="share-game-section">
                                 <h4>Invite Player</h4>
                                 <p>Share this Game ID:</p>
                                 <div className="game-id-display">
                                     <code>{gameIdToShare}</code>
                                     <button onClick={copyGameIdToClipboard} title="Copy Game ID"> Copy ID </button>
                                 </div>
                                 {copySuccess && <span className="copy-feedback">{copySuccess}</span>}
                             </div>
                         )}
                         <Scoreboard players={gameState.players || []} currentPlayerId={gameState.currentTurnPlayerId}/>
                         <GameInfo status={gameState.status} currentPlayerId={gameState.currentTurnPlayerId} players={gameState.players || []} tilesRemaining={gameState.tilesRemaining ?? '?'}/>
                         {/* Display non-fatal game errors */}
                         {lastGameError && <p className="error-message">{lastGameError}</p>}
                         <Chat messages={messages} onSendMessage={handleSendMessage} playersInfo={gameState.players || []} myPlayerId={myPlayerId}/>
                    </div>

                    <div className="main-panel">
                         {/* Board Component */}
                         <Board
                            boardData={gameState.board}
                            temporaryPlacements={temporaryPlacements}
                            onTileDrop={handleTileDropOnBoard}
                            canInteract={canInteract}
                        />
                         {/* Rack Component */}
                         <Rack
                            tiles={myRack || []}
                            temporarilyPlacedIndices={temporarilyPlacedRackIndices}
                            onRackDrop={handleTileDropOnRack}
                            canInteract={canInteract}
                            selectedForExchange={selectedTilesForExchange} // Pass selected indices
                            onTileSelect={handleTileSelectForExchange}    // Pass selection handler
                         />
                         {/* Controls Component */}
                         <Controls
                            onPlay={handlePlayMove}
                            onPass={handlePassTurn}
                            onExchange={handleExchangeTiles}
                            disabled={!canInteract} // General disable based on turn/connection/gameover
                            playDisabled={temporaryPlacements.length === 0} // Disable Play if nothing placed
                            exchangeDisabled={selectedTilesForExchange.length === 0} // Disable Exchange if nothing selected
                        />
                    </div>
                 </div>
            ) : (
                 // Show loading indicator while waiting for gameJoined after connection
                 isConnected ? <p>Attempting to join game...</p> : <p>Connecting...</p>
            ) }
        </div>
    );
}

export default App;