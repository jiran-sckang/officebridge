const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ob', {
  getStatus: () => ipcRenderer.invoke('ob:getStatus'),
  openExternal: (url) => ipcRenderer.invoke('ob:openExternal', url),
  openAdminWeb: () => ipcRenderer.invoke('ob:openAdminWeb'),
});
