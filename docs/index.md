---
layout: content
---

# Trinity

Trinity is a command-line wallet for the NEO Network written in Node.js and distributed via npm.

## Overview

_This wallet is still being thoroughly tested, please DO NOT use on mainnet._

### What does it currently do

- Wallet functionality
  - Create address / private key pairs
  - Import private key
  - NEP-2 support
  - Display balances
  - Display transaction details from Neoscan blockchain explorer
  - Monitor multiple addresses
  - Send NEO
  - Send GAS
  - Claim GAS
- Contact list management
- Ledger Nano S support (watch-only)
- Trade GAS for NEO on [KuCoin](https://www.kucoin.com/#/trade/GAS-NEO) exchange
- View balances of NEP-5 tokens, such as RPX

### What will it do

- Full support for Ledger Nano S
- Full support for NEP-5 tokens
- Generation of cold storage wallet
- Adding watch-only addresses
- Display current USD and BTC equivalent values for GAS and NEO

### Known issues

- Due to the way configuration is stored, sometimes configurations aren't saved first try and need to be tried again. Fix coming soon for this.
- Can be difficult to cancel an action once started. Currently best approach is to deliberately enter invalid information to throw an error.
- On slower machines some of the encryption / decryption can take a little while, and there's no nice visual indicator something is happening. Coming!

### Get help or give help

- Open a new [issue](https://github.com/Satoshinaire/trinity-cli/issues/new) if you encounter a problem.
- Or ping **@satoshinaire** on the **NEO Slack**.
- Pull requests welcome. You can help with wallet functionality, writing tests or documentation, or on any other feature you deem awesome.

## Getting started

### Installation

```
npm install -g trinity-cli
```

### Usage

Trinity works like a command-prompt, just type `help` to get started:

```
[TestNet] trinity > help

 Commands:

    help                       Provides help for a given command.
    exit                       Exits application.
    send neo                   Send NEO from one of your addresses to one of your contacts.
    send gas                   Send GAS from one of your addresses to one of your contacts.
    wallet list                List available wallets.
    wallet show [options]      Select an address to show its balances, transactions, claimables, etc.
    wallet create              Creates a new wallet address.
    wallet import [options]    Import an existing private key in WIF format.
    wallet remove              Select an address to remove from local storage.
    wallet clear               Purge all wallet information from local storage.
    token list                 List available tokens.
    token add                  Add a new token hash.
    token remove               Remove a token hash.
    contact list               List your contacts.
    contact add                Add a new contact.
    contact remove             Remove an existing contact.
    contact clear              Purge all contact information from local storage.
    claim gas                  Claim all available and unavailable gas.
    network                    Switch to a different network.
    trade [options]            Configure, lock, or unlock your KuCoin API credentials for trading.
    trade balance              Get trading balance from KuCoin.
    trade orders               Get current active orders from KuCoin.
    trade create               Create a new order on KuCoin.
    trade cancel               Cancel an order on KuCoin.
    trade withdraw             Withdraw funds from KuCoin.
    version                    Show Trinity version information.
```

### Demo

![A quick demo of current Trinity functionality](https://user-images.githubusercontent.com/30309816/32032525-6c077db8-ba53-11e7-8646-b89fbabecf0b.gif)

## License

- Open-source [MIT](https://github.com/Satoshinaire/trinity-cli/blob/master/LICENSE.md).
- Main author is [@satoshinaire](https://github.com/satoshinaire).

## Donations

Accepted at __AeqoGrirm7khpRVTJvisi8EugfYYmbB6xD__
