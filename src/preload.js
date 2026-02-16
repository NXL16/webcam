const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  sendPhoto: (image) => ipcRenderer.send('send-photo', image),
  sendVideo: (video) => ipcRenderer.send('send-video', video)
});
