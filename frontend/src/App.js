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
    const [gameState, setGameState] = useState(null);
    const [myRack, setMyRack] = useState([]);
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
    const [copySuccess, setCopySuccess] = useState(''); // Disable warning, setter IS used below

    // --- Derived State ---
    const myPlayerId = socket?.id;
    const myPlayerData = (gameState && gameState.players)
        ? gameState.players.find(p => p.id === myPlayerId)
        : null;
    const isMyTurn = myPlayerData?.isTurn || false;
    const isGameOver = gameState?.status === 'finished';
    // Define canInteract early
    const canInteract = isConnected && isInGame && isMyTurn && !isGameOver;

    const temporarilyPlacedRackIndices = temporaryPlacements
        .map(p => p.tile.originData?.type === 'rack' ? p.tile.originData.index : -1)
        .filter(index => index !== -1);


    // --- Socket Connection & Event Handling Effect ---
    useEffect(() => {
        const currentSocket = socketService.getSocketInstance();
        setSocket(currentSocket); // Used

        const handleConnect = () => { setIsConnected(true); setLastGameError(''); console.log("handleConnect triggered"); }; // Setter used
        const handleDisconnect = () => { setIsConnected(false); setIsInGame(false); setGameState(null); setMyRack([]); setTemporaryPlacements([]); setGameIdToShare(null); setJoinError('Disconnected. Please refresh.'); console.log("handleDisconnect triggered");}; // Setters used
        const handleGameUpdate = (newGameState) => {
            console.log("App received gameUpdate:", newGameState);
             if (!newGameState || !newGameState.gameId /* ... */) { /* ... error handling ... */ return; }
            setGameState(newGameState);

        
            const newMyPlayer = newGameState.players?.find(p => p.id === myPlayerId);
            if (!newMyPlayer?.isTurn || newGameState.status !== 'playing') { /* ... clear temps ... */ }
            setLastGameError('');
            if (newGameState.gameId) setGameIdToShare(newGameState.gameId);
        };

        const handleGameJoined = (playerSpecificState) => {
             console.log("App received gameJoined:", playerSpecificState);
             if (playerSpecificState && Array.isArray(playerSpecificState.players) && Array.isArray(playerSpecificState.myRack) && playerSpecificState.gameId) {
                 setGameState(playerSpecificState); // Used
                 setMyRack(playerSpecificState.myRack); // Used
                 setIsInGame(true); // Used
                 setTemporaryPlacements([]); setSelectedTilesForExchange([]); setJoinError(''); setLastGameError(''); setGameIdToShare(playerSpecificState.gameId); // Used
                 console.log("App State Updated: myRack set to", playerSpecificState.myRack);
             } else { console.error(/*...*/); setJoinError("Invalid data."); setIsInGame(false); } // Used
         };

        const handleNewMessage = (message) => { setMessages(prev => [...prev, message]); }; // Used
        const handleInvalidMove = (error) => { console.warn(/*...*/); setLastGameError(`Invalid Move: ${error.message || '?'}`); setTemporaryPlacements([]); }; // Used
// Inside frontend/src/App.js

const handleError = (error) => { // Handles gameError event from server
    console.error("Game Error Received:", error.message);
    // ---> Update joinError specifically for join failures <---
    if (error.message?.includes('not found') || error.message?.includes('full') || error.message?.includes('already started')) {
        setJoinError(error.message); // Show specific join error on the form
    } else {
    // ---> Use lastGameError for other generic errors <---
        setLastGameError(`Error: ${error.message || 'An unknown error occurred.'}`);
    }
};        const handlePlayerLeft = (leftPlayerInfo) => { console.log(/*...*/); setMessages(prev => [...prev, { system: true, text: `Player ${leftPlayerInfo.username || leftPlayerInfo.playerId.substring(0,6)} left.`}]); }; // Used
         const handleGameOver = (gameOverData) => { console.log(/*...*/); setGameState(prev => prev ? { ...prev, status: 'finished', finalScores: gameOverData.finalScores } : null); setTemporaryPlacements([]); setSelectedTilesForExchange([]); }; // Used

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
             if (currentSocket.connected) { console.log("useEffect: Socket already connected."); handleConnect(); }
             else { console.log("useEffect: Socket not connected..."); socketService.connect(); }
        } else { console.log("useEffect: No socket instance yet."); }

        // Cleanup Listeners
        return () => {
             console.log("useEffect: Cleaning up listeners...");
             if (currentSocket) {
                 currentSocket.off('connect', handleConnect); currentSocket.off('disconnect', handleDisconnect);
                 socketService.removeListener('gameUpdate', handleGameUpdate); socketService.removeListener('gameJoined', handleGameJoined);
                 socketService.removeListener('newChatMessage', handleNewMessage); socketService.removeListener('invalidMove', handleInvalidMove);
                 socketService.removeListener('onError', handleError); socketService.removeListener('playerLeft', handlePlayerLeft);
                 socketService.removeListener('gameOver', handleGameOver);
             }
        };
    }, [socket, myPlayerId]); // Keep minimal dependencies for main effect


    // --- Drag and Drop Handlers ---
