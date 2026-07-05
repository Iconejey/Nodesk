const express = require('express');
const path = require('path');
const fs = require('fs');

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
	console.warn('Could not parse .env file programmatically:', e.message);
}

const app = express();
const port = process.env.PWA_SERVER_PORT ? parseInt(process.env.PWA_SERVER_PORT, 10) : 8009;

// Enable CORS
app.use((req, res, next) => {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
	next();
});

// API configuration endpoint for PWA client
app.get('/api/config', (req, res) => {
	res.json({
		localServerPort: process.env.LOCAL_SERVER_PORT ? parseInt(process.env.LOCAL_SERVER_PORT, 10) : 13737
	});
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html for PWA navigation
app.use((req, res) => {
	res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
	console.log(`Nodesk PWA Frontend Server running on port ${port}`);
});
