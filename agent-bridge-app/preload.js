const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bridge', {
  getStatus: () => ipcRenderer.invoke('bridge:getStatus'),
  openService: (url) => ipcRenderer.invoke('bridge:openService', url),
  register: (relayDomain, companyCode, email, password, totpCode) => ipcRenderer.invoke('bridge:register', { relayDomain, companyCode, email, password, totpCode }),
  openExternal: (url) => ipcRenderer.invoke('bridge:openExternal', url),
  forget: () => ipcRenderer.invoke('bridge:forget'),
  quit: () => ipcRenderer.invoke('bridge:quit'),
});
