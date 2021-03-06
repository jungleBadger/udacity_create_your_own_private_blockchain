/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message` 
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *  
 */

const SHA256 = require('crypto-js/sha256');
const BlockClass = require('./block.js');
const bitcoinMessage = require('bitcoinjs-message');
const VALIDATION_TIMEOUT = 5 * 60; // 5 minutes
class Blockchain {

    /**
     * Constructor of the class, you will need to setup your chain array and the height
     * of your chain (the length of your chain array).
     * Also everytime you create a Blockchain class you will need to initialized the chain creating
     * the Genesis Block.
     * The methods in this class will always return a Promise to allow client applications or
     * other backends to call asynchronous functions.
     */
    constructor() {
        this.chain = [];
        this.height = -1;
        this.initializeChain();
    }

    /**
     * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
     * You should use the `addBlock(block)` to create the Genesis Block
     * Passing as a data `{data: 'Genesis Block'}`
     */
    async initializeChain() {
        if( this.height === -1){
            let block = new BlockClass.Block({data: 'Genesis Block'});
            try {
                await this._addBlock(block);
            } catch (e) {
                console.log(e);
            }
        }
    }

    /**
     * Utility method that return a Promise that will resolve with the height of the chain
     */
    getChainHeight() {
        return new Promise((resolve, reject) => {
            resolve(this.height);
        });
    }

    /**
     * _addBlock(block) will store a block in the chain
     * @param {*} block 
     * The method will return a Promise that will resolve with the block added
     * or reject if an error happen during the execution.
     * You will need to check for the height to assign the `previousBlockHash`,
     * assign the `timestamp` and the correct `height`...At the end you need to 
     * create the `block hash` and push the block into the chain array. Don't for get 
     * to update the `this.height`
     * Note: the symbol `_` in the method name indicates in the javascript convention 
     * that this method is a private method. 
     */
    _addBlock(block) {
        let self = this;
        return new Promise((resolve, reject) => {
            try {
                if (self.chain && self.chain.length) {
                    block.previousBlockHash = self.chain[self.chain.length - 1].generateHash();
                    block.height = self.chain.length;
                } else {
                    block.previousBlockHash = null;
                    block.height = 0;
                }

                block.hash = block.generateHash();

                self.chain.push(block);
                this.height = block.height;
                resolve(block);
            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     * The requestMessageOwnershipVerification(address) method
     * will allow you  to request a message that you will use to
     * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
     * This is the first step before submit your Block.
     * The method return a Promise that will resolve with the message to be signed
     * @param {*} address 
     */
    requestMessageOwnershipVerification(address) {
        return new Promise((resolve, reject) => {
            if (!address) {
                reject("Invalid params");
            }
            resolve(`${address}:${new Date().getTime().toString().slice(0, -3)}:starRegistry`);
        });
    }

    /**
     * The submitStar(address, message, signature, star) method
     * will allow users to register a new Block with the star object
     * into the chain. This method will resolve with the Block added or
     * reject with an error.
     * Algorithm steps:
     * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
     * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
     * 3. Check if the time elapsed is less than 5 minutes
     * 4. Veify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
     * 5. Create the block and add it to the chain
     * 6. Resolve with the block added.
     * @param {*} address 
     * @param {*} message 
     * @param {*} signature 
     * @param {*} star 
     */
    submitStar(address, message, signature, star) {
        let self = this;
        //I would rather do it with async/await, but to respect the proposed style and be consistent, I will keep the
        // promise-based style.
        return new Promise(async (resolve, reject) => {
            if (
                (Number(new Date().getTime().toString().slice(0, -3)) - Number(message.split(':')[1])) > VALIDATION_TIMEOUT
            ) {
                reject("Message signature expired");
            } else {
                try {
                    if (
                        bitcoinMessage.verify(
                            message, address, signature
                        )
                    ) {
                        let block = new BlockClass.Block(
                            {
                                "owner": address,
                                "star": star
                            }
                        );
                        self._addBlock(
                            block
                        ).then(newBlock => resolve(newBlock)
                        ).catch(err => reject(err));
                    } else {
                        reject("Invalid message signature");
                    }
                } catch (e) {
                    reject(e);
                }

            }
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block
     *  with the hash passed as a parameter.
     * Search on the chain array for the block that has the hash.
     * @param {*} hash 
     */
    getBlockByHash(hash) {
        let self = this;
        return new Promise((resolve, reject) => {
            let block = self.chain.find(p => p.hash === hash);
            if (block) {
                resolve(block);
            } else {
                resolve(null);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block object 
     * with the height equal to the parameter `height`
     * @param {*} height 
     */
    getBlockByHeight(height) {
        let self = this;
        return new Promise((resolve, reject) => {
            let block = self.chain.find(p => p.height === height);
            if (block) {
                resolve(block);
            } else {
                resolve(null);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with an array of Stars objects existing in the chain 
     * and are belongs to the owner with the wallet address passed as parameter.
     * Remember the star should be returned decoded.
     * @param {*} address 
     */
    getStarsByWalletAddress (address) {
        let self = this;
        return new Promise((resolve, reject) => {

            let stars =
                self.chain.filter(
                    block => block.getBData().owner === address
                ).map(
                    block => block.getBData()
                );
            if (stars && stars.length) {
                resolve(stars);
            } else {
                resolve(null);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with the list of errors when validating the chain.
     * Steps to validate:
     * 1. You should validate each block using `validateBlock`
     * 2. Each Block should check the with the previousBlockHash
     */
    validateChain() {
        let self = this;
        let errorLog = [];
        return new Promise(async (resolve, reject) => {
            try {
                for (let i = 0; i < self.chain.length; i += 1) {
                    let status = await self.chain[i].validate();
                    if (!status) {
                        errorLog.push({
                            "error": "Invalid block signature",
                            "block": self.chain[i]
                        });
                    } else if (self.chain[i].previousBlockHash && (!self.chain[i - 1] || !self.chain[i - 1].generateHash)) {
                        errorLog.push({
                            "error": "Inconsistent chain heights.",
                            "block": self.chain[i]
                        });
                    } else if (
                        //Compare hash of previous block with current block `previousBlockHash` value
                        self.chain[i].height > 0 &&
                        (self.chain[i - 1].generateHash() !== self.chain[i].previousBlockHash)
                    ) {
                        errorLog.push({
                            "error": "Invalid previous block signature",
                            "block": self.chain[i]
                        });
                    }
                }

                resolve(errorLog);
            } catch (e) {
                reject(e);
            }

        });
    }
}

module.exports.Blockchain = Blockchain;   
