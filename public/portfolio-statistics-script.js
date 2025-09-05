// Initialize the earliest transaction date to today and adjust later as needed
let earliestTransactionDate = new Date()

// Declare and initialize line chart as null. This is done as a global variable
// so the status of the line chart can be tracked outside its specific function
let lineChart = null

// Some of the data are coming from different API sources, so I decided to keep each
// piece of data as a separate variable to avoid confusion and for more intuitive
// access instead of adding all the data into a huge dictionary containing all pieces of data

// Cryptocurrency address, balance, and transaction data declarations
let bitcoinAddresses = [];
let bitcoinBalance = {USD: 0, satoshi: 0};
let bitcoinTransactions = [];

let ethereumAddresses = [];
let ethereumBalance = {USD: 0, gwei: 0};
let ethereumTransactions = [];
// Ethereum fee log because main ethereum API doesn't include fees
// Dictionary enables O(1) lookup, increases efficiency when looping through transactions
// and adding fee to transaction value
let ethereumFeeLog = {}

let litecoinAddresses = [];
let litecoinBalance = {USD: 0, litoshi: 0};
let litecoinTransactions = [];

let totalBalance = 0

// Load addresses function - will be called during initialization
function loadAddressesFromStorage() {
  try {
    // Get the addresses object from localStorage
    const addressesJson = localStorage.getItem('addresses');
    
    if (!isBlank(addressesJson)) {
      const addresses = JSON.parse(addressesJson);
      bitcoinAddresses = addresses.BTC || [];
      ethereumAddresses = addresses.ETH || [];
      litecoinAddresses = addresses.LTC || [];
    } else {
      // Fallback to old format if new format doesn't exist
      bitcoinAddresses = isBlank(localStorage.getItem('btc_addresses')) ? [] : localStorage.getItem('btc_addresses').split(",")
      ethereumAddresses = isBlank(localStorage.getItem('eth_addresses')) ? [] : localStorage.getItem('eth_addresses').split(",")
      litecoinAddresses = isBlank(localStorage.getItem('ltc_addresses')) ? [] : localStorage.getItem('ltc_addresses').split(",")
    }
    
    console.log("Loaded addresses:", {
      bitcoin: bitcoinAddresses,
      ethereum: ethereumAddresses, 
      litecoin: litecoinAddresses
    });
  } catch (e) {
    console.log("Couldn't fetch local storage ", e)
    document.getElementById('loader').style.display = "block"
  }
}

// Helper function to check if local storage item empty or null
function isBlank(string) {
  return string === "" || string === null;
}

// Declare and initialize sorting choice
let sortOrder = "descending"

// Declare and initialize current page to 1. Declare and initialize
// max transactions per page to 10.
let currentPage = 1
const txPerPage = 10

// All transactions standardized arrays initialized. This has to be done to later
// be used for sorting and converting to a standardized tax format. Data for each
// cryptocurrency is different so these arrays standardize that data
let allTransactions = []
let sortedTransactions = []

// Initialize price dictionaries at the start of the code to later populate
// Dictionary data structure enables O(1) lookup
let btcPrices = {}
let ethPrices = {}
let ltcPrices = {}

// Fetch BTC prices from local CSV and fill in missing recent dates with CoinGecko API
// Prices last updated 03/12/2025, update by 03/12/2026 to maintain
// BTC prices until 01/21/2012, ETH prices until 03/10/2016, LTC prices until 08/24/2016. While these
// price data points aren't of the full history of the cryptocurrencies, they go back far enough
// so that almost no cryptocurrency investors have used any of these before these dates, and my
// client started investing in cryptocurrencies far after these dates.

// Function to fetch CSV price data
async function fetchCSVPriceData() {
  // Fetch BTC prices from local CSV
  fetch('/Bitcoin_Historical_Data.csv')
    // Get response text and parse it to BTC price dictionary
    .then(response => response.text())
    .then(response => parseCSV(response, "BTC"))
    // Catch any errors and display error message
    .catch(error => {
      console.error("Error fetching CSV data:", error)
      document.getElementById('loader').style.display = "block"
    });
  // Fetch ETH prices from local CSV
  fetch('/Ethereum_Historical_Data.csv')
    .then(response => response.text())
    .then(response => parseCSV(response, "ETH"))
    .catch(error => {
      console.error("Error fetching CSV data:", error)
      document.getElementById('loader').style.display = "block"
    });
  // Fetch LTC prices from local CSV
  fetch('/Litecoin_Historical_Data.csv')
    .then(response => response.text())
    .then(response => parseCSV(response, "LTC"))
    .catch(error => {
      console.error("Error fetching CSV data:", error)
      document.getElementById('loader').style.display = "block"
    });
}

// Function to fetch all price data and populate dictionaries
async function fetchPriceData() {
  // Fetch CSV price data and populate dictionary first
  await fetchCSVPriceData()
  // Fetch prices for Bitcoin to fill in missing prices between last updated date and current date
  try {
    const response = await fetch(`/api/price-data/bitcoin`);
    const data = await response.json();
    // Loop through data and add price for each date to the dictionary
    for (let i = 0; i < data.prices.length; i++) {
      const date = dateObjectToString(new Date(data.prices[i][0]))
      btcPrices[date] = data.prices[i][1]
    }
  } // Catch any errors
  catch (error) {
    console.error("Error fetching Bitcoin price:", error);
    document.getElementById('loader').style.display = "block"
  }
  // Fetch prices for Ethereum to fill in missing prices between last updated date and current date
  try {
    const response = await fetch(`/api/price-data/ethereum`);
    const data = await response.json();
    // Loop through data and add price for each date to the dictionary
    for (let i = 0; i < data.prices.length; i++) {
      const date = dateObjectToString(new Date(data.prices[i][0]))
      ethPrices[date] = data.prices[i][1]
    }
  } catch (error) {
    console.error("Error fetching Ethereum price:", error);
    document.getElementById('loader').style.display = "block"
  }
  // Fetch prices for Litecoin to fill in missing prices between last updated date and current date
  try {
    // Fetch from the API URL and convert response to json
    const response = await fetch(`/api/price-data/litecoin`);
    const data = await response.json();
    // Loop through the price data points and populate dictionary price for \
    // corresponding date with the data
    for (let i = 0; i < data.prices.length; i++) {
      const date = dateObjectToString(new Date(data.prices[i][0]))
      ltcPrices[date] = data.prices[i][1]
    }
  } catch (error) {
    console.error("Error fetching Litecoin price:", error);
    document.getElementById('loader').style.display = "block"
  }
}

