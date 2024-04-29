import { buildPoseidon } from "circomlibjs";
import { verifyDKIMSignature } from "@zk-email/helpers/dist/dkim";
import { generateTwitterVerifierCircuitInputs, generateCompanyEmailCircuitInputs } from "../helpers";
import { bigIntToChunkedBytes, bytesToBigInt } from "@zk-email/helpers/dist/binary-format";
import { log, error } from "console";

const path = require("path");
const fs = require("fs");
const wasm_tester = require("circom_tester").wasm;


describe("Company email test", function () {
  jest.setTimeout(10 * 60 * 1000); // 10 minutes

  let rawEmail: Buffer;
  let circuit: any;
  const ethAddress = "0xCbcAC0388501E5317304D7Da1Ee3a082Df67336d";

  beforeAll(async () => {
    rawEmail = fs.readFileSync(
      path.join(__dirname, "./emls/github-test.eml"),
      "utf8"
    );

    circuit = await wasm_tester(path.join(__dirname, "../src/company.circom"), {
      // NOTE: We are running tests against pre-compiled circuit in the below path
      // You need to manually compile when changes are made to circuit if `recompile` is set to `false`.
      recompile: false,
      output: path.join(__dirname, "../build"),
      include: [path.join(__dirname, "../node_modules"), path.join(__dirname, "../../../node_modules")],
    });
  });

  it("should verify company email", async function () {
    const companyVerifierInputs = await generateCompanyEmailCircuitInputs(rawEmail, ethAddress);
    // log("toemailindex: " + companyVerifierInputs.toEmailIndex);
    const witness = await circuit.calculateWitness(companyVerifierInputs);
    // log(witness);
    await circuit.checkConstraints(witness);

    // Calculate DKIM pubkey hash to verify its same as the one from circuit output
    // We input pubkey as 121 * 17 chunk, but the circuit convert it to 242 * 9 chunk for hashing
    // https://zkrepl.dev/?gist=43ce7dce2466c63812f6efec5b13aa73 - This can be used to get pubkey hash from 121 * 17 chunk
    const dkimResult = await verifyDKIMSignature(rawEmail, "github.com");
    const poseidon = await buildPoseidon();
    const pubkeyChunked = bigIntToChunkedBytes(dkimResult.publicKey, 242, 9);
    console.log(pubkeyChunked);
    const hash = poseidon(pubkeyChunked);
    console.log(poseidon.F.toObject(hash));
    console.log(hash);
    log(witness);
    // Assert pubkey hash
    expect(witness[1]).toEqual(poseidon.F.toObject(hash));

    // Verify the to domain is correctly extracted and packed from email header
    const toDomainInEmailBytes = new TextEncoder().encode("gmail.com").reverse(); // Circuit pack in reverse order
    expect(witness[2]).toEqual(bytesToBigInt(toDomainInEmailBytes));
    //
    // // Verify the to address is correctly extracted and packed from email header
    // const toAddressInEmailBytes = new TextEncoder().encode("zkemailverify@gmail.com").reverse(); // Circuit pack in reverse order
    // expect(witness[2]).toEqual(bytesToBigInt(toAddressInEmailBytes));
    //
    // // Verify the to email is correctly extracted
    // log(typeof(witness[2]));
    // log(witness[2]);
    // let chunkedBytes = bigIntToChunkedBytes(witness[2], 242, 9);
    // log(chunkedBytes);
    // let bytes = bigIntToBytes(witness[2]);
    // log(bytes);
    // let str = bytesToString(bytes.reverse());
    // log(str);
    //
    // log(typeof(witness[2+9]));
    // log(witness[2+9]);
    // bytes = bigIntToBytes(witness[2+9]);
    // log(bytes);
    // str = bytesToString(bytes.reverse());
    // log(str);

    // Verify the username is correctly extracted and packed form email body
    // const usernameInEmailBytes = new TextEncoder().encode("zktestemail").reverse(); // Circuit pack in reverse order
    // expect(witness[2]).toEqual(bytesToBigInt(usernameInEmailBytes));

    // Check address public input
    // log(BigInt(ethAddress));
    expect(witness[3]).toEqual(BigInt(ethAddress));
  });
  //
  // it("should fail if the twitterUsernameIndex is invalid", async function () {
  //   const twitterVerifierInputs = await generateTwitterVerifierCircuitInputs(rawEmail, ethAddress);
  //   twitterVerifierInputs.twitterUsernameIndex = (Number((await twitterVerifierInputs).twitterUsernameIndex) + 1).toString();
  //
  //   expect.assertions(1);
  //   try {
  //     const witness = await circuit.calculateWitness(twitterVerifierInputs);
  //     await circuit.checkConstraints(witness);
  //   } catch (error) {
  //     expect((error as Error).message).toMatch("Assert Failed");
  //   }
  // })
});
