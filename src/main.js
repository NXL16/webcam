const { app } = require('electron');
const { startTelegramBot, stopTelegramBot } = require('./telebot');

let botStarted = false;

app.whenReady().then(async () => {
  console.log('Background monitor started (headless mode)');

  if (!botStarted) {
    console.log('[main] Khởi động Telegram bot lần đầu...');
    await startTelegramBot();
    botStarted = true;
  } else {
    console.log('[main] Bot đã chạy, bỏ qua launch lại');
  }

  app.on('window-all-closed', () => {
    console.log('[main] Không có window nào, process vẫn sống');
  });
});

app.on('will-quit', () => {
  console.log('[main] App đang quit, dừng bot...');
  stopTelegramBot();
  console.log('Background monitor stopped');
});

// Ngăn quit khi không có window
app.on('window-all-closed', (e) => {
  e.preventDefault();
});

// Debug quit bất ngờ
process.on('exit', (code) => {
  console.log('[process] App exit với code:', code);
});

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection] Lỗi không xử lý:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException] Lỗi không bắt được:', err.message, err.stack);
});