// Function to parse the price CSV into the dictionaries
function parseCSV(csvText, crypto) {
  // Find and set the target dictionary to corresponding dictionary
  let targetDict
  if (crypto === "BTC") {
    targetDict = btcPrices
  } else if (crypto === "ETH") {
    targetDict = ethPrices
  } else if (crypto === "LTC") {
    targetDict = ltcPrices
  }
  // Sanitize CSV text before splitting lines using new line delimiter
  const lines = csvText.trim().split('\n');
  // Loop through lines array
  for (let i = 0; i < lines.length; i++) {
    // Split lines by semicolon delimiter then map and sanitize data
    const values = lines[i].split(';').map(value => value.trim());
    // Reformat price string to conventional number syntax and save as price in target dictionary
    // values[0] is date and values[1] is price in CoinGecko format
    targetDict[values[0]] = parseFloat(values[1].replace('.', '').replace(',', '.'))
  }
}

// Function to convert date object to string with properly
// padded start to be able to access price dictionaries
function dateObjectToString(date) {
  // Get month and days and pad to ensure 2 digits (pad 0 before if 1 digit)
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  // Get year and return date as mm/dd/yyyy string
  const year = date.getFullYear();
  return `${month}/${day}/${year}`
}

// Throttling isn't used for Blockchair API retrieval because their API rate
// limits essentially don't exist

// Function to retrieve Bitcoin balance and data
async function retrieveBitcoinData() {
  // Declare promises array
  let promises = []
  // Loop through addresses
  for (let i = 0; i < bitcoinAddresses.length; i++) {
    // Get API URl for address
    try {
      // Fetch data from API and convert to JSON
      const response = await fetch(`/api/dashboard/bitcoin/${bitcoinAddresses[i]}`);
      const data = await response.json();
      // Check if data structure exists
      if (!data || !data.data) {
        console.log(`No data returned for Bitcoin address: ${bitcoinAddresses[i]}`);
        continue;
      }
      // Dynamically get address as key to ensure it is accessible
      // If we simply use bitcoinAddresses[i], it may fail sometimes
      const addressKey = Object.keys(data.data)[0];
      // Add address balances to current balances
      bitcoinBalance.USD += data.data[addressKey].address.balance_usd;
      bitcoinBalance.satoshi += data.data[addressKey].address.balance;
      // Fetch transactions for the address
      const fetchTransactions = fetchAllBitcoinTransactions(bitcoinAddresses[i],
          data.data[addressKey].address.transaction_count)
      // Push transaction fetch requests to promises list to await at the end
      promises.push(fetchTransactions)
    } // Catch any errors in data retrieval
    catch (error) {
      console.error("Error fetching Bitcoin balance:", error);
      document.getElementById('loader').style.display = "block"
    }
  }
  // Ensure that all promises in promises array are resolved until this function resolves
  await Promise.all(promises);
}

// Function to retrieve Ethereum prices and transactions
async function retrieveEthereumData() {
  // Loop through Ethereum addresses
  for (let i = 0; i < ethereumAddresses.length; i++) {
    // Get API URL for address
    try {
      // Get data from API and convert to JSON
      const response = await fetch(`/api/dashboard/ethereum/${ethereumAddresses[i]}`);
      const data = await response.json();
      // Check if data structure exists
      if (!data || !data.data) {
        console.log(`No data returned for Ethereum address: ${ethereumAddresses[i]}`);
        continue;
      }
      // Dynamically get address key to ensure it is accessible. Error may happen otherwise
      const addressKey = Object.keys(data.data)[0];
      // Update ethereum balances by adding address's balances.
      ethereumBalance.USD += data.data[addressKey].address.balance_usd;
      ethereumBalance.gwei += parseInt(data.data[addressKey].address.balance);
      // Push address transactions to full Ethereum transactions array
      ethereumTransactions.push(...(data.data[addressKey].calls))
    } // Catch any errors
    catch (error) {
      console.error("Error fetching Ethereum balance:", error);
      document.getElementById('loader').style.display = "block"
    }
  }
  // Once all address and transaction data retrieved, fetch and add output transaction
  // fees to transaction values
  await addEthereumOutputTransactionFees()
}

// Main ethereum transaction retrieval doesn't contain transaction fees
// This function retrieves and adds output transaction fees to Ethereum transaction values
// Etherscan API can't solely be used instead of Blockchair API because of rate limits
// and its API response structure which requires double the calls. Thus, it is best to combine
// the two sources
async function addEthereumOutputTransactionFees() {
  // Initialize remaining fails to 10
  let remainingFails = 10
  // Loop through Ethereum addresses
  for (let i = 0; i < ethereumAddresses.length; i++) {
    // Get API URl
    try {
      // Fetch data from API and convert to JSON
      const response = await fetch(`/api/fees/ethereum/${ethereumAddresses[i]}`);
      // Catch HTML-level errors such as rate limit errors throw error to handle in catch
      if (!response.ok) throw new Error(`HTTP error status ${response.status}`);
      const data = await response.json();

      // Loop through transactions
      for (let j = 0; j < data.result.length; j++) {
        // If the sender of the transaction is one of the user's transactions, calculate
        // fee and add to fee dictionary
        if (ethereumAddresses[i].toLowerCase() === (data.result[j].from).toLowerCase()) {
          // Parse data to int and add calculated fee to ethereum fee log dictionary
          ethereumFeeLog[data.result[j].hash] = parseInt(data.result[j].gas) * parseInt(data.result[j].gasPrice)
        }
      }

    } // Catch errors and retry after 1.1s
    catch (error) {
      remainingFails--
      // Check if ran out of fails
      if (remainingFails <= 0) {
        // Display error and break if failed
        console.error("Error fetching Ethereum fees:", error)
        document.getElementById('loader').style.display = 'block'
        break;
      }
      // Set timeout to retry in 1.1 seconds
      await new Promise(resolve => setTimeout(resolve, 1100));
      i--
    }
  }
  // Loop through transactions to add newly retrieved fees. Will also add transaction type (in/out)
  // to get the most out of this loop and reduce overall runtime
  for (let i = 0; i < ethereumTransactions.length; i++) {
    // Assume type is in
    ethereumTransactions[i].type = "IN"
    // Check if any ethereum addresses match transaction sender
    for (let j = 0; j < ethereumAddresses.length; j++) {
      if (ethereumAddresses[j].toLowerCase() === ethereumTransactions[i].sender.toLowerCase()) {
        // If match, change type to OUT and add fee to transaction value (default fallback value 0
        // if fee doesn't exist)
        ethereumTransactions[i].type = "OUT"
        ethereumTransactions[i].value += ethereumFeeLog[ethereumTransactions[i].transaction_hash] || 0
      }
    }
  }
}

