# ZK Comments 

We are presenting you a DApp built based on Scroll, where Employee can self-attest themselves using the emails they received by providers like Github recently using Zero-knowledge libraries without disclosing anything but the recipient's domain.


## How it works

1. Request a forget password request from Github
2. Copy the Original Email received by Github
3. Paste to our website and generate the zk proof on client-side (NO DATA is transferred to server/blockchain at this stage)
4. After the generation of zk proof, type the comments of the company and get it sent to the chain. (Only your email domain, wallet address, public key of the DNS record and comments will be disclosed)

## Running locally
#### Pre-requisites
1. rust
2. foundry
3. zk-regexp

#### Install dependencies

```bash
yarn
```

#### Start the web app. In `packages/app` directory, run

```bash
yarn start
```

This will start the UI at `http://localhost:3000/` where you can paste the email, generate proof and mint the NFT.

The UI works against the generated zkeys downloaded from AWS and the deployed contract on Sepolia.

## Manual Proof Generation

If you want to generate the proof locally outside browser, follow the instructions below.

### Circuits

Circom circuits are located in `packages/circuits`, the main circuit being [twitter.circom](packages/circuits/twitter.circom). TwitterVerifier circuit use [EmailVerifier](https://github.com/zkemail/zk-email-verify/blob/main/packages/circuits/email-verifier.circom) circuit from `@zk-email/circuits`.

The regex circuit required to parse/extract Twitter username can be generated using [https://github.com/zkemail/zk-regex](zk-regex) package.

#### » Generate Regex Circuit

```bash
# CWD = packages/circuits
yarn generate-regex:to-address
yarn generate-regex
```

This will generate `src/twitter-reset-regex.circom` and `src/to-address-regex.circom` using the config in `src/twitter_reset.json` and `src/to-domain.json` 

Note that `twitter_reset-regex.circom` and `to-domain-regex.circom` is already in repo, so this step is optional.

#### » Build the circuit

```bash
# CWD = packages/circuits
yarn build:company && yarn build:twitter
```

This will create `twitter.wasm`, `company.wasm` and other files in `packages/circuits/build` directory.

You can test the circuit using

```bash
# CWD = packages/circuits
yarn test:company && yarn test:twitter
```

#### » Generating Zkey

You can generate proving and verification keys using

```bash
# CWD = packages/circuits/scripts
ZKEY_ENTROPY=<random-number> ZKEY_BEACON=<random-hex> ts-node dev-setup.ts
```

This will generate `zkey` files, `vkey.json` in `build` directory, and Solidity verifier in `packages/contracts/src/Verifier.sol` (You might need to manually update the solidity pragma version).

> Note: We are using a custom fork of `snarkjs` which generated **chunked zkeys**. Chunked zkeys make it easier to use in browser, especially since we have large circuit. You can switch to regular `snarkjs` in `package.json` if you don't want to use chunked zkeys.


For browser use, the script also compresses the chunked zkeys. 

**The compressed zkeys, vkey, wasm are copied to /build/artifacts` directory. This directory can be served using a local server or uploaded to S3 for use in the browser.

To upload to S3, the below script can be used.
```bash
python3 upload_to_s3.py --build-dir <project-path>/proof-of-twitter/packages/circuits/build --circuit-name twitter 
```

There are helper functions in `@zk-email/helpers` package to download and decompress the zkeys in the browser.

To use locally, please run `cd packages/circuits/build/artifacts && python3 server-cors.py 8080` and the artifacts will be accessible.

#### » Generate Input and Proof

```bash
# CWD = packages/circuits/scripts
# ts-node generate-proof.ts --email-file ../tests/emls/twitter-test.eml --ethereum-address <your-eth-address>
```

This will generate input + witness using the given email file and Ethereum address, and prove using the generated zkey.

The script will save `inputs.json`, `input.wtns`, `proof.json`, and `public.json` in `proof` directory.

The script also verify the generated proof are correct. You can use the proof and public inputs to verify in the Solidity verifier as well.

### Contracts

The solidity contracts can be found in `packages/contracts`. 

#### You can build the contracts using

```bash
# CWD = packages/contracts
yarn build  # Assume you have foundry installed
```

#### Run tests

```bash
# CWD = packages/contracts
yarn test:company
```

Note that the tests will not pass if you have generated your own zkeys and `Verifier.sol` as you would have used a different Entropy.

To fix, update the `publicSignals` and `proof` in `test/TestTwitter.t.sol` with the values from `input.json` and `public.json` generated from the above steps. (Remember that you need to flip items in the nested array of `pi_b`).

#### Deploy contracts

```bash
# CWD = packages/contracts
PRIVATE_KEY=<pk-hex> forge script script/DeployTwitter.s.sol.bak:Deploy -vvvv --rpc-url  https://sepolia-rpc.scroll.io/ --broadcast --legacy --extra-output-files=abi --verifier-url https://api-sepolia.scrollscan.com/api --etherscan-api-key <API-KEY> --verify
```

They are deployed to scroll sepolia testnet at the following addresses:

```
src/Verifier.sol 0x19aB947b5bddBf66419415c7b72dc7299BFA7b3A (verified)
src/DKIMRegistry.sol 0x9e58681a270D28a0E26E01d4c1e5942CEA8A984B (verified)
src/ProofOfCompany.sol 0xF9D45eBbD284F0732b2f3826a67f58154738a3FE (failed to verify)
```

### UI

If you want to update the UI based on your own zkeys and contracts, please make the below changes:

- Set the `VITE_CONTRACT_ADDRESS` in `packages/app/.env`. This is the address of the `ProofOfTwitter` contract.
- Set `VITE_CIRCUIT_ARTIFACTS_URL` in `packages/app/.env` to the URL of the directory containing circuit artifacts (compressed partial zkeys, wasm, verifier, etc). You can run a local server in `circuits/build/artifacts` directory and use that URL or upload to S3 (or similar) and use that public URL/


## Credit
https://github.com/zkemail
https://github.com/ethereum-attestation-service
