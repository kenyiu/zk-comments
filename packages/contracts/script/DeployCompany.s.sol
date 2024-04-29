pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "forge-std/Script.sol";
import "forge-std/console.sol";
import "@zk-email/contracts/DKIMRegistry.sol";
import "../src/ProofOfCompany.sol";
import "../src/Verifier.sol";
import { IEAS } from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";
import "forge-std/console.sol";

contract Deploy is Script, Test {
    function getPrivateKey() internal view returns (uint256) {
        try vm.envUint("PRIVATE_KEY") returns (uint256 privateKey) {
            return privateKey;
        } catch {
            // This is the anvil default exposed secret key
            return 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        }
    }

    function run() public {
        uint256 sk = getPrivateKey();
        address owner = vm.createWallet(sk).addr;
        vm.startBroadcast(sk);

        Verifier proofVerifier = new Verifier();
        console.log("Deployed Verifier at address: %s", address(proofVerifier));

        DKIMRegistry dkimRegistry = new DKIMRegistry(owner);
        console.log("Deployed DKIMRegistry at address: %s", address(dkimRegistry));

        // x.com hash for selector dkim-202308
        dkimRegistry.setDKIMPublicKeyHash(
            "x.com",
            bytes32(uint256(1983664618407009423875829639306275185491946247764487749439145140682408188330))
        );

        dkimRegistry.setDKIMPublicKeyHash(
            "x.com",
            bytes32(uint256(14900978865743571023141723682019198695580050511337677317524514528673897510335))
        );

        // TODO: update the github public key hash
        // github.com hash for selector pf2023
        dkimRegistry.setDKIMPublicKeyHash(
            "github.com",
            bytes32(uint256(18769159890606851885526203517158331386071551795170342791119488780143683832216))
        );

        // Prepare the EAS contract
        IEAS eas = IEAS(address(0xaEF4103A04090071165F78D45D83A0C0782c2B2a));
        ProofOfCompany testVerifier = new ProofOfCompany(proofVerifier, dkimRegistry, eas);
        console.log("Deployed ProofOfCompany at address: %s", address(testVerifier));

        vm.stopBroadcast();
    }
}