// Functions to retrieve Litecoin balance and data (similar structure to retrieveBitcoinData)
async function retrieveLitecoinData() {
  // Declare promises array
  let promises = []
  // Loop through Litecoin addresses
  for (let i = 0; i < litecoinAddresses.length; i++) {
    // Get API URL
    try {
      // Fetch API response and convert to JSON
      const response = await fetch(`/api/dashboard/litecoin/${litecoinAddresses[i]}`);
      const data = await response.json();
      // Check if data structure exists
      if (!data || !data.data) {
        console.log(`No data returned for Litecoin address: ${litecoinAddresses[i]}`);
        continue;
      }
      // Dynamically get address key
      const addressKey = Object.keys(data.data)[0];
      // Update litecoin balances
      litecoinBalance.USD += data.data[addressKey].address.balance_usd;
      litecoinBalance.litoshi += data.data[addressKey].address.balance;
      // Fetch transactions and push to promises array to await the end
      const fetchTransactions = fetchAllLitecoinTransactions(litecoinAddresses[i])
      promises.push(fetchTransactions)
    } // Catch errors and display message
    catch (error) {
      console.error("Error fetching Litecoin balance:", error);
      document.getElementById('loader').style.display = "block"
    }
  }
  // Waits for all promises to resolve before finishing and resolving this whole function's promise
  await Promise.all(promises)
}

// Function to fetch all transactions from a Bitcoin address
async function fetchAllBitcoinTransactions(address, txCount) {
  // Declare transactions array to append to main array when fully populated
  const transactions = []
  // Initialize chained tx and remaining fails
  let chainedTX = ""
  let remainingFails = 10
  // Loop until the transactions array length is equal to the correct length passed in the parameter
  while (txCount > transactions.length) {
    try {
      // Fetch from API
      const apiUrl = `https://blockstream.info/api/address/${address}/txs/chain/${chainedTX}`
      const response = await fetch(apiUrl);
      // Catch HTML-level errors and throw error to handle in catch block
      if (!response.ok) throw new Error(`HTTP error status ${response.status}`);
      // Convert data to JSON and push data to transactions array
      const data = await response.json();
      transactions.push(...data)
      // Update chained tx to the last tx in the data
      chainedTX = data[data.length - 1].txid;
    } // Catch errors and throttle to retry after 1.1s
    catch (error) {
      remainingFails--
      if (remainingFails <= 0) {
        console.error("Error fetching Bitcoin transactions:", error)
        document.getElementById('loader').style.display = 'block'
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 1100));
    }
  }
  // Push all address transactions to full bitcoin transactions array once finished looping
  bitcoinTransactions.push(...transactions)
}

// Ethereum transactions already fetched in retrieve ethereum data function

