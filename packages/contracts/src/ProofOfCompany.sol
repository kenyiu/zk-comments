// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@zk-email/contracts/DKIMRegistry.sol";
import "@zk-email/contracts/utils/StringUtils.sol";
import { IEAS, AttestationRequest, AttestationRequestData } from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";
import { NO_EXPIRATION_TIME, EMPTY_UID } from "@ethereum-attestation-service/eas-contracts/contracts/Common.sol";
import "forge-std/console.sol";

//import "./utils/NFTSVG.sol";
import { Verifier } from "./Verifier.sol";

struct AttestationData {
    string md;
    string c;
    string d;
    string r;
    string s;
}

contract ProofOfCompany is ERC721Enumerable {
    using StringUtils for *;
//    using NFTSVG for *;

    uint16 public constant bytesInPackedBytes = 31;
    string constant domain = "github.com";

    uint32 public constant pubKeyHashIndexInSignals = 0; // index of DKIM public key hash in signals array
    uint32 public constant toDomainIndexInSignals = 1; // index of first packed twitter username in signals array
    uint32 public constant toDomainLengthInSignals = 1; // length of packed twitter username in signals array
    uint32 public constant addressIndexInSignals = 2; // index of ethereum address in signals array

    uint256 private tokenCounter;
    DKIMRegistry dkimRegistry;
    Verifier public immutable verifier;

    mapping(uint256 => string) public tokenIDToName;

    // The address of the global EAS contract.
    IEAS private immutable _eas;

    constructor(Verifier v, DKIMRegistry d, IEAS eas) ERC721("VerifiedEmail", "VerifiedEmail") {
        verifier = v;
        dkimRegistry = d;
        _eas = eas;
    }

    function tokenDesc(uint256 tokenId) public view returns (string memory) {
        string memory twitter_username = tokenIDToName[tokenId];
        address address_owner = ownerOf(tokenId);
        string memory result = string(
            abi.encodePacked("Twitter username", twitter_username, "is owned by", StringUtils.toString(address_owner))
        );
        return result;
    }

//    function tokenURI(uint256 tokenId) public view override returns (string memory) {
//        string memory username = tokenIDToName[tokenId];
//        address owner = ownerOf(tokenId);
////        return NFTSVG.constructAndReturnSVG(username, tokenId, owner);
//    }

    function _domainCheck(uint256[] memory headerSignals) public pure returns (bool) {
        string memory senderBytes = StringUtils.convertPackedBytesToString(headerSignals, 18, bytesInPackedBytes);
        string[3] memory domainStrings = ["verify@x.com", "info@x.com", "noreply@github.com"];
        return
            StringUtils.stringEq(senderBytes, domainStrings[0]) ||
            StringUtils.stringEq(senderBytes, domainStrings[1]) ||
            StringUtils.stringEq(senderBytes, domainStrings[2]);
        // Usage: require(_domainCheck(senderBytes, domainStrings), "Invalid domain");
    }

    /// Mint a token proving twitter ownership by verifying proof of email
    /// @param proof ZK proof of the circuit - a[2], b[4] and c[2] encoded in series
    /// @param signals Public signals of the circuit. First item is pubkey_hash, next 3 are twitter username, the last one is etherum address
    function mint(uint256[8] memory proof, uint256[3] memory signals) public {
        // Veiry RSA and proof
        require(
            verifier.verifyProof(
                [proof[0], proof[1]],
                [[proof[2], proof[3]], [proof[4], proof[5]]],
                [proof[6], proof[7]],
                signals
            ),
            "Invalid Proof"
        );
        console.log('valid proof');

        // TODO no invalid signal check yet, which is fine since the zk proof does it
//        require(_domainCheck(headerSignals), "Invalid from domain");

        // Verify the DKIM public key hash stored on-chain matches the one used in circuit
        bytes32 dkimPublicKeyHashInCircuit = bytes32(signals[pubKeyHashIndexInSignals]);
//        console.log('---');
//        console.logBytes32(dkimPublicKeyHashInCircuit);
        require(dkimRegistry.isDKIMPublicKeyHashValid(domain, dkimPublicKeyHashInCircuit), "invalid dkim signature");

        // Extract the toDomain chunks from the signals.
        // Note that this is not relevant now as username can fit in one signal
        // TODO: Simplify signal uint to string conversion
        uint256[] memory toDomainPack = new uint256[](toDomainLengthInSignals);
        for (uint256 i = toDomainIndexInSignals; i < (toDomainIndexInSignals + toDomainLengthInSignals); i++) {
            toDomainPack[i - toDomainIndexInSignals] = signals[i];
        }

        console.log('the to domain');
        string memory messageBytes = StringUtils.convertPackedBytesToString(
            toDomainPack,
            bytesInPackedBytes * toDomainLengthInSignals,
            bytesInPackedBytes
        );

        console.log(messageBytes);

        // Attest the comments
        _eas.attest(
            AttestationRequest({
                schema: 0xe48211c35083a8f46baf57b0af8199409fc80439736bec6e01ed8b814aa42c5a,
                data: AttestationRequestData({
                    recipient: address(0), // No recipient
                    expirationTime: NO_EXPIRATION_TIME, // No expiration time
                    revocable: true,
                    refUID: EMPTY_UID, // No references UI
                    data: abi.encode(AttestationData({
                        md: messageBytes,
                        c: "some comments",
                        d: "software department",
                        r: "software engineer",
                        s: "5792.3"
                    })),
                    value: 0 // No value/ETH
                })
            })
        );

    }

    function _beforeTokenTransfer(address from) internal pure {
        require(
            from == address(0),
            "Cannot transfer - VerifiedEmail is soulbound"
        );
    }
}
