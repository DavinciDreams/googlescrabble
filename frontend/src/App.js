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
import GameOverDisplay from './components/GameOverDisplay/GameOverDisplay'; // Ensure this component exists

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

        // ---> Handles general game updates AND specific updates with player rack <---
        const handleGameUpdate = (newGameState) => {
            console.log("App received gameUpdate:", newGameState);
             if (!newGameState || !newGameState.gameId || !Array.isArray(newGameState.players)) {
                 console.error("Received invalid gameUpdate structure:", newGameState);
                 setLastGameError("Received invalid data from server.");
                 return;
             }
            setGameState(newGameState); // Update the main game state

             // ---> If this update contains 'myRack', update the local rack state <---
             // This happens on initial game start (for all players) and after exchange (for the player who exchanged)
            if (newGameState.myRack && Array.isArray(newGameState.myRack)) {
                 setMyRack(newGameState.myRack);
                 console.log("App: Updated local rack from gameUpdate containing myRack.");
            }

            // Clear temps/selection if not our turn or game not playing
            const newMyPlayer = newGameState.players.find(p => p.id === myPlayerId);
            if (!newMyPlayer?.isTurn || newGameState.status !== 'playing') {
                 setTemporaryPlacements([]);
                 setSelectedTilesForExchange([]);
            }
            setLastGameError(''); // Clear errors on update
            if (newGameState.gameId) setGameIdToShare(newGameState.gameId);
        };

        // ---> Handles initial join, receiving rack if game started on join <---
        const handleGameJoined = (playerSpecificState) => {
             console.log("App received gameJoined:", playerSpecificState);
             if (playerSpecificState && Array.isArray(playerSpecificState.players) && Array.isArray(playerSpecificState.myRack) && playerSpecificState.gameId) {
                 setGameState(playerSpecificState);
                 // ---> Set initial rack from gameJoined <---
                 setMyRack(playerSpecificState.myRack);
                 setIsInGame(true);
                 setTemporaryPlacements([]);
                 setSelectedTilesForExchange([]);
                 setJoinError('');
                 setLastGameError('');
                 setGameIdToShare(playerSpecificState.gameId);
                 console.log("App State Updated after gameJoined: myRack set to", playerSpecificState.myRack);
             } else {
                 console.error("Received invalid state from gameJoined:", playerSpecificState);
                 setJoinError("Received invalid game data from server.");
                 setIsInGame(false);
             }
         };

        const handleNewMessage = (message) => { setMessages(prev => [...prev, message]); };
        const handleInvalidMove = (error) => { console.warn("Invalid Move:", error.message); setLastGameError(`Invalid Move: ${error.message || 'Unknown reason'}`); setTemporaryPlacements([]); };
        const handleError = (error) => { console.error("Game Error:", error.message); setLastGameError(`Error: ${error.message || 'An unknown error occurred.'}`); };
        const handlePlayerLeft = (leftPlayerInfo) => { console.log(/*...*/); setMessages(prev => [...prev, { system: true, text: `Player ${leftPlayerInfo.username || leftPlayerInfo.playerId.substring(0,6)} has left.`}]); };
        const handleGameOver = (gameOverData) => { console.log(/*...*/); setGameState(prev => prev ? { ...prev, status: 'finished', finalScores: gameOverData.finalScores } : null); setTemporaryPlacements([]); setSelectedTilesForExchange([]); };

        // --- Setup Listeners ---
        if (currentSocket) { /* ... attach all handlers using socketService.on... or currentSocket.on... */
             console.log("useEffect: Setting up listeners for socket:", currentSocket.id);
             currentSocket.off('connect', handleConnect); currentSocket.on('connect', handleConnect);
             currentSocket.off('disconnect', handleDisconnect); currentSocket.on('disconnect', handleDisconnect);
             socketService.removeListener('gameUpdate', handleGameUpdate); socketService.onGameUpdate(handleGameUpdate);
             socketService.removeListener('gameJoined', handleGameJoined); socketService.onGameJoined(handleGameJoined);
             socketService.removeListener('newChatMessage', handleNewMessage); socketService.onNewChatMessage(handleNewMessage);
             socketService.removeListener('invalidMove', handleInvalidMove); socketService.onInvalidMove(handleInvalidMove);
             socketService.removeListener('gameError', handleError); socketService.onError(handleError);
             socketService.removeListener('playerLeft', handlePlayerLeft); socketService.onPlayerLeft(handlePlayerLeft);
             socketService.removeListener('gameOver', handleGameOver); socketService.onGameOver(handleGameOver);
             if (currentSocket.connected) { console.log("useEffect: Socket already connected."); handleConnect(); } else { console.log("useEffect: Socket not connected..."); socketService.connect(); }
        } else { console.log("useEffect: No socket instance yet."); }

        // --- Cleanup Listeners ---
        return () => { /* ... cleanup all listeners ... */ };
    // No need to add gameState here now, gameIdToShare updated within handlers
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

            {/* Show Join Form OR Game Area OR Loading Indicator */}
            {!isInGame && !isGameOver ? (
                 <div className="join-form-container">
                    {/* --- Join Form JSX --- */}
                    <form onSubmit={handleJoinGame} className="join-form">
                         <div className="form-group"> <label htmlFor="username">Username:</label> <input id="username" type="text" value={username} onChange={(e) => { setUsername(e.target.value); setJoinError(''); }} placeholder="Enter Username" maxLength="16" required /> </div>
                         <div className="form-group"> <label htmlFor="gameIdInput">Game ID (Optional):</label> <input id="gameIdInput" type="text" value={joinGameId} onChange={(e) => setJoinGameId(e.target.value)} placeholder="Enter Game ID to join" /> </div>
                         <button type="submit" disabled={!isConnected} > {joinGameId.trim() ? 'Join Specific Game' : 'Join / Create Game'} </button>
                         {joinError && <p className="error-message join-error">{joinError}</p>}
                    </form>
                 </div>
            ) : gameState ? ( // Only render game area if gameState is loaded
                 <div className="game-area">
                    {isGameOver && <GameOverDisplay finalScores={gameState.finalScores} />}
                     <div className="left-panel">
                         {/* --- Share Section JSX --- */}
                         {gameIdToShare && !isGameOver && ( <div className="share-game-section"><h4>Invite Player</h4> <p>Share this Game ID:</p> <div className="game-id-display"> <code>{gameIdToShare}</code> <button onClick={copyGameIdToClipboard} title="Copy Game ID"> Copy ID </button> </div> {copySuccess && <span className="copy-feedback">{copySuccess}</span>} </div> )}
                         {/* --- Other Left Panel Components --- */}
                         <Scoreboard players={gameState.players || []} currentPlayerId={gameState.currentTurnPlayerId}/>
                         <GameInfo status={gameState.status} currentPlayerId={gameState.currentTurnPlayerId} players={gameState.players || []} tilesRemaining={gameState.tilesRemaining ?? '?'}/>
                         {lastGameError && <p className="error-message">{lastGameError}</p>}
                         <Chat messages={messages} onSendMessage={handleSendMessage} playersInfo={gameState.players || []} myPlayerId={myPlayerId}/>
                     </div>
                     <div className="main-panel">
                          <Board boardData={gameState.board} temporaryPlacements={temporaryPlacements} onTileDrop={handleTileDropOnBoard} canInteract={canInteract}/>
                          {/* ---> Pass myRack State to Rack <--- */}
                          <Rack
                            tiles={myRack || []} // Use the myRack state
                            temporarilyPlacedIndices={temporarilyPlacedRackIndices}
                            onRackDrop={handleTileDropOnRack}
                            canInteract={canInteract}
                            selectedForExchange={selectedTilesForExchange}
                            onTileSelect={handleTileSelectForExchange}
                         />
                         <Controls
                            onPlay={handlePlayMove} onPass={handlePassTurn} onExchange={handleExchangeTiles}
                            disabled={!canInteract} playDisabled={temporaryPlacements.length === 0} exchangeDisabled={selectedTilesForExchange.length === 0}
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