// Fetch all transactions for Litecoin
async function fetchAllLitecoinTransactions(address) {
  // This API is very strict with its limits so the remaining fails is set low as it is unlikely
  // that throttle will work after it fails a few times

  // Initialize remaining fails and last block
  let remainingFails = 5;
  let lastBlock = null
  while (true) {
    // Create URl and add query parameter if lastBlock exists (because max transactions
    // per call is 2000, so lastBlock is used for pagination
    let apiURL = `https://api.blockcypher.com/v1/ltc/main/addrs/${address}?limit=2000`;
    if (lastBlock) {
      apiURL += `&before=${lastBlock}`;
    }
    try {
      // Fetch API
      const response = await fetch(apiURL);

      // Catch HTML-level errors and throw error to handle in catch block
      if (!response.ok) throw new Error(`HTTP error status ${response.status}`);

      // Convert data to JSON and push data to to litecoin transactions array
      const data = await response.json();
      litecoinTransactions.push(...data.txrefs);

      // Update last block to the block of the last transaction in the data
      lastBlock = data.txrefs[data.txrefs.length - 1].block_height;

      // Break if no more transactions
      if (!data.hasMore) break;
    } // Catch errors and throttle to retry after 3s
    catch (error) {
      remainingFails--
      if (remainingFails <= 0) {
        console.error("Error fetching Litecoin transactions:", error)
        document.getElementById('loader').style.display = 'block'
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

}

// Get crypto balance on a given date
async function getTotalBalanceOnGivenDate(date) {
  // Get BTC, ETH, and LTC balance and return their sum rounded to 2 sig figs
  const btcBalance = parseFloat(await getBitcoinBalanceOnGivenDate(date))
  const ethBalance = parseFloat(await getEthereumBalanceOnGivenDate(date))
  const ltcBalance = parseFloat(await getLitecoinBalanceOnGivenDate(date))
  console.log(`btc balance ${btcBalance}\neth balance ${ethBalance}\nltc balance ${ltcBalance}`)
  return (btcBalance + ethBalance + ltcBalance).toFixed(2)
}

// Function to get Bitcoin balance on a given date
async function getBitcoinBalanceOnGivenDate(date) {
  try {
    // Convert the date to a Unix timestamp in seconds to match with data format
    const timestamp = Math.floor(new Date(date).getTime() / 1000);
    // Initialize balance on date to current balance
    let balanceOnDate = bitcoinBalance.satoshi;
    // Loop through all bitcoin transactions
    for (let i = 0; i < bitcoinTransactions.length; i++) {
      // When this function is first called, it is called on the earliest
      // transaction date so the below if statement will be true for all transactions
      // This will make sure that IN/OUT and relevant value attribute is filled out
      // for all transactions which is later used for standardizing transactions

      // Check if the transaction is after the timestamp (else do nothing).
      if (bitcoinTransactions[i].status.block_time > timestamp) {
        // Initialize net value of transaction
        let netValue = 0
        // Loop through each output in the transaction
        for (const output of bitcoinTransactions[i].vout) {
          // Note: a set could be used instead to check if the output address
          // is in the bitcoin addresses array but the bitcoin addresses array will
          // never be longer than 3 so improvement would be minimal

          // Loop through each address to check if any of the user's addresses is an output
          for (const address of bitcoinAddresses) {
            // If a user address is an output, add the transaction value to
            // the net value because the user is receiving the coin
            if (output.scriptpubkey_address === address) {
              netValue += output.value;
            }
          }
        }
        // Loop through each input in the transaction
        for (const input of bitcoinTransactions[i].vin) {
          // Loop through each address to check if any of the user's addresses is an input
          for (const address of bitcoinAddresses) {
            // If a user address is an input, remove the transactions value from the
            // net value because the user sent the coin
            if (input.prevout.scriptpubkey_address === address) {
              netValue -= input.prevout.value;
            }
          }
        }
        // If the net value is positive, the transaction was an input (user received coin),
        // else it was an output (user sent coin). Change the transaction's type attribute.
        // This will be useful later when standardizing transactions to an all transactions array
        if (netValue >= 0) bitcoinTransactions[i].type = "IN"
        else bitcoinTransactions[i].type = "OUT"

        // Set the transaction's relevant value attribute to the absolute value of its net value.
        // This is the amount the user gained/lost from the transaction
        bitcoinTransactions[i].relevantValue = Math.abs(netValue)

        // Subtract balance on date from the net value of the transaction (because this transaction
        // took place after the specified date)
        balanceOnDate -= netValue
      }
    }
    // Divide balance on date by 1e8 to convert to bitcoin and multiply by price on date
    balanceOnDate = balanceOnDate / 1e8 * btcPrices[date]
    console.log(`Bitcoin Balance on ${date} = ${balanceOnDate}`)
    return balanceOnDate

  } // Catch any errors and return default of 0 to continue with rest of code
  catch (error) {
    console.error("Error fetching Bitcoin historical balance:", error);
    document.getElementById('loader').style.display = 'block'
    return 0;
  }
}

// Function to get Ethereum balance on a given date
async function getEthereumBalanceOnGivenDate(date) {
  try {
    // Create date object of current date
    let dateObject = new Date(date);
    // Initialize balance on date to current balance (gwei) to subtract in the following loop
    let balanceOnDate = ethereumBalance.gwei

    // Loop through all ethereum transactions
    for (let i = 0; i < ethereumTransactions.length; i++) {
      // Check if the transaction happened after the date (else do nothing)
      if (new Date(ethereumTransactions[i].time) > dateObject) {
        // If the transaction happened after the date, loop through ethereum addresses
        for (let j = 0; j < ethereumAddresses.length; j++) {
          // Check if any of the ethereum addresses is the recipient in the transaction
          if (ethereumTransactions[i].recipient.toLowerCase() === ethereumAddresses[j].toLowerCase()) {
            // If it is, subtract transaction value from balance on date
            balanceOnDate -= ethereumTransactions[i].value
          }
          // Check if any of the ethereum addresses is the sender in the transaction
          if (ethereumTransactions[i].sender.toLowerCase() === ethereumAddresses[j].toLowerCase()) {
            // If it is, add transaction value to balance on date
            balanceOnDate += ethereumTransactions[i].value
          }
        }
      }
    }
    // Divide by 1e18 to get balance in eth and multiply by price on date
    balanceOnDate = balanceOnDate / 1e18 * ethPrices[date]
    console.log(`Ethereum Balance on ${date} = $${balanceOnDate}`)
    return balanceOnDate;
  } // Catch any errors and return default value of 0
  catch (error) {
    console.error("Error fetching Ethereum historical balance:", error)
    document.getElementById('loader').style.display = 'block'
    return 0
  }
}

async function getLitecoinBalanceOnGivenDate(date) {
  try {
    // Convert the date to a Unix timestamp (in seconds)
    let dateObject = new Date(date)
    let balanceOnDate = litecoinBalance.litoshi;
    // Iterate through transactions and adjust the balance
    for (let i = 0; i < litecoinTransactions.length; i++) {
      // Check if transaction happened after specified date (else do nothing)
      if (new Date(litecoinTransactions[i].confirmed) > dateObject) {
        // Check if the user sent or received in this transaction (if tx_input_n greater
        // or equal to 0 it means that there exists a tx_input index, thus the user sent)
        if (litecoinTransactions[i].tx_input_n >= 0) {
          // If the user sent, add transaction value to balance on date (because the transaction
          // happened between specified date and current date, so if we go back in time and the
          // transaction never happened, the user would get the money back)
          balanceOnDate += litecoinTransactions[i].value
        }  // Else the user received, so remove transaction value from balance on date
        else {
          balanceOnDate -= litecoinTransactions[i].value
        }
      }
    }
    // Divide balance on date by 1e8 to get price in LTC and multiply by price on date
    balanceOnDate = balanceOnDate / 1e8 * ltcPrices[date]
    console.log(`Litecoin Balance on ${date} = ${balanceOnDate}`)
    return balanceOnDate
  } // Catch error and return default value of 0
  catch (error) {
    console.error("Error fetching Litecoin historical balance:", error);
    document.getElementById('loader').style.display = 'block'
    return 0;
  }
}

// Function to get and output balance
function updateBalance() {
  totalBalance = (bitcoinBalance.USD + litecoinBalance.USD + ethereumBalance.USD).toFixed(2)
  document.getElementById("total-portfolio-value").innerHTML = `$${totalBalance}`
}

// Function to calculate and display 24h portfolio change
async function update24hChange() {
  try {
    // Get yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDateString = dateObjectToString(yesterday);
    
    // Calculate portfolio value 24h ago
    const portfolioValue24hAgo = await getTotalBalanceOnGivenDate(yesterdayDateString);
    
    // Calculate change in USD and percentage
    const changeUSD = (totalBalance - portfolioValue24hAgo);
    const changePercent = portfolioValue24hAgo > 0 ? ((changeUSD / portfolioValue24hAgo) * 100) : 0;
    
    // Format the display text
    const changeUSDFormatted = changeUSD >= 0 ? `+$${Math.abs(changeUSD).toFixed(2)}` : `-$${Math.abs(changeUSD).toFixed(2)}`;
    const changePercentFormatted = changePercent >= 0 ? `+${changePercent.toFixed(2)}%` : `${changePercent.toFixed(2)}%`;
    
    // Update the display
    const portfolioChangeElement = document.getElementById("portfolio-change");
    portfolioChangeElement.innerHTML = `${changeUSDFormatted} (${changePercentFormatted})`;
    
    // Update the CSS class based on the change
    portfolioChangeElement.classList.remove('positive', 'negative', 'neutral');
    if (changeUSD > 0) {
      portfolioChangeElement.classList.add('positive');
    } else if (changeUSD < 0) {
      portfolioChangeElement.classList.add('negative');
    } else {
      portfolioChangeElement.classList.add('neutral');
    }
    
  } catch (error) {
    console.error("Error calculating 24h change:", error);
    // Show neutral state on error
    const portfolioChangeElement = document.getElementById("portfolio-change");
    portfolioChangeElement.innerHTML = "$0.00 (0.00%)";
    portfolioChangeElement.classList.remove('positive', 'negative');
    portfolioChangeElement.classList.add('neutral');
  }
}

// Function to load overview table (UPDATED FOR NEW HTML STRUCTURE)
function loadOverviewTable() {
  // Get today date as string to access prices
  const todayDate = dateObjectToString(new Date())
  
  // Update holdings table
  const holdingsTableBody = document.getElementById('holdings-table-body');
  holdingsTableBody.innerHTML = '';
  
  // Add Bitcoin row
  const btcAmount = (bitcoinBalance.satoshi / 1e8).toFixed(8);
  const btcPrice = btcPrices[todayDate];
  const btcRow = document.createElement('tr');
  btcRow.innerHTML = `
    <td><img src="btc_icon.png" alt="Bitcoin" style="width: 20px; height: 20px; margin-right: 8px; vertical-align: middle;">Bitcoin</td>
    <td>${btcAmount} BTC</td>
    <td>$${btcPrice.toFixed(2)}</td>
    <td>$${bitcoinBalance.USD.toFixed(2)}</td>
  `;
  holdingsTableBody.appendChild(btcRow);
  
  // Add Ethereum row
  const ethAmount = (ethereumBalance.gwei / 1e18).toFixed(8);
  const ethPrice = ethPrices[todayDate];
  const ethRow = document.createElement('tr');
  ethRow.innerHTML = `
    <td><img src="eth_icon.png" alt="Ethereum" style="width: 20px; height: 20px; margin-right: 8px; vertical-align: middle;">Ethereum</td>
    <td>${ethAmount} ETH</td>
    <td>$${ethPrice.toFixed(2)}</td>
    <td>$${ethereumBalance.USD.toFixed(2)}</td>
  `;
  holdingsTableBody.appendChild(ethRow);
  
  // Add Litecoin row
  const ltcAmount = (litecoinBalance.litoshi / 1e8).toFixed(8);
  const ltcPrice = ltcPrices[todayDate];
  const ltcRow = document.createElement('tr');
  ltcRow.innerHTML = `
    <td><img src="ltc_icon.png" alt="Litecoin" style="width: 20px; height: 20px; margin-right: 8px; vertical-align: middle;">Litecoin</td>
    <td>${ltcAmount} LTC</td>
    <td>$${ltcPrice.toFixed(2)}</td>
    <td>$${litecoinBalance.USD.toFixed(2)}</td>
  `;
  holdingsTableBody.appendChild(ltcRow);
}

// Function to load pie chart (UPDATED FOR NEW HTML STRUCTURE)
function loadPieChart() {
  // Get pie chart element
  let ctx = document.getElementById('holdings-pie-chart');
  // Create new chart on pie chart canvas
  new Chart(ctx, {
    type: 'pie',
    // Data for pie chart
    data: {
      // Slice labels
      labels: ['Bitcoin', 'Ethereum', 'Litecoin'],
      // Data points
      datasets: [{
        // Data for each slice corresponding to above labels
        data: [bitcoinBalance.USD, ethereumBalance.USD, litecoinBalance.USD],
        // Slice styling
        backgroundColor: ['#f7931a', '#627eea', '#bfbbbb'],
        borderColor: ['#1a1a1a', '#1a1a1a', '#1a1a1a'],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        // Move legend to left and change label color to white to make it readable
        legend: {
          position: 'bottom',
          labels: {
            color: '#FFFFFF',
            padding: 20
          }
        },
      }
    }
  });
}

// Function to prep line chart data and print the line chart for the specified period (UPDATED FOR NEW HTML STRUCTURE)
async function loadLineChart(timePeriod) {
  // If line chart already exists, destroy it to make room for new one
  if (lineChart !== null) {
    lineChart.destroy()
    lineChart = null;
  }
  // 6 data points
  const dataPoints = 6
  // Get current date as object
  const currentTime = new Date()
  // Initialize labels and data arrays
  let timeLabels = []
  let portfolioValueData = []
  // Declare lower bound and time difference
  let lowerBound
  let timeDifference
  // Adjust lower bound and time difference according to time period
  if (timePeriod === "All") {
    // If time period is all, find the earliest transaction and set as lower bound
    await findEarliestTransactionDate()
    // Set lower bound to earliest transaction date and calculate time difference
    lowerBound = earliestTransactionDate
    timeDifference = currentTime - earliestTransactionDate
  } else if (timePeriod === "3y") {
    // Set time different to 3 years in seconds
    timeDifference = 9.4608e10
    // Calculate lower bound
    lowerBound = new Date(currentTime - timeDifference)
  } else if (timePeriod === "1Y") {
    timeDifference = 3.1536e10
    lowerBound = new Date(currentTime - timeDifference)
  } else if (timePeriod === "3M") {
    timeDifference = 7.776e9
    lowerBound = new Date(currentTime - timeDifference)
  } else if (timePeriod === "1M") {
    timeDifference = 2.592e9
    lowerBound = new Date(currentTime - timeDifference)
  } else if (timePeriod === "5D") {
    timeDifference = 4.32e8
    lowerBound = new Date(currentTime - timeDifference)
  }
  // Loop through and Populate time labels and portfolio value data array for
  // all data points except the last
  for (let i = 0; i < dataPoints - 1; i++) {
    // Set time label to the lower bound plus the calculated time difference between data points
    timeLabels[i] = dateObjectToString(new Date(lowerBound.getTime() + (i * timeDifference / (dataPoints - 1))))
    // Set portfolio value data at that date to the portfolio balance on that date
    portfolioValueData[i] = await getTotalBalanceOnGivenDate(timeLabels[i])
  }
  // Get last data point using existing data retrieved earlier because it is current data.
  // Reduces loading time and ensures highest accuracy
  timeLabels.push(dateObjectToString(currentTime))
  portfolioValueData.push(totalBalance)

  // Get line chart element (UPDATED FOR NEW HTML STRUCTURE)
  const ctx = document.getElementById('portfolio-line-chart');

  // Define the data
  const data = {
    // Define labels
    labels: timeLabels,
    datasets: [{
      label: 'Portfolio Value',
      // Define data points
      data: portfolioValueData,
      // Line border and background color
      borderColor: '#00d4ff',
      backgroundColor: 'rgba(0, 212, 255, 0.1)',
      borderWidth: 2,
      fill: true,
      // Curvature: higher = more curves to make a more continuous graph
      tension: 0.3
    }]
  };
  // Create the chart on the line chart canvas
  lineChart = new Chart(ctx, {
    type: 'line',
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          display: true,
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          },
          ticks: {
            color: '#ffffff'
          }
        },
        y: {
          display: true,
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          },
          ticks: {
            color: '#ffffff',
            callback: function(value) {
              return '$' + value.toLocaleString();
            }
          }
        }
      }
    }
  });
}

