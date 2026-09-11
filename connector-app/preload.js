const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('connectorApp', {
  register: (relayDomain, companyCode, email, password, totpCode) => ipcRenderer.invoke('connector:register', { relayDomain, companyCode, email, password, totpCode }),
  openExternal: (url) => ipcRenderer.invoke('connector:openExternal', url),
  logout: () => ipcRenderer.invoke('connector:logout'),
  quit: () => ipcRenderer.invoke('connector:quit'),
  getStatus: () => ipcRenderer.invoke('connector:getStatus'),
  addService: (name, internalAddress) => ipcRenderer.invoke('connector:addService', { name, internalAddress }),
  removeService: (name) => ipcRenderer.invoke('connector:removeService', name),
  toggleService: (name, enabled) => ipcRenderer.invoke('connector:toggleService', { name, enabled }),
});
