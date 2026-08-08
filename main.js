/* ============================================================
   main.js — Electron main process
   Medical Centre Stock Register (desktop)

   Runs the same HTML/JS app inside a native window and keeps the
   register in a real file on disk instead of browser storage.
   ============================================================ */
'use strict';

const { app, BrowserWindow, Menu, dialog, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_NAME = 'Medical Centre Stock Register';

let win = null;

/* ------------------------------------------------------------
   where the data lives
   ------------------------------------------------------------ */

function dataDir() { return app.getPath('userData'); }
function dataFile() { return path.join(dataDir(), 'stock-data.json'); }
function backupDir() { return path.join(dataDir(), 'backups'); }

function readData() {
  try {
    return fs.readFileSync(dataFile(), 'utf8');
  } catch (e) {
    return null;                       // first run — renderer uses its defaults
  }
}

function writeData(json) {
  fs.mkdirSync(dataDir(), { recursive: true });
  // write to a temp file first so a crash mid-write cannot corrupt the register
  const tmp = dataFile() + '.tmp';
  fs.writeFileSync(tmp, json, 'utf8');
  fs.renameSync(tmp, dataFile());
  dailyBackup(json);
  return true;
}

/** Keeps one automatic snapshot per day, last 30 kept. */
function dailyBackup(json) {
  try {
    const d = new Date();
    const stamp = d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
    fs.mkdirSync(backupDir(), { recursive: true });
    const file = path.join(backupDir(), 'stock-' + stamp + '.json');
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, json, 'utf8');
      const old = fs.readdirSync(backupDir())
        .filter(f => f.startsWith('stock-') && f.endsWith('.json'))
        .sort();
      while (old.length > 30) {
        fs.unlinkSync(path.join(backupDir(), old.shift()));
      }
    }
  } catch (e) {
    // a failed snapshot must never block saving the register itself
    console.error('backup snapshot failed:', e.message);
  }
}

/* ------------------------------------------------------------
   IPC — the renderer's storage adapter talks to these
   ------------------------------------------------------------ */

ipcMain.on('data:load', (e) => { e.returnValue = readData(); });

ipcMain.on('data:save', (e, json) => {
  try { writeData(json); e.returnValue = { ok: true }; }
  catch (err) { e.returnValue = { ok: false, error: err.message }; }
});

ipcMain.on('data:paths', (e) => {
  e.returnValue = { dataFile: dataFile(), backupDir: backupDir(), version: app.getVersion() };
});

