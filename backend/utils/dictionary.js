const fs = require('fs');
const path = require('path');

const dictionaryPath = path.join(__dirname, '../data/dictionary.txt'); // Path to your word list
let wordSet = new Set();
let isLoaded = false;

/**
 * Loads the dictionary file into a Set for efficient lookups.
 */
function loadDictionary() {
    try {
        console.log(`Attempting to load dictionary from: ${dictionaryPath}`);
        const data = fs.readFileSync(dictionaryPath, 'utf8');
        const words = data.split(/\r?\n/); // Split by newline, handle Windows/Unix endings
        wordSet = new Set(words.map(word => word.trim().toUpperCase())); // Trim whitespace and store uppercase
        isLoaded = true;
        console.log(`Dictionary loaded successfully. ${wordSet.size} words.`);
    } catch (err) {
        console.error("Error loading dictionary:", err);
        console.error("Please ensure 'data/dictionary.txt' exists in the backend directory.");
        isLoaded = false;
    }
}

/**
 * Checks if a word exists in the loaded dictionary (case-insensitive).
 * @param {string} word - The word to check.
 * @returns {boolean} - True if the word is valid, false otherwise.
 */
function isValidWord(word) {
    if (!isLoaded) {
        console.warn("Dictionary not loaded. Cannot validate word.");
        return false; // Or maybe throw an error, or attempt reload
    }
    return wordSet.has(word.toUpperCase());
}

// Load the dictionary when the module is required
loadDictionary();

module.exports = {
    isValidWord,
    loadDictionary // Expose load function if needed elsewhere (e.g., for reloading)
};