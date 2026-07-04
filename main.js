const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const QRCode = require('qrcode');

const active_sessions = new Map();
let web_server = null;
let io_server = null;
let server_port = 0;

let cachedHyprlandSocketPath = null;
if (process.env.XDG_RUNTIME_DIR && process.env.HYPRLAND_INSTANCE_SIGNATURE) {
	cachedHyprlandSocketPath = path.join(process.env.XDG_RUNTIME_DIR, 'hypr', process.env.HYPRLAND_INSTANCE_SIGNATURE, '.socket.sock');
}

let cachedDisplaySize = null;

function getPrimaryDisplaySize() {
	if (!cachedDisplaySize) {
		try {
			const { execSync } = require('child_process');
			const stdout = execSync('hyprctl monitors', { encoding: 'utf8' });
			const match = stdout.match(/(\d+)x(\d+)@[\d.]+/);
			if (match) {
				cachedDisplaySize = {
					width: parseInt(match[1], 10),
					height: parseInt(match[2], 10)
				};
			}
		} catch (e) {
			// fallback
		}
		if (!cachedDisplaySize) {
			cachedDisplaySize = { width: 1920, height: 1080 };
		}
	}
	return cachedDisplaySize;
}

function sendHyprlandCommand(cmd) {
	if (!cachedHyprlandSocketPath) return;
	try {
		const client = net.createConnection(cachedHyprlandSocketPath, () => {
			client.write(cmd);
		});
		client.on('data', () => {
			client.end();
		});
		client.on('error', err => {
			// ignore
		});
	} catch (e) {
		// ignore
	}
}

function performMouseClick() {
	exec('ydotool click 0xC0', ydotoolErr => {
		if (!ydotoolErr) return;
		exec('wlrctl pointer click', wlrctlErr => {
			if (!wlrctlErr) return;
			exec("echo 'click left' | dotool", dotoolErr => {
				if (!dotoolErr) return;
				exec('xdotool click 1', xdotoolErr => {
					if (!xdotoolErr) return;
					console.error(
						'Failed to simulate mouse click: ydotool, wlrctl, dotool, and xdotool all failed.\n' +
							`  - ydotool error: ${ydotoolErr.message.trim()}\n` +
							`  - wlrctl error: ${wlrctlErr.message.trim()}\n` +
							`  - dotool error: ${dotoolErr.message.trim()}\n` +
							`  - xdotool error: ${xdotoolErr.message.trim()}\n\n` +
							'Please ensure at least one of these tools is installed and properly configured.\n' +
							'For Wayland/Hyprland, ydotool (with ydotoold running) or wlrctl is recommended.\n' +
							'For X11/XWayland, xdotool is recommended.'
					);
				});
			});
		});
	});
}

function performMouseRightClick() {
	exec('ydotool click 0xC1', ydotoolErr => {
		if (!ydotoolErr) return;
		exec('wlrctl pointer click right', wlrctlErr => {
			if (!wlrctlErr) return;
			exec("echo 'click right' | dotool", dotoolErr => {
				if (!dotoolErr) return;
				exec('xdotool click 3', xdotoolErr => {
					if (!xdotoolErr) return;
					console.error('Failed to simulate mouse right click: ydotool, wlrctl, dotool, and xdotool all failed.');
				});
			});
		});
	});
}

function performMouseScroll(dx, dy) {
	const ydotoolCmd = `ydotool mousemove -w -- ${Math.round(dx)} ${Math.round(dy)}`;
	const wlrctlCmd = `wlrctl pointer scroll ${Math.round(-dy)} ${Math.round(dx)}`;

	let dotoolCmds = [];
	if (dy > 0) dotoolCmds.push('wheel up');
	if (dy < 0) dotoolCmds.push('wheel down');
	if (dx > 0) dotoolCmds.push('wheel right');
	if (dx < 0) dotoolCmds.push('wheel left');
	const dotoolCmd = dotoolCmds.length > 0 ? `echo '${dotoolCmds.join('\n')}' | dotool` : 'true';

	let xdotoolCmds = [];
	const stepsY = Math.abs(Math.round(dy));
	const clickY = dy > 0 ? 4 : 5;
	for (let i = 0; i < stepsY; i++) {
		xdotoolCmds.push(`xdotool click ${clickY}`);
	}
	const stepsX = Math.abs(Math.round(dx));
	const clickX = dx < 0 ? 6 : 7;
	for (let i = 0; i < stepsX; i++) {
		xdotoolCmds.push(`xdotool click ${clickX}`);
	}
	const xdotoolCmd = xdotoolCmds.length > 0 ? xdotoolCmds.join(' && ') : 'true';

	exec(ydotoolCmd, ydotoolErr => {
		if (!ydotoolErr) return;
		exec(wlrctlCmd, wlrctlErr => {
			if (!wlrctlErr) return;
			exec(dotoolCmd, dotoolErr => {
				if (!dotoolErr) return;
				exec(xdotoolCmd, xdotoolErr => {
					if (!xdotoolErr) return;
					console.error('Failed to simulate mouse scroll using ydotool, wlrctl, dotool, or xdotool.');
				});
			});
		});
	});
}

function injectTextToSystem(text) {
	if (!text) return;
	const ydotool = spawn('ydotool', ['type', '--file', '-']);
	ydotool.stdin.write(text);
	ydotool.stdin.end();
	ydotool.on('error', err => {
		console.error('Failed to inject text using ydotool:', err);
	});
}