ipcMain.handle('report:pdf', async (e, suggestedName) => {
  const res = await dialog.showSaveDialog(win, {
    title: 'Save report as PDF',
    defaultPath: path.join(app.getPath('documents'), suggestedName || 'stock-report.pdf'),
    filters: [{ name: 'PDF document', extensions: ['pdf'] }]
  });
  if (res.canceled || !res.filePath) return { ok: false, canceled: true };
  try {
    const pdf = await win.webContents.printToPDF({
      landscape: true,
      pageSize: 'A4',
      printBackground: true,
      margins: { top: 0.4, bottom: 0.4, left: 0.3, right: 0.3 }
    });
    fs.writeFileSync(res.filePath, pdf);
    shell.showItemInFolder(res.filePath);
    return { ok: true, path: res.filePath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

/* ------------------------------------------------------------
   backup / restore through native dialogs
   ------------------------------------------------------------ */

async function exportBackup() {
  const json = readData();
  if (!json) {
    dialog.showMessageBox(win, { type: 'info', message: 'There is nothing to back up yet.' });
    return;
  }
  const d = new Date();
  const stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
    '-' + String(d.getDate()).padStart(2, '0');
  const res = await dialog.showSaveDialog(win, {
    title: 'Save backup',
    defaultPath: path.join(app.getPath('documents'), 'stock-backup-' + stamp + '.json'),
    filters: [{ name: 'Stock backup', extensions: ['json'] }]
  });
  if (res.canceled || !res.filePath) return;
  fs.writeFileSync(res.filePath, json, 'utf8');
  const open = await dialog.showMessageBox(win, {
    type: 'info',
    message: 'Backup saved.',
    detail: res.filePath,
    buttons: ['OK', 'Show in folder'],
    defaultId: 0
  });
  if (open.response === 1) shell.showItemInFolder(res.filePath);
}

async function importBackup() {
  const res = await dialog.showOpenDialog(win, {
    title: 'Restore from backup',
    properties: ['openFile'],
    filters: [{ name: 'Stock backup', extensions: ['json'] }]
  });
  if (res.canceled || !res.filePaths.length) return;

  let json, parsed;
  try {
    json = fs.readFileSync(res.filePaths[0], 'utf8');
    parsed = JSON.parse(json);
  } catch (e) {
    dialog.showErrorBox('Cannot restore', 'That file is not a valid backup file.');
    return;
  }
  if (!parsed || !Array.isArray(parsed.items)) {
    dialog.showErrorBox('Cannot restore', 'That file is not a stock register backup.');
    return;
  }

  const confirm = await dialog.showMessageBox(win, {
    type: 'warning',
    message: 'Restore this backup?',
    detail: parsed.items.length + ' items and ' + (parsed.txns || []).length +
      ' entries will replace everything currently in the register.',
    buttons: ['Cancel', 'Restore'],
    defaultId: 0,
    cancelId: 0
  });
  if (confirm.response !== 1) return;

  writeData(json);
  win.reload();
}

/* ------------------------------------------------------------
   menu
   ------------------------------------------------------------ */

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function buildMenu() {
  const template = [
    {
      label: '&File',
      submenu: [
        { label: 'Add Item…', accelerator: 'CmdOrCtrl+N', click: () => send('menu', 'new-item') },
        { label: 'Record Receipt / Issue', accelerator: 'CmdOrCtrl+E', click: () => send('menu', 'new-txn') },
        { label: 'New Prescription', accelerator: 'CmdOrCtrl+R', click: () => send('menu', 'new-rx') },
        { label: 'New Referral', accelerator: 'CmdOrCtrl+D', click: () => send('menu', 'new-referral') },
        { type: 'separator' },
        { label: 'Save Backup…', accelerator: 'CmdOrCtrl+B', click: exportBackup },
        { label: 'Restore from Backup…', click: importBackup },
        { label: 'Open Data Folder', click: () => { fs.mkdirSync(dataDir(), { recursive: true }); shell.openPath(dataDir()); } },
        { type: 'separator' },
        { label: 'Print Report…', accelerator: 'CmdOrCtrl+P', click: () => send('menu', 'print') },
        { label: 'Save Report as PDF…', accelerator: 'CmdOrCtrl+Shift+P', click: () => send('menu', 'pdf') },
        { type: 'separator' },
        { label: 'Exit', role: 'quit' }
      ]
    },
    {
      label: '&Go',
      submenu: [
        { label: 'Dashboard', accelerator: 'CmdOrCtrl+1', click: () => send('menu', 'go:dashboard') },
        { label: 'Item Master', accelerator: 'CmdOrCtrl+2', click: () => send('menu', 'go:items') },
        { label: 'Receipt / Issue', accelerator: 'CmdOrCtrl+3', click: () => send('menu', 'go:txns') },
        { label: 'Prescriptions', accelerator: 'CmdOrCtrl+4', click: () => send('menu', 'go:rx') },
        { label: 'Referrals', accelerator: 'CmdOrCtrl+5', click: () => send('menu', 'go:referrals') },
        { label: 'Monthly Stock', accelerator: 'CmdOrCtrl+6', click: () => send('menu', 'go:monthly') },
        { label: 'Asset Maintenance', accelerator: 'CmdOrCtrl+7', click: () => send('menu', 'go:maint') },
        { label: 'Print Reports', accelerator: 'CmdOrCtrl+8', click: () => send('menu', 'go:reports') },
        { label: 'Settings & Backup', accelerator: 'CmdOrCtrl+9', click: () => send('menu', 'go:settings') }
      ]
    },
    {
      label: '&Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }
      ]
    },
    {
      label: '&View',
      submenu: [
        { role: 'reload' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { label: 'Developer Tools', accelerator: 'F12', role: 'toggleDevTools' }
      ]
    },
    {
      label: '&Help',
      submenu: [
        { label: 'User Guide', click: () => send('menu', 'guide') },
        { label: 'Load Sample Data', click: () => send('menu', 'sample') },
        { type: 'separator' },
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(win, {
              type: 'info',
              title: 'About',
              message: APP_NAME,
              detail:
                'Version ' + app.getVersion() + '\n\n' +
                'Stock register for medicines, disposable items and permanent assets, ' +
                'with monthly closing and printable register sheets.\n\n' +
                'Register file:\n' + dataFile() + '\n\n' +
                'Daily snapshots:\n' + backupDir() + '\n\n' +
                'Electron ' + process.versions.electron + ' · Chromium ' + process.versions.chrome
            });
          }
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ------------------------------------------------------------
   window
   ------------------------------------------------------------ */

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: '#f4f6f8',
    title: APP_NAME,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.loadFile(path.join(__dirname, 'index.html'));

  // keep the app self-contained: external links go to the real browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) { e.preventDefault(); shell.openExternal(url); }
  });

  win.on('closed', () => { win = null; });
}

/* ------------------------------------------------------------
   lifecycle
   ------------------------------------------------------------ */

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });

  app.whenReady().then(() => {
    buildMenu();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
