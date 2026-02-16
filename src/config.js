require('dotenv').config();

const Store = require( 'electron-store')

const store = new Store({
    encryptionKey: process.env.ENCRYPTION_KEY,
    defaults: {
        stealthMode: false, // Mặc định là false (có tray icon)
        hotkey: 'Control+Shift+Alt+S', // Có thể tùy chỉnh
    }
});

module.exports = store;