const KEY_CODES = {
	ctrl: 29,
	shift: 42,
	alt: 56,
	super: 125,
	win: 125,
	meta: 125,
	escape: 1,
	esc: 1,
	enter: 28,
	space: 57,
	tab: 15,
	backspace: 14,
	delete: 111,
	del: 111,
	insert: 110,
	ins: 110,
	pageup: 104,
	pgup: 104,
	pagedown: 109,
	pgdn: 109,
	home: 102,
	end: 107,
	up: 103,
	down: 108,
	left: 105,
	right: 106,
	a: 30,
	b: 48,
	c: 46,
	d: 32,
	e: 18,
	f: 33,
	g: 34,
	h: 35,
	i: 23,
	j: 36,
	k: 37,
	l: 38,
	m: 50,
	n: 49,
	o: 24,
	p: 25,
	q: 16,
	r: 19,
	s: 31,
	t: 20,
	u: 22,
	v: 47,
	w: 17,
	x: 45,
	y: 21,
	z: 44,
	1: 2,
	2: 3,
	3: 4,
	4: 5,
	5: 6,
	6: 7,
	7: 8,
	8: 9,
	9: 10,
	0: 11,
	f1: 59,
	f2: 60,
	f3: 61,
	f4: 62,
	f5: 63,
	f6: 64,
	f7: 65,
	f8: 66,
	f9: 67,
	f10: 68,
	f11: 87,
	f12: 88
};

function triggerKeyShortcut(shortcut) {
	if (!shortcut) return;
	const keys = shortcut
		.toLowerCase()
		.split('+')
		.map(k => k.trim())
		.filter(Boolean);
	const codes = keys.map(k => KEY_CODES[k]).filter(c => c !== undefined);
	if (codes.length === 0) {
		console.error(`Invalid shortcut keys: ${shortcut}`);
		return;
	}
	const pressSeq = codes.map(c => `${c}:1`);
	const releaseSeq = [...codes].reverse().map(c => `${c}:0`);
	const sequence = [...pressSeq, ...releaseSeq];
	const ydotool = spawn('ydotool', ['key', ...sequence]);
	ydotool.on('error', err => {
		console.error('Failed to run ydotool key shortcut:', err);
	});
}

function getLocalIpAddress() {
	const interfaces = os.networkInterfaces();
	for (const name of Object.keys(interfaces)) {
		for (const iface of interfaces[name]) {
			if ((iface.family === 'IPv4' || iface.family === 4) && !iface.internal) {
				return iface.address;
			}
		}
	}
	return '127.0.0.1';
}

function sendToWindow(windowId, eventName, ...args) {
	if (io_server) {
		io_server.to(`window_${windowId}`).emit(eventName, ...args);
	}
}

