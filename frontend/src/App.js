import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import Board from './components/Board/Board';
import Rack from './components/Rack/Rack';
import Controls from './components/Controls/Controls';
import Scoreboard from './components/Scoreboard/Scoreboard';
import GameInfo from './components/GameInfo/GameInfo';
import Chat from './components/Chat/Chat';
import socketService from './services/socketService';
import GameOverDisplay from './components/GameOverDisplay/GameOverDisplay'; // <-- Create this component

function App() {
    // --- State Variables ---
    const [isConnected, setIsConnected] = useState(false);
    const [gameState, setGameState] = useState(null); // Holds the full game state from server
    const [myRack, setMyRack] = useState([]); // Holds this player's specific rack
    const [messages, setMessages] = useState([]); // Chat messages { senderId, senderUsername, text }
    const [username, setUsername] = useState('');
    const [isInGame, setIsInGame] = useState(false);
    const [socket, setSocket] = useState(null);
    const [temporaryPlacements, setTemporaryPlacements] = useState([]);
    const [selectedTilesForExchange, setSelectedTilesForExchange] = useState([]); // Indices or letters
    const [joinError, setJoinError] = useState('');
    const [lastGameError, setLastGameError] = useState(''); // For non-fatal errors

    // --- Derived State ---
    const myPlayerId = socket?.id;
    const myPlayerData = (gameState && gameState.players)
        ? gameState.players.find(p => p.id === myPlayerId)
        : null;
    const isMyTurn = myPlayerData?.isTurn || false;
    const isGameOver = gameState?.status === 'finished';

    const temporarilyPlacedRackIndices = temporaryPlacements
        .map(p => p.tile.originData?.type === 'rack' ? p.tile.originData.index : -1)
        .filter(index => index !== -1);


    // --- Socket Connection & Event Handling Effect ---
    useEffect(() => {
        const currentSocket = socketService.getSocketInstance();
        setSocket(currentSocket);

        // --- Define Event Handlers ---
        const handleConnect = () => { setIsConnected(true); setLastGameError(''); };
        const handleDisconnect = () => { setIsConnected(false); setIsInGame(false); setGameState(null); setMyRack([]); setTemporaryPlacements([]); setJoinError('Disconnected. Please refresh.');}; // Show disconnect message

        const handleGameUpdate = (newGameState) => {
            console.log("App received gameUpdate:", newGameState);
            setGameState(newGameState);
            // Update local rack state ONLY if the update contains it (e.g., after exchange for self)
            // Otherwise, rack size change is handled by reading new rackTileCount in public state
            if (newGameState.myRack) {
                 setMyRack(newGameState.myRack);
            }
            // Clear temporary placements if it's no longer our turn or game status changes
            const newMyPlayer = newGameState.players.find(p => p.id === myPlayerId);
            if (!newMyPlayer?.isTurn || newGameState.status !== 'playing') {
                 setTemporaryPlacements([]);
            }
            setLastGameError(''); // Clear errors on successful update
        };

        const handleGameJoined = (playerSpecificState) => {
            console.log("App received gameJoined:", playerSpecificState);
            setGameState(playerSpecificState);
            setMyRack(playerSpecificState.myRack || []); // Ensure myRack is array
            setIsInGame(true);
            setTemporaryPlacements([]);
            setJoinError('');
            setLastGameError('');
        };

        const handleNewMessage = (message) => { // message = { senderId, senderUsername, text }
            setMessages(prev => [...prev, message]);
        };

        const handleInvalidMove = (error) => {
            console.warn("Invalid Move:", error.message);
            setLastGameError(`Invalid Move: ${error.message || 'Unknown reason'}`); // Show error non-blockingly
            setTemporaryPlacements([]); // Clear invalid temporary placements
        };

        const handleError = (error) => { // Generic game errors
            console.error("Game Error:", error.message);
            setLastGameError(`Error: ${error.message || 'An unknown error occurred.'}`);
        };

        const handlePlayerLeft = (leftPlayerInfo) => { // { playerId }
             console.log(`Player ${leftPlayerInfo.playerId} left the game.`);
             // Optional: Add a system message to chat
             setMessages(prev => [...prev, { system: true, text: `Player ${leftPlayerInfo.username || leftPlayerInfo.playerId.substring(0,6)} has left.`}]);
             // Game state update will be handled by the subsequent 'gameUpdate' if needed
        };

         const handleGameOver = (gameOverData) => { // { finalScores, reason }
             console.log(`Game Over! Reason: ${gameOverData.reason}`, gameOverData.finalScores);
             // Update state to reflect finished status (gameUpdate might also do this)
             setGameState(prev => prev ? { ...prev, status: 'finished', finalScores: gameOverData.finalScores } : null);
             setTemporaryPlacements([]);
             // Final scores are now in gameState.finalScores to be displayed
        };

        // --- Setup Listeners ---
        if (currentSocket) {
            currentSocket.on('connect', handleConnect);
            currentSocket.on('disconnect', handleDisconnect);
            socketService.onGameUpdate(handleGameUpdate);
            socketService.onGameJoined(handleGameJoined);
            socketService.onNewChatMessage(handleNewMessage);
            socketService.onInvalidMove(handleInvalidMove);
            socketService.onError(handleError);
            socketService.onPlayerLeft(handlePlayerLeft); // Listen for player leaving
            socketService.onGameOver(handleGameOver);    // Listen for game over

            if (currentSocket.connected) handleConnect();
            else socketService.connect();
        }

        // --- Cleanup Listeners ---
        return () => {
            if (currentSocket) {
                currentSocket.off('connect', handleConnect);
                currentSocket.off('disconnect', handleDisconnect);
                socketService.removeListener('gameUpdate', handleGameUpdate);
                socketService.removeListener('gameJoined', handleGameJoined);
                socketService.removeListener('newChatMessage', handleNewMessage);
                socketService.removeListener('invalidMove', handleInvalidMove);
                socketService.removeListener('onError', handleError);
                socketService.removeListener('playerLeft', handlePlayerLeft); // Cleanup listener
                socketService.removeListener('gameOver', handleGameOver);    // Cleanup listener
            }
        };
    }, [socket, myPlayerId]); // Add myPlayerId dependency as it's used in handleGameUpdate


    // --- Drag and Drop Handlers ---
    // (handleTileDropOnBoard, handleTileDropOnRack remain the same)
    const handleTileDropOnBoard = useCallback(/* ... */);
    const handleTileDropOnRack = useCallback(/* ... */);

    // --- Action Handlers ---
    // (handleJoinGame, handlePlayMove, handlePassTurn, handleExchangeTiles, handleSendMessage remain mostly the same)
    // Ensure handleExchangeTiles clears selectedTilesForExchange state on success
    const handleJoinGame = useCallback(/* ... */); // Make sure these use state setters like setJoinError correctly
    const handlePlayMove = useCallback(/* ... */);
    const handlePassTurn = useCallback(/* ... */);
    const handleExchangeTiles = useCallback(/* ... Make sure to update/clear selectedTilesForExchange ... */);
    const handleSendMessage = useCallback(/* ... */);


    // --- Rendering ---
    const canInteract = isConnected && isInGame && isMyTurn && !isGameOver;

    return (
        <div className="App">
            <h1>Real-time Scrabble</h1>
            <p>Connection Status: {isConnected ? 'Connected' : 'Disconnected'}</p>

            {/* Show Join Form OR Game Area */}
            {!isInGame && !isGameOver ? ( // Only show join form if not in game AND game not over
                <form onSubmit={handleJoinGame}>
                    {/* ... input, button ... */}
                    <input
                        type="text" value={username}
                        onChange={(e) => { setUsername(e.target.value); setJoinError(''); }}
                        placeholder="Enter Username" maxLength="12" required
                    />
                    <button type="submit" disabled={!isConnected}>Join / Create Game</button>
                    {joinError && <p className="error-message">{joinError}</p>}
                </form>
            ) : gameState ? ( // Render game area only if gameState is loaded
                <div className="game-area">
                    {/* Game Over Overlay */}
                    {isGameOver && <GameOverDisplay finalScores={gameState.finalScores} />}

                    <div className="left-panel">
                         <Scoreboard
                            players={gameState.players}
                            currentPlayerId={gameState.currentTurnPlayerId}
                         />
                        <GameInfo
                            status={gameState.status}
                            currentPlayerId={gameState.currentTurnPlayerId}
                            players={gameState.players}
                            tilesRemaining={gameState.tilesRemaining}
                         />
                         {/* Display non-fatal errors */}
                         {lastGameError && <p className="error-message">{lastGameError}</p>}
                        <Chat
                            messages={messages}
                            onSendMessage={handleSendMessage}
                            playersInfo={gameState.players} // Pass player info for username lookup
                            myPlayerId={myPlayerId}
                        />
                    </div>

                    <div className="main-panel">
                          <Board
                             boardData={gameState.board}
                             temporaryPlacements={temporaryPlacements}
                             onTileDrop={handleTileDropOnBoard}
                             canInteract={canInteract}
                         />
                        <Rack
                            tiles={myRack || []}
                            temporarilyPlacedIndices={temporarilyPlacedRackIndices}
                            onRackDrop={handleTileDropOnRack}
                            canInteract={canInteract}
                            // --- TODO: Pass props for exchange selection ---
                            // selectedForExchange={selectedTilesForExchange}
                            // onTileSelect={handleTileSelectForExchange} // Implement this handler
                         />
                        <Controls
                            onPlay={handlePlayMove}
                            onPass={handlePassTurn}
                            onExchange={handleExchangeTiles}
                            // Disable if not interactable, or Play if no temps, or Exchange if no selection
                            disabled={!canInteract || (temporaryPlacements.length === 0 && gameState?.status === 'playing')}
                            // TODO: Add disabled logic for exchange based on selection
                        />
                    </div>
                </div>
            ) : (
                 // Optional: Loading indicator while waiting for gameJoined
                 <p>Loading game data...</p>
            ) }
        </div>
    );
}

export default App;