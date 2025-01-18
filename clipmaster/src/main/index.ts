import {
  app,
  BrowserWindow,
  clipboard,
  globalShortcut,
  ipcMain,
  Notification,
  Tray,
} from "electron";
import Positioner from "electron-positioner";
import { join } from "node:path";

let tray: Tray | null = null;

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 400,
    minWidth: 300,
    maxWidth: 450,
    height: 600,
    minHeight: 400,
    maxHeight: 800,
    maximizable: false,
    titleBarStyle: "hidden",
    titleBarOverlay: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  // mainWindow.webContents.openDevTools({ mode: "detach" });

  return mainWindow;
};

app.on("ready", () => {
  const browserWindow = createWindow();

  // add to system tray / menu bar
  // const contextMenu = Menu.buildFromTemplate([
  //   {
  //     label: "Show Window",
  //     click: () => {
  //       browserWindow.show();
  //       browserWindow.focus();
  //     },
  //   },
  //   {
  //     label: "Quit",
  //     role: "quit",
  //   },
  // ]);
  tray = new Tray("./src/icons/trayTemplate.png");
  tray.setIgnoreDoubleClickEvents(true);
  // tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    if (!tray) return;
    if (browserWindow.isVisible()) {
      browserWindow.hide();
    } else {
      const positioner = new Positioner(browserWindow);
      const trayPosition = positioner.calculate("trayCenter", tray.getBounds());
      browserWindow.setPosition(trayPosition.x, trayPosition.y, false);
      browserWindow.show();
    }
  });

  // bring app into focus and raise to top
  globalShortcut.register("CommandOrControl+Shift+Alt+V", () => {
    app.focus();
    browserWindow.show();
    browserWindow.focus();
  });
  // trigger OS notification
  globalShortcut.register("CommandOrControl+Shift+Alt+L", () => {
    let content = clipboard.readText();
    content = content.toUpperCase();
    new Notification({
      title: "Capitalized Clipboard Content",
      subtitle: "Clipboard Stuff",
      body: content,
    }).show();
  });
});

app.on("quit", () => {
  globalShortcut.unregisterAll(); // release all shortcuts back to OS
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.on("write-to-clipboard", (_event, content: string) => {
  clipboard.writeText(content);
});

ipcMain.handle("read-from-clipboard", (_event) => {
  return clipboard.readText();
});
