// installed packages:
//dovenv
//crypto
//node-fetch@2

// consigure secret keys:
require('dotenv').config();

const apiKey = process.env.BITGET_API_KEY;
const apiSecret = process.env.BITGET_API_SECRET;
const apiUrl = 'https://api.bitget.com';

// Function to create the signature for the request
function createSignature(apiSecret, preHash) {
  const crypto = require('crypto');
  return crypto.createHmac('sha256', apiSecret).update(preHash).digest('hex');
}

// Function to make a request to the Bitget API

const fetch = require('node-fetch');

async function requestBitgetAPI(method, endpoint, queryParams = {}) {
  const timestamp = Date.now();
  const preHash = `${method}${endpoint}${timestamp}${JSON.stringify(queryParams)}`;
  const signature = createSignature(apiSecret, preHash);

  const headers = {
    'Content-Type': 'application/json',
    'ACCESS-KEY': apiKey,
    'ACCESS-SIGN': signature,
    'ACCESS-TIMESTAMP': timestamp.toString(),
  };

  const requestOptions = {
    method: method,
    headers: headers,
  };

  if (method === 'POST') {
    requestOptions.body = JSON.stringify(queryParams);
  }

  const response = await fetch(`${apiUrl}${endpoint}`, requestOptions);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`API request failed: ${data.message}`);
  }

  return data;
}

// Example usage: 
// Fetch account information

(async function() {
  try {
    const accountInfo = await requestBitgetAPI('GET', '/api/spot/v1/accounts');
    console.log(accountInfo);
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
})();
