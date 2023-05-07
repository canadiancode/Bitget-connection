// installed npm packages:
// dovenv
// express
// body-parser
// axios
// websocket
// crypto
// node-fetch@2

// configure secret keys:
require('dotenv').config();

/////////////////////////////////////////////////////////////////
// CREATE WEBHOOK URL -- CREATE WEBHOOK URL -- CREATE WEBHOOK URL
/////////////////////////////////////////////////////////////////

const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

app.post('/webhook', (req, res) => {

    console.log('TradingView alert received:', req.body);
    const comment = req.body.comment;

    if (comment === 'Long') {
    console.log('Going Long!')
    postLongOrderEntry();
    } else if (comment === 'Short') {
    console.log('Going Short!')
    postShortOrderEntry();
    } else {
    console.log('Exiting Position!')
    closePosition();
    };

    res.sendStatus(200);
});

app.listen(port, () => {
    console.log(`TradingView webhook listener is running on port ${port}`);
});

// for testing purposes, open two terminals
// On one, run 'node app.js'
// On the other run 'ngrok http 3000' & copy the https link adding the /webhook at the end to tradingview
// the comment on Tradingview should be formatted like so: { "comment": "{{strategy.order.comment}}" }

// Configure axios to use the QuotaGuard Static proxy
const quotaGuardUrl = require('url');
const axios = require('axios');
if (process.env.QUOTAGUARDSTATIC_URL) {
    const proxyUrl = quotaGuardUrl.parse(process.env.QUOTAGUARDSTATIC_URL);
    axios.defaults.proxy = {
        host: proxyUrl.hostname,
        port: proxyUrl.port,
        auth: {
        username: proxyUrl.username,
        password: proxyUrl.password,
        },
    };
};

////////////////////////////////////////////////////////
// PRICE DATA FEED -- PRICE DATA FEED -- PRICE DATA FEED
////////////////////////////////////////////////////////

const WebSocket = require('websocket').client;
const wsClient = new WebSocket();

const subscribeToWebSocket = () => {
  const subscriptionMessage = {
    "op": "subscribe",
    "args":[
        {
            "instType": "mc",
            "channel": "ticker",
            "instId": "BTCUSDT"
        }
    ]
  };
  return JSON.stringify(subscriptionMessage);
};

wsClient.on('connectFailed', (error) => {
  console.log('Connect Error: ' + error.toString());
});

wsClient.on('connect', (connection) => {

  console.log('WebSocket Client Connected');

  connection.on('error', (error) => {
    console.log("Connection Error: " + error.toString());
  });

  connection.on('close', () => {
    console.log('WebSocket Connection Closed');
  });

  connection.on('message', (message) => {
    if (message.type === 'utf8') {
      const parsedMessage = JSON.parse(message.utf8Data);

      let currentTime = (new Date()).toISOString().slice(0, 19).replace(/-/g, "/").replace("T", " ");

      if (parsedMessage.data && Array.isArray(parsedMessage.data) && parsedMessage.data.length > 0) {
        const lastPrice = parsedMessage.data[0].last;
        console.log(`Bitcoin price at ${currentTime}: ` + lastPrice);
      }
    }
  });

  if (connection.connected) {
    connection.send(subscribeToWebSocket());
  }
});
const bitgetWebSocketURL = 'wss://ws.bitget.com/mix/v1/stream';
wsClient.connect(bitgetWebSocketURL, null);


///////////////////////////////////////////////////////////////////////
// BITGET ORDER REQUEST -- BITGET ORDER REQUEST -- BITGET ORDER REQUEST
///////////////////////////////////////////////////////////////////////

const crypto = require('crypto');

const apiKey = process.env.BITGET_API_KEY;
const secret = process.env.BITGET_API_SECRET;
const passphrase = process.env.API_PASSPHRASE;

// const getAccountBalance = async () => {
//     const timestamp = Date.now().toString();
//     const method = 'GET';
//     const path = '/api/account/v1/info';
//     const baseURL = 'https://api.bitget.com';
  
//     const signData = method + '\n' + path + '\n' + timestamp;
//     const signature = crypto.createHmac('sha256', secret).update(signData).digest('hex');
  
//     const headers = {
//       'Content-Type': 'application/json',
//       'ACCESS-KEY': apiKey,
//       'ACCESS-SIGN': signature,
//       'ACCESS-TIMESTAMP': timestamp,
//       'ACCESS-PASSPHRASE': passphrase,
//     };
  
//     try {
//       const response = await axios.get(baseURL + path, { headers });
//       console.log(response.data);
//     } catch (error) {
//       console.error('Error fetching account balance:', error.message);
//     };
// };

// getAccountBalance();

const https = require('https');

let availableBalance = '0';
const getAccountBalance = () => {
    const timestamp = Date.now().toString();
    const method = 'GET';
    const path = '/api/mix/v1/account/account';
    const queryParams = 'marginCoin=USDT&symbol=BTCUSDT_UMCBL';
    const baseURL = 'https://api.bitget.com';
  
    const signData = timestamp + method + path + '?' + queryParams;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(signData)
      .digest()
      .toString('base64');
  
    const headers = {
      'Content-Type': 'application/json',
      'ACCESS-KEY': apiKey,
      'ACCESS-SIGN': signature,
      'ACCESS-TIMESTAMP': timestamp,
      'ACCESS-PASSPHRASE': passphrase,
    };
  
    const options = {
      hostname: 'api.bitget.com',
      path: path + '?' + queryParams,
      method: method,
      headers: headers,
    };
  
    https.request(options, (res) => {

        let data = '';
    
        res.on('data', (chunk) => {
          data += chunk;
        });
    
        res.on('end', () => {
          try {
            const parsedData = JSON.parse(data);
            console.log('Full data:', parsedData);
            availableBalance = parsedData.data.available;
            console.log('Available Balance in USDT:', availableBalance);
          } catch (error) {
            console.error('Error parsing response:', error.message);
          }
        });
    
    }).on('error', (error) => {
        console.error('Error fetching account balance:', error.message);
    }).end();
};
getAccountBalance();    


////////////////////////////////////////////////////////
// ORDER FUNCTIONS -- ORDER FUNCTIONS -- ORDER FUNCTIONS
////////////////////////////////////////////////////////