// Function to find and update earliest transaction date
async function findEarliestTransactionDate() {
  // Loop through all transactions and adjust the earliest transaction date accordingly
  for (const tx of bitcoinTransactions) {
    const txTime = new Date(tx.status.block_time * 1000)
    if (txTime < earliestTransactionDate) earliestTransactionDate = txTime
  }
  for (const tx of ethereumTransactions) {
    const txTime = new Date(tx.time)
    if (txTime < earliestTransactionDate) earliestTransactionDate = txTime
  }
  for (const tx of litecoinTransactions) {
    const txTime = new Date(tx.confirmed)
    if (txTime < earliestTransactionDate) earliestTransactionDate = txTime
  }
  return earliestTransactionDate
}

// Function to convert all the crypto transaction arrays into a standardized 2d array
function standardizeTransactions() {
  // Array structure: [Crypto, Date (as string), IN/OUT, value, value on date, TXID]
  // Loop through Bitcoin, Ethereum, and Litecoin trasactions and push to all transactions array
  for (let i = 0; i < bitcoinTransactions.length; i++) {
    allTransactions.push(["BTC", dateObjectToString(new Date(bitcoinTransactions[i].status.block_time * 1000)), bitcoinTransactions[i].type, bitcoinTransactions[i].relevantValue / 1e8, (bitcoinTransactions[i].relevantValue / 1e8 * btcPrices[dateObjectToString(new Date(bitcoinTransactions[i].status.block_time * 1000))]).toFixed(2), bitcoinTransactions[i].txid])
  }
  for (let i = 0; i < ethereumTransactions.length; i++) {
    allTransactions.push(["ETH", dateObjectToString(new Date(ethereumTransactions[i].time)), ethereumTransactions[i].type, (ethereumTransactions[i].value / 1e18), (ethereumTransactions[i].value / 1e18 * ethPrices[dateObjectToString(new Date(ethereumTransactions[i].time))]).toFixed(2), ethereumTransactions[i].transaction_hash])
  }
  for (let i = 0; i < litecoinTransactions.length; i++) {
    let type = "IN"
    if (litecoinTransactions[i].tx_input_n >= 0) type = "OUT"
    allTransactions.push(["LTC", dateObjectToString(new Date(litecoinTransactions[i].confirmed)), type, litecoinTransactions[i].value / 1e8, (litecoinTransactions[i].value / 1e8 * ltcPrices[dateObjectToString(new Date(litecoinTransactions[i].confirmed))]).toFixed(2), litecoinTransactions[i].tx_hash])
  }
  console.log(allTransactions)
}

