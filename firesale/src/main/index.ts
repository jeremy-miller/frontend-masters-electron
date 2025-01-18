import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  MenuItemConstructorOptions,
  shell,
} from "electron";
import { readFile, writeFile } from "fs/promises";
import { basename, join } from "path";

type MarkdownFile = {
  content?: string;
  filePath?: string;
};

let currentFile: MarkdownFile = {
  content: "",
  filePath: undefined,
};

async function getCurrentFile(browserWindow?: BrowserWindow) {
  if (currentFile.filePath) return currentFile.filePath;
  if (!browserWindow) return;
  return showSaveDialog(browserWindow);
}

function setCurrentFile(
  browserWindow: BrowserWindow,
  filePath: string,
  content: string
) {
  currentFile.content = content;
  currentFile.filePath = filePath;

  app.addRecentDocument(filePath);
  browserWindow.setTitle(`${basename(filePath)} - ${app.name}`);
  browserWindow.setRepresentedFilename(filePath);
}

function hasChanges(content: string) {
  return currentFile.content !== content;
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false, // don't show the window by default, since it will be empty
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

  // wait until the window has loaded the HTML, parsed the JS, etc before showing it
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.openDevTools({
    mode: "detach",
  });

  return mainWindow;
};

app.on("ready", createWindow);

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

async function showOpenDialog(browserWindow: BrowserWindow) {
  const result = await dialog.showOpenDialog(browserWindow, {
    properties: ["openFile"],
    filters: [
      {
        name: "Markdown File",
        extensions: ["md"],
      },
    ],
  });

  if (result.canceled) return;

  const [filePath] = result.filePaths;

  openFile(filePath, browserWindow);
}

async function openFile(filePath: string, browserWindow: BrowserWindow) {
  const content = await readFile(filePath, { encoding: "utf-8" });
  setCurrentFile(browserWindow, filePath, content);
  browserWindow.webContents.send("file-opened", content, filePath);
}

ipcMain.on("show-open-dialog", (event) => {
  const browserWindow = BrowserWindow.fromWebContents(event.sender);

  if (!browserWindow) return;

  showOpenDialog(browserWindow);
});

async function showExportHtmlDialog(
  browserWindow: BrowserWindow,
  html: string
) {
  const result = await dialog.showSaveDialog(browserWindow, {
    title: "Export HTML",
    filters: [{ name: "HTML File", extensions: ["html"] }],
  });

  if (result.canceled) return;

  const { filePath } = result;

  if (!filePath) return;

  exportHtml(filePath, html);
}

async function exportHtml(filePath: string, html: string) {
  await writeFile(filePath, html, { encoding: "utf-8" });
}

ipcMain.on("show-export-html-dialog", async (event, html: string) => {
  const browserWindow = BrowserWindow.fromWebContents(event.sender);

  if (!browserWindow) return;

  showExportHtmlDialog(browserWindow, html);
});

async function showSaveDialog(browserWindow: BrowserWindow) {
  const result = await dialog.showSaveDialog(browserWindow, {
    title: "Save Markdown",
    filters: [{ name: "Markdown File", extensions: ["md"] }],
  });

  if (result.canceled) return;

  const { filePath } = result;

  if (!filePath) return;

  return filePath;
}

async function saveFile(browserWindow: BrowserWindow, content: string) {
  const filePath = await getCurrentFile(browserWindow);

  if (!filePath) return;

  await writeFile(filePath, content, { encoding: "utf-8" });
  setCurrentFile(browserWindow, filePath, content);
}

ipcMain.on("save-file", async (event, content: string) => {
  const browserWindow = BrowserWindow.fromWebContents(event.sender);

  if (!browserWindow) return;

  await saveFile(browserWindow, content);
});

ipcMain.handle("has-changes", async (event, content: string) => {
  const browserWindow = BrowserWindow.fromWebContents(event.sender);

  const changed = hasChanges(content);

  browserWindow?.setDocumentEdited(changed);

  return changed;
});

ipcMain.on("show-in-folder", async () => {
  if (currentFile.filePath) {
    await shell.showItemInFolder(currentFile.filePath);
  }
});

ipcMain.on("open-in-default-app", async () => {
  if (currentFile.filePath) {
    await shell.openPath(currentFile.filePath);
  }
});

const template: MenuItemConstructorOptions[] = [
  {
    label: "File",
    submenu: [
      {
        label: "Open",
        click: () => {
          let browserWindow = BrowserWindow.getFocusedWindow();
          if (!browserWindow) browserWindow = createWindow();
          showOpenDialog(browserWindow);
        },
        accelerator: "CmdOrCtrl+O",
      },
    ],
  },
  {
    label: "Edit",
    role: "editMenu",
  },
];

if (process.platform === "darwin") {
  // macOS assumes first menu option is name of app
  template.unshift({
    label: app.name,
    role: "appMenu",
  });
}

const menu = Menu.buildFromTemplate(template);

Menu.setApplicationMenu(menu);
