const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('connectorApp', {
  register: (companyCode, email, password) => ipcRenderer.invoke('connector:register', { companyCode, email, password }),
  logout: () => ipcRenderer.invoke('connector:logout'),
  getStatus: () => ipcRenderer.invoke('connector:getStatus'),
  addService: (name, internalAddress) => ipcRenderer.invoke('connector:addService', { name, internalAddress }),
  removeService: (name) => ipcRenderer.invoke('connector:removeService', name),
  toggleService: (name, enabled) => ipcRenderer.invoke('connector:toggleService', { name, enabled }),
});