function startMobileServer() {
	if (web_server) {
		return Promise.resolve(server_port);
	}

	const expressApp = express();
	const httpServer = http.createServer(expressApp);

	// Enable socket.io CORS so PWA from VPS can connect
	io_server = socketIo(httpServer, {
		cors: {
			origin: '*',
			methods: ['GET', 'POST']
		},
		handlePreflightRequest: (req, res) => {
			const headers = {
				'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Origin, Accept',
				'Access-Control-Allow-Origin': req.headers.origin || '*',
				'Access-Control-Allow-Credentials': 'true',
				'Access-Control-Allow-Private-Network': 'true'
			};
			res.writeHead(204, headers);
			res.end();
		}
	});

	io_server.engine.on('headers', (headers, req) => {
		headers['Access-Control-Allow-Private-Network'] = 'true';
		headers['Access-Control-Allow-Origin'] = req.headers.origin || '*';
		headers['Access-Control-Allow-Credentials'] = 'true';
	});

	// Enable CORS headers in Express
	expressApp.use((req, res, next) => {
		res.header('Access-Control-Allow-Origin', '*');
		res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
		res.header('Access-Control-Allow-Private-Network', 'true');
		next();
	});

	// REST API endpoint to list active terminal sessions for scanning/discovery
	expressApp.get('/api/active-windows', (req, res) => {
		const list = [];
		for (const [id, data] of active_sessions.entries()) {
			list.push({
				id: id,
				cwd: data.session.current_cwd || process.cwd(),
				startTime: data.startTime || Date.now()
			});
		}
		res.json({ windows: list });
	});

	// Ping endpoint for fast subnet scans
	expressApp.get('/ping', (req, res) => {
		res.send('pong');
	});

	expressApp.use(express.static(path.join(__dirname, 'window')));

	io_server.on('connection', socket => {
		let joinedRoom = null;
		let current_crop = { x: 0, y: 0, w: 1, h: 1 };
		let cursor_sync_interval = null;
		let last_cursor_pos = { x: 0, y: 0 };

		const getWindowData = windowId => {
			const wId = windowId ? String(windowId) : '1';
			let data = active_sessions.get(wId);
			if (!data) {
				const session = new ShellSession(wId, os.homedir());
				data = {
					id: wId,
					session,
					startTime: Date.now()
				};
				active_sessions.set(wId, data);
				console.log(`Created new ShellSession for sessionId: ${wId}`);
			}
			return data;
		};

		socket.on('register', async ({ windowId }) => {
			const data = getWindowData(windowId);
			if (data) {
				const sessionId = data.id;
				joinedRoom = `window_${sessionId}`;
				socket.join(joinedRoom);
				console.log(`Socket client joined room: ${joinedRoom} (requested: ${windowId})`);

				socket.emit('window-init', {
					windowId: sessionId,
					cwd: data.session.current_cwd,
					availableCommands: getAvailableCommands(),
					historyHtml: '',
					pinnedDirs: getPinnedDirectories(),
					homeDir: os.homedir(),
					displaySize: getPrimaryDisplaySize()
				});
			}
		});

		socket.on('run-user-command', ({ windowId, command }) => {
			const data = getWindowData(windowId);
			if (data) {
				const sessionId = data.id;
				sendToWindow(sessionId, 'shell-command-start', { command });
				data.session.writeCommand(command, info => {
					sendToWindow(sessionId, 'shell-complete', info);
				});
			}
		});

		socket.on('shell-interrupt', ({ windowId }) => {
			const data = getWindowData(windowId);
			if (data) {
				data.session.interrupt();
			}
		});

		socket.on('execute-slash-command', ({ windowId, command }) => {
			const data = getWindowData(windowId);
			if (data) {
				executeSlashCommandForWindow(data.id, command);
			}
		});

		socket.on('sudo-password', ({ windowId, password }) => {
			const data = getWindowData(windowId);
			if (data) {
				data.session.shell_proc.stdin.write(password + '\n');
			}
		});

		socket.on('request-state', async ({ windowId }) => {
			const data = getWindowData(windowId);
			if (data) {
				const sessionId = data.id;
				socket.emit('window-init', {
					windowId: sessionId,
					cwd: data.session.current_cwd,
					availableCommands: getAvailableCommands(),
					historyHtml: '',
					pinnedDirs: getPinnedDirectories(),
					homeDir: os.homedir(),
					displaySize: getPrimaryDisplaySize()
				});
			}
		});

		socket.on('toggle-debug-mode', ({ windowId }) => {
			// No-op
		});

		socket.on('read-dir', ({ windowId, dirPath }, callback) => {
			const data = getWindowData(windowId);
			const base = data ? data.session.current_cwd : process.cwd();
			const resolved = path.resolve(base, dirPath || '.');
			const res = listDirectory(resolved);
			if (res.error) {
				callback({ resolved, error: res.error, code: res.code });
			} else {
				callback({ resolved, items: res });
			}
		});

		socket.on('unpin-dir', ({ windowId, dirPath }, callback) => {
			const pinned_dirs = getPinnedDirectories();
			const idx = pinned_dirs.indexOf(dirPath);
			if (idx !== -1) {
				pinned_dirs.splice(idx, 1);
				savePinnedDirectories(pinned_dirs);
				const data = getWindowData(windowId);
				if (data) {
					sendToWindow(data.id, 'pinned-dirs-updated', {
						pinned_dirs: pinned_dirs,
						home_dir: os.homedir()
					});
				}
				if (callback) callback({ success: true, pinned_dirs: pinned_dirs });
			} else {
				if (callback)
					callback({
						success: false,
						error: 'Directory not found in pinned list'
					});
			}
		});

		socket.on('read-file-content', ({ windowId, filePath }, callback) => {
			const data = getWindowData(windowId);
			const base = data ? data.session.current_cwd : process.cwd();
			const resolved = path.resolve(base, filePath);
			try {
				const content = fs.readFileSync(resolved, 'utf8');
				callback({ resolved, content });
			} catch (err) {
				callback({ resolved, error: err.message, code: err.code });
			}
		});

		socket.on('save-file-content', async ({ windowId, filePath, content }, callback) => {
			const data = getWindowData(windowId);
			const base = data ? data.session.current_cwd : process.cwd();
			const resolved = path.resolve(base, filePath);
			try {
				let formattedContent = content;
				let formatted = false;
				try {
					const prettier = require('prettier');
					const fileInfo = await prettier.getFileInfo(resolved);
					if (fileInfo && !fileInfo.ignored && fileInfo.inferredParser) {
						const vscodeConfig = getVsCodePrettierConfig();
						const projectConfig = await prettier.resolveConfig(resolved);
						formattedContent = await prettier.format(content, {
							...vscodeConfig,
							...projectConfig,
							parser: fileInfo.inferredParser
						});
						formatted = true;
					}
				} catch (prettierErr) {
					console.error('Prettier formatting failed:', prettierErr);
				}
				fs.writeFileSync(resolved, formattedContent, 'utf8');
				callback({ resolved, success: true, formatted, formattedContent });
			} catch (err) {
				callback({ resolved, error: err.message, code: err.code });
			}
		});

		socket.on('open-in-vs-code', ({ windowId, filePath }, callback) => {
			const data = getWindowData(windowId);
			const base = data ? data.session.current_cwd : process.cwd();
			const resolved = path.resolve(base, filePath);
			exec(`code "${resolved}"`, err => {
				if (err) callback({ error: err.message });
				else callback({ success: true });
			});
		});

		socket.on('read-git-status', async ({ windowId }, callback) => {
			const data = getWindowData(windowId);
			const base = data ? data.session.current_cwd : process.cwd();
			exec('git status --porcelain', { cwd: base }, (err, stdout, stderr) => {
				if (err && err.code !== 0) {
					callback({ error: stderr || err.message });
					return;
				}
				const lines = stdout.split('\n');
				const staged = [];
				const unstaged = [];
				for (const line of lines) {
					if (!line.trim()) continue;
					const x = line[0];
					const y = line[1];
					let filePath = line.substring(3).trim();
					if (filePath.startsWith('"') && filePath.endsWith('"')) {
						filePath = filePath.substring(1, filePath.length - 1);
					}
					if (x !== ' ' && x !== '?') {
						let type = 'edit';
						if (x === 'A') type = 'addition';
						else if (x === 'D') type = 'deletion';
						staged.push({ path: filePath, type });
					}
					if (y !== ' ' && y !== undefined) {
						let type = 'edit';
						if (y === 'A' || x === '?') type = 'addition';
						else if (y === 'D') type = 'deletion';
						unstaged.push({ path: filePath, type });
					} else if (x === '?') {
						unstaged.push({ path: filePath, type: 'addition' });
					}
				}
				callback({ staged, unstaged });
			});
		});

		socket.on('git-stage-file', ({ windowId, filePath }, callback) => {
			const data = getWindowData(windowId);
			const base = data ? data.session.current_cwd : process.cwd();
			exec(`git add "${filePath}"`, { cwd: base }, (err, stdout, stderr) => {
				if (err) callback({ error: stderr || err.message });
				else callback({ success: true });
			});
		});

		socket.on('git-unstage-file', ({ windowId, filePath }, callback) => {
			const data = getWindowData(windowId);
			const base = data ? data.session.current_cwd : process.cwd();
			exec(`git reset HEAD "${filePath}"`, { cwd: base }, (err, stdout, stderr) => {
				if (err) callback({ error: stderr || err.message });
				else callback({ success: true });
			});
		});

		socket.on('read-file-diff', ({ windowId, filePath }, callback) => {
			const data = getWindowData(windowId);
			const base = data ? data.session.current_cwd : process.cwd();
			const resolved = path.resolve(base, filePath);
			exec(`git status --porcelain -- "${resolved}"`, { cwd: base }, (err, stdout, stderr) => {
				if (err) {
					callback({ resolved, error: stderr || err.message });
					return;
				}
				const isUntracked = stdout.startsWith('??');
				let diffCmd = `git diff HEAD -U999999 -- "${resolved}"`;
				if (isUntracked) {
					diffCmd = `git diff --no-index -U999999 -- /dev/null "${resolved}"`;
				}
				exec(diffCmd, { cwd: base }, (diffErr, diffStdout, diffStderr) => {
					if (diffErr && diffErr.code !== 1 && diffErr.code !== 0) {
						callback({ resolved, error: diffStderr || diffErr.message });
						return;
					}
					callback({ resolved, diff: diffStdout });
				});
			});
		});

		socket.on('start-screen-stream', () => {
			console.log('Socket client requested screen stream start');

			if (cursor_sync_interval) {
				clearInterval(cursor_sync_interval);
			}
			cursor_sync_interval = setInterval(() => {
				exec('hyprctl cursorpos', (err, stdout) => {
					if (!err && stdout) {
						const parts = stdout.trim().split(/,\s*/);
						if (parts.length === 2) {
							const curX = parseFloat(parts[0]);
							const curY = parseFloat(parts[1]);
							const size = getPrimaryDisplaySize();
							if (size) {
								const xNorm = curX / size.width;
								const yNorm = curY / size.height;
								if (Math.abs(xNorm - last_cursor_pos.x) > 0.002 || Math.abs(yNorm - last_cursor_pos.y) > 0.002) {
									last_cursor_pos = { x: xNorm, y: yNorm };
									socket.emit('cursor-sync', { x: xNorm, y: yNorm });
								}
							}
						}
					}
				});
			}, 100);
		});

		socket.on('mouse-move', ({ x, y }) => {
			const size = getPrimaryDisplaySize();
			if (!size) return;
			const absX = Math.round(x * size.width);
			const absY = Math.round(y * size.height);
			sendHyprlandCommand(`/dispatch movecursor ${absX} ${absY}`);
		});

		socket.on('mouse-click', ({ x, y }) => {
			const size = getPrimaryDisplaySize();
			if (!size) return;
			const absX = Math.round(x * size.width);
			const absY = Math.round(y * size.height);
			sendHyprlandCommand(`/dispatch movecursor ${absX} ${absY}`);
			performMouseClick();
		});

		socket.on('mouse-right-click', ({ x, y }) => {
			const size = getPrimaryDisplaySize();
			if (!size) return;
			const absX = Math.round(x * size.width);
			const absY = Math.round(y * size.height);
			sendHyprlandCommand(`/dispatch movecursor ${absX} ${absY}`);
			performMouseRightClick();
		});

		socket.on('mouse-scroll', delta => {
			performMouseScroll(delta.x, delta.y);
		});

		socket.on('inject-text', ({ text }) => {
			injectTextToSystem(text);
		});

		socket.on('inject-key-shortcut', ({ shortcut }) => {
			triggerKeyShortcut(shortcut);
		});

		socket.on('webrtc-signal', ({ signal }) => {
			// No-op without Electron window
		});

		socket.on('mobile-log', ({ type, args }) => {
			const logStr = args.join(' ');
			console.log(`[Mobile ${type.toUpperCase()}] ${logStr}`);
		});

		socket.on('update-crop-region', ({ region }) => {
			current_crop = region;
			socket.emit('stream-crop-updated', { region });
		});

		socket.on('stop-screen-stream', () => {
			console.log('Socket client requested screen stream stop');
			if (cursor_sync_interval) {
				clearInterval(cursor_sync_interval);
				cursor_sync_interval = null;
			}
		});

		socket.on('disconnect', () => {
			console.log('Socket client disconnected');
			if (cursor_sync_interval) {
				clearInterval(cursor_sync_interval);
				cursor_sync_interval = null;
			}
		});
	});

	return new Promise((resolve, reject) => {
		let port = 13737;
		const startListening = p => {
			httpServer.listen(p, '0.0.0.0', () => {
				server_port = p;
				web_server = httpServer;
				console.log(`Mobile Express/Socket.io server started on port ${server_port}`);
				resolve(server_port);
			});

			httpServer.on('error', err => {
				if (err.code === 'EADDRINUSE' && p < 13745) {
					console.log(`Port ${p} in use, trying ${p + 1}...`);
					httpServer.removeAllListeners('error');
					startListening(p + 1);
				} else {
					reject(err);
				}
			});
		};
		startListening(port);
	});
}

