const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bridge', {
  getStatus: () => ipcRenderer.invoke('bridge:getStatus'),
  openService: (url) => ipcRenderer.invoke('bridge:openService', url),
  register: (relayDomain, companyCode, email, password) => ipcRenderer.invoke('bridge:register', { relayDomain, companyCode, email, password }),
  forget: () => ipcRenderer.invoke('bridge:forget'),
  quit: () => ipcRenderer.invoke('bridge:quit'),
});
