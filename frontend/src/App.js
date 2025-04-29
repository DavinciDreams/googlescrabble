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
    const [isInGame, setIsInGame] = useState(false);
    const [socket, setSocket] = useState(null);
    const [temporaryPlacements, setTemporaryPlacements] = useState([]);
    const [selectedTilesForExchange, setSelectedTilesForExchange] = useState([]);
    const [joinError, setJoinError] = useState('');
    const [lastGameError, setLastGameError] = useState('');

    // --- Derived State ---
    const myPlayerId = socket?.id;
    const myPlayerData = (gameState && gameState.players)
        ? gameState.players.find(p => p.id === myPlayerId)
        : null;
    const isMyTurn = myPlayerData?.isTurn || false;
    const isGameOver = gameState?.status === 'finished';
    const canInteract = isConnected && isInGame && isMyTurn && !isGameOver; // Moved definition up

    const temporarilyPlacedRackIndices = temporaryPlacements
        .map(p => p.tile.originData?.type === 'rack' ? p.tile.originData.index : -1)
        .filter(index => index !== -1);


    // --- Socket Connection & Event Handling Effect ---
    useEffect(() => {
        const currentSocket = socketService.getSocketInstance();
        setSocket(currentSocket);
        const handleConnect = () => { setIsConnected(true); setLastGameError(''); console.log("handleConnect triggered"); };
        const handleDisconnect = () => { setIsConnected(false); setIsInGame(false); setGameState(null); setMyRack([]); setTemporaryPlacements([]); setJoinError('Disconnected. Please refresh.'); console.log("handleDisconnect triggered");};
        const handleGameUpdate = (newGameState) => {
            console.log("App received gameUpdate:", newGameState);
            setGameState(newGameState);
            if (newGameState.myRack) { setMyRack(newGameState.myRack); }
            const newMyPlayer = newGameState.players?.find(p => p.id === myPlayerId); // Add safe navigation
            if (!newMyPlayer?.isTurn || newGameState.status !== 'playing') { setTemporaryPlacements([]); }
            setLastGameError('');
        };
        const handleGameJoined = (playerSpecificState) => {
             console.log("App received gameJoined:", playerSpecificState);
             if (playerSpecificState && Array.isArray(playerSpecificState.players) && Array.isArray(playerSpecificState.myRack)) {
                 setGameState(playerSpecificState);
                 setMyRack(playerSpecificState.myRack);
                 setIsInGame(true);
                 setTemporaryPlacements([]);
                 setJoinError('');
                 setLastGameError('');
             } else {
                 console.error("Received invalid state from gameJoined:", playerSpecificState);
                 setJoinError("Received invalid game data from server.");
             }
         };
        const handleNewMessage = (message) => { setMessages(prev => [...prev, message]); };
        const handleInvalidMove = (error) => { console.warn("Invalid Move:", error.message); setLastGameError(`Invalid Move: ${error.message || 'Unknown reason'}`); setTemporaryPlacements([]); };
        const handleError = (error) => { console.error("Game Error:", error.message); setLastGameError(`Error: ${error.message || 'An unknown error occurred.'}`); };
        const handlePlayerLeft = (leftPlayerInfo) => { console.log(`Player ${leftPlayerInfo.playerId} left the game.`); setMessages(prev => [...prev, { system: true, text: `Player ${leftPlayerInfo.username || leftPlayerInfo.playerId.substring(0,6)} has left.`}]); };
         const handleGameOver = (gameOverData) => { console.log(`Game Over! Reason: ${gameOverData.reason}`, gameOverData.finalScores); setGameState(prev => prev ? { ...prev, status: 'finished', finalScores: gameOverData.finalScores } : null); setTemporaryPlacements([]); };

        if (currentSocket) {
            console.log("useEffect: Setting up listeners for socket:", currentSocket.id);
            currentSocket.on('connect', handleConnect);
            currentSocket.on('disconnect', handleDisconnect);
            socketService.onGameUpdate(handleGameUpdate);
            socketService.onGameJoined(handleGameJoined);
            socketService.onNewChatMessage(handleNewMessage);
            socketService.onInvalidMove(handleInvalidMove);
            socketService.onError(handleError);
            socketService.onPlayerLeft(handlePlayerLeft);
            socketService.onGameOver(handleGameOver);
            if (currentSocket.connected) { console.log("useEffect: Socket already connected."); handleConnect(); }
            else { console.log("useEffect: Socket not connected, attempting connection..."); socketService.connect(); }
        } else { console.log("useEffect: No socket instance yet."); }

        return () => {
             console.log("useEffect: Cleaning up listeners...");
             if (currentSocket) { /* ... cleanup listeners ... */
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
    }, [socket, myPlayerId]);


    // --- Drag and Drop Handlers ---
    const handleTileDropOnBoard = useCallback((tileData, targetRow, targetCol) => {
        if (!canInteract) return;
        if (temporaryPlacements.some(p => p.row === targetRow && p.col === targetCol)) {
             console.warn("Target square already has a temporary tile.");
             return;
        }
        setTemporaryPlacements(prevPlacements => {
            const existingPlacementIndex = prevPlacements.findIndex(p => p.tile.id === tileData.id);
            let updatedPlacements = [...prevPlacements];
            if (existingPlacementIndex > -1) { updatedPlacements.splice(existingPlacementIndex, 1); }
            updatedPlacements.push({ row: targetRow, col: targetCol, tile: tileData });
            return updatedPlacements;
        });
    }, [canInteract, temporaryPlacements]); // Removed isMyTurn, isGameOver as canInteract covers them

    const handleTileDropOnRack = useCallback((tileData) => {
         if (!canInteract) return;
         if (tileData.originData?.type === 'board') {
              // ---> FIXED SYNTAX ERROR HERE <---
              setTemporaryPlacements(prevPlacements =>
                  prevPlacements.filter(p => !(p.row === tileData.originData.row && p.col === tileData.originData.col))
              );
              // ---------------------------------
         }
    }, [canInteract]); // Removed isMyTurn, isGameOver


    // --- Action Handlers ---
    const handleJoinGame = useCallback((e) => {
        console.time("handleJoinGame Execution");
        console.log("handleJoinGame start");
        if (e) e.preventDefault();
        setJoinError('');
        if (!username.trim()) { setJoinError("Please enter a username."); console.log("handleJoinGame end - validation failed (username)"); console.timeEnd("handleJoinGame Execution"); return; }
        if (!socket || !isConnected) { setJoinError("Not connected to server. Please wait or refresh."); console.log("handleJoinGame end - not connected"); console.timeEnd("handleJoinGame Execution"); return; }
        console.log("Calling socketService.joinGame...");
        socketService.joinGame({ username: username.trim() });
        console.log("Called socketService.joinGame.");
        console.log("handleJoinGame end");
        console.timeEnd("handleJoinGame Execution");
    }, [username, socket, isConnected]);

    const handlePlayMove = useCallback(() => {
        if (!canInteract || temporaryPlacements.length === 0) { setLastGameError("Cannot play: Not your turn or no tiles placed."); return; }
        const moveData = temporaryPlacements.map(p => ({ letter: p.tile.letter, value: p.tile.value, isBlank: p.tile.letter === 'BLANK' || p.tile.value === 0, row: p.row, col: p.col }));
        console.log("Submitting move:", moveData);
        if (gameState?.gameId) {
            setLastGameError('');
            socketService.placeTiles({ gameId: gameState.gameId, move: moveData });
        } else { console.error("Cannot play move, no game ID found."); setLastGameError("Error: Could not determine Game ID."); }
    }, [canInteract, temporaryPlacements, gameState]);

    const handlePassTurn = useCallback(() => {
        if (!canInteract) { setLastGameError("Cannot pass: Not your turn."); return; }
        if (gameState?.gameId) {
            setLastGameError('');
            socketService.passTurn(gameState.gameId);
            setTemporaryPlacements([]);
        }
    }, [canInteract, gameState]);

    const handleExchangeTiles = useCallback(() => {
         if (!canInteract) { setLastGameError("Cannot exchange: Not your turn."); return; }
         // TODO: Implement UI selection and use selectedTilesForExchange state
         const tilesToExchangeFromUI = selectedTilesForExchange; // Use state here when implemented
         if (tilesToExchangeFromUI.length === 0) { setLastGameError("Select tiles from your rack to exchange first."); return; }
         if (gameState?.gameId) {
             setLastGameError('');
             console.log("Exchanging tiles:", tilesToExchangeFromUI);
             socketService.exchangeTiles(gameState.gameId, tilesToExchangeFromUI);
             setTemporaryPlacements([]);
             setSelectedTilesForExchange([]);
        }
    // Keep dependency - it will be needed when UI selection uses the state value
    }, [canInteract, gameState, selectedTilesForExchange]);

    const handleSendMessage = useCallback((message) => {
         if (gameState?.gameId && message.trim()) { socketService.sendChatMessage(gameState.gameId, message.trim()); }
    }, [gameState]);

    // --- TODO: Handler for Tile Selection for Exchange ---
    const handleTileSelectForExchange = useCallback((rackIndexOrTileLetter) => {
        // Example using letter: toggle selection
        setSelectedTilesForExchange(prev => {
            if (prev.includes(rackIndexOrTileLetter)) {
                return prev.filter(t => t !== rackIndexOrTileLetter); // Remove
            } else {
                 // Optional: Limit number of selected tiles?
                return [...prev, rackIndexOrTileLetter]; // Add
            }
        });
        setLastGameError(''); // Clear errors when selection changes
    }, []); // Needs selectedTilesForExchange if limiting selection size based on prev


    // --- Rendering ---
    return (
        <div className="App">
            <h1>Real-time Scrabble</h1>
            <p>Connection Status: {isConnected ? 'Connected' : 'Disconnected'}</p>

            {!isInGame && !isGameOver ? (
                <form onSubmit={handleJoinGame}>
                    <input type="text" value={username} onChange={(e) => { setUsername(e.target.value); setJoinError(''); }} placeholder="Enter Username" maxLength="12" required />
                    <button type="submit" disabled={!isConnected} onClick={() => console.log("DEBUG: Join Button Clicked!")} > Join / Create Game </button>
                    {joinError && <p className="error-message">{joinError}</p>}
                </form>
            ) : gameState ? (
                <div className="game-area">
                    {isGameOver && <GameOverDisplay finalScores={gameState.finalScores} />}
                    <div className="left-panel">
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
                            // Pass state and handler for exchange selection
                            selectedForExchange={selectedTilesForExchange}
                            onTileSelect={handleTileSelectForExchange}
                         />
                         <Controls
                            onPlay={handlePlayMove}
                            onPass={handlePassTurn}
                            onExchange={handleExchangeTiles}
                            // Disable general controls if cannot interact
                            disabled={!canInteract}
                            // Disable Play specifically if no tiles placed
                            playDisabled={temporaryPlacements.length === 0}
                            // Disable Exchange specifically if no tiles selected
                            exchangeDisabled={selectedTilesForExchange.length === 0}
                        />
                    </div>
                </div>
            ) : ( <p>Loading game data...</p> ) }
        </div>
    );
}

export default App;