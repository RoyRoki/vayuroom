const https = require('https');

const SECRET_KEY = '4B0y355dlftH16P279J5b4TgY1liuRxo-8kfFFaoihfRp6jJi';
const APP_NAME = 'vayuroom';

const data = JSON.stringify({
    label: 'vayuroom-frontend',
    expiryInSeconds: 31536000 // 1 year
});

const options = {
    hostname: `${APP_NAME}.metered.live`,
    path: `/api/v1/turn/credential?secretKey=${SECRET_KEY}`,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log('Body:', body);
    });
});

req.on('error', (error) => {
    console.error('Error:', error);
});

req.write(data);
req.end();
