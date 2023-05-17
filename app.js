// installed npm packages:
// dovenv
// express
// body-parser
// url
// axios
// websocket
// crypto
// https
// https-proxy-agent

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
    postExitOrder();
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

let currentBitcoinPrice = 0;

function subscribeToWebSocket() {
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

  // send ping to the server every 10 seconds
  function ping() {
    if (connection.connected) {
      connection.ping();
      console.log('Sent a ping to server');
    }
  };
  setInterval(ping, 10000);

  // received the ping (pong) from Bitget
  connection.on('pong', () => {
    console.log('Received a pong from server');
  });
  

  connection.on('error', (error) => {
    console.log("Connection Error: " + error.toString());
  });

  connection.on('close', (code, reason) => {
    console.log(`WebSocket connection closed: ${code} - ${reason}`);
    setTimeout(() => {
      console.log('Reconnecting...');
      wsClient.connect(bitgetWebSocketURL, null);
    }, 1000);
  });

  connection.on('message', (message) => {
    if (message.type === 'utf8') {
      const parsedMessage = JSON.parse(message.utf8Data);

      let currentTime = (new Date()).toISOString().slice(0, 19).replace(/-/g, "/").replace("T", " ");

      if (parsedMessage.data && Array.isArray(parsedMessage.data) && parsedMessage.data.length > 0) {
        currentBitcoinPrice = parsedMessage.data[0].last;
        console.log(`Time: ${currentTime} Price: $` + currentBitcoinPrice);
      }
    }
  });

  if (connection.connected) {
    connection.send(subscribeToWebSocket());
  }
});
const bitgetWebSocketURL = 'wss://ws.bitget.com/mix/v1/stream';
wsClient.connect(bitgetWebSocketURL, null);

/////////////////////////////////////////////////////////////////////
// BITGET ACCOUNT INFO -- BITGET ACCOUNT INFO -- BITGET ACCOUNT INFO
/////////////////////////////////////////////////////////////////////

const crypto = require('crypto');

const apiKey = process.env.BITGET_API_KEY;
const secret = process.env.BITGET_API_SECRET;
const passphrase = process.env.API_PASSPHRASE;

const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');

let availableBalance = '0';
let leverage = 1;
let positionSize = 0;
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

    const proxy = 'http://ghakmyawgi92qf:1eqrene038e5x6pgf606qjcs3eawdy@us-east-static-09.quotaguard.com:9293';
    const agent = new HttpsProxyAgent(proxy);
  
    const options = {
      hostname: 'api.bitget.com',
      path: path + '?' + queryParams,
      method: method,
      headers: headers,
      agent: agent,
    };
  
    https.request(options, (res) => {

      console.log(`Response status code: ${res.statusCode}`);

        let data = '';
    
        res.on('data', (chunk) => {
          data += chunk;
        });
    
        res.on('end', () => {
          console.log('Raw server response:', data);
          try {
            const parsedData = JSON.parse(data);
            availableBalance = parsedData.data.available;
            let unroundedPositionSize = (availableBalance * leverage) / currentBitcoinPrice;
            positionSize = unroundedPositionSize.toFixed(4);
            
            console.log(`Availalbe balance of ${availableBalance} with a position size of ${positionSize}`);
          } catch (error) {
            console.error('Error parsing response message:', error.message);
          }
        });
    
    }).on('error', (error) => {
        console.error('Error fetching account balance:', error.message);
    }).end();
};
// getAccountBalance(); 

let openPositions = [];
// get open positions
async function checkOpenPositions() {

  openPositions = [];

  const timestamp = Date.now().toString();
  const method = 'GET';
  const path = '/api/mix/v1/position/allPosition';
  const baseURL = 'https://api.bitget.com';

  const queryParams = 'productType=umcbl&marginCoin=USDT';
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

  const proxy = 'http://ghakmyawgi92qf:1eqrene038e5x6pgf606qjcs3eawdy@us-east-static-09.quotaguard.com:9293';
  const agent = new HttpsProxyAgent(proxy);

  const options = {
    hostname: 'api.bitget.com',
    path: path + '?' + queryParams,
    method: method,
    headers: headers,
    agent: agent,
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          response.data.forEach(data => {
            openPositions.push(data.total);
          });
          console.log(`Open positions: ${openPositions}`);

          resolve(response);
        } catch (error) {
          reject(new Error('Error parsing response: ' + error.message));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error('Error getting open positions: ' + error.message));
    });

    req.end();
  });
};
// checkOpenPositions();

