/* ============================================================
   preload.js — the only bridge between the page and the OS
   ============================================================ */
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,

  /* storage — kept synchronous so the page's store layer is unchanged */
  load: () => ipcRenderer.sendSync('data:load'),
  save: (json) => ipcRenderer.sendSync('data:save', json),
  paths: () => ipcRenderer.sendSync('data:paths'),

  /* save the sheet on screen as a PDF through a native save dialog */
  savePdf: (suggestedName, portrait) => ipcRenderer.invoke('report:pdf', suggestedName, portrait),

  /* menu commands from the main process */
  onMenu: (handler) => {
    ipcRenderer.on('menu', (_e, command) => handler(command));
  }
});