async function executeSlashCommandForWindow(windowId, command_str) {
	const data = active_sessions.get(String(windowId));
	if (!data) return;

	const clean_str = command_str.replace(/\xa0/g, ' ').trim();
	const args = clean_str.split(/\s+/);
	const command_name = args[0];

	if (command_name === '/exit') {
		sendToWindow(windowId, 'shell-output', {
			text: "Closing session...\n",
			is_stderr: false
		});
		data.session.shell_proc.kill();
		active_sessions.delete(String(windowId));
		sendToWindow(windowId, 'shell-complete', {
			exit_code: 0,
			cwd: os.homedir()
		});
	} else if (command_name === '/clear') {
		sendToWindow(windowId, 'shell-complete', {
			exit_code: 0,
			cwd: data.session.current_cwd
		});
	} else if (command_name === '/mobile') {
		try {
			const ip = getLocalIpAddress();
			sendToWindow(windowId, 'shell-output', {
				text: `Mobile server is running by default.\nLocal Address: http://${ip}:${server_port}\nAccess it via your VPS PWA! (No QR code needed)\n`,
				is_stderr: false
			});
			sendToWindow(windowId, 'shell-complete', {
				exit_code: 0,
				cwd: data.session.current_cwd
			});
		} catch (err) {
			sendToWindow(windowId, 'shell-output', {
				text: `Error getting mobile connection details: ${err.message}\n`,
				is_stderr: true
			});
			sendToWindow(windowId, 'shell-complete', {
				exit_code: 1,
				cwd: data.session.current_cwd
			});
		}
	} else if (command_name === '/host') {
		try {
			const ip = getLocalIpAddress();
			sendToWindow(windowId, 'shell-output', {
				text: `http://${ip}:${server_port}\n`,
				is_stderr: false
			});
			sendToWindow(windowId, 'shell-complete', {
				exit_code: 0,
				cwd: data.session.current_cwd
			});
		} catch (err) {
			sendToWindow(windowId, 'shell-output', {
				text: `Error getting host details: ${err.message}\n`,
				is_stderr: true
			});
			sendToWindow(windowId, 'shell-complete', {
				exit_code: 1,
				cwd: data.session.current_cwd
			});
		}
	} else if (command_name === '/fullscreen') {
		sendToWindow(windowId, 'shell-output', {
			text: "Fullscreen command is handled client-side in the browser.\n",
			is_stderr: false
		});
		sendToWindow(windowId, 'shell-complete', {
			exit_code: 0,
			cwd: data.session.current_cwd
		});
	} else if (command_name === '/add-pin') {
		let pin_path = args.slice(1).join(' ').trim();
		if (!pin_path) {
			pin_path = data.session.current_cwd;
		} else {
			pin_path = path.resolve(data.session.current_cwd, pin_path);
		}

		try {
			if (!fs.existsSync(pin_path) || !fs.statSync(pin_path).isDirectory()) {
				sendToWindow(windowId, 'shell-output', {
					text: `Error: "${pin_path}" is not a valid directory.\n`,
					is_stderr: true
				});
				sendToWindow(windowId, 'shell-complete', {
					exit_code: 1,
					cwd: data.session.current_cwd
				});
				return;
			}

			const pinned_dirs = getPinnedDirectories();
			if (pinned_dirs.includes(pin_path)) {
				sendToWindow(windowId, 'shell-output', {
					text: `Directory already pinned: ${pin_path}\n`,
					is_stderr: false
				});
			} else {
				pinned_dirs.push(pin_path);
				savePinnedDirectories(pinned_dirs);
				sendToWindow(windowId, 'shell-output', {
					text: `Successfully pinned directory: ${pin_path}\n`,
					is_stderr: false
				});
				sendToWindow(windowId, 'pinned-dirs-updated', {
					pinned_dirs: pinned_dirs,
					home_dir: os.homedir()
				});
			}
			sendToWindow(windowId, 'shell-complete', {
				exit_code: 0,
				cwd: data.session.current_cwd
			});
		} catch (err) {
			sendToWindow(windowId, 'shell-output', {
				text: `Error pinning directory: ${err.message}\n`,
				is_stderr: true
			});
			sendToWindow(windowId, 'shell-complete', {
				exit_code: 1,
				cwd: data.session.current_cwd
			});
		}
	} else if (command_name === '/test-sound') {
		sendToWindow(windowId, 'agent-ask-user', { question: 'Testing Question Chime...', options: [] });
		sendToWindow(windowId, 'fingerprint-prompt', { type: 'fingerprint' });
		sendToWindow(windowId, 'shell-output', {
			text: "Triggered test chimes for both Agent Question and Fingerprint auth!\n",
			is_stderr: false
		});
		sendToWindow(windowId, 'shell-complete', {
			exit_code: 0,
			cwd: data.session.current_cwd
		});
	} else if (command_name === '/update') {
		sendToWindow(windowId, 'shell-complete', {
			exit_code: 0,
			cwd: data.session.current_cwd
		});
	} else {
		sendToWindow(windowId, 'shell-output', {
			text: `Unknown slash command: ${command_name}\n`,
			is_stderr: true
		});
		sendToWindow(windowId, 'shell-complete', {
			exit_code: 1,
			cwd: data.session.current_cwd
		});
	}
}

