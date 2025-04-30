// frontend/src/App.js
import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import Board from './components/Board/Board';
import Rack from './components/Rack/Rack';
import Controls from './components/Controls/Controls';
import Scoreboard from './components/Scoreboard/Scoreboard';
import GameInfo from './components/GameInfo/GameInfo';
import Chat from './components/Chat/Chat';
import socketService from './services/socketService';
import GameOverDisplay from './components/GameOverDisplay/GameOverDisplay'; // Ensure this component exists and is styled

function App() {
    // --- State Variables ---
    const [isConnected, setIsConnected] = useState(false);
    const [gameState, setGameState] = useState(null); // Holds the full game state from server
    const [myRack, setMyRack] = useState([]); // Holds this player's specific rack [{letter, value}]
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
    const canInteract = isConnected && isInGame && isMyTurn && !isGameOver; // Can player perform game actions?

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
             // Update local rack ONLY if this update payload contains it specifically for us
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
                 setSelectedTilesForExchange([]);
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
        const handleError = (error) => { console.error("Game Error:", error.message); setLastGameError(`Error: ${error.message || 'An unknown error occurred.'}`); };
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
            // Remove potential old listeners before adding new ones (safety measure)
            currentSocket.off('connect', handleConnect); currentSocket.on('connect', handleConnect);
            currentSocket.off('disconnect', handleDisconnect); currentSocket.on('disconnect', handleDisconnect);
            socketService.removeListener('gameUpdate', handleGameUpdate); socketService.onGameUpdate(handleGameUpdate); // Use service wrappers for consistency
            socketService.removeListener('gameJoined', handleGameJoined); socketService.onGameJoined(handleGameJoined);
            socketService.removeListener('newChatMessage', handleNewMessage); socketService.onNewChatMessage(handleNewMessage);
            socketService.removeListener('invalidMove', handleInvalidMove); socketService.onInvalidMove(handleInvalidMove);
            socketService.removeListener('gameError', handleError); socketService.onError(handleError); // Assuming service uses 'gameError'
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
                 // Use service remove methods to detach callbacks added via the service
                 socketService.removeListener('gameUpdate', handleGameUpdate);
                 socketService.removeListener('gameJoined', handleGameJoined);
                 socketService.removeListener('newChatMessage', handleNewMessage);
                 socketService.removeListener('invalidMove', handleInvalidMove);
                 socketService.removeListener('onError', handleError);
                 socketService.removeListener('playerLeft', handlePlayerLeft);
                 socketService.removeListener('gameOver', handleGameOver);
             }
        };
    // Dependencies for the effect: runs on mount and if socket instance or player ID changes
    }, [socket, myPlayerId]); // gameState removed as dependency to prevent loops, necessary updates happen via handlers


    // --- Drag and Drop Handlers ---
    const handleTileDropOnBoard = useCallback((tileData, targetRow, targetCol) => {
        if (!canInteract) return; // Use derived state check
        if (temporaryPlacements.some(p => p.row === targetRow && p.col === targetCol)) { console.warn("Target square already has a temporary tile."); return; }
        // Clear exchange selection if player starts placing tiles
        if (selectedTilesForExchange.length > 0) setSelectedTilesForExchange([]);
        setTemporaryPlacements(prevPlacements => {
            const existingPlacementIndex = prevPlacements.findIndex(p => p.tile.id === tileData.id);
            let updatedPlacements = [...prevPlacements];
            if (existingPlacementIndex > -1) { updatedPlacements.splice(existingPlacementIndex, 1); }
            // Add isBlank info if dragging a blank from rack
            const isBlank = tileData.originData?.type === 'rack' && myRack[tileData.originData.index]?.letter === 'BLANK';
            updatedPlacements.push({ row: targetRow, col: targetCol, tile: {...tileData, isBlank} }); // Add isBlank hint
            return updatedPlacements;
        });
    }, [canInteract, temporaryPlacements, selectedTilesForExchange.length, myRack]); // Added dependencies

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
             else { isBlank = p.tile.value === 0; } // Fallback check if dragged from board (less reliable)
             return { letter: p.tile.letter.toUpperCase(), value: p.tile.value, isBlank: isBlank, row: p.row, col: p.col };
        });
        console.log("Submitting move:", moveData);
        if (gameState?.gameId) { setLastGameError(''); socketService.placeTiles({ gameId: gameState.gameId, move: moveData }); }
        else { console.error("Cannot play move, no game ID found."); setLastGameError("Error: Could not determine Game ID."); }
    }, [canInteract, temporaryPlacements, gameState, myRack]); // Added myRack

    const handlePassTurn = useCallback(() => {
        if (!canInteract) { setLastGameError("Cannot pass: Not your turn."); return; }
        if (gameState?.gameId) { setLastGameError(''); socketService.passTurn(gameState.gameId); setTemporaryPlacements([]); setSelectedTilesForExchange([]); }
    }, [canInteract, gameState]);

    const handleExchangeTiles = useCallback(() => {
         if (!canInteract) { setLastGameError("Cannot exchange: Not your turn."); return; }
         if (selectedTilesForExchange.length === 0) { setLastGameError("Select tiles from your rack to exchange first."); return; }
         // Map selected indices back to tile letters
         const lettersToExchange = selectedTilesForExchange.map(index => myRack[index]?.letter).filter(Boolean);
         if (lettersToExchange.length !== selectedTilesForExchange.length) { console.error("Mismatch finding letters for exchange indices"); setLastGameError("Error preparing tiles for exchange."); return; }
         if (gameState?.gameId) {
             setLastGameError(''); console.log("Requesting exchange for tiles:", lettersToExchange);
             socketService.exchangeTiles(gameState.gameId, lettersToExchange);
             setTemporaryPlacements([]); setSelectedTilesForExchange([]);
        }
    }, [canInteract, gameState, selectedTilesForExchange, myRack]); // Added myRack

    const handleSendMessage = useCallback((message) => {
         if (gameState?.gameId && message.trim()) { socketService.sendChatMessage(gameState.gameId, message.trim()); }
    }, [gameState]);

    const handleTileSelectForExchange = useCallback((rackIndex) => {
        if (!canInteract) return;
        if (temporaryPlacements.length > 0) { setLastGameError("Clear board placements before selecting tiles for exchange."); return; }
        setSelectedTilesForExchange(prevSelectedIndices => {
            if (prevSelectedIndices.includes(rackIndex)) return prevSelectedIndices.filter(index => index !== rackIndex);
            else return [...prevSelectedIndices, rackIndex];
        });
        setLastGameError('');
    }, [canInteract, temporaryPlacements.length]);

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
            <p>Connection Status: {isConnected ? <span style={{color: 'green'}}>Connected</span> : <span style={{color: 'red'}}>Disconnected</span>}</p>

            {!isInGame && !isGameOver ? (
                 <div className="join-form-container">
                    <form onSubmit={handleJoinGame} className="join-form">
                         <div className="form-group"> <label htmlFor="username">Username:</label> <input id="username" type="text" value={username} onChange={(e) => { setUsername(e.target.value); setJoinError(''); }} placeholder="Enter Username" maxLength="16" required /> </div>
                         <div className="form-group"> <label htmlFor="gameIdInput">Game ID (Optional):</label> <input id="gameIdInput" type="text" value={joinGameId} onChange={(e) => setJoinGameId(e.target.value)} placeholder="Enter Game ID to join" /> </div>
                         <button type="submit" disabled={!isConnected} > {joinGameId.trim() ? 'Join Specific Game' : 'Join / Create Game'} </button>
                         {joinError && <p className="error-message join-error">{joinError}</p>}
                    </form>
                 </div>
            ) : gameState ? (
                 <div className="game-area">
                    {isGameOver && <GameOverDisplay finalScores={gameState.finalScores} />}
                     <div className="left-panel">
                         {gameIdToShare && !isGameOver && (
                             <div className="share-game-section">
                                 <h4>Invite Player</h4> <p>Share this Game ID:</p>
                                 <div className="game-id-display"> <code>{gameIdToShare}</code> <button onClick={copyGameIdToClipboard} title="Copy Game ID"> Copy ID </button> </div>
                                 {copySuccess && <span className="copy-feedback">{copySuccess}</span>}
                             </div>
                         )}
                         <Scoreboard players={gameState.players || []} currentPlayerId={gameState.currentTurnPlayerId}/>
                         <GameInfo status={gameState.status} currentPlayerId={gameState.currentTurnPlayerId} players={gameState.players || []} tilesRemaining={gameState.tilesRemaining ?? '?'}/>
                         {lastGameError && <p className="error-message">{lastGameError}</p>}
                         <Chat messages={messages} onSendMessage={handleSendMessage} playersInfo={gameState.players || []} myPlayerId={myPlayerId}/>
                     </div>
                     <div className="main-panel">
                          <Board boardData={gameState.board} temporaryPlacements={temporaryPlacements} onTileDrop={handleTileDropOnBoard} canInteract={canInteract}/>
                         <Rack
                            tiles={myRack || []}
                            temporarilyPlacedIndices={temporarilyPlacedRackIndices}
                            onRackDrop={handleTileDropOnRack}
                            canInteract={canInteract}
                            selectedForExchange={selectedTilesForExchange}
                            onTileSelect={handleTileSelectForExchange}
                         />
                         <Controls
                            onPlay={handlePlayMove}
                            onPass={handlePassTurn}
                            onExchange={handleExchangeTiles}
                            disabled={!canInteract} // General disable if not your turn/connected/game over
                            playDisabled={temporaryPlacements.length === 0} // Disable Play if nothing placed
                            exchangeDisabled={selectedTilesForExchange.length === 0} // Disable Exchange if nothing selected
                        />
                    </div>
                 </div>
            ) : ( <p>Loading game data...</p> ) }
        </div>
    );
}

export default App;