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
    const [joinGameId, setJoinGameId] = useState('');
    const [joinError, setJoinError] = useState('');

    // --- Temporary Gameplay UI State (Managed by App) ---
    const [temporaryPlacements, setTemporaryPlacements] = useState([]); // { row, col, tile: { letter, value, id, originData, isBlank } }
    const [selectedTilesForExchange, setSelectedTilesForExchange] = useState([]); // Array of originalIndex numbers
    // eslint-disable-next-line no-unused-vars
    const [copySuccess, setCopySuccess] = useState('');
    // ---> NEW STATE for Blank Assignment <---
    const [assigningBlankInfo, setAssigningBlankInfo] = useState(null); // Stores { tempPlacementIndex: number, row: number, col: number } or null

    // --- Get Core Game State & Listeners via Custom Hook ---
    const myPlayerId = socket?.id;
    const {
        gameState, myRack, messages, isInGame, isGameOver,
        currentTurnPlayerId, gameIdToShare, lastGameError, setLastGameError
    } = useGameManager(socket, myPlayerId);

    // --- Derived State ---
    const myPlayerData = (gameState && gameState.players) ? gameState.players.find(p => p.id === myPlayerId) : null;
    const isMyTurn = myPlayerData?.isTurn || false;
    const canInteract = isConnected && isInGame && isMyTurn && !isGameOver; // General interaction capability
    const canInteractWithGame = canInteract && !assigningBlankInfo; // Can interact specifically with board/rack (not while assigning blank)
    const temporarilyPlacedRackIndices = temporaryPlacements.map(p => p.tile.originData?.type === 'rack' ? p.tile.originData.index : -1).filter(index => index !== -1);


    // --- Effect for Basic Connection ---
    useEffect(() => {
        const currentSocket = socketService.getSocketInstance(); setSocket(currentSocket);
        const handleConnect = () => { setIsConnected(true); setJoinError(''); };
        const handleDisconnect = () => { setIsConnected(false); setJoinError('Disconnected.'); /* Let hook handle game state reset */ };
        if (currentSocket) {
             currentSocket.off('connect', handleConnect); currentSocket.on('connect', handleConnect);
             currentSocket.off('disconnect', handleDisconnect); currentSocket.on('disconnect', handleDisconnect);
             if (currentSocket.connected) handleConnect(); else socketService.connect();
        }
        return () => { if (currentSocket) { currentSocket.off('connect', handleConnect); currentSocket.off('disconnect', handleDisconnect); }};
    }, []); // Run only once


    // --- Effect to Clear Temporary State on Turn Change/Game Over ---
    useEffect(() => {
        if ((gameState && !isMyTurn) || isGameOver) {
             if(!isMyTurn) console.log("App Effect: Turn changed. Clearing temps.");
             if(isGameOver) console.log("App Effect: Game over. Clearing temps.");
             setTemporaryPlacements([]);
             setSelectedTilesForExchange([]);
             setAssigningBlankInfo(null); // Also close blank assign UI
        }
    }, [gameState, isMyTurn, isGameOver]);


    // --- Action Handlers & Callbacks ---

    const handleJoinGame = useCallback((e) => {
        if (e) e.preventDefault(); setJoinError('');
        if (!username.trim()) { setJoinError("Please enter a username."); return; }
        if (!socket || !isConnected) { setJoinError("Not connected to server."); return; }
        const joinData = { username: username.trim() }; const targetGameId = joinGameId.trim();
        if (targetGameId) { joinData.gameId = targetGameId; }
        console.log("App: Emitting joinGame", joinData);
        socketService.joinGame(joinData);
    }, [username, joinGameId, socket, isConnected]);

    const handleTileDropOnBoard = useCallback((tileData, targetRow, targetCol) => {
        if (!canInteractWithGame) return; // Check specific interaction flag
        if (temporaryPlacements.some(p => p.row === targetRow && p.col === targetCol)) return;
        if (selectedTilesForExchange.length > 0) setSelectedTilesForExchange([]);

        // Check if the dropped tile is a BLANK from the rack
        const isBlankFromRack = tileData.originData?.type === 'rack' && myRack[tileData.originData.index]?.letter === 'BLANK';

        setTemporaryPlacements(prevPlacements => {
            let updatedPlacements = [...prevPlacements];
             // Remove if dragged from another board spot
            if (tileData.originData?.type === 'board') { updatedPlacements = updatedPlacements.filter(p => !(p.row === tileData.originData.row && p.col === tileData.originData.col)); }

            // Add the new placement - blanks get empty letter initially
            const newPlacement = {
                row: targetRow,
                col: targetCol,
                // Store if it's originally a blank, letter starts empty for blanks
                tile: { ...tileData, isBlank: isBlankFromRack, letter: isBlankFromRack ? '' : tileData.letter }
            };
            updatedPlacements.push(newPlacement);

            // If it was a blank from the rack, trigger assignment UI
            if (isBlankFromRack) {
                const newIndex = updatedPlacements.length - 1;
                console.log(`Blank dropped at index ${newIndex}, triggering assignment UI for ${targetRow},${targetCol}`);
                setAssigningBlankInfo({ tempPlacementIndex: newIndex, row: targetRow, col: targetCol });
                setLastGameError(''); // Clear other errors
            }

            return updatedPlacements;
        });
    }, [canInteractWithGame, temporaryPlacements, selectedTilesForExchange.length, myRack, setLastGameError]); // Added setLastGameError

    // ---> NEW: Handler for when a letter is chosen for the blank <---
    const handleAssignLetterToBlank = useCallback((chosenLetter) => {
        if (!assigningBlankInfo || !chosenLetter || chosenLetter.length !== 1 || !/^[A-Z]$/i.test(chosenLetter)) {
            console.error("Invalid letter assignment attempt:", chosenLetter);
            setLastGameError("Choose a single letter (A-Z)."); // Use game error state
            return;
        }

        const letter = chosenLetter.toUpperCase();
        const indexToUpdate = assigningBlankInfo.tempPlacementIndex;

        console.log(`Assigning letter '${letter}' to blank at temp index ${indexToUpdate}`);

        setTemporaryPlacements(prevPlacements => {
            // Ensure index is valid before updating
            if (indexToUpdate < 0 || indexToUpdate >= prevPlacements.length) {
                console.error("Invalid index to update for blank assignment:", indexToUpdate);
                return prevPlacements; // Return unchanged state if index is bad
            }
            // Create a new array with the updated tile
            return prevPlacements.map((placement, index) => {
                if (index === indexToUpdate) {
                    // Update the letter property of the tile within the placement
                    return {
                        ...placement,
                        tile: {
                            ...placement.tile,
                            letter: letter, // Assign the chosen letter
                        }
                    };
                }
                return placement; // Return other placements unchanged
            });
        });

        // Close the assignment UI
        setAssigningBlankInfo(null);
        setLastGameError(''); // Clear assignment-specific error

    }, [assigningBlankInfo, setLastGameError]);

    const handleTileDropOnRack = useCallback((tileData) => {
         // Use canInteractWithGame to prevent dropping while assigning blank
         if (!canInteractWithGame) return;
         if (tileData.originData?.type === 'board') {
              // If the tile being returned was the one waiting for assignment, cancel assignment
              if(assigningBlankInfo?.row === tileData.originData.row && assigningBlankInfo?.col === tileData.originData.col) {
                  setAssigningBlankInfo(null);
              }
              setTemporaryPlacements(prev => prev.filter(p => !(p.row === tileData.originData.row && p.col === tileData.originData.col)));
         }
    }, [canInteractWithGame, assigningBlankInfo]); // Added assigningBlankInfo

    const handlePlayMove = useCallback(() => {
        if (!canInteract) { setLastGameError("Cannot play."); return; }
        if (temporaryPlacements.length === 0) { setLastGameError("Place tiles first."); return; }
        // ---> Check for unassigned blanks <---
        if (temporaryPlacements.some(p => p.tile.isBlank && !p.tile.letter)) {
             setLastGameError("Assign a letter to the blank tile(s) first!");
             return;
         }
        // Basic line validation...
        let minR=15,maxR=-1,minC=15,maxC=-1; temporaryPlacements.forEach(p=>{minR=Math.min(minR,p.row);maxR=Math.max(maxR,p.row);minC=Math.min(minC,p.col);maxC=Math.max(maxC,p.col);});
        if(minR!==maxR && minC!==maxC) { setLastGameError("Tiles not in line."); return; }
        // Prepare move data...
        const moveData = temporaryPlacements.map(p => {
             const tileObj = p.tile;
             // isBlank flag comes from the temporary placement state now
             const isBlank = tileObj.isBlank || false;
             return {
                 letter: tileObj.letter?.toUpperCase() || '', // Send assigned letter
                 value: isBlank ? 0 : tileObj.value ?? 0, // Send 0 value if blank
                 isBlank: isBlank,
                 row: p.row,
                 col: p.col
             };
        });
        console.log("App: Emitting placeTiles", moveData);
        if (gameState?.gameId) { setLastGameError(''); socketService.placeTiles({ gameId: gameState.gameId, move: moveData }); }
        else { setLastGameError("Error: No Game ID."); }
        // Temp placements cleared by useEffect based on turn change in gameState
    }, [canInteract, temporaryPlacements, gameState, myRack, setLastGameError]); // Removed direct myRack dependency here as isBlank comes from temp placement

    const handlePassTurn = useCallback(() => {
        if (!canInteract) { setLastGameError("Cannot pass."); return; }
        if (gameState?.gameId) { setLastGameError(''); socketService.passTurn(gameState.gameId); }
        // Temp placements cleared by useEffect
    }, [canInteract, gameState, setLastGameError]);

    const handleExchangeTiles = useCallback(() => {
         if (!canInteract) { setLastGameError("Cannot exchange."); return; }
         if (selectedTilesForExchange.length === 0) { setLastGameError("Select tiles first."); return; }
         const lettersToExchange = selectedTilesForExchange.map(index => myRack[index]?.letter).filter(Boolean);
         if (lettersToExchange.length !== selectedTilesForExchange.length) { setLastGameError("Error preparing exchange."); return; }
         if (gameState?.gameId) {
             setLastGameError(''); console.log("App: Emitting exchangeTiles", lettersToExchange);
             socketService.exchangeTiles(gameState.gameId, lettersToExchange);
             // Clear selection immediately, effect clears temps if turn advances
             setSelectedTilesForExchange([]);
        }
    }, [canInteract, gameState, selectedTilesForExchange, myRack, setLastGameError]);

    const handleSendMessage = useCallback((message) => {
         if (gameState?.gameId && message.trim()) { socketService.sendChatMessage(gameState.gameId, message.trim()); }
    }, [gameState]);

    const handleTileSelectForExchange = useCallback((rackIndex) => {
        if (!canInteractWithGame) return; // Use specific interaction flag
        if (temporaryPlacements.length > 0) { setLastGameError("Clear board first."); return; }
        setSelectedTilesForExchange(prev => { if (prev.includes(rackIndex)) { return prev.filter(i => i !== rackIndex); } else { return [...prev, rackIndex]; } });
        setLastGameError('');
    }, [canInteractWithGame, temporaryPlacements.length, setLastGameError]); // Used specific flag

    const copyGameIdToClipboard = useCallback(() => {
        if (!gameIdToShare) return;
        navigator.clipboard.writeText(gameIdToShare).then(() => { setCopySuccess('Copied!'); setTimeout(() => setCopySuccess(''), 2000); })
        .catch(err => { console.error('Failed to copy: ', err); setCopySuccess('Failed!'); setTimeout(() => setCopySuccess(''), 2000); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameIdToShare]);


    // --- Rendering Logic ---
    console.log(`App Render: isInGame=${isInGame}, isGameOver=${isGameOver}, gameStateExists=${!!gameState}, assigningBlank=${!!assigningBlankInfo}`);
    // console.log(`App Render - myRack from hook:`, JSON.stringify(myRack)); // Keep log if needed

    return (
        <div className="App">
            <h1>Real-time Scrabble</h1>
            <p>Connection Status: {isConnected ? <span style={{color: 'green', fontWeight: 'bold'}}>Connected</span> : <span style={{color: 'red', fontWeight: 'bold'}}>Disconnected</span>}</p>

            {/* --- BLANK ASSIGNMENT UI OVERLAY --- */}
            {assigningBlankInfo && (
                <div className="blank-assign-overlay">
                    <div className="blank-assign-box">
                        <h4>Assign Letter to Blank</h4>
                        <p>For square ({assigningBlankInfo.row}, {assigningBlankInfo.col})</p>
                        <input
                            type="text"
                            maxLength="1"
                            autoFocus
                            placeholder="A-Z"
                            // Convert to uppercase on input, prevent non-alpha
                            onInput={(e) => {
                                e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.target.value) {
                                    handleAssignLetterToBlank(e.target.value);
                                } else if (e.key === 'Escape') {
                                    // Optional: Cancel assignment - remove the temp placement
                                    setTemporaryPlacements(prev => prev.filter((_,idx) => idx !== assigningBlankInfo.tempPlacementIndex));
                                    setAssigningBlankInfo(null);
                                    setLastGameError('');
                                }
                            }}
                            className="blank-assign-input"
                        />
                         <button
                             onClick={() => {
                                 const input = document.querySelector('.blank-assign-input');
                                 if (input) handleAssignLetterToBlank(input.value);
                             }}
                             className="blank-assign-button"
                          >Set</button>
                          {/* Show assignment-specific error */}
                          {lastGameError.includes("blank") || lastGameError.includes("letter") ? <p className='error-message'>{lastGameError}</p> : null}
                    </div>
                </div>
            )}
            {/* --- END BLANK ASSIGNMENT UI --- */}


            {/* Show Join Form OR Game Area OR Loading */}
            {!isInGame && !isGameOver ? (
                 <div className="join-form-container">
                    <form onSubmit={handleJoinGame} className="join-form">
                         <div className="form-group"> <label htmlFor="username">Username:</label> <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter Username" maxLength="16" required /> </div>
                         <div className="form-group"> <label htmlFor="gameIdInput">Game ID (Optional):</label> <input id="gameIdInput" type="text" value={joinGameId} onChange={(e) => setJoinGameId(e.target.value)} placeholder="Enter Game ID to join" /> </div>
                         <button type="submit" disabled={!isConnected} > {joinGameId.trim() ? 'Join Specific Game' : 'Join / Create Game'} </button>
                         {joinError && <p className="error-message join-error">{joinError}</p>}
                    </form>
                 </div>
            ) : isInGame && gameState ? ( // Render game area only if IN game and gameState is loaded
                 <div className="game-area">
                    {isGameOver && <GameOverDisplay finalScores={gameState.finalScores} />}
                     <div className="left-panel">
                         {gameIdToShare && !isGameOver && ( <div className="share-game-section"><h4>Invite Player</h4> <p>Share ID:</p> <div className="game-id-display"> <code>{gameIdToShare}</code> <button onClick={copyGameIdToClipboard} title="Copy">Copy</button> </div> {copySuccess && <span className="copy-feedback">{copySuccess}</span>} </div> )}
                         <Scoreboard players={gameState.players || []} currentPlayerId={currentTurnPlayerId}/>
                         <GameInfo status={gameState.status} currentPlayerId={currentTurnPlayerId} players={gameState.players || []} tilesRemaining={gameState.tilesRemaining ?? '?'}/>
                         {/* Display general GAME errors here (excluding blank assignment errors maybe) */}
                         {lastGameError && !(lastGameError.includes("blank") || lastGameError.includes("letter")) && <p className="error-message">{lastGameError}</p>}
                         <Chat messages={messages} onSendMessage={handleSendMessage} playersInfo={gameState.players || []} myPlayerId={myPlayerId}/>
                     </div>
                     <div className="main-panel">
                          <Board
                             boardData={gameState.board}
                             temporaryPlacements={temporaryPlacements}
                             onTileDrop={handleTileDropOnBoard}
                             canInteract={canInteractWithGame} // Use specific flag
                         />
                          <Rack
                            tiles={myRack || []}
                            temporarilyPlacedIndices={temporarilyPlacedRackIndices}
                            onRackDrop={handleTileDropOnRack}
                            canInteract={canInteractWithGame} // Use specific flag
                            selectedForExchange={selectedTilesForExchange}
                            onTileSelect={handleTileSelectForExchange}
                         />
                          <Controls
                            onPlay={handlePlayMove}
                            onPass={handlePassTurn}
                            onExchange={handleExchangeTiles}
                            // Disable general controls if cannot interact specifically OR assigning blank
                            disabled={!canInteractWithGame || !!assigningBlankInfo}
                            // Also disable Play if unassigned blank exists
                            playDisabled={temporaryPlacements.length === 0 || temporaryPlacements.some(p => p.tile.isBlank && !p.tile.letter)}
                            exchangeDisabled={selectedTilesForExchange.length === 0}
                        />
                    </div>
                 </div>
            ) : isConnected ? ( <p>Waiting for game data...</p> ) // Use hook's isInGame state
              : ( <p>Connecting...</p> ) }
        </div>
    );
}

export default App;