const pinned_dirs_path = path.join(__dirname, 'pinned_directories.json');

function getPinnedDirectories() {
	try {
		if (fs.existsSync(pinned_dirs_path)) {
			const content = fs.readFileSync(pinned_dirs_path, 'utf8');
			return JSON.parse(content);
		}
	} catch (err) {
		console.error('Error reading pinned_directories.json:', err.message);
	}
	return [];
}

function savePinnedDirectories(dirs) {
	try {
		fs.writeFileSync(pinned_dirs_path, JSON.stringify(dirs, null, 2), 'utf8');
	} catch (err) {
		console.error('Error writing pinned_directories.json:', err.message);
	}
}



let cached_commands = null;

function getAvailableCommands() {
	if (cached_commands) {
		return cached_commands;
	}

	const commands = new Set();
	const shell_builtins = ['cd', 'echo', 'eval', 'exec', 'exit', 'export', 'read', 'set', 'unset', 'alias', 'unalias', 'pushd', 'popd', 'dirs', 'history', 'history-list', 'source', 'bg', 'fg', 'jobs', 'type', 'which', 'pwd'];
	shell_builtins.forEach(cmd => commands.add(cmd));

	const path_env = process.env.PATH || '';
	const directories = path_env.split(path.delimiter);

	for (const dir of directories) {
		try {
			if (fs.existsSync(dir)) {
				const files = fs.readdirSync(dir);
				for (const file of files) {
					const full_path = path.join(dir, file);
					try {
						const stat = fs.statSync(full_path);
						if (stat.isFile()) {
							const is_executable = (stat.mode & 0o111) !== 0;
							if (is_executable) {
								commands.add(file);
							}
						}
					} catch (err) {
						// Ignore broken symlinks
					}
				}
			}
		} catch (err) {
			// Ignore read errors
		}
	}

	return Array.from(commands);
}

class ShellSession {
	constructor(sessionId, initial_cwd) {
		this.sessionId = sessionId;
		this.current_cwd = initial_cwd || process.cwd();
		this.stdout_buffer = '';
		this.stderr_buffer = '';
		this.active_command_callback = null;

		this.shell_proc = spawn('/bin/bash', [], {
			cwd: this.current_cwd,
			env: { ...process.env, PS1: '' }
		});

		this.setupListeners();
	}

	setupListeners() {
		this.shell_proc.stdout.on('data', chunk => {
			this.handleOutput(chunk.toString(), false);
		});

		this.shell_proc.stderr.on('data', chunk => {
			this.handleOutput(chunk.toString(), true);
		});

		this.shell_proc.on('close', code => {
			console.log('Shell closed with code:', code);
		});
	}

