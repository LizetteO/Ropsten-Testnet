var ethers = require('ethers');
var request = require('request');
var fs = require('fs');

var privateKey = "YourPrivateKey";
var publicKey = "YourPublicKey"
var bankPublicKey = "BankPublicKey"
var mainwallet = new ethers.Wallet(privateKey, ethers.getDefaultProvider('ropsten'));
let mainprovider = ethers.getDefaultProvider('ropsten');

var ratelimited = false;
var useproxy = false;

var mainproxyarray = fs.readFileSync('proxies.txt', 'utf8').split('\n');

function GetFaucet() {
    if (useproxy == true) {
        var proxyindex = Math.floor(Math.random()*mainproxyarray.length);
        var randomproxy = mainproxyarray[proxyindex];
        var splitproxy = randomproxy.split(':')
        var randomproxyip = splitproxy[0]
        var randomproxyport = splitproxy[1]

        request.post({
        headers: {'content-type' : 'application/rawdata'},
        url:     "https://faucet.metamask.io/",
        proxy:   "http://" + randomproxyip + ":" + randomproxyport,
        body:    publicKey.toString()
        }, function(error, response, body){
            if (!error && response.statusCode == 200) {
                console.log("Claimed Faucet | Transaction : " + body);
            }
            else {
                console.log("Error while getting faucet : " + error)
                mainproxyarray.splice(proxyindex, 1);
                console.log(mainproxyarray.length)
                GetFaucet()
            }
        });
    }
    else {
        request.post({
            headers: {'content-type' : 'application/rawdata'},
            url:     'https://faucet.metamask.io/',
            body:    publicKey.toString()
        }, function(error, response, body){
            if (body == "Too many requests, please try again later.")
            {
                console.log("Faucet Rate Limited")
                ratelimited = true;
            }
            else {
                console.log("Claimed Faucet | Transaction : " + body);
                ratelimited = false;
            }

        });
    }
}

async function sweep(privateKey, newAddress) {
    let provider = ethers.getDefaultProvider('ropsten');

    let wallet = new ethers.Wallet(privateKey, provider);

    // Make sure we are sweeping to an EOA, not a contract. The gas required
    // to send to a contract cannot be certain, so we may leave dust behind
    // or not set a high enough gas limit, in which case the transaction will
    // fail.
    let code = await provider.getCode(newAddress);
    if (code !== '0x') { throw new Error('Cannot sweep to a contract'); }

    // Get the current balance
    let balance = await wallet.getBalance();

    // Normally we would let the Wallet populate this for us, but we
    // need to compute EXACTLY how much value to send
    let gasPrice = await provider.getGasPrice();

    // The exact cost (in gas) to send to an Externally Owned Account (EOA)
    let gasLimit = 21000;

    // The balance less exactly the txfee in wei
    let value = balance.sub(gasPrice.mul(gasLimit))

    let tx = await wallet.sendTransaction({
        gasLimit: gasLimit,
        gasPrice: gasPrice,
        to: newAddress,
        value: value
    });

    console.log('Sent ' + ethers.utils.formatEther(balance) + ' ETH in Transaction: ' + tx.hash);
}

function Main() {
    mainprovider.getBalance(mainwallet.address).then((balance) => {

        // balance is a BigNumber (in wei); format is as a sting (in ether)
        let etherString = ethers.utils.formatEther(balance);

        if (etherString > 0)
        {
            console.log("Balance: " + etherString + ", Sweeping");
            sweep(privateKey, bankPublicKey)
        }
        else 
        {
            console.log("Balance: " + etherString + ", Too low to sweep");
        }

        if (etherString > 4.0) {
            console.log("Bal is too high to claim faucet!")
        }
        else 
        {
            console.log("Claiming Faucet...")
            GetFaucet();
        }
        if (ratelimited == true)
        {
            setTimeout(Main, 180000);
        }
        else 
        {
            setTimeout(Main, 15000);
        }
    });
}
setTimeout(Main, 5000);
