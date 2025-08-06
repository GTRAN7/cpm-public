const express = require('express');
const app = express();
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');
dotenv.config();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/statistics', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'Portfolio_Statistics.html'));
});

app.get('/api/price-data/:coin', async (req, res) => {
    const coin = req.params.coin;
    const apiURL = `https://api.coingecko.com/api/v3/coins/${coin}/market_chart?vs_currency=usd&days=365&x_cg_demo_api_key=${process.env.CGAPIKEY}`;
    const response = await fetch(apiURL);
    const data = await response.json();
    res.json(data); 
});

app.get('/api/dashboard/:coin/:address', async (req, res) => {
    const coin = req.params.coin;
    const address = req.params.address;
    let apiURL = `https://api.blockchair.com/${coin}/dashboards/address/${address}?key=${process.env.BLOCKCHAIRAPIKEY}`;
    if (coin === 'ethereum') {
        apiURL = `https://api.blockchair.com/ethereum/dashboards/address/${address}?limit=10000&key=${process.env.BLOCKCHAIRAPIKEY}`;
    }
    const response = await fetch(apiURL);
    const data = await response.json();
    res.json(data);
});

app.get('/api/fees/ethereum/:address', async (req, res) => {
    const address = req.params.address;
    const apiURL = `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&apikey=${process.env.ETHERSCANAPIKEY}`;
    const response = await fetch(apiURL);
    const data = await response.json();
    res.json(data);
});

app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'views', '404.html'));
});

// Only start the server if we're not in a Vercel environment
if (process.env.NODE_ENV !== 'production') {
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}

// Export the Express app for Vercel
module.exports = app;