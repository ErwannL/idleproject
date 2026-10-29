// Pont minimal entre la page du jeu et la fenêtre bureau (aucun accès Node exposé).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  getInfo: () => ipcRenderer.invoke('desktop:getInfo'),
  setAlwaysOnTop: (value) => ipcRenderer.invoke('desktop:setAlwaysOnTop', value),
  setSizePreset: (preset) => ipcRenderer.invoke('desktop:setSizePreset', preset),
  resizeBy: (dw, dh) => ipcRenderer.invoke('desktop:resizeBy', dw, dh),
  growLeft: (dw, dh) => ipcRenderer.invoke('desktop:growLeft', dw, dh),
  restoreGrow: () => ipcRenderer.invoke('desktop:restoreGrow'),
  checkUpdate: (token) => ipcRenderer.invoke('desktop:checkUpdate', token),
  openReleases: () => ipcRenderer.invoke('desktop:openReleases'),
  installUpdate: (token) => ipcRenderer.invoke('desktop:installUpdate', token),
  retryInstaller: () => ipcRenderer.invoke('desktop:retryInstaller'),
});
