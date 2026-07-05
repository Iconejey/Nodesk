#!/usr/bin/env node
const QRCode = require('qrcode');
const os = require('os');
const fs = require('fs');
const path = require('path');

// Programmatically load .env file if it exists
try {
	const dotenvPath = path.join(__dirname, '.env');
	if (fs.existsSync(dotenvPath)) {
		const envConfig = fs.readFileSync(dotenvPath, 'utf8');
		for (const line of envConfig.split('\n')) {
			const trimmed = line.trim();
			if (trimmed && !trimmed.startsWith('#')) {
				const [key, ...values] = trimmed.split('=');
				const value = values.join('=').trim();
				process.env[key.trim()] = value;
			}
		}
	}
} catch (e) {
	// Ignore
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

const ip = getLocalIpAddress();
const port = process.env.LOCAL_SERVER_PORT ? parseInt(process.env.LOCAL_SERVER_PORT, 10) : (process.env.PORT ? parseInt(process.env.PORT, 10) : 13737);
const targetUrl = `http://${ip}:${port}`;

console.log(`\nScan the QR code below to open Nodesk directly on your mobile device:\n`);
console.log(`Connection URL: ${targetUrl}\n`);

try {
	const qr = QRCode.create(targetUrl);
	const size = qr.modules.size;
	const marginH = 1;
	const marginV = 1;
	let output = '';

	for (let r = -marginV; r < size + marginV; r += 2) {
		let line = '';
		for (let c = -marginH; c < size + marginH; c++) {
			const getPixel = (row, col) => {
				if (row < -1 || row > size) {
					return 1; // outside quiet zone boundary (black/transparent)
				}
				if (col < -1 || col >= size + 1) {
					return 1; // outside quiet zone boundary (black/transparent)
				}
				if (row === -1 || row === size) {
					return 0; // vertical quiet zone (white)
				}
				if (col === -1 || col === size) {
					return 0; // horizontal quiet zone (white)
				}
				return qr.modules.get(row, col);
			};

			const top = getPixel(r, c);
			const bottom = getPixel(r + 1, c);

			// Invert so dark (1) becomes transparent (space) and light (0) becomes solid (block)
			const topWhite = (top === 0);
			const bottomWhite = (bottom === 0);

			if (topWhite && bottomWhite) {
				line += '█';
			} else if (topWhite && !bottomWhite) {
				line += '▀';
			} else if (!topWhite && bottomWhite) {
				line += '▄';
			} else {
				line += ' ';
			}
		}
		output += line + '\n';
	}
	console.log(output);
} catch (err) {
	console.error('Failed to generate QR code:', err);
}
