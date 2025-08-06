document.addEventListener('DOMContentLoaded', function() {
    migrateOldAddresses();
    loadAddresses();
});

// --- DATA MIGRATION ---
function migrateOldAddresses() {
    const oldBtc = localStorage.getItem('btc_addresses');
    const oldEth = localStorage.getItem('eth_addresses');
    const oldLtc = localStorage.getItem('ltc_addresses');
    
    if (oldBtc || oldEth || oldLtc) {
        const addresses = getAddresses(); // Get existing new-format addresses
        
        if (oldBtc && oldBtc.length > 0) addresses.BTC = [...new Set([...addresses.BTC, ...oldBtc.split(',').filter(a => a)])];
        if (oldEth && oldEth.length > 0) addresses.ETH = [...new Set([...addresses.ETH, ...oldEth.split(',').filter(a => a)])];
        if (oldLtc && oldLtc.length > 0) addresses.LTC = [...new Set([...addresses.LTC, ...oldLtc.split(',').filter(a => a)])];
        
        saveAddresses(addresses);

        // Remove old items after migration
        localStorage.removeItem('btc_addresses');
        localStorage.removeItem('eth_addresses');
        localStorage.removeItem('ltc_addresses');
        
        console.log('Successfully migrated old addresses to the new format.');
    }
}

// --- CORE FUNCTIONS ---
const MAX_ADDRESSES = 3;

function getAddresses() {
    return JSON.parse(localStorage.getItem('addresses')) || { BTC: [], ETH: [], LTC: [] };
}

function saveAddresses(addresses) {
    localStorage.setItem('addresses', JSON.stringify(addresses));
}

function displayStatus(message, isError = false) {
    const statusElement = document.getElementById('status-message');
    statusElement.textContent = message;
    statusElement.className = 'status-message'; // Reset classes
    statusElement.classList.add(isError ? 'error' : 'success');
    statusElement.style.display = 'block';

    setTimeout(() => {
        statusElement.style.display = 'none';
    }, 3000);
}

function renderAddresses() {
    const addresses = getAddresses();
    const coinTypeMap = {
        'BTC': 'bitcoin',
        'ETH': 'ethereum',
        'LTC': 'litecoin'
    };

    Object.keys(coinTypeMap).forEach(type => {
        const listElementId = `${coinTypeMap[type]}Addresses`;
        const listElement = document.getElementById(listElementId);
        if (!listElement) return;

        listElement.innerHTML = ''; // Clear existing list

        if (addresses[type]) {
            addresses[type].forEach(address => {
                const li = document.createElement('li');
                li.textContent = address;

                const removeBtn = document.createElement('button');
                removeBtn.innerHTML = '&times;';
                removeBtn.className = 'remove-btn';
                removeBtn.onclick = () => removeAddress(type, address);

                li.appendChild(removeBtn);
                listElement.appendChild(li);
            });
        }
    });
}


function addAddress(type) {
    const addresses = getAddresses();
    const input = document.getElementById(type);
    const address = input.value.trim();

    if (!validateAddress(type, address)) {
        displayStatus('Invalid or duplicate address.', true);
        return;
    }

    if (!address) {
        displayStatus('Please enter an address.', true);
        return;
    }

    if (addresses[type].length >= MAX_ADDRESSES) {
        displayStatus(`You can only add up to ${MAX_ADDRESSES} ${type} addresses.`, true);
        return;
    }

    if (addresses[type].includes(address)) {
        displayStatus('This address has already been added.', true);
        return;
    }

    addresses[type].push(address);
    saveAddresses(addresses);
    renderAddresses();
    input.value = '';
    displayStatus(`${type} address added successfully.`);
}

function removeAddress(type, addressToRemove) {
    const addresses = getAddresses();
    addresses[type] = addresses[type].filter(address => address !== addressToRemove);
    saveAddresses(addresses);
    renderAddresses();
    displayStatus(`${type} address removed.`);
}

// --- ADDRESS VALIDATION ---
function validateAddress(type, address) {
    const addresses = getAddresses();
    if (!address || addresses[type].includes(address)) {
        return false;
    }

    if (type === "BTC") {
        const p2pkh = /^[1][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address);
        const p2sh = /^[3][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address);
        const bech32 = /^(bc1)[a-z0-9]{25,90}$/.test(address);
        return p2pkh || p2sh || bech32;
    }
    if (type === "ETH") {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }
    if (type === "LTC") {
        const p2pkh = /^[LM][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address);
        const bech32 = /^(ltc1)[a-z0-9]{25,90}$/.test(address);
        return p2pkh || bech32;
    }
    return false;
}

function clearAllAddresses() {
    if (confirm('Are you sure you want to clear all addresses? This action cannot be undone.')) {
        saveAddresses({ BTC: [], ETH: [], LTC: [] });
        renderAddresses();
        displayStatus('All addresses have been cleared.');
    }
}

// Initial render on page load
function loadAddresses() {
    renderAddresses();
}
