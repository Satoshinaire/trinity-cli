<p align="center">
  <img
    src="https://user-images.githubusercontent.com/30309816/31295829-c8d25310-ab2b-11e7-8885-fb335d0c3baf.png"
    width="125px;">
</p>

<h1 align="center">Trinity</h1>

<p align="center">
  Trinity is a command-line wallet for the NEO Network written in Node.js and distributed via npm.
</p>

## Overview

### What does it currently do

- Very basic Wallet functionality (Not fully tested, please do not use on mainnet)

### What will it do

- Feature-complete light Wallet

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

    help              Provides help for a given command.
    exit              Exits application.
    send neo          Send NEO from one of your addresses to one of your contacts.
    send gas          Send GAS from one of your addresses to one of your contacts.
    wallet list       List available wallets.
    wallet show       Select an address to show its balances, transactions, claimables, etc.
    wallet create     Creates a new wallet address.
    wallet import     Import an existing private key in WIF format.
    wallet remove     Select an address to remove from local storage.
    wallet clear      Purge all wallet information from local storage.
    contact list      List your contacts.
    contact add       Add a new contact.
    contact remove    Remove an existing contact.
    contact clear     Purge all contact information from local storage.
    claim gas         Claim all available and unavailable gas.
    network           Switch to a different network.
    version           Show Trinity version information.
```

### Demo

![A quick demo of current Trinity functionality](https://i.imgur.com/OCU2eVi.gif)

## License

- Open-source [MIT](https://github.com/Satoshinaire/trinity-cli/blob/master/LICENSE.md).
- Main author is [@satoshinaire](https://github.com/satoshinaire).

## Donations

Accepted at __AWcAwoXK6gbMUTojHMHEx8FgEfaVK9Hz5s__
