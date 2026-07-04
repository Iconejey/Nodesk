# Nono-Terminal

Nono-Terminal is an Electron-based persistent terminal emulator and workspace manager. It allows executing standard shell commands, managing directory pins, editing files in an inline code editor, and managing Git status all from a unified terminal-chat style interface.

---

## Todo list

- Better file edit output print.
- Handle multi-line shell inputs gracefully.
- Autocompletion for file paths and directory names in the prompt.
- /files slash command to toggle a file explorer view and navigate the workspace files.
- Bash commands regex blacklist.

## Architecture & Technical Stack

Nono-Terminal separates the browser interface from your system using Electron IPC channels:

- **Renderer (Frontend):** Consists of `index.html`, `style.css`, and `window.js`. It utilizes custom styling with the Consolas font, Material Icons, and custom scrollbars.
- **IPC Bridge (`preload.js`):** Exposes safe, context-isolated IPC channels to the renderer.
- **Main Process (`main.js`):** Manages a single-instance app lock, spawns persistent shell processes (mapping them to `event.sender.id`), handles local tool executions (like file editing and git helpers).

---

## Features

### 1. Persistent Terminal Execution

Spawns a persistent `/bin/bash` shell in the background. State features like environment variables, child processes, and current working directories (`$PWD`) are preserved between executions. Directory changes and command completions are detected automatically via tracking delimiters.

### 2. Built-in Code Editor & Diff Viewer

- **Inline File Editor:** Open any file directly in the app using `/open [path]` to edit it on-the-fly.
- **Git Diff & Status Panel:** View staged/unstaged changes, stage/unstage files, and perform commits with a simple UI.

### 3. Advanced UI Controls

- **Output Collapse Modes:** Cycle through output states using `Ctrl+H`:
    - `Full` (Normal): Shows all command outputs.
    - `Collapsed`: Hides all outputs and replaces them with a line-count placeholder button (e.g., `[42 lines of output]`). Clicking a placeholder expands that specific output block.
    - `Last`: Collapses all historical command outputs but keeps the newest one expanded.

### 4. Interactive Autocomplete Slash Commands

Typing a `/` in the prompt opens an autocomplete popup box under the cursor.

- `ArrowUp` / `ArrowDown`: Navigates the suggestions.
- `Tab` / `Enter`: Autocompletes the highlighted suggestion.
- _Note:_ The suggestions popup automatically hides once you type a space to let you input arguments naturally.
    - `/clear`: Clears screen history.
    - `/exit`: Closes the current window.
    - `/mobile`: Displays the local network address for the companion mobile PWA.
    - `/host`: Prints the local HTTP server address.
    - `/fullscreen`: Toggles fullscreen mode.
    - `/add-pin [path]`: Bookmarks/pins a directory in the startup quick access list (defaults to current directory if path is omitted).
    - `/update`: Erases the service worker cache and refreshes the app.

---

## Keyboard Shortcuts

- `Ctrl+R` / `Cmd+R`: Reloads the active window.
- `Ctrl+Shift+I` / `Cmd+Option+I`: Toggles Chromium Developer Tools.
- `Ctrl+Shift+D` / `Cmd+Shift+D`: Toggles debug mode (switches between `electron.html` and `example.html`).
- `Ctrl+H` / `Cmd+H`: Cycles output collapse modes (`Full` ➔ `Collapsed` ➔ `Last`).
- `Ctrl+C`: Interrupts running child processes (via `pkill -INT -P` against the shell PID) without closing the terminal shell.
- `Ctrl+Enter`: Insert line break in command prompt.

---

## Installation & Running

### Dependencies

Ensure Node.js and dependencies are installed:

```bash
npm install
```

### Running on Arch Linux / Hyprland

To ensure Wayland compatibility, fractional display scaling, and correct GPU rendering under tiling managers like Hyprland, it is recommended to run Nono-Terminal using your system-installed `electron` binary:

```bash
electron .
```

or:

```bash
npm start
```
