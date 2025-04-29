import React, { useState, useRef, useEffect } from 'react';
import './Chat.css'; // Create this CSS file

const Chat = ({ messages = [], onSendMessage }) => {
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef(null); // To auto-scroll chat

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (newMessage.trim()) {
            onSendMessage(newMessage.trim());
            setNewMessage(''); // Clear input after sending
        }
    };

    return (
        <div className="chat-area">
            <h2>Chat</h2>
            <div className="chat-messages">
                {messages.map((msg, index) => (
                    <div key={index} className="chat-message">
                        {/* TODO: Get username based on sender ID */}
                        <span className="sender-name">{msg.sender}: </span>
                        <span className="message-text">{msg.text}</span>
                    </div>
                ))}
                {/* Dummy div to target for scrolling */}
                <div ref={messagesEndRef} />
            </div>
            <form className="chat-input-form" onSubmit={handleSubmit}>
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type message..."
                    maxLength="100"
                />
                <button type="submit">Send</button>
            </form>
        </div>
    );
};

export default Chat;