// Function to sort transactions according to current user choice
async function sortTransactions() {
  // Get current filter values
  const assetFilter = document.getElementById('asset-filter');
  const typeFilter = document.getElementById('type-filter');
  
  const selectedAsset = assetFilter ? assetFilter.value : 'ALL';
  const selectedType = typeFilter ? typeFilter.value : 'ALL';
  
  // Start with all transactions
  sortedTransactions = [...allTransactions];
  
  // Filter by asset first
  if (selectedAsset !== 'ALL') {
    sortedTransactions = sortedTransactions.filter(transaction => transaction[0] === selectedAsset);
  }
  
  // Filter by transaction type
  if (selectedType === 'IN') {
    sortedTransactions = sortedTransactions.filter(transaction => transaction[2] === "IN");
  } else if (selectedType === 'OUT') {
    sortedTransactions = sortedTransactions.filter(transaction => transaction[2] === "OUT");
  }
  // If selectedType === 'ALL', no additional filtering needed
  // Sort transactions by descending order (newest first)
  if (sortOrder === "descending") {
    // JavaScript built-in sort function combines sorting algorithms to optimize performance
    // based on array statistics. On average O(n log n)
    sortedTransactions.sort((a, b) => {
      return (new Date(b[1]) - new Date(a[1]));
    });
  } // Sort transactions by ascending order (oldest first)
  else {
    sortedTransactions.sort((a, b) => {
      return (new Date(a[1]) - new Date(b[1]));
    });
  }
}

// Function to populate the transaction table with the sorted transaction data (UPDATED FOR NEW HTML STRUCTURE)
function populateTransactionTable() {
  // Calculate total pages needed
  const totalPages = Math.ceil(sortedTransactions.length / txPerPage)
  // Update page info (current page and total pages)
  document.getElementById("page-indicator").innerHTML = `Page ${currentPage} of ${totalPages}`
  
  // Update pagination button states
  const prevBtn = document.getElementById('prev-page-btn');
  const nextBtn = document.getElementById('next-page-btn');
  
  if (prevBtn) {
    prevBtn.disabled = currentPage === 1;
  }
  
  if (nextBtn) {
    nextBtn.disabled = currentPage === totalPages || totalPages === 0;
  }
  // Get transaction history table body (UPDATED FOR NEW HTML STRUCTURE)
  const tableBody = document.getElementById("transaction-table-body");
  // Clear current table body
  tableBody.innerHTML = "";
  // Slice sorted transactions based on current page and transactions per page
  sortedTransactions.slice((currentPage - 1) * txPerPage, currentPage * txPerPage).forEach(tx => {
    // For each transaction, create a new table row in the table body and populate with the data
    const row = document.createElement("tr");
    // Blockchain doesn't show LTC transactions so use if statement to populate table with rows and
    // transaction links from correct sources
    if (tx[0] === "BTC" || tx[0] === "ETH") {
      // Data structure based on standardized transactions
      let color;
      if (tx[2] === "IN") {
        color = "#3cff71"
      } else {
        color = "#ff5f5f"
      }
      row.innerHTML = `
      <td>${tx[1]}</td>
      <td>${tx[0]}</td>
      <td style="color: ${color};">${tx[2]}</td>
      <td>${tx[3]} ${tx[0]}</td>
      <td>$${tx[4]}</td>
      <td><a href="https://www.blockchain.com/explorer/transactions/${tx[0]}/${tx[5]}" target="_blank">${tx[5]}</a></td>
      `;
    } else if (tx[0] === "LTC") {
      let color = tx[2] === "IN" ? "#3cff71" : "#ff5f5f";
      row.innerHTML = `
      <td>${tx[1]}</td>
      <td>${tx[0]}</td>
      <td style="color: ${color};">${tx[2]}</td>
      <td>${tx[3]} ${tx[0]}</td>
      <td>$${tx[4]}</td>
      <td><a href="https://blockchair.com/litecoin/transaction/${tx[5]}" target="_blank">${tx[5]}</a></td>
      `;
    }
    // Append row to table body
    tableBody.appendChild(row);
  });
}

