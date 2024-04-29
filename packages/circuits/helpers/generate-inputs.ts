import { bytesToBigInt, fromHex } from "@zk-email/helpers/dist/binary-format";
import { generateEmailVerifierInputs } from "@zk-email/helpers/dist/input-generators";
import { log, error } from "console";

export const STRING_PRESELECTOR = "email was meant for @";
export const TO_STRING_PRESELECTOR: string = "to:";

// TODO: comment out the following circuitinput
export type ITwitterCircuitInputs = {
  twitterUsernameIndex: string;
  address: string;
  emailHeader: string[];
  emailHeaderLength: string;
  pubkey: string[];
  signature: string[];
  emailBody?: string[] | undefined;
  emailBodyLength?: string | undefined;
  precomputedSHA?: string[] | undefined;
  bodyHashIndex?: string | undefined;
};

export type ICompanyEmailCircuitInputs = {
  toDomainIndex: string;
  address: string;
  emailHeader: string[];
  emailHeaderLength: string;
  pubkey: string[];
  signature: string[];
  emailBody?: string[] | undefined;
  emailBodyLength?: string | undefined;
  precomputedSHA?: string[] | undefined;
  bodyHashIndex?: string | undefined;
}

export async function generateCompanyEmailCircuitInputs(
  email: string | Buffer,
  ethereumAddress: string,
): Promise<ICompanyEmailCircuitInputs> {
  const emailVerifierInputs = await generateEmailVerifierInputs(email);

  // const toEmailIndex = 1;
  const selectorBuffer = Buffer.from(TO_STRING_PRESELECTOR.split('').map((c) => c.charCodeAt(0)))
  // log(new TextDecoder().decode(selectorBuffer));
  const header = emailVerifierInputs.emailHeader!.map((c) => Number(c)); // Char array to Uint8Array
  // log(new TextDecoder().decode(Buffer.from(header)));
  // log(Buffer.from(header));
  let toEmailOfficialIndex = Buffer.from(header).indexOf(selectorBuffer) + selectorBuffer.length;
  const remainingHeader = Buffer.from(header).slice(toEmailOfficialIndex);
  const addIndex = remainingHeader.indexOf(Buffer.from('<'));
  toEmailOfficialIndex += addIndex + 1;

  let toDomainIndex = Buffer.from(header).indexOf(selectorBuffer) + selectorBuffer.length;
  const remainingHeader2 = Buffer.from(header).slice(toDomainIndex);
  const addIndex2 = remainingHeader2.indexOf(Buffer.from('@'));
  toDomainIndex += addIndex2 + 1;

  // log(toEmailIndex);
  // log('???');
  // select the header buffer from toEmailIndex to the end of the header
  // const headerRemaining = header.slice(toEmailIndex);
  // log(new TextDecoder().decode(Buffer.from(headerRemaining)));
  const address = bytesToBigInt(fromHex(ethereumAddress)).toString();

  return {
    ...emailVerifierInputs,
    toDomainIndex: toDomainIndex.toString(),
    address,
  };
}
export async function generateTwitterVerifierCircuitInputs(
  email: string | Buffer,
  ethereumAddress: string
): Promise<ITwitterCircuitInputs> {
  const emailVerifierInputs = await generateEmailVerifierInputs(email, {
    shaPrecomputeSelector: STRING_PRESELECTOR,
  });

  const bodyRemaining = emailVerifierInputs.emailBody!.map((c) => Number(c)); // Char array to Uint8Array
  const selectorBuffer = Buffer.from(STRING_PRESELECTOR);
  const usernameIndex =
    Buffer.from(bodyRemaining).indexOf(selectorBuffer) + selectorBuffer.length;

  const address = bytesToBigInt(fromHex(ethereumAddress)).toString();

  return {
    ...emailVerifierInputs,
    twitterUsernameIndex: usernameIndex.toString(),
    address,
  };
}
