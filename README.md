# Nodesk

Nodesk is a progressive web app (PWA) remote terminal emulator and workspace manager. It allows executing standard shell commands, managing directory pins, editing files in an inline code editor, and managing Git status all from a unified terminal-chat style interface in your browser.

---

## Architecture & Technical Stack

Nodesk is built on a decoupled, client-server PWA architecture:

- **Frontend (Client PWA):** Consists of `index.html`, `style.css`, and `window.js`. It utilizes custom styling, Material Icons, custom scrollbars, and includes a service worker (`sw.js`) for progressive web app functionality.
- **Backend (Node.js Server):** A pure Node.js Express/Socket.io server (`main.js`) that hosts the static frontend files, spawns persistent shell processes (mapping them to connection session IDs), and handles remote command executions, file editing, and git status helpers.

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
- *Note:* The suggestions popup automatically hides once you type a space to let you input arguments naturally.
    - `/clear`: Clears screen history.
    - `/exit`: Closes the current session.
    - `/mobile`: Displays the local network address for companion PWA clients.
    - `/host`: Prints the local HTTP server address.
    - `/fullscreen`: Toggles fullscreen mode.
    - `/add-pin [path]`: Bookmarks/pins a directory in the startup quick access list (defaults to current directory if path is omitted).
    - `/update`: Erases the service worker cache and refreshes the app.

---

## Keyboard Shortcuts

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

### Running the Server

Start the headless server locally or on a remote VPS:

```bash
npm start
```

Access the app by opening `http://localhost:13737` (or the corresponding VPS IP address) in any modern web browser or mobile browser.
