const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('connectorApp', {
  register: (companyCode, email, password, totpCode) => ipcRenderer.invoke('connector:register', { companyCode, email, password, totpCode }),
  logout: () => ipcRenderer.invoke('connector:logout'),
  quit: () => ipcRenderer.invoke('connector:quit'),
  getStatus: () => ipcRenderer.invoke('connector:getStatus'),
  addService: (name, internalAddress) => ipcRenderer.invoke('connector:addService', { name, internalAddress }),
  removeService: (name) => ipcRenderer.invoke('connector:removeService', name),
  toggleService: (name, enabled) => ipcRenderer.invoke('connector:toggleService', { name, enabled }),
});
