const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  isElectron: true,
  sendUserCommand: (command) => ipcRenderer.send("run-user-command", command),
  sendInterrupt: () => ipcRenderer.send("shell-interrupt"),
  onShellOutput: (callback) =>
    ipcRenderer.on("shell-output", (event, data) => callback(data)),
  onShellComplete: (callback) =>
    ipcRenderer.on("shell-complete", (event, info) => callback(info)),
  onWindowInit: (callback) =>
    ipcRenderer.on("window-init", (event, info) => callback(info)),
  onShowQrCode: (callback) =>
    ipcRenderer.on("show-qrcode", (event, info) => callback(info)),
  onHideQrCode: (callback) =>
    ipcRenderer.on("hide-qrcode", (event) => callback()),
  onPinnedDirsUpdated: (callback) =>
    ipcRenderer.on("pinned-dirs-updated", (event, info) => callback(info)),
  onShellCommandStart: (callback) =>
    ipcRenderer.on("shell-command-start", (event, info) => callback(info)),
  executeSlashCommand: (command) =>
    ipcRenderer.send("execute-slash-command", command),
  toggleDebugMode: () => ipcRenderer.send("toggle-debug-mode"),
  requestState: () => ipcRenderer.send("request-state"),
  readDir: (dirPath) => ipcRenderer.invoke("read-dir", dirPath),
  readFileContent: (filePath) =>
    ipcRenderer.invoke("read-file-content", filePath),
  saveFileContent: (filePath, content) =>
    ipcRenderer.invoke("save-file-content", filePath, content),
  unpinDir: (dirPath) => ipcRenderer.invoke("unpin-dir", dirPath),
  openInVsCode: (filePath) => ipcRenderer.invoke("open-in-vs-code", filePath),
  readGitStatus: () => ipcRenderer.invoke("read-git-status"),
  stageFile: (filePath) => ipcRenderer.invoke("git-stage-file", filePath),
  unstageFile: (filePath) => ipcRenderer.invoke("git-unstage-file", filePath),
  readFileDiff: (filePath) => ipcRenderer.invoke("read-file-diff", filePath),
  gitFetch: () => ipcRenderer.invoke("git-fetch"),
  gitPull: () => ipcRenderer.invoke("git-pull"),
  gitPush: () => ipcRenderer.invoke("git-push"),
  gitCommit: (message) => ipcRenderer.invoke("git-commit", message),
  gitCommitHistory: () => ipcRenderer.invoke("git-commit-history"),
  getBashCommands: (query) => ipcRenderer.invoke("get-bash-commands", query),
  getScreenSourceId: () => ipcRenderer.invoke("get-screen-source-id"),
  sendWebRtcSignalToMobile: (socketId, signal) =>
    ipcRenderer.send("webrtc-signal-to-mobile", socketId, signal),
  onWebRtcSignal: (callback) =>
    ipcRenderer.on("webrtc-signal", (event, info) => callback(info)),
  onStartScreenStream: (callback) =>
    ipcRenderer.on("start-screen-stream", (event, info) => callback(info)),
  onStopScreenStream: (callback) =>
    ipcRenderer.on("stop-screen-stream", (event, info) => callback(info)),
  sendStreamCropUpdated: (socketId, region) =>
    ipcRenderer.send("stream-crop-updated", socketId, region),
  onUpdateCropRegion: (callback) =>
    ipcRenderer.on("update-crop-region", (event, info) => callback(info)),
  injectMouseMove: (coords) => ipcRenderer.send("inject-mouse-move", coords),
  injectMouseClick: (coords) => ipcRenderer.send("inject-mouse-click", coords),
  injectMouseRightClick: (coords) => ipcRenderer.send("inject-mouse-right-click", coords),
  injectMouseScroll: (delta) => ipcRenderer.send("inject-mouse-scroll", delta),
  injectText: (text) => ipcRenderer.send("inject-text", text),
  injectKeyShortcut: (shortcut) => ipcRenderer.send("inject-key-shortcut", shortcut),
  sendScreenBg: (socketId, jpegData) =>
    ipcRenderer.send("send-screen-bg", socketId, jpegData),
  onFingerprintPrompt: (callback) =>
    ipcRenderer.on("fingerprint-prompt", (event, info) => callback(info)),
  sendSudoPassword: (password) =>
    ipcRenderer.send("sudo-password", password),
});
