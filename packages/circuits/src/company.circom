pragma circom 2.1.5;

// include "@zk-email/zk-regex-circom/circuits/common/from_addr_regex.circom";
// clude "@zk-email/zk-regex-circom/circuits/common/to_addr_regex.circom";
// include "@zk-email/zk-regex-circom/circuits/common/email_addr_regex.circom";
include "@zk-email/circuits/email-verifier.circom";
// include "@zk-email/circuits/utils/regex.circom";
// include "./to-address-regex.circom";
include "./to-domain-regex.circom";

template CompanyEmailVerifier(maxHeadersLength, maxBodyLength, n, k) {
    log("CompanyEmailVerifier 20240429 03:47");

    signal input emailHeader[maxHeadersLength];
    signal input emailHeaderLength;
    signal input pubkey[k];
    signal input signature[k];
    signal input emailBody[maxBodyLength];
    signal input emailBodyLength;
    signal input bodyHashIndex;
    signal input precomputedSHA[32];
    signal input toDomainIndex;
    // signal input toEmailOfficialIndex;
    signal input address; // we don't need to constrain the + 1 due to https://geometry.xyz/notebook/groth16-malleability

    signal output pubkeyHash;
    signal output toDomain;

    log(maxHeadersLength);
    component EV = EmailVerifier(maxHeadersLength, maxBodyLength, n, k, 1);
    EV.emailHeader <== emailHeader;
    EV.pubkey <== pubkey;
    EV.signature <== signature;
    EV.emailHeaderLength <== emailHeaderLength;

    pubkeyHash <== EV.pubkeyHash;

    // signal (fromEmailFound, fromEmailReveal[maxHeadersLength]) <== FromAddrRegex(maxHeadersLength)(emailHeader);
    // log(fromEmailFound);
    // fromEmailFound === 1;
    // log("fromEmail Found");

    // signal (toEmailByOfficialFound, toEmailByOfficialReveal[maxHeadersLength]) <== ToAddrRegex(maxHeadersLength)(emailHeader);
    // log(toEmailByOfficialFound);
    // toEmailByOfficialFound === 1;
    // log("toEmailByOfficial Found");
    // var maxEmailLength = 255;
    // signal output toEmailAddrPacks[9] <== PackRegexReveal(maxHeadersLength, maxEmailLength)(toEmailByOfficialReveal, toEmailOfficialIndex);

    signal (toDomainFound, toDomainReveal[maxHeadersLength]) <== ToDomainRegex(maxHeadersLength)(emailHeader);
    log(toDomainFound);
    toDomainFound === 1;
    log("toDomain Found");

    var maxEmailLength = 255;
    signal toDomainAddrPacks2[9] <== PackRegexReveal(maxHeadersLength, maxEmailLength)(toDomainReveal, toDomainIndex);

    // TODO: Now it's assumed the email domain can be stored in one byte
    toDomain <== toDomainAddrPacks2[0];
}


component main { public [ address ] } = CompanyEmailVerifier(1024, 1536, 121, 17);
