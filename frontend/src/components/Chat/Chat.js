import React, { useState, useRef, useEffect } from 'react';
import './Chat.css';

// Added playersInfo prop to map senderId to username
const Chat = ({ messages = [], onSendMessage, playersInfo = [], myPlayerId }) => {
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSubmit = (e) => { /* ... logic remains same ... */ };

    // Helper to get username from ID
    const getUsername = (senderId) => {
         if (senderId === myPlayerId) return 'You'; // Identify self
        const player = playersInfo.find(p => p.id === senderId);
        return player ? player.username : (senderId ? senderId.substring(0, 6) : '???'); // Fallback to short ID
    };

    return (
        <div className="chat-area">
            <h2>Chat</h2>
            <div className="chat-messages">
                {messages.map((msg, index) => (
                     // Handle system messages differently
                     msg.system ? (
                         <div key={`system-${index}`} className="chat-message system-message">
                             <em>{msg.text}</em>
                         </div>
                     ) : (
                        <div key={msg.senderId + index} className={`chat-message ${msg.senderId === myPlayerId ? 'my-message' : 'other-message'}`}>
                            <span className="sender-name">{getUsername(msg.senderId)}: </span>
                            <span className="message-text">{msg.text}</span>
                        </div>
                     )
                ))}
                <div ref={messagesEndRef} />
            </div>
            <form className="chat-input-form" onSubmit={handleSubmit}>
                {/* ... input, button ... */}
                 <input
                    type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type message..." maxLength="100"
                />
                <button type="submit">Send</button>
            </form>
        </div>
    );
};

export default Chat;