// Function to change page with change as parameter (UPDATED FOR NEW HTML STRUCTURE)
function changePage(change) {
  // Change page forward
  if (change === 1) {
    // Check if next page will be inbounds
    if (currentPage < Math.ceil(sortedTransactions.length / txPerPage)) {
      // Increment current page and repopulate transaction table
      currentPage++;
      populateTransactionTable()
    }
  }
  // Change page backwards
  else if (change === -1) {
    // Check if previous page will be in bounds
    if (currentPage > 1) {
      // Decrement current page and repopulate transaction table
      currentPage--;
      populateTransactionTable()
    }
  }
}

// Function to setup event listeners for the new design
function setupEventListeners() {
  // Setup time period buttons for chart
  const timeButtons = document.querySelectorAll('.time-btn');
  timeButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons
      timeButtons.forEach(btn => btn.classList.remove('active'));
      // Add active class to clicked button
      button.classList.add('active');
      // Load chart with selected period
      const period = button.getAttribute('data-period');
      loadLineChart(period);
    });
  });
  
  // Setup filter event listeners for the new design
  const assetFilter = document.getElementById('asset-filter');
  const typeFilter = document.getElementById('type-filter');
  const sortDateBtn = document.getElementById('sort-date-btn');
  
  if (assetFilter) {
    assetFilter.addEventListener('change', () => {
      currentPage = 1; // Reset to first page when filtering
      sortTransactions().then(() => populateTransactionTable());
    });
  }
  
  if (typeFilter) {
    typeFilter.addEventListener('change', () => {
      currentPage = 1; // Reset to first page when filtering
      sortTransactions().then(() => populateTransactionTable());
    });
  }
  
  if (sortDateBtn) {
    sortDateBtn.addEventListener('click', () => {
      sortOrder = sortOrder === "descending" ? "ascending" : "descending";
      sortDateBtn.textContent = sortOrder === "descending" ? "Sort: Newest First" : "Sort: Oldest First";
      currentPage = 1;
      sortTransactions().then(() => populateTransactionTable());
    });
  }

  // Setup pagination buttons (UPDATED FOR NEW HTML STRUCTURE)
  const prevBtn = document.getElementById('prev-page-btn');
  const nextBtn = document.getElementById('next-page-btn');
  const goToPageBtn = document.getElementById('go-to-page-btn');
  const pageInput = document.getElementById('page-input');
  
  if (prevBtn) {
    prevBtn.addEventListener('click', () => changePage(-1));
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', () => changePage(1));
  }
  
  if (goToPageBtn && pageInput) {
    goToPageBtn.addEventListener('click', () => {
      const page = parseInt(pageInput.value);
      const totalPages = Math.ceil(sortedTransactions.length / txPerPage);
      if (page >= 1 && page <= totalPages) {
        currentPage = page;
        populateTransactionTable();
        pageInput.value = '';
      }
    });
    
    pageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        goToPageBtn.click();
      }
    });
  }
}

// Function to download all transactions under current filters and sorting
// order as .csv or .pdf

