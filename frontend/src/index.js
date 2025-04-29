import React from 'react';
import ReactDOM from 'react-dom/client'; // Use client renderer for React 18+
import './index.css'; // Global styles (can be empty or contain base styles)
import App from './App';
import reportWebVitals from './reportWebVitals'; // For performance monitoring

// Get the root DOM element
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

// Create a root Concurrent Mode instance
const root = ReactDOM.createRoot(rootElement);

// Render the main App component within StrictMode
// StrictMode helps catch potential problems in an application. It activates additional checks and warnings for its descendants.
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();