// Inside App.js
const handleTileDropOnBoard = useCallback((tileData, targetRow, targetCol) => {
    if (!canInteract) return;
    console.log(`==> handleTileDropOnBoard START`);
    console.log(`  Dropping Tile:`, JSON.stringify(tileData));
    console.log(`  Onto Square: ${targetRow}, ${targetCol}`);
    console.log(`  Current temporaryPlacements (Before):`, JSON.stringify(temporaryPlacements));

    if (temporaryPlacements.some(p => p.row === targetRow && p.col === targetCol)) {
         console.warn("  Target square already has a temporary tile. Preventing drop.");
         console.log(`==> handleTileDropOnBoard END (Blocked)`);
         return;
    }
    if (selectedTilesForExchange.length > 0) setSelectedTilesForExchange([]);

    setTemporaryPlacements(prevPlacements => {
        console.log(`  setTemporaryPlacements running...`);
        // --- Logic to remove tile if it was dragged from another temp board spot ---
        let updatedPlacements = [...prevPlacements];
        if (tileData.originData?.type === 'board') {
             console.log(`  Tile originated from board (${tileData.originData.row}, ${tileData.originData.col}). Filtering it out.`);
             updatedPlacements = updatedPlacements.filter(p => !(p.row === tileData.originData.row && p.col === tileData.originData.col));
             console.log(`  Placements after filtering origin:`, JSON.stringify(updatedPlacements));
        }
        // --- End removal logic ---

        // Add the new placement
        // Ensure isBlank is correctly determined here
        let isBlank = false;
        if (tileData.originData?.type === 'rack' && typeof tileData.originData.index === 'number' && myRack[tileData.originData.index]) {
             isBlank = myRack[tileData.originData.index].letter === 'BLANK';
        } else { isBlank = tileData.value === 0 || tileData.letter === 'BLANK';} // Use received tileData letter too

        const newPlacement = { row: targetRow, col: targetCol, tile: {...tileData, isBlank} };
        updatedPlacements.push(newPlacement);
        console.log(`  New placement added:`, JSON.stringify(newPlacement));
        console.log(`  New temporaryPlacements state:`, JSON.stringify(updatedPlacements));
        return updatedPlacements;
    });
     console.log(`==> handleTileDropOnBoard END (Success)`);

}, [canInteract, temporaryPlacements, selectedTilesForExchange.length, myRack]);
    const handleTileDropOnRack = useCallback((tileData) => {
         if (!canInteract) return;
         if (tileData.originData?.type === 'board') {
              setTemporaryPlacements(prevPlacements =>
                  prevPlacements.filter(p => !(p.row === tileData.originData.row && p.col === tileData.originData.col))
              );
         }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canInteract]); // Suppress warning, dep seems necessary


    // --- Action Handlers ---
    const handleJoinGame = useCallback((e) => {
        console.time("handleJoinGame Execution"); console.log("handleJoinGame start");
        if (e) e.preventDefault(); setJoinError('');
        if (!username.trim()) { setJoinError("Please enter a username."); console.timeEnd("handleJoinGame Execution"); return; }
        if (!socket || !isConnected) { setJoinError("Not connected to server."); console.timeEnd("handleJoinGame Execution"); return; }
        const joinData = { username: username.trim() }; const targetGameId = joinGameId.trim();
        if (targetGameId) { joinData.gameId = targetGameId; console.log(/*...*/); } else { console.log(/*...*/); }
        socketService.joinGame(joinData);
        console.log("Called socketService.joinGame."); console.log("handleJoinGame end");
        console.timeEnd("handleJoinGame Execution");
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [username, joinGameId, socket, isConnected]); // Suppress warning, deps seem necessary

    const handlePlayMove = useCallback(() => {
        if (!canInteract || temporaryPlacements.length === 0) { /* ... */ return; }
        // ... line validation ...
    
        // Prepare move data more robustly
        const moveData = temporaryPlacements.map(p => {
            let isBlank = false;
            const tileObj = p.tile; // Get the nested tile object
    
            // --- SAFELY get letter and value ---
            const letter = tileObj?.letter; // Use optional chaining
            const value = tileObj?.value;
    
            // Determine if blank (using origin is more reliable if available)
            if (tileObj?.originData?.type === 'rack' && typeof tileObj.originData.index === 'number' && myRack[tileObj.originData.index]) {
                 isBlank = myRack[tileObj.originData.index].letter === 'BLANK';
            } else {
                 // Fallback if origin isn't rack or tile isn't in rack anymore (shouldn't happen often)
                 // Check if value is 0 or if the letter prop itself was 'BLANK' initially
                 isBlank = value === 0 || letter === 'BLANK';
            }
    
            // --- ENSURE letter is a string before toUpperCase ---
            // If it's a blank, the letter might be missing or intended to be empty until assigned.
            // If it's truly undefined/null, something is wrong earlier. Default to ''? Or throw error?
            // Let's default to '' for now, server-side validation should catch meaningless moves.
            const letterToSend = (typeof letter === 'string') ? letter : ''; // Default to empty string if not a string
    
            return {
                letter: letterToSend, // Send the potentially corrected letter
                value: value ?? 0,     // Default value to 0 if null/undefined
                isBlank: isBlank,      // Send calculated isBlank flag
                row: p.row,
                col: p.col
            };
        }).filter(tile => typeof tile.letter === 'string'); // Extra safety filter (optional)
    
        // Check if moveData became empty after filtering (if filtering is added)
        if (moveData.length === 0 && temporaryPlacements.length > 0) {
            console.error("Failed to prepare valid move data from temporary placements:", temporaryPlacements);
            setLastGameError("Error preparing move data.");
            return;
        }
        if (moveData.length === 0) { // If initially empty
             setLastGameError("No tiles placed to submit.");
             return;
        }
    
    
        console.log("Submitting move:", moveData);
        if (gameState?.gameId) {
            setLastGameError('');
            socketService.placeTiles({ gameId: gameState.gameId, move: moveData });
        } else {
             console.error("Cannot play move, no game ID found.");
             setLastGameError("Error: Could not determine Game ID.");
        }
    }, [canInteract, temporaryPlacements, gameState, myRack]);

    const handlePassTurn = useCallback(() => {
        if (!canInteract) { setLastGameError("Cannot pass."); return; }
        if (gameState?.gameId) { setLastGameError(''); socketService.passTurn(gameState.gameId); setTemporaryPlacements([]); setSelectedTilesForExchange([]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canInteract, gameState]); // Suppress warning, deps seem necessary

    const handleExchangeTiles = useCallback(() => {
         if (!canInteract) { setLastGameError("Cannot exchange."); return; }
         if (selectedTilesForExchange.length === 0) { setLastGameError("Select tiles first."); return; }
         const lettersToExchange = selectedTilesForExchange.map(index => myRack[index]?.letter).filter(Boolean);
         if (lettersToExchange.length !== selectedTilesForExchange.length) { console.error(/*...*/); setLastGameError("Error preparing exchange."); return; }
         if (gameState?.gameId) {
             setLastGameError(''); console.log("Requesting exchange:", lettersToExchange);
             socketService.exchangeTiles(gameState.gameId, lettersToExchange);
             setTemporaryPlacements([]); setSelectedTilesForExchange([]);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canInteract, gameState, selectedTilesForExchange, myRack]); // Suppress warning, deps seem necessary (including selectedTilesForExchange value)

    const handleSendMessage = useCallback((message) => {
         if (gameState?.gameId && message.trim()) { socketService.sendChatMessage(gameState.gameId, message.trim()); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameState]); // Suppress warning, dep seems necessary

    const handleTileSelectForExchange = useCallback((rackIndex) => {
        if (!canInteract) return;
        if (temporaryPlacements.length > 0) { setLastGameError("Clear board first."); return; }
        setSelectedTilesForExchange(prev => { if (prev.includes(rackIndex)) { return prev.filter(i => i !== rackIndex); } else { return [...prev, rackIndex]; } });
        setLastGameError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canInteract, temporaryPlacements.length]); // Suppress warning, deps seem necessary

    const copyGameIdToClipboard = useCallback(() => {
        if (!gameIdToShare) return;
        navigator.clipboard.writeText(gameIdToShare).then(() => { setCopySuccess('Copied!'); setTimeout(() => setCopySuccess(''), 2000); })
        .catch(err => { console.error(/*...*/); setCopySuccess('Failed!'); setTimeout(() => setCopySuccess(''), 2000); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameIdToShare]); // Suppress warning, dep seems necessary


    // --- Rendering ---
    return (
        <div className="App">
            <h1>Real-time Scrabble</h1>
            <p>Connection Status: {isConnected ? <span style={{color: 'green', fontWeight: 'bold'}}>Connected</span> : <span style={{color: 'red', fontWeight: 'bold'}}>Disconnected</span>}</p>

            {/* --- JSX using the state variables and components --- */}
            {!isInGame && !isGameOver ? (
                 <div className="join-form-container">
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
                         {gameIdToShare && !isGameOver && ( <div className="share-game-section"><h4>Invite Player</h4> <p>Share this Game ID:</p> <div className="game-id-display"> <code>{gameIdToShare}</code> <button onClick={copyGameIdToClipboard} title="Copy Game ID"> Copy ID </button> </div> {copySuccess && <span className="copy-feedback">{copySuccess}</span>} </div> )}
                         <Scoreboard players={gameState.players || []} currentPlayerId={gameState.currentTurnPlayerId}/>
                         <GameInfo status={gameState.status} currentPlayerId={gameState.currentTurnPlayerId} players={gameState.players || []} tilesRemaining={gameState.tilesRemaining ?? '?'}/>
                         {lastGameError && <p className="error-message">{lastGameError}</p>}
                         <Chat messages={messages} onSendMessage={handleSendMessage} playersInfo={gameState.players || []} myPlayerId={myPlayerId}/>
                     </div>
                     <div className="main-panel">
                          <Board boardData={gameState.board} temporaryPlacements={temporaryPlacements} onTileDrop={handleTileDropOnBoard} canInteract={canInteract}/>
                         <Rack tiles={myRack || []} temporarilyPlacedIndices={temporarilyPlacedRackIndices} onRackDrop={handleTileDropOnRack} canInteract={canInteract} selectedForExchange={selectedTilesForExchange} onTileSelect={handleTileSelectForExchange} />
                         <Controls onPlay={handlePlayMove} onPass={handlePassTurn} onExchange={handleExchangeTiles} disabled={!canInteract} playDisabled={temporaryPlacements.length === 0} exchangeDisabled={selectedTilesForExchange.length === 0} />
                    </div>
                 </div>
            ) : ( <p>Loading game data...</p> ) }
        </div>
    );
}

export default App;