function downloadCSV() {
  // Data headers
  const headers = ["Crypto", "Date", "IN/OUT", "Amount", "$USD Value on TX Date", "TXID"];
  // Convert sorted transactions array to CSV string
  // Combine headers with sorted transactions
  const csvContent = [headers, ...sortedTransactions].map(row =>
    // Make each item a string and join with a comma then join each row with new line
    row.map(item => `"${item}"`).join(",")).join("\n");

  // Create a Blob from the CSV string with type csv
  const blob = new Blob([csvContent], {type: 'text/csv;charset=utf-8;'});

  // Create a temporary link element
  const link = document.createElement("a");
  // Create URL for the blob and set link href attribute to the url
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  // Make link download the data from the URl on click with file name transactions.csv
  link.setAttribute("download", 'transactions.csv');
  // Hide link, append to body, and click it
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();

  // Remove link from DOM and revoke blob link
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Function Create pdf file and download using jsPDF autotable
function downloadPDF() {
  // Get jsPDF constructor from DOM
  const {jsPDF} = window.jspdf;
  // Table headers
  const headers = ["Crypto", "Date", "IN/OUT", "Amount", "$USD Value on TX Date", "TXID"];
  // Create new jspdf
  const doc = new jsPDF();

  // Use autotable to create the pdf table
  doc.autoTable({
    // Define theme, header, and body (data)
    theme: 'grid',
    head: [headers],
    body: sortedTransactions,
    // Set column widths to fit with expected data length
    columnStyles: {
      0: {cellWidth: 15},
      1: {cellWidth: 25},
      2: {cellWidth: 11},
      3: {cellWidth: 25},
      4: {cellWidth: 20},
      5: {cellWidth: 70},
    }
  });
  // Save file as transactions.pdf
  doc.save("transactions.pdf");
}

// Get the tax year (most recent full year passed)
const taxYear = (new Date()).getFullYear() - 1

// Initialize short and long-term capital gains
let shortTermCapitalGains = 0
let longTermCapitalGains = 0

// Initialize default capital gains tax rates
let shortTermCapitalGainsTaxRate = 0.25
let longTermCapitalGainTaxRate = 0.1

// Function to get the short-term capital gains tax rate for 2025 (same as ordinary income)
function getShortTermTaxRate(income) {
    if (income <= 11925) return 0.10;
    if (income <= 48475) return 0.12;
    if (income <= 103350) return 0.22;
    if (income <= 197300) return 0.24;
    if (income <= 250525) return 0.32;
    if (income <= 626350) return 0.35;
    return 0.37;
}

// Function to get the long-term capital gains tax rate for 2025
function getLongTermTaxRate(income) {
    if (income <= 49230) return 0.00;
    if (income <= 541450) return 0.15;
    return 0.20;
}

// Declare transactions in tax format and sales array
let transactionsTaxFormat
let sales = []

// Function to prepare transactions for tax format by reversing transactions
// and mapping values for better data readability
async function prepTransactionsForTaxCalculation() {
  transactionsTaxFormat = [...sortedTransactions].reverse().map(tx => ({
    asset: tx[0],
    date: tx[1],
    type: tx[2],
    amount: tx[3],
    pricePerUnit: tx[4] / tx[3],
  }));
}
async function calculateCapitalGains() {
  // Get the transactions in tax format first
  await prepTransactionsForTaxCalculation()

  // Declare assets dictionary
  const assets = {};

  // Loop through each transaction
  transactionsTaxFormat.forEach(tx => {
    // If asset not already in dictionary create an inside dictionary for that asset with
    // buys and sells arrays
    if (!assets[tx.asset]) assets[tx.asset] = {buys: [], sells: []};
    // Push into either buy or sell array corresponding to transaction type
    if (tx.type === "IN") assets[tx.asset].buys.push(tx);
    else assets[tx.asset].sells.push(tx);
  });
  // Loop through each asset
  for (const asset in assets) {
    // Get the buys and sells for the asset
    // Buys array is reversed so that removing the first element would now be popping the end element
    // Time complexity reduced from O(n) to O(1) for removal
    const buys = assets[asset].buys.reverse();
    const sells = assets[asset].sells;
    // Loop through all sells
    for (const sell of sells) {
      // Get amount of sell
      let amountToSell = sell.amount;
      // Loop until no amount to sell left
      while (amountToSell > 0 && buys.length > 0) {
        // Get first buy from buys array (earliest buy)
        const buy = buys[buys.length - 1];
        // Get amount to sell (minimum of sell amount and buy amount)
        const sellAmount = Math.min(amountToSell, buy.amount);

        // Calculate gain and term
        const gain = sellAmount * sell.pricePerUnit - sellAmount * buy.pricePerUnit;
        const term = calculateTerm(buy.date, sell.date)

        // Push sale data to sales array
        sales.push({
          asset: asset,
          dateSold: sell.date,
          buyDate: buy.date,
          amount: sellAmount,
          gain: gain,
          term: term,
        });

        // Update remaining buy amount and sell amount
        amountToSell -= sellAmount;
        buy.amount -= sellAmount;
        // If the buy is all used up, pop the buy (removing the earliest buy because it is reversed)
        if (buy.amount <= 0) buys.pop();
      }
    }
  }
  // Filter sales to get only sales for most recent year
  const recentYearSales = sales.filter(sale => (new Date(sale.dateSold)).getFullYear() === taxYear)
  // Loop through sales
  for (let i = 0; i < recentYearSales.length; i++) {
    // If the term of the sale is long, add sale value to long-term gains else add to short-term gains
    if (recentYearSales[i].term === "LONG") longTermCapitalGains += recentYearSales[i].gain
    else shortTermCapitalGains += recentYearSales[i].gain
  }
}

// Check if holding period > 1 year
function calculateTerm(buyDate, sellDate) {
  return new Date(sellDate) - new Date(buyDate) >= 31536000000 ? "LONG" : "SHORT"
}

// Function to populate the tax statistics section
function populateTaxStatistics() {
  const incomeInput = document.getElementById('income-input');
  const income = parseFloat(incomeInput.value) || 0;

  shortTermCapitalGainsTaxRate = getShortTermTaxRate(income + shortTermCapitalGains);
  longTermCapitalGainTaxRate = getLongTermTaxRate(income + longTermCapitalGains);

  document.getElementById('short-term-gains').textContent = `$${shortTermCapitalGains.toFixed(2)}`;
  document.getElementById('long-term-gains').textContent = `$${longTermCapitalGains.toFixed(2)}`;
  
  const estimatedShortTermTax = shortTermCapitalGains * shortTermCapitalGainsTaxRate;
  const estimatedLongTermTax = longTermCapitalGains * longTermCapitalGainTaxRate;
  
  document.getElementById('short-term-tax').textContent = `$${estimatedShortTermTax.toFixed(2)}`;
  document.getElementById('long-term-tax').textContent = `$${estimatedLongTermTax.toFixed(2)}`;
}

// Main initialization function
async function initializeApp() {
  try {
    // Show loading message
    document.getElementById('loader').style.display = 'block';
    document.getElementById('statistics-content').style.display = 'none';
    
    // Load addresses from localStorage first
    loadAddressesFromStorage();
    
    // Check if user has any addresses saved
    if (bitcoinAddresses.length === 0 && ethereumAddresses.length === 0 && litecoinAddresses.length === 0) {
      // Show message that no addresses are found, but don't redirect
      console.log("No addresses found");
      document.getElementById('loader').style.display = 'none';
      document.getElementById('statistics-content').style.display = 'block';
      // Show empty state or message in the portfolio
      return;
    }
    
    // Fetch all data in parallel
    await Promise.all([
      fetchPriceData(),
      retrieveBitcoinData(),
      retrieveEthereumData(),
      retrieveLitecoinData()
    ]);
    
    // Process the data
    updateBalance();
    await update24hChange();
    loadOverviewTable();
    loadPieChart();
    await findEarliestTransactionDate();
    await loadLineChart("All");
    standardizeTransactions();
    await sortTransactions();
    populateTransactionTable();
    await calculateCapitalGains();
    populateTaxStatistics();
    
    // Setup event listeners
    setupEventListeners();

    // Add event listener for income input
    const incomeInput = document.getElementById('income-input');
    if (incomeInput) {
        incomeInput.addEventListener('input', populateTaxStatistics);
    }
    
    // Hide loading message and show content
    document.getElementById('loader').style.display = 'none';
    document.getElementById('statistics-content').style.display = 'block';
    
  } catch (error) {
    console.error("Error initializing app:", error);
    document.getElementById('loader').style.display = 'none';
    alert('Error loading portfolio data. Please try again.');
  }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});