	handleOutput(data, is_stderr) {
		const lowerData = data.toLowerCase();
		const isFingerprint = lowerData.includes('finger') || 
		                      lowerData.includes('fprint') || 
		                      lowerData.includes('doigt') ||       // French
		                      lowerData.includes('dedo') ||        // Spanish/Portuguese
		                      lowerData.includes('empreinte') ||   // French
		                      lowerData.includes('huella');        // Spanish
		const isSudoOrAuth = lowerData.includes('password') ||
		                     lowerData.includes('passphrase') ||
		                     lowerData.includes('mot de passe') || // French
		                     lowerData.includes('contraseña') ||   // Spanish
		                     lowerData.includes('passwort');       // German
		
		if (isFingerprint || isSudoOrAuth) {
			sendToWindow(this.sessionId, 'fingerprint-prompt', { type: isFingerprint ? 'fingerprint' : 'password' });
		}

		const buffer_name = is_stderr ? 'stderr_buffer' : 'stdout_buffer';
		this[buffer_name] += data;

		let lines = this[buffer_name].split('\n');
		this[buffer_name] = lines.pop();

		for (const line of lines) {
			const delim_index = line.indexOf('__NODESK_CMD_END__');
			if (delim_index !== -1) {
				const prefix = line.substring(0, delim_index);
				if (prefix) {
					sendToWindow(this.sessionId, 'shell-output', {
						text: prefix,
						is_stderr
					});
				}
				const suffix = line.substring(delim_index);
				const match = suffix.match(/__NODESK_CMD_END__ (\d+) (.*)/);
				if (match) {
					const exit_code = parseInt(match[1], 10);
					const next_cwd = match[2].trim();
					this.current_cwd = next_cwd;
					if (this.active_command_callback) {
						const cb = this.active_command_callback;
						this.active_command_callback = null;
						cb({ exit_code, cwd: this.current_cwd });
					}
				}
			} else {
				sendToWindow(this.sessionId, 'shell-output', {
					text: line + '\n',
					is_stderr
				});
			}
		}
	}

	writeCommand(command, callback) {
		this.active_command_callback = callback;
		this.shell_proc.stdin.write(command + '\n');
		this.shell_proc.stdin.write('echo "__NODESK_CMD_END__ $? $PWD"\n');
	}

	interrupt() {
		// Send SIGINT to direct children of the bash shell PID
		exec(`pkill -INT -P ${this.shell_proc.pid}`, err => {
			if (err) {
				console.warn('pkill SIGINT failed:', err.message);
			}
		});
	}
}

// Tool functions
function listDirectory(dir_path) {
	try {
		const files = fs.readdirSync(dir_path);
		return files.map(file => {
			const full_path = path.join(dir_path, file);
			const stat = fs.statSync(full_path);
			return {
				name: file,
				is_directory: stat.isDirectory(),
				size: stat.size
			};
		});
	} catch (err) {
		return { error: err.message, code: err.code };
	}
}

function getVsCodePrettierConfig() {
	try {
		const homedir = os.homedir();
		const settingsPath = path.join(homedir, '.config', 'Code', 'User', 'settings.json');
		if (fs.existsSync(settingsPath)) {
			const content = fs.readFileSync(settingsPath, 'utf8');
			const cleanJson = content.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
			const settings = JSON.parse(cleanJson);
			const prettierConfig = {};
			for (const key in settings) {
				if (key.startsWith('prettier.')) {
					prettierConfig[key.substring(9)] = settings[key];
				}
			}
			return prettierConfig;
		}
	} catch (err) {
		console.error('Failed to load VS Code settings for Prettier:', err.message);
	}
	return {};
}

function readFile(file_path, start_line, end_line) {
	try {
		const content = fs.readFileSync(file_path, 'utf8');
		const lines = content.split('\n');
		const start = start_line ? Math.max(1, start_line) - 1 : 0;
		const max_end = start + 2001; // cap at start_line + 2000 lines
		const end = end_line ? Math.min(lines.length, end_line, max_end) : Math.min(lines.length, max_end);
		const sliced = lines.slice(start, end);
		// Format with line numbers (cat -n style)
		const numbered = sliced.map((line, idx) => {
			const line_num = String(start + idx + 1).padStart(6);
			return `${line_num}\t${line}`;
		});
		return {
			content: numbered.join('\n'),
			total_lines: lines.length,
			start_line: start + 1,
			end_line: end
		};
	} catch (err) {
		return { error: err.message };
	}
}

function writeToFile(file_path, content) {
	try {
		const dir = path.dirname(file_path);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
		fs.writeFileSync(file_path, content, 'utf8');
		const lines = content.split('\n').length;
		return { success: true, lines_written: lines };
	} catch (err) {
		return { error: err.message };
	}
}

function replaceInFile(file_path, diff) {
	try {
		let content = fs.readFileSync(file_path, 'utf8');
		// Parse all SEARCH/REPLACE blocks
		const block_regex = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;
		let match;
		let applied = 0;
		let result_content = content;
		const errors = [];
		while ((match = block_regex.exec(diff)) !== null) {
			const search = match[1];
			const replace = match[2];
			const occurrences = result_content.split(search).length - 1;
			if (occurrences === 0) {
				errors.push(`SEARCH block not found in file. Ensure it matches exactly (including whitespace): ${search.substring(0, 80)}...`);
				continue;
			}
			if (occurrences > 1) {
				errors.push(`SEARCH block is ambiguous — found ${occurrences} occurrences. Provide a more specific block: ${search.substring(0, 80)}...`);
				continue;
			}
			result_content = result_content.replace(search, replace);
			applied++;
		}
		if (errors.length > 0 && applied === 0) {
			return { error: errors.join('\n') };
		}
		fs.writeFileSync(file_path, result_content, 'utf8');
		const warnings = errors.length > 0 ? errors : undefined;
		return { success: true, blocks_applied: applied, warnings };
	} catch (err) {
		return { error: err.message };
	}
}

function listFiles(dir_path, recursive = false) {
	const results = [];
	const MAX_ENTRIES = 1000;

	function walk(current_dir, rel_prefix) {
		if (results.length >= MAX_ENTRIES) return;
		let entries;
		try {
			entries = fs.readdirSync(current_dir);
		} catch (err) {
			return;
		}
		for (const entry of entries) {
			if (results.length >= MAX_ENTRIES) break;
			const full_path = path.join(current_dir, entry);
			const rel_path = rel_prefix ? `${rel_prefix}/${entry}` : entry;
			let stat;
			try {
				stat = fs.statSync(full_path);
			} catch (err) {
				continue;
			}
			results.push({
				name: rel_path,
				is_directory: stat.isDirectory(),
				size: stat.isFile() ? stat.size : undefined
			});
			if (recursive && stat.isDirectory()) {
				walk(full_path, rel_path);
			}
		}
	}

	try {
		walk(dir_path, '');
		return { entries: results, truncated: results.length >= MAX_ENTRIES };
	} catch (err) {
		return { error: err.message };
	}
}

function searchFiles(base_path, regex_pattern, file_pattern) {
	return new Promise(resolve => {
		const args = ['-n', '--no-heading', '--context', '2'];
		if (file_pattern) {
			args.push('-g', file_pattern);
		}
		args.push(regex_pattern, base_path);

		const rg = spawn('rg', args);
		let stdout = '';
		let stderr = '';
		rg.stdout.on('data', d => {
			stdout += d.toString();
		});
		rg.stderr.on('data', d => {
			stderr += d.toString();
		});
		rg.on('close', code => {
			if (code === 0 || code === 1) {
				// code 1 means no matches — not an error
				const lines = stdout.split('\n').filter(Boolean);
				// Cap results
				const capped = lines.slice(0, 200);
				resolve({ matches: capped.join('\n'), truncated: lines.length > 200 });
			} else {
				// ripgrep not available — fallback to JS implementation
				resolve(searchCodebase(regex_pattern, base_path));
			}
		});
		rg.on('error', () => {
			// ripgrep not installed — fallback
			resolve(searchCodebase(regex_pattern, base_path));
		});
	});
}

