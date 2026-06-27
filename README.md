# Nono-Terminal

Nono-Terminal is an Electron-based persistent terminal emulator integrated with an AI assistant agent. It allows executing standard terminal commands side-by-side with natural language AI instructions. The agent can inspect your workspace, search your codebase, edit files using smart diffs, run terminal commands, search the web, and manage git changes.

---

## Todo list

- /web {query} slash command to do a web search : `Add "/web {query}" slash command that uses AI search with query and outputs result.`
- Better file edit output print.
- Handle "**Error:** Request was aborted." response.
- Full git management using commit (messages, button), push, pull and commit history in the currently implemented changes/diff page, renaming it "git management" page.
- /context slash command to view the current context window size and contents.
- Autocompletion for file paths and directory names in the prompt.
- AI autocomplete suggestions for terminal input and code editing.
- /files slash command to toggle a file explorer view and navigate the workspace files.
- Bash commands regex blacklist
- UI for `ask_user_question` agent tool (interactive question/answer UI element in the chat).
- UI for `todo_write` agent tool (task list panel/sidebar).
- UI for `enter_plan_mode` / `exit_plan_mode` (visual indicator of plan mode state).
- True parallel `fleet_execution` using worker threads.
- True async `spawn_subagent` with result callback.

## Architecture & Technical Stack

Nono-Terminal separates the browser interface from your system using Electron IPC channels:

- **Renderer (Frontend):** Consists of `index.html`, `style.css`, and `window.js`. It utilizes custom styling with the Consolas font, Material Icons, and custom scrollbars.
- **IPC Bridge (`preload.js`):** Exposes safe, context-isolated IPC channels to the renderer.
- **Main Process (`main.js`):** Manages a single-instance app lock, spawns persistent shell processes (mapping them to `event.sender.id`), handles local tool executions, and orchestrates the AI reasoning loop.

---

## Features

### 1. Persistent Terminal Execution

Spawns a persistent `/bin/bash` shell in the background. State features like environment variables, child processes, and current working directories (`$PWD`) are preserved between executions. Directory changes and command completions are detected automatically via tracking delimiters.

### 2. AI Agent Integration

The AI agent operates in a reasoning loop using the OpenAI-compatible SDK (default provider: Gemini).

- **Available Tools:**
    - `read_file(path, start_line, end_line)`: Reads specific line ranges from a file. Returns line-numbered output (`cat -n` style). Window capped at 2000 lines per call.
    - `write_to_file(path, content)`: Atomically creates or overwrites a file with the given content. Parent directories are created automatically.
    - `replace_in_file(path, diff)`: Performs surgical, multi-block edits using `<<<<<<< SEARCH / ======= / >>>>>>> REPLACE` diff syntax. Validates uniqueness of each block before applying.
    - `list_files(path, recursive)`: Lists directory contents. With `recursive: true`, walks the entire subtree. Capped at 1000 entries.
    - `search_files(path, regex, file_pattern)`: Regex search across files using `ripgrep` (falls back to native JS walker if `rg` is not installed). Results include surrounding context lines.
    - `list_code_definition_names(path)`: Scans top-level source files in a directory and extracts high-level definitions (functions, classes, interfaces, types) without reading full implementations.
    - `execute_command(command, requires_approval, timeout_ms)`: Runs a command in the persistent shell and streams outputs. Interactive commands are forbidden. Supports optional timeout (max 20 min).
    - `todo_write(tasks)`: Creates or updates a structured task list for complex multi-step goals. Mandatory for tasks with more than 3 steps.
    - `spawn_subagent(agent_type, instruction)`: Delegates a research or analysis subtask to an isolated subagent context to avoid polluting the main session history.
    - `ask_user_question(question, options, multi_select)`: Pauses autonomous execution and forwards a question to the user UI when a required parameter is ambiguous.
    - `enter_plan_mode(reason)`: Activates read-only planning mode. Prevents file writes and destructive commands until the plan is validated by the user.
    - `exit_plan_mode(confirm_ready)`: Exits planning mode and restores write access.
    - `schedule_action(duration_seconds, prompt)`: Schedules a deferred agent invocation after a given delay (e.g. to monitor a background build process).
    - `fleet_execution(tasks)`: Dispatches multiple independent tasks for parallel processing.
    - `web_search(query)`: Searches the web using Google Search grounding via the Gemini API and returns a synthesized answer with sources.
    - `workspace_changed_files()`: Lists all files with uncommitted git changes (`git status --porcelain`).
    - `file_changes(path)`: Shows the full uncommitted diff for a specific file (`git diff HEAD`).
- **Abort & Retry:** Network calls feature a 30-second timeout wrapper (`callOpenAiWithRetry`) that retries up to 3 times on transient issues.
- **Context Truncation:** To manage context window size and costs, older `read_file`, `search_files`, and `list_code_definition_names` tool responses are automatically truncated as the conversation grows (keeps the 5 most recent).
- **Error Loop Halting:** The agent will halt execution if a tool fails 3 consecutive times, preventing runaway loops.
- **Repo Map Context:** Generates a tree map of the repository (respecting `.gitignore`) and injects it into the agent upon start.
- **Plan Mode:** The system prompt enforces structured planning for complex tasks via `todo_write` (mandatory for >3-step tasks) and the `enter_plan_mode`/`exit_plan_mode` pair.

### 3. Advanced UI Controls

- **Reasoning Process Dropdowns:** Streams `<thinking>...</thinking>` reasoning blocks into a collapsible `<details>` element in the UI, keeping the main terminal view clean.
- **Unified Diff Markup:** Edits made via `write_to_file` and `replace_in_file` are displayed as a colorized unified diff highlighting additions in green and deletions in red.
- **Dynamic Prompt Chevron:** Automatically checks the input heuristic: if it looks like a natural language prompt, the prompt chevron turns purple (`var(--purple)`). If it looks like a shell command, the chevron remains green (`var(--green)`).
- **Output Collapse Modes:** Cycle through output states using `Ctrl+H`:
    - `Full` (Normal): Shows all command outputs.
    - `Collapsed`: Hides all outputs and replaces them with a line-count placeholder button (e.g., `[42 lines of output]`). Clicking a placeholder expands that specific output block.
    - `Last`: Collapses all historical command outputs but keeps the newest one expanded.

### 4. Interactive Autocomplete Slash Commands

Typing a `/` in the prompt opens an autocomplete popup box under the cursor.

- `ArrowUp` / `ArrowDown`: Navigates the suggestions.
- `Tab` / `Enter`: Autocompletes the highlighted suggestion.
- _Note:_ The suggestions popup automatically hides once you type a space to let you input arguments naturally.
    - `/clear`: Clears screen history and resets the agent message context.
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
# Run using system-wide Electron
electron .
```

or:

```bash
# Fallback to npm script (which calls system electron if npm local devDependencies are removed)
npm start
```

### Configuration

Configuration is managed via `config.json` (user overrides) and `default_config.json` (defaults). Key fields:

```json
{
  "api_key": "YOUR_GEMINI_API_KEY",
  "flash_model": "gemini-2.5-flash",
  "pro_model": "gemini-2.5-pro-preview"
}
```

The `pro_model` is used when the user explicitly requests a higher-quality response (e.g. via a "use pro" toggle in the UI).
