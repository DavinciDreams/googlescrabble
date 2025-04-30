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

function App() {
    // --- State Variables ---
    const [isConnected, setIsConnected] = useState(false);
    const [gameState, setGameState] = useState(null);
    const [myRack, setMyRack] = useState([]); // Player's current hand
    const [messages, setMessages] = useState([]);
    const [username, setUsername] = useState('');
    const [joinGameId, setJoinGameId] = useState('');
    const [isInGame, setIsInGame] = useState(false);
    const [socket, setSocket] = useState(null);
    const [temporaryPlacements, setTemporaryPlacements] = useState([]);
    const [selectedTilesForExchange, setSelectedTilesForExchange] = useState([]);
    const [joinError, setJoinError] = useState('');
    const [lastGameError, setLastGameError] = useState('');
    const [gameIdToShare, setGameIdToShare] = useState(null);
    // eslint-disable-next-line no-unused-vars
    const [copySuccess, setCopySuccess] = useState('');

    // --- Derived State ---
    const myPlayerId = socket?.id;
    const myPlayerData = (gameState && gameState.players) ? gameState.players.find(p => p.id === myPlayerId) : null;
    const isMyTurn = myPlayerData?.isTurn || false;
    const isGameOver = gameState?.status === 'finished';
    const canInteract = isConnected && isInGame && isMyTurn && !isGameOver;
    const temporarilyPlacedRackIndices = temporaryPlacements.map(p => p.tile.originData?.type === 'rack' ? p.tile.originData.index : -1).filter(index => index !== -1);

    // --- Socket Connection & Event Handling Effect ---
    useEffect(() => {
        const currentSocket = socketService.getSocketInstance(); setSocket(currentSocket);
        const handleConnect = () => { setIsConnected(true); setLastGameError(''); console.log("handleConnect triggered"); };
        const handleDisconnect = () => { setIsConnected(false); setIsInGame(false); setGameState(null); setMyRack([]); setTemporaryPlacements([]); setGameIdToShare(null); setJoinError('Disconnected.'); console.log("handleDisconnect triggered");};

        // --->>> UPDATED handleGameUpdate <<<---
        const handleGameUpdate = (newGameState) => {
            console.log("App received gameUpdate:", newGameState);
             // Basic validation of received state
             if (!newGameState || !newGameState.gameId || !Array.isArray(newGameState.players)) {
                 console.error("Received invalid gameUpdate structure:", newGameState);
                 setLastGameError("Received invalid data from server.");
                 return;
             }
            setGameState(newGameState); // Always update the main game state


    // --->>> RESTORED: Update myRack IF payload contains it <<<---
            // This handles the specific updates sent after player moves/exchanges or on game start
            if (newGameState.myRack && Array.isArray(newGameState.myRack)) {
                console.log(`--> handleGameUpdate: Found myRack in update for ${myPlayerId}. Updating local rack.`);
                console.log("   New myRack data received:", JSON.stringify(newGameState.myRack));
                setMyRack(newGameState.myRack); // Update the local rack state
                console.log("   setMyRack was called.");
           } else {
               // This is expected for public updates sent after opponent moves
                console.log(`--> handleGameUpdate: No specific myRack found in update for ${myPlayerId}. Local rack state unchanged.`);
           }
           // --->>> END RESTORED <<<---

           // Clear temps/selection if not our turn or game not playing
           const newMyPlayer = newGameState.players.find(p => p.id === myPlayerId);
           if (!newMyPlayer?.isTurn || newGameState.status !== 'playing') {
                setTemporaryPlacements([]);
                setSelectedTilesForExchange([]);
           }
           setLastGameError(''); // Clear errors on update
           if (newGameState.gameId) setGameIdToShare(newGameState.gameId);
        };
        // --->>> END handleGameUpdate <<<---

        const handleGameJoined = (playerSpecificState) => {
             console.log("App received gameJoined:", playerSpecificState);
             if (playerSpecificState && Array.isArray(playerSpecificState.players) && Array.isArray(playerSpecificState.myRack) && playerSpecificState.gameId) {
                 setGameState(playerSpecificState);
                 setMyRack(playerSpecificState.myRack); // Set initial rack
                 setIsInGame(true);
                 setTemporaryPlacements([]); setSelectedTilesForExchange([]); setJoinError(''); setLastGameError(''); setGameIdToShare(playerSpecificState.gameId);
                 console.log("App State Initialized: myRack set to", playerSpecificState.myRack);
             } else { console.error("Invalid gameJoined state:", playerSpecificState); setJoinError("Invalid data from server."); setIsInGame(false); }
         };
        const handleNewMessage = (message) => { setMessages(prev => [...prev, message]); };
        const handleInvalidMove = (error) => { console.warn("Invalid Move:", error.message); setLastGameError(`Invalid Move: ${error.message || '?'}`); setTemporaryPlacements([]); };
        const handleError = (error) => { console.error("Game Error:", error.message); 
            if (error.message?.includes('not found') || error.message?.includes('full') || error.message?.includes('already started') || error.message?.includes('Username may be taken')) { setJoinError(error.message); } 
            else { setLastGameError(`Error: ${error.message || '?'}`); } };
        const handlePlayerLeft = (leftPlayerInfo) => { console.log(/*...*/); setMessages(prev => [...prev, { system: true, text: `Player ${leftPlayerInfo.username || leftPlayerInfo.playerId.substring(0,6)} left.`}]); };
        const handleGameOver = (gameOverData) => { console.log(/*...*/); setGameState(prev => prev ? { ...prev, status: 'finished', finalScores: gameOverData.finalScores } : null); setTemporaryPlacements([]); setSelectedTilesForExchange([]); };

        // Setup Listeners
        if (currentSocket) {
             console.log("useEffect: Setting up listeners...", currentSocket.id);
             currentSocket.off('connect', handleConnect); currentSocket.on('connect', handleConnect);
             currentSocket.off('disconnect', handleDisconnect); currentSocket.on('disconnect', handleDisconnect);
             socketService.removeListener('gameUpdate', handleGameUpdate); socketService.onGameUpdate(handleGameUpdate);
             socketService.removeListener('gameJoined', handleGameJoined); socketService.onGameJoined(handleGameJoined);
             socketService.removeListener('newChatMessage', handleNewMessage); socketService.onNewChatMessage(handleNewMessage);
             socketService.removeListener('invalidMove', handleInvalidMove); socketService.onInvalidMove(handleInvalidMove);
             socketService.removeListener('gameError', handleError); socketService.onError(handleError);
             socketService.removeListener('playerLeft', handlePlayerLeft); socketService.onPlayerLeft(handlePlayerLeft);
             socketService.removeListener('gameOver', handleGameOver); socketService.onGameOver(handleGameOver);
             if (currentSocket.connected) { handleConnect(); } else { socketService.connect(); }
             
        }
        // Cleanup Listeners
        return () => {
             console.log("useEffect: Cleaning up listeners...");
             if (currentSocket) { /* ... cleanup all listeners using removeListener or currentSocket.off ... */ }
        };
    // Removed gameState dependency again to avoid potential loops
    }, [socket, myPlayerId]);


    // --- Action Handlers & Callbacks (Keep existing implementations) ---
    const handleTileDropOnBoard = useCallback((tileData, targetRow, targetCol) => { /* ... */ }, [canInteract, temporaryPlacements, selectedTilesForExchange.length, myRack]);
    const handleTileDropOnRack = useCallback((tileData) => { /* ... */ }, [canInteract]);
    const handleJoinGame = useCallback((e) => { /* ... */ }, [username, joinGameId, socket, isConnected]);
    const handlePlayMove = useCallback(() => { /* ... */ }, [canInteract, temporaryPlacements, gameState, myRack]);
    const handlePassTurn = useCallback(() => { /* ... */ }, [canInteract, gameState]);
    const handleExchangeTiles = useCallback(() => { /* ... */ }, [canInteract, gameState, selectedTilesForExchange, myRack]);
    const handleSendMessage = useCallback((message) => { /* ... */ }, [gameState]);
    const handleTileSelectForExchange = useCallback((rackIndex) => { /* ... */ }, [canInteract, temporaryPlacements.length]);
    const copyGameIdToClipboard = useCallback(() => { /* ... */ }, [gameIdToShare]);


    // --- Rendering ---
    return (
        <div className="App">
            <h1>Real-time Scrabble</h1>
            <p>Connection Status: {isConnected ? <span style={{color: 'green', fontWeight: 'bold'}}>Connected</span> : <span style={{color: 'red', fontWeight: 'bold'}}>Disconnected</span>}</p>

            {!isInGame && !isGameOver ? (
                 <div className="join-form-container">
                     {/* Join Form JSX */}
                     <form onSubmit={handleJoinGame} className="join-form">
                     <div className="form-group"> <label htmlFor="username">Username:</label> <input id="username" type="text" value={username} onChange={(e) => { setUsername(e.target.value); setJoinError(''); }} placeholder="Enter Username" maxLength="16" required /> </div>
                         <div className="form-group"> <label htmlFor="gameIdInput">Game ID (Optional):</label> <input id="gameIdInput" type="text" value={joinGameId} onChange={(e) => setJoinGameId(e.target.value)} placeholder="Enter Game ID to join" /> </div>
                         <button type="submit" disabled={!isConnected} onClick={() => console.log("DEBUG: Join Button Clicked!")} > {joinGameId.trim() ? 'Join Specific Game' : 'Join / Create Game'} </button>
                         {joinError && <p className="error-message join-error">{joinError}</p>}
                     </form>
                 </div>
            ) : gameState ? (
                 <div className="game-area">
                    {isGameOver && <GameOverDisplay finalScores={gameState.finalScores} />}
                     <div className="left-panel">
                        {/* Share Section, Scoreboard, GameInfo, Error Display, Chat */}
                     </div>
                     <div className="main-panel">
                          <Board /* props */ />
                          <Rack /* props, including tiles={myRack || []} */ />
                          <Controls /* props */ />
                    </div>
                 </div>
            ) : ( <p>Loading game data...</p> ) }
        </div>
    );
}

export default App;