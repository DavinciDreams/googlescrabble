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
import GameOverDisplay from './components/GameOverDisplay/GameOverDisplay';
import { useGameManager } from './hooks/useGameManager'; // Import the custom hook

function App() {
    // --- Connection & Join UI State (Managed by App) ---
    const [isConnected, setIsConnected] = useState(false);
    const [socket, setSocket] = useState(null);
    const [username, setUsername] = useState('');
    const [joinGameId, setJoinGameId] = useState(''); // Optional Game ID input
    const [joinError, setJoinError] = useState('');   // Errors specific to joining

    // --- Temporary Gameplay UI State (Managed by App) ---
    const [temporaryPlacements, setTemporaryPlacements] = useState([]);
    const [selectedTilesForExchange, setSelectedTilesForExchange] = useState([]);
    const [copySuccess, setCopySuccess] = useState('');

    // --- Get Core Game State & Listeners via Custom Hook ---
    const myPlayerId = socket?.id; // Get player ID from socket state
    const {
        gameState,            // The main state object from server { board, players, status, etc. }
        myRack,               // Player's specific rack [{ letter, value }]
        messages,             // Array of chat messages
        isInGame,             // Is the player successfully in a game?
        isGameOver,           // Is the current game finished?
        currentTurnPlayerId,  // ID of the player whose turn it is
        gameIdToShare,        // The current game ID for sharing
        lastGameError,        // Last non-fatal error received
        setLastGameError      // Function to clear non-fatal errors
    } = useGameManager(socket, myPlayerId); // Pass socket and playerId to the hook

    // --- Derived State (Calculated from other state) ---
    const myPlayerData = (gameState && gameState.players)
        ? gameState.players.find(p => p.id === myPlayerId)
        : null;
    const isMyTurn = myPlayerData?.isTurn || false;
    // Can player interact with board/rack/controls?
    const canInteract = isConnected && isInGame && isMyTurn && !isGameOver;
    // Indices of rack tiles currently placed temporarily on the board
    const temporarilyPlacedRackIndices = temporaryPlacements
        .map(p => p.tile.originData?.type === 'rack' ? p.tile.originData.index : -1)
        .filter(index => index !== -1);

    // --- Effect for Basic Connection Management (Simplified in App) ---
    useEffect(() => {
        const currentSocket = socketService.getSocketInstance();
        setSocket(currentSocket);

        const handleConnect = () => { setIsConnected(true); setJoinError(''); }; // Clear join error on connect
        const handleDisconnect = () => { setIsConnected(false); setJoinError('Disconnected.'); /* Let useGameManager handle resetting game state */ };

        if (currentSocket) {
            currentSocket.off('connect', handleConnect); currentSocket.on('connect', handleConnect);
            currentSocket.off('disconnect', handleDisconnect); currentSocket.on('disconnect', handleDisconnect);
            if (currentSocket.connected) handleConnect();
            else socketService.connect();
        }
        // Cleanup basic listeners
        return () => {
            if (currentSocket) {
                currentSocket.off('connect', handleConnect);
                currentSocket.off('disconnect', handleDisconnect);
            }
        };
    }, []); // Run only once on mount to establish connection

    // --- Action Handlers (Remain in App, use socketService directly) ---

    const handleJoinGame = useCallback((e) => {
        if (e) e.preventDefault();
        setJoinError(''); // Clear previous join errors
        if (!username.trim()) { setJoinError("Please enter a username."); return; }
        if (!socket || !isConnected) { setJoinError("Not connected to server."); return; }

        const joinData = { username: username.trim() };
        const targetGameId = joinGameId.trim();
        if (targetGameId) { joinData.gameId = targetGameId; }

        console.log("App: Emitting joinGame", joinData);
        socketService.joinGame(joinData); // Emit event via service
        // Let useGameManager handle the 'gameJoined' or 'gameError' response
    }, [username, joinGameId, socket, isConnected]);

    const handleTileDropOnBoard = useCallback((tileData, targetRow, targetCol) => {
        if (!canInteract) return;
        if (temporaryPlacements.some(p => p.row === targetRow && p.col === targetCol)) { return; }
        if (selectedTilesForExchange.length > 0) setSelectedTilesForExchange([]); // Clear exchange selection
        setTemporaryPlacements(prev => { /* Add placement, remove if from board origin */
             let updated = [...prev];
             if (tileData.originData?.type === 'board') { updated = updated.filter(p => !(p.row === tileData.originData.row && p.col === tileData.originData.col)); }
             const isBlank = tileData.originData?.type === 'rack' && myRack[tileData.originData.index]?.letter === 'BLANK';
             updated.push({ row: targetRow, col: targetCol, tile: {...tileData, isBlank} });
             return updated;
        });
    }, [canInteract, temporaryPlacements, selectedTilesForExchange.length, myRack]);

    const handleTileDropOnRack = useCallback((tileData) => {
         if (!canInteract) return;
         if (tileData.originData?.type === 'board') {
              setTemporaryPlacements(prev => prev.filter(p => !(p.row === tileData.originData.row && p.col === tileData.originData.col)));
         }
    }, [canInteract]);

    const handlePlayMove = useCallback(() => {
        if (!canInteract || temporaryPlacements.length === 0) { setLastGameError("Cannot play."); return; }
        // Basic line validation...
        let minR = 15, maxR = -1, minC = 15, maxC = -1; temporaryPlacements.forEach(p => { minR=Math.min(minR,p.row); maxR=Math.max(maxR,p.row); minC=Math.min(minC,p.col); maxC=Math.max(maxC,p.col); });
        if (minR !== maxR && minC !== maxC) { setLastGameError("Tiles must be in line."); return; }
        // Prepare move data...
        const moveData = temporaryPlacements.map(p => {
             let isBlank = (p.tile?.originData?.type === 'rack' && myRack[p.tile.originData.index]?.letter === 'BLANK') || p.tile?.value === 0;
             return { letter: p.tile?.letter?.toUpperCase() || '', value: p.tile?.value ?? 0, isBlank, row: p.row, col: p.col };
        });
        console.log("App: Emitting placeTiles", moveData);
        if (gameState?.gameId) { setLastGameError(''); socketService.placeTiles({ gameId: gameState.gameId, move: moveData }); }
        else { setLastGameError("Error: No Game ID."); }
        // Temp placements cleared by useGameManager via gameUpdate listener
    }, [canInteract, temporaryPlacements, gameState, myRack, setLastGameError]);

    const handlePassTurn = useCallback(() => {
        if (!canInteract) { setLastGameError("Cannot pass."); return; }
        if (gameState?.gameId) { setLastGameError(''); socketService.passTurn(gameState.gameId); setTemporaryPlacements([]); setSelectedTilesForExchange([]); }
    }, [canInteract, gameState, setLastGameError]);

    const handleExchangeTiles = useCallback(() => {
         if (!canInteract) { setLastGameError("Cannot exchange."); return; }
         if (selectedTilesForExchange.length === 0) { setLastGameError("Select tiles first."); return; }
         const lettersToExchange = selectedTilesForExchange.map(index => myRack[index]?.letter).filter(Boolean);
         if (lettersToExchange.length !== selectedTilesForExchange.length) { setLastGameError("Error preparing exchange."); return; }
         if (gameState?.gameId) {
             setLastGameError(''); console.log("App: Emitting exchangeTiles", lettersToExchange);
             socketService.exchangeTiles(gameState.gameId, lettersToExchange);
             setTemporaryPlacements([]); setSelectedTilesForExchange([]);
        }
    }, [canInteract, gameState, selectedTilesForExchange, myRack, setLastGameError]);

    const handleSendMessage = useCallback((message) => {
         if (gameState?.gameId && message.trim()) { socketService.sendChatMessage(gameState.gameId, message.trim()); }
    }, [gameState]);

    const handleTileSelectForExchange = useCallback((rackIndex) => {
        if (!canInteract) return;
        if (temporaryPlacements.length > 0) { setLastGameError("Clear board first."); return; }
        setSelectedTilesForExchange(prev => { if (prev.includes(rackIndex)) { return prev.filter(i => i !== rackIndex); } else { return [...prev, rackIndex]; } });
        setLastGameError('');
    }, [canInteract, temporaryPlacements.length, setLastGameError]);

    const copyGameIdToClipboard = useCallback(() => { /* ... same logic using setCopySuccess ... */ }, [gameIdToShare]);


    // --- Rendering Logic ---
    return (
        <div className="App">
            <h1>Real-time Scrabble</h1>
            <p>Connection Status: {isConnected ? <span style={{color: 'green', fontWeight: 'bold'}}>Connected</span> : <span style={{color: 'red', fontWeight: 'bold'}}>Disconnected</span>}</p>

            {/* Show Join Form if NOT connected or NOT in a game yet */}
            {!isInGame && !isGameOver ? (
                 <div className="join-form-container">
                    <form onSubmit={handleJoinGame} className="join-form">
                         <div className="form-group">
                            <label htmlFor="username">Username:</label>
                            <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter Username" maxLength="16" required />
                         </div>
                         <div className="form-group">
                            <label htmlFor="gameIdInput">Game ID (Optional):</label>
                            <input id="gameIdInput" type="text" value={joinGameId} onChange={(e) => setJoinGameId(e.target.value)} placeholder="Enter Game ID to join" />
                         </div>
                         {/* Button now just checks connection, join logic handles errors */}
                         <button type="submit" disabled={!isConnected}>
                             {joinGameId.trim() ? 'Join Specific Game' : 'Join / Create Game'}
                         </button>
                         {/* Display JOIN errors here */}
                         {joinError && <p className="error-message join-error">{joinError}</p>}
                    </form>
                 </div>
            /* Show Game Area if IN a game and gameState is loaded */
            ) : isInGame && gameState ? (
                 <div className="game-area">
                    {/* Show Game Over overlay if game is finished */}
                    {isGameOver && <GameOverDisplay finalScores={gameState.finalScores} />}

                    <div className="left-panel">
                         {/* Share Section */}
                         {gameIdToShare && !isGameOver && ( <div className="share-game-section"> <h4>Invite Player</h4> <p>Share ID:</p> <div className="game-id-display"> <code>{gameIdToShare}</code> <button onClick={copyGameIdToClipboard} title="Copy">Copy</button> </div> {copySuccess && <span className="copy-feedback">{copySuccess}</span>} </div> )}
                         {/* Other Info Components */}
                         <Scoreboard players={gameState.players || []} currentPlayerId={currentTurnPlayerId}/>
                         <GameInfo status={gameState.status} currentPlayerId={currentTurnPlayerId} players={gameState.players || []} tilesRemaining={gameState.tilesRemaining ?? '?'}/>
                         {/* Display general GAME errors here */}
                         {lastGameError && <p className="error-message">{lastGameError}</p>}
                         <Chat messages={messages} onSendMessage={handleSendMessage} playersInfo={gameState.players || []} myPlayerId={myPlayerId}/>
                    </div>

                    <div className="main-panel">
                          <Board boardData={gameState.board} temporaryPlacements={temporaryPlacements} onTileDrop={handleTileDropOnBoard} canInteract={canInteract}/>
                          <Rack tiles={myRack || []} temporarilyPlacedIndices={temporarilyPlacedRackIndices} onRackDrop={handleTileDropOnRack} canInteract={canInteract} selectedForExchange={selectedTilesForExchange} onTileSelect={handleTileSelectForExchange} />
                          <Controls onPlay={handlePlayMove} onPass={handlePassTurn} onExchange={handleExchangeTiles} disabled={!canInteract} playDisabled={temporaryPlacements.length === 0} exchangeDisabled={selectedTilesForExchange.length === 0} />
                    </div>
                 </div>
            /* Show Loading indicator if connected but not yet in game (waiting for gameJoined) */
            ) : isConnected ? (
                 <p>Waiting for game data...</p>
            /* Fallback if not connected and not showing join form (shouldn't happen often) */
            ) : (
                 <p>Connecting...</p>
            ) }
        </div>
    );
}

export default App;