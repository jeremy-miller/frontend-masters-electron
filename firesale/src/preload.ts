import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  onFileOpen: (callback: (content: string) => void) => {
    ipcRenderer.on("file-opened", (_event, content: string) => {
      callback(content);
    });
  },
  showOpenDialog: () => {
    ipcRenderer.send("show-open-dialog");
  },
  showExportHtmlDialog: (html: string) => {
    ipcRenderer.send("show-export-html-dialog", html);
  },
  saveFile: (content: string) => {
    ipcRenderer.send("save-file", content);
  },
  checkForUnsavedChanges: async (content: string) => {
    const result = await ipcRenderer.invoke("has-changes", content);
    return result;
  },
  showInFolder: () => {
    ipcRenderer.send("show-in-folder");
  },
  openInDefaultApp: () => {
    ipcRenderer.send("open-in-default-app");
  },
});
