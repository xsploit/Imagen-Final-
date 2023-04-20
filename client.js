/* const https = require('https');
const fs = require('fs');
const options = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
  };
// STEP 3 - Update your app.use session to the below
app.use(session(
    {
        name: 'sessionID',
        resave: false,
        secret: "secret",
        saveUninitialized: false,
        cookie: { 
            httpOnly: true,
            sameSite: 'none',
            secure: true 
        }
    }
));
// STEP 4 - SSL SETTINGS AND ORIGIN SETTINGS 
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://scwebsrv-six.work'); // Replace with your client-side origin
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
});

// STEP 5 - remove applisten(5000) and add in the following
let port = 5000;
let ip = '167.114.138.186'; // update to your ip address

https.createServer(options,app).listen(port,ip); */
const express = require('express');
const app = express();
const https = require('https');
const fs = require('fs');
const path = require('path');

app.use('/public/images', express.static(__dirname + '/public/images'));

// Load the SSL certificate and key
const privateKey = fs.readFileSync(path.join(__dirname, 'privatekey.pem'), 'utf8');
const certificate = fs.readFileSync(path.join(__dirname, 'certificate.pem'), 'utf8');

const credentials = { key: privateKey, cert: certificate };

// Create an HTTPS service for the client app
const httpsServer = https.createServer(credentials, app);

module.exports = httpsServer;
