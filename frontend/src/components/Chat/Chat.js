import React, { useState, useRef, useEffect } from 'react';
import './Chat.css'; // Ensure this CSS file exists

/**
 * Chat component for displaying messages and sending new ones.
 * @param {object} props
 * @param {Array} [props.messages=[]] - Array of message objects { system?: boolean, senderId?, senderUsername?, text }.
 * @param {Function} props.onSendMessage - Callback function to send a new message string.
 * @param {Array} [props.playersInfo=[]] - Array of player objects { id, username } for username lookup.
 * @param {string} props.myPlayerId - The socket ID of the current player.
 */
const Chat = ({ messages = [], onSendMessage, playersInfo = [], myPlayerId }) => {
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef(null); // To auto-scroll chat

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]); // Dependency on the messages array

    // Handles form submission (pressing Enter or clicking Send)
    const handleSubmit = (e) => {
        // --- CRUCIAL FIX: Prevent default form submission/navigation ---
        if (e) e.preventDefault();
        // --------------------------------------------------------------

        const messageToSend = newMessage.trim();
        if (messageToSend && onSendMessage) { // Check message isn't empty and handler exists
            onSendMessage(messageToSend);
            setNewMessage(''); // Clear input field after sending
        } else if (!onSendMessage) {
             console.warn("Chat component: onSendMessage prop is missing.");
        }
    };

    // Helper function to get display username from player ID
    const getUsername = (senderId) => {
         if (!senderId) return 'System'; // Handle system messages or missing IDs
         if (senderId === myPlayerId) return 'You'; // Identify self
        const player = playersInfo.find(p => p.id === senderId);
        // Fallback to short ID if username not found in playersInfo
        return player ? player.username : (senderId ? senderId.substring(0, 6) : '???');
    };

    return (
        <div className="chat-area">
            <h2>Chat</h2>
            <div className="chat-messages" aria-live="polite"> {/* Added aria-live */}
                {messages.map((msg, index) => (
                     // Handle system messages (don't have senderId/senderUsername)
                     msg.system ? (
                         <div key={`system-${index}`} className="chat-message system-message">
                             <em>{msg.text}</em>
                         </div>
                     ) : (
                         // Handle regular messages
                        <div
                            // Use a more stable key if messages have unique IDs, otherwise combine elements
                            key={msg.senderId + index + msg.text}
                            className={`chat-message ${msg.senderId === myPlayerId ? 'my-message' : 'other-message'}`}
                        >
                            <span className="sender-name">{getUsername(msg.senderId)}: </span>
                            <span className="message-text">{msg.text}</span>
                        </div>
                     )
                ))}
                {/* Dummy div to target for scrolling */}
                <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Form */}
            <form className="chat-input-form" onSubmit={handleSubmit}>
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type message..."
                    maxLength="200" // Increased max length slightly
                    aria-label="Chat message input" // Accessibility
                />
                <button type="submit">Send</button>
            </form>
        </div>
    );
};

export default Chat;