// Fetch order number
let trackingNumber = '';
function getTrackingNumber() {
  const timestamp = Date.now().toString();
  const method = 'GET';
  const path = '/api/mix/v1/trace/currentTrack';
  const queryParams = 'symbol=BTCUSDT_UMCBL&productType=umcbl';
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

  const proxy = 'http://ghakmyawgi92qf:1eqrene038e5x6pgf606qjcs3eawdy@us-east-static-09.quotaguard.com:9293';
  const agent = new HttpsProxyAgent(proxy);

  const options = {
    hostname: 'api.bitget.com',
    path: path + '?' + queryParams,
    method: method,
    headers: headers,
    agent: agent,
  };

  https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        if (response.code === '00000' && response.data) {
          console.log(response.data);
          trackingNumber = response.data[0].trackingNo;
          console.log(`Tracking number: ${trackingNumber}`)
        } else {
          console.error('Error fetching current positions:', response);
        }
      } catch (error) {
        console.error('Error parsing response:', error.message);
      }
    });
  })
  .on('error', (error) => {
    console.error('Error fetching current positions:', error.message);
  })
  .end();
};
// getTrackingNumber();


////////////////////////////////////////////////////////
// ORDER FUNCTIONS -- ORDER FUNCTIONS -- ORDER FUNCTIONS
////////////////////////////////////////////////////////

// open order
function createOrder(direction, positionSize) {

  const timestamp = Date.now().toString();
  const method = 'POST';
  const path = '/api/mix/v1/order/placeOrder';
  const baseURL = 'https://api.bitget.com';

  const generateClientOid = () => {
    const prefix = 'myapp';
    const timestamp = Date.now();
    const randomPart = Math.floor(Math.random() * 1e6);
    return `${prefix}-${timestamp}-${randomPart}`;
  };
  clientOid = generateClientOid();

  const requestBody = JSON.stringify({
    symbol: 'BTCUSDT_UMCBL',
    marginCoin: 'USDT',
    size: positionSize, // 0.01
    price: currentBitcoinPrice,
    side: direction, // open_long, open_short
    orderType: 'market', // limit
    timeInForceValue: 'normal',
    clientOid: clientOid,
  });

  const signData = timestamp + method + path + requestBody;
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

  const proxy = 'http://ghakmyawgi92qf:1eqrene038e5x6pgf606qjcs3eawdy@us-east-static-09.quotaguard.com:9293';
  const agent = new HttpsProxyAgent(proxy);

  const options = {
    hostname: 'api.bitget.com',
    path: path,
    method: method,
    headers: headers,
    agent: agent,
  };

  const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        console.log(JSON.parse(data));
      } catch (error) {
        console.error('Error parsing response:', error.message);
      }
    });
  });

  req.on('error', (error) => {
    console.error('Error creating order:', error.message);
  });

  req.write(requestBody);
  req.end();
};

// close order
async function closePosition(trackingNo) {
  const timestamp = Date.now().toString();
  const method = 'POST';
  const path = '/api/mix/v1/trace/closeTrackOrder';
  const baseURL = 'https://api.bitget.com';

  const requestBody = {
    symbol: 'BTCUSDT_UMCBL',
    trackingNo: trackingNo,
  };

  const signData = timestamp + method + path + JSON.stringify(requestBody);
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

  const proxy = 'http://ghakmyawgi92qf:1eqrene038e5x6pgf606qjcs3eawdy@us-east-static-09.quotaguard.com:9293';
  const agent = new HttpsProxyAgent(proxy);

  const options = {
    hostname: 'api.bitget.com',
    path: path,
    method: method,
    headers: headers,
    agent: agent,
  };

  const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        console.log(JSON.parse(data));
      } catch (error) {
        console.error('Error parsing response:', error.message);
      }
    });
  });

  req.on('error', (error) => {
    console.error('Error closing trader position:', error.message);
  });

  req.write(JSON.stringify(requestBody));
  req.end();
};



/////////////////////////////////////////////////////////////
// LONG, SHORT, EXIT FUNCTIONS -- LONG, SHORT, EXIT FUNCTIONS
/////////////////////////////////////////////////////////////

let clientOid = '';

async function postLongOrderEntry() {
  tradeDirection = 'long';

  await getAccountBalance();
  await createOrder('open_long', positionSize) // direction, positionSize, clientOid
};
// setTimeout(postLongOrderEntry, 5000);

async function postShortOrderEntry() {
  tradeDirection = 'short';

  await getAccountBalance();
  await createOrder('open_short', positionSize)  // direction, positionSize, clientOid
};
// setTimeout(postShortOrderEntry, 5000);


async function postExitOrder() {

  await getTrackingNumber();
    
  await closePosition(trackingNumber);

  await checkOpenPositions();

  if (openPositions[0] === '0' && openPositions[1] === '0') {
    console.log('All positions closed.');
  } else {
    postExitOrder();
  }
};
// setTimeout(postExitOrder, 10000);