function listCodeDefinitionNames(dir_path) {
	const definitions = [];
	const code_extensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.cs', '.go', '.rs', '.rb', '.php'];

	// Regex patterns for common definition types
	const patterns = [
		{ regex: /^\s*(export\s+)?(default\s+)?(async\s+)?function\s+([\w$]+)/m, label: 'function', group: 4 },
		{ regex: /^\s*(export\s+)?(default\s+)?class\s+([\w$]+)/m, label: 'class', group: 3 },
		{ regex: /^\s*(export\s+)?const\s+([\w$]+)\s*=\s*(async\s+)?\(/m, label: 'const-fn', group: 2 },
		{ regex: /^\s*(export\s+)?const\s+([\w$]+)\s*=\s*(async\s+)?function/m, label: 'const-fn', group: 2 },
		{ regex: /^\s*def\s+([\w_]+)/m, label: 'def', group: 1 },
		{ regex: /^\s*class\s+([\w_]+)/m, label: 'class', group: 1 },
		{ regex: /^\s*(public|private|protected|static)\s+(\w+\s+)?([\w<>]+)\s+([\w$]+)\s*\(/m, label: 'method', group: 4 },
		{ regex: /^\s*(export\s+)?(default\s+)?interface\s+([\w$]+)/m, label: 'interface', group: 3 },
		{ regex: /^\s*(export\s+)?(default\s+)?type\s+([\w$]+)\s*=/m, label: 'type', group: 3 }
	];

	let files_checked = 0;
	try {
		const entries = fs.readdirSync(dir_path);
		for (const entry of entries) {
			if (files_checked > 50) break; // limit scan to top-level files
			const full_path = path.join(dir_path, entry);
			const ext = path.extname(entry).toLowerCase();
			if (!code_extensions.includes(ext)) continue;
			let stat;
			try {
				stat = fs.statSync(full_path);
			} catch (e) {
				continue;
			}
			if (!stat.isFile()) continue;
			files_checked++;
			try {
				const content = fs.readFileSync(full_path, 'utf8');
				const lines = content.split('\n');
				const file_defs = [];
				lines.forEach((line, idx) => {
					for (const { regex, label, group } of patterns) {
						const m = line.match(regex);
						if (m && m[group]) {
							file_defs.push(`  ${label} ${m[group]} (line ${idx + 1})`);
							break;
						}
					}
				});
				if (file_defs.length > 0) {
					definitions.push(`${entry}:\n${file_defs.join('\n')}`);
				}
			} catch (err) {
				// skip unreadable files
			}
		}
	} catch (err) {
		return { error: err.message };
	}
	return { definitions: definitions.join('\n\n') };
}

function workspaceChangedFiles(cwd) {
	return new Promise(resolve => {
		exec('git status --porcelain', { cwd }, (err, stdout, stderr) => {
			if (err && err.code !== 0) {
				resolve({ error: stderr || err.message });
				return;
			}
			const lines = stdout.split('\n').filter(Boolean);
			const changed = lines.map(line => ({
				status: line.substring(0, 2).trim(),
				file: line.substring(3).trim()
			}));
			resolve({ changed_files: changed });
		});
	});
}

function fileChanges(file_path, cwd) {
	return new Promise(resolve => {
		const resolved = path.resolve(cwd, file_path);
		exec(`git status --porcelain -- "${resolved}"`, { cwd }, (err, stdout, stderr) => {
			if (err) {
				resolve({ error: stderr || err.message });
				return;
			}
			const is_untracked = stdout.startsWith('??');
			const diff_cmd = is_untracked ? `git diff --no-index -U999999 -- /dev/null "${resolved}"` : `git diff HEAD -U999999 -- "${resolved}"`;
			exec(diff_cmd, { cwd }, (diff_err, diff_stdout, diff_stderr) => {
				if (diff_err && diff_err.code !== 1 && diff_err.code !== 0) {
					resolve({ error: diff_stderr || diff_err.message });
					return;
				}
				resolve({ diff: diff_stdout });
			});
		});
	});
}

function loadGitignore(dir_path) {
	const rules = ['.git', 'node_modules'];
	try {
		const gitignore_path = path.join(dir_path, '.gitignore');
		if (fs.existsSync(gitignore_path)) {
			const content = fs.readFileSync(gitignore_path, 'utf8');
			content.split('\n').forEach(line => {
				const trimmed = line.trim();
				if (trimmed && !trimmed.startsWith('#')) {
					rules.push(trimmed);
				}
			});
		}
	} catch (err) {
		// Ignore error
	}
	return rules;
}

function shouldIgnore(file_name, relative_path, rules) {
	for (const rule of rules) {
		let clean_rule = rule.replace(/\/$/, '');
		if (clean_rule.startsWith('/')) {
			if (relative_path === clean_rule.substring(1) || relative_path.startsWith(clean_rule.substring(1) + '/')) {
				return true;
			}
		} else {
			if (file_name === clean_rule || relative_path.split('/').includes(clean_rule)) {
				return true;
			}
		}
	}
	return false;
}

function walkDirectory(dir, base_dir, rules, callback) {
	const files = fs.readdirSync(dir);
	for (const file of files) {
		const full_path = path.join(dir, file);
		const relative_path = path.relative(base_dir, full_path);
		if (shouldIgnore(file, relative_path, rules)) {
			continue;
		}
		const stat = fs.statSync(full_path);
		if (stat.isDirectory()) {
			walkDirectory(full_path, base_dir, rules, callback);
		} else if (stat.isFile()) {
			callback(full_path, relative_path);
		}
	}
}

function searchCodebase(query, base_dir) {
	const rules = loadGitignore(base_dir);
	const matches = [];
	try {
		walkDirectory(base_dir, base_dir, rules, (full_path, relative_path) => {
			const ext = path.extname(full_path).toLowerCase();
			const text_extensions = ['.js', '.json', '.html', '.css', '.md', '.txt', '.sh', '.py', '.ts', '.tsx', '.jsx', '.jsonld', '.yml', '.yaml'];
			if (!text_extensions.includes(ext)) {
				return;
			}
			const content = fs.readFileSync(full_path, 'utf8');
			const lines = content.split('\n');
			lines.forEach((line, index) => {
				if (line.includes(query)) {
					matches.push({
						path: relative_path,
						line_number: index + 1,
						line_content: line.trim()
					});
				}
			});
		});
		return matches.slice(0, 100);
	} catch (err) {
		return { error: err.message };
	}
}

function generateRepoMap(base_dir) {
	const rules = loadGitignore(base_dir);
	const tree_lines = [];

	function buildTree(dir, prefix = '') {
		const files = fs.readdirSync(dir);
		const sorted = files
			.map(file => {
				const full_path = path.join(dir, file);
				const stat = fs.statSync(full_path);
				return { file, is_dir: stat.isDirectory(), full_path };
			})
			.filter(item => {
				const relative_path = path.relative(base_dir, item.full_path);
				return !shouldIgnore(item.file, relative_path, rules);
			})
			.sort((a, b) => {
				if (a.is_dir && !b.is_dir) return -1;
				if (!a.is_dir && b.is_dir) return 1;
				return a.file.localeCompare(b.file);
			});

		sorted.forEach((item, index) => {
			const is_last = index === sorted.length - 1;
			const marker = is_last ? '└── ' : '├── ';
			tree_lines.push(prefix + marker + item.file);
			if (item.is_dir) {
				const next_prefix = prefix + (is_last ? '    ' : '│   ');
				buildTree(item.full_path, next_prefix);
			}
		});
	}

	tree_lines.push('/');
	try {
		buildTree(base_dir);
	} catch (err) {
		tree_lines.push('Error generating repo map: ' + err.message);
	}
	return tree_lines.join('\n');
}

function computeLineDiff(old_lines, new_lines) {
	const dp = Array(old_lines.length + 1)
		.fill(null)
		.map(() => Array(new_lines.length + 1).fill(0));
	for (let i = 1; i <= old_lines.length; i++) {
		for (let j = 1; j <= new_lines.length; j++) {
			if (old_lines[i - 1] === new_lines[j - 1]) {
				dp[i][j] = dp[i - 1][j - 1] + 1;
			} else {
				dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
			}
		}
	}

	const diff = [];
	let i = old_lines.length;
	let j = new_lines.length;
	while (i > 0 || j > 0) {
		if (i > 0 && j > 0 && old_lines[i - 1] === new_lines[j - 1]) {
			diff.unshift('  ' + old_lines[i - 1]);
			i--;
			j--;
		} else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
			diff.unshift('+ ' + new_lines[j - 1]);
			j--;
		} else {
			diff.unshift('- ' + old_lines[i - 1]);
			i--;
		}
	}
	return diff.join('\n');
}

function startDbusMonitor() {
	if (process.platform !== 'linux') return;

	try {
		const monitor = spawn('dbus-monitor', ['--system', 'sender=net.reactivated.Fprint']);

		monitor.stdout.on('data', data => {
			const output = data.toString();
			if (output.includes('VerifyFingerSelected')) {
				console.log('[DBus] Fingerprint verification started!');
				for (const sessionId of active_sessions.keys()) {
					sendToWindow(sessionId, 'fingerprint-prompt', { type: 'fingerprint' });
				}
			}
		});

		monitor.on('error', err => {
			console.warn('Failed to start dbus-monitor:', err.message);
		});

		monitor.on('close', code => {
			console.log('dbus-monitor exited with code:', code);
			if (code !== 0) {
				setTimeout(startDbusMonitor, 5000);
			}
		});
	} catch (e) {
		console.error('Failed to initialize DBus monitor:', e);
	}
}

// Start mobile Express/Socket.io server immediately
startMobileServer().then(port => {
	console.log(`Nodesk PWA server started on port ${port}`);
}).catch(err => {
	console.error('Failed to start mobile server on startup:', err);
});
startDbusMonitor();


