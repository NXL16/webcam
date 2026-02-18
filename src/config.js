const Store = require('electron-store')

const store = new Store({
    encryptionKey: process.env.ENCRYPTION_KEY,
    defaults: {
        stealthMode: true, // Mặc định là true (không có tray icon)
        hotkey: 'Control+Shift+Alt+S',
    }
});

module.exports = store;