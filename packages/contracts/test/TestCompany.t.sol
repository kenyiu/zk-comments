pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "@zk-email/contracts/DKIMRegistry.sol";
import "../src/Verifier.sol";
import "../src/ProofOfCompany.sol";
import "forge-std/console.sol";

// Mock
import {MockEAS, MockSchemaRegistry} from "../src/utils/MockEAS.sol";
import { IEAS, AttestationRequest, AttestationRequestData } from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";

contract CompanyUtilsTest is Test {
    IEAS public eas;
    using StringUtils for *;

    address constant VM_ADDR = 0x7109709ECfa91a80626fF3989D68f67F5b1DD12D; // Hardcoded address of the VM from foundry

    Verifier proofVerifier;
    DKIMRegistry dkimRegistry;
    ProofOfCompany testVerifier;

    uint16 public constant packSize = 7;

    function setUp() public {
        address owner = vm.addr(1);

        vm.startPrank(owner);

        proofVerifier = new Verifier();
        dkimRegistry = new DKIMRegistry(owner);

        // These are the Poseidon hash of DKIM public keys for x.com
        // This was calcualted using https://github.com/zkemail/zk-email-verify/tree/main/packages/scripts
        dkimRegistry.setDKIMPublicKeyHash(
            "x.com",
            bytes32(uint256(14900978865743571023141723682019198695580050511337677317524514528673897510335))
        );
        dkimRegistry.setDKIMPublicKeyHash(
            "x.com",
            bytes32(uint256(1983664618407009423875829639306275185491946247764487749439145140682408188330))
        );
        dkimRegistry.setDKIMPublicKeyHash(
            "github.com",
            bytes32(uint256(18769159890606851885526203517158331386071551795170342791119488780143683832216))
        );

        eas = IEAS(address(new MockEAS()));

        testVerifier = new ProofOfCompany(proofVerifier, dkimRegistry, eas);

        vm.stopPrank();
    }

    // function testMint() public {
    //   testVerifier.mint
    // }

    // Should pass (note that there are extra 0 bytes, which are filtered out but should be noted in audits)
    function testUnpack1() public view {
        uint256[] memory packedBytes = new uint256[](3);
        packedBytes[0] = 29096824819513600;
        packedBytes[1] = 0;
        packedBytes[2] = 0;

        // This is 0x797573685f670000000000000000000000000000000000000000000000000000
        // packSize = 7
        string memory byteList = StringUtils.convertPackedBytesToString(
            packedBytes,
            15,
            packSize
        );
        // This is 0x797573685f67, since strings are internally arbitrary length arrays
        string memory intended_value = "yush_g";

        // We need to cast both to bytes32, which works since usernames can be at most 15, alphanumeric + '_' characters
        // Note that this may not generalize to non-ascii characters.
        // Weird characters are allowed in email addresses, see https://en.wikipedia.org/wiki/Email_address#Local-part
        // See https://stackoverflow.com/a/2049510/3977093 -- you can even have international characters with RFC 6532
        // Our regex should just disallow most of these emails, but they may end up taking more than two bytes
        // ASCII should fit in 2 bytes but emails may not be ASCII
        assertEq(bytes32(bytes(byteList)), bytes32(bytes(intended_value)));
        assertEq(byteList, intended_value);
        console.logString(byteList);
    }

    function testUnpack2() public view {
        uint256[] memory packedBytes = new uint256[](3);
        packedBytes[0] = 28557011619965818;
        packedBytes[1] = 1818845549;
        packedBytes[2] = 0;
        string memory byteList = StringUtils.convertPackedBytesToString(
            packedBytes,
            15,
            packSize
        );
        string memory intended_value = "zktestemail";
        assertEq(bytes32(bytes(byteList)), bytes32(bytes(intended_value)));
        console.logString(byteList);
    }

    // These proof and public input values are generated using scripts in packages/circuits/scripts/generate-proof.ts
    // The sample email in `/emls` is used as the input, but you will have different values if you generated your own zkeys
    function testVerifyTestEmail() public {
        uint256[3] memory publicSignals;
        publicSignals[0] = 1983664618407009423875829639306275185491946247764487749439145140682408188330;
        publicSignals[1] = 2018721414038404820327;
        publicSignals[2] = 698366364972452586744113103099682820325781057851;

        uint256[2] memory proof_a = [
            6791641610937131894007112739269016934187908891503820168704437751089583275379,
            34547184110568668050265698293327158528792817099703934521998283998033836504
        ];
        // Note: you need to swap the order of the two elements in each subarray
        uint256[2][2] memory proof_b = [
            [
                14031474248429158462945833900702194042142986682230091632920992211299544393375,
                16931380205023364467827372622224950178199766514809543253988045600213266501625
            ],
            [
                7421926272227353892206301434706345899207702633555690344487784239078524128533,
                9112985845482034195577659399000524869043416081127862833807394486928458309078
            ]
        ];
        uint256[2] memory proof_c = [
            3392439715609347923219976259016795515101523070713961625448562804360836286961,
            8239616286539099341793710975107570961146408787014322287004191735523087209225
        ];

        uint256[8] memory proof = [
            proof_a[0],
            proof_a[1],
            proof_b[0][0],
            proof_b[0][1],
            proof_b[1][0],
            proof_b[1][1],
            proof_c[0],
            proof_c[1]
        ];

        // Test proof verification
        bool verified = proofVerifier.verifyProof(
            proof_a,
            proof_b,
            proof_c,
            publicSignals
        );
        assertEq(verified, true);
        console.log(verified);


        // Test mint after spoofing msg.sender
        Vm vm = Vm(VM_ADDR);
        vm.startPrank(0x0000000000000000000000000000000000000001);
        testVerifier.mint(proof, publicSignals);
        vm.stopPrank();
    }

    function testChainID() public view {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        console.log(chainId);
        // Local chain, xdai, goerli, mainnet
        assert(
            chainId == 31337 || chainId == 100 || chainId == 5 || chainId == 1
        );
    }
}
