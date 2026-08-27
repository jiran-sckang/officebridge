const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bridge', {
  getStatus: () => ipcRenderer.invoke('bridge:getStatus'),
  openService: (url) => ipcRenderer.invoke('bridge:openService', url),
  importConfig: () => ipcRenderer.invoke('bridge:importConfig'),
  forget: () => ipcRenderer.invoke('bridge:forget'),
});
