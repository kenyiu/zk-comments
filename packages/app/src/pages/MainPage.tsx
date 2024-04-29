import React, { useEffect, useState } from "react";
// @ts-ignore
import { useMount, useUpdateEffect } from "react-use";
import styled from "styled-components";
import _ from "lodash";
import { useAccount, useContractWrite, usePrepareContractWrite } from "wagmi";
// import {
//   rawEmailToBuffer,
// } from "@zk-email/helpers/dist/input-helpers";
import { verifyDKIMSignature, DKIMVerificationResult } from "@zk-email/helpers/dist/dkim";
import {
  downloadProofFiles,
  generateProof,
  verifyProof,
} from "./zkp";
import { abi } from "../abi.json";
import {
  generateTwitterVerifierCircuitInputs,
  ITwitterCircuitInputs,
  ICompanyEmailCircuitInputs,
  generateCompanyEmailCircuitInputs
} from "@proof-of-twitter/circuits/helpers";
import { LabeledTextArea } from "../components/LabeledTextArea";
import DragAndDropTextBox from "../components/DragAndDropTextBox";
import { SingleLineInput } from "../components/SingleLineInput";
import { Button } from "../components/Button";
import { Col, Row } from "../components/Layout";
import { NumberedStep } from "../components/NumberedStep";
import { TopBanner } from "../components/TopBanner";
import { ProgressBar } from "../components/ProgressBar";

const CIRCUIT_NAME = "company";

export const MainPage: React.FC<{}> = (props) => {
  const { address } = useAccount();

  const [ethereumAddress, setEthereumAddress] = useState<string>(address ?? "");
  const [emailFull, setEmailFull] = useState<string>(
    localStorage.emailFull || ""
  );

  const [department, setDepartment] = useState<string>(localStorage.department ?? "");
  const [role, setRole] = useState<string>(localStorage.role ?? "");
  const [comments, setComments] = useState<string>(localStorage.comments ?? "");

  const [proof, setProof] = useState<string>(localStorage.proof || "");
  const [publicSignals, setPublicSignals] = useState<string>(
    localStorage.publicSignals || ""
  );
  const [displayMessage, setDisplayMessage] = useState<string>("Prove");

  const [verificationMessage, setVerificationMessage] = useState("");
  const [verificationPassed, setVerificationPassed] = useState(false);
  const [lastAction, setLastAction] = useState<"" | "sign" | "verify" | "send">(
    ""
  );
  const [showBrowserWarning, setShowBrowserWarning] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [status, setStatus] = useState<
    | "not-started"
    | "generating-input"
    | "downloading-proof-files"
    | "generating-proof"
    | "error-bad-input"
    | "error-failed-to-download"
    | "error-failed-to-prove"
    | "done"
    | "sending-on-chain"
    | "sent"
  >("not-started");

  const [stopwatch, setStopwatch] = useState<Record<string, number>>({
    startedDownloading: 0,
    finishedDownloading: 0,
    startedProving: 0,
    finishedProving: 0,
  });

  useEffect(() => {
    const userAgent = navigator.userAgent;
    const isChrome = userAgent.indexOf("Chrome") > -1;
    if (!isChrome) {
      setShowBrowserWarning(true);
    }
  }, []);

  useEffect(() => {
    if (address) {
      setEthereumAddress(address);
    } else {
      setEthereumAddress("");
    }
  }, [address]);

  const recordTimeForActivity = (activity: string) => {
    setStopwatch((prev) => ({
      ...prev,
      [activity]: Date.now(),
    }));
  };

  const reformatProofForChain = (proofStr: string) => {
    if (!proofStr) return [];

    const proof = JSON.parse(proofStr);
    // console.log('---proof---');
    // console.log(proof);
    // console.log('---end of proof---');
    const reformattedProof = [
      proof.pi_a.slice(0, 2),
      proof.pi_b
        .slice(0, 2)
        .map((s: string[]) => s.reverse())
        .flat(),
      proof.pi_c.slice(0, 2),
    ].flat();
    console.log(reformattedProof);
    return reformattedProof;
  };

  // console.log('--- public signals ---');
  // console.log(JSON.parse(publicSignals));
  // console.log('--- end of public signals ---');
  const { config } = usePrepareContractWrite({
    // @ts-ignore
    address: import.meta.env.VITE_CONTRACT_ADDRESS,
    abi: abi,
    functionName: "mint",
    args: [
      reformatProofForChain(proof),
      publicSignals ? JSON.parse(publicSignals) : [],
    ],
    enabled: !!(proof && publicSignals),
    onError: (error: { message: any }) => {
      console.error(error.message);
      // TODO: handle errors
    },
  });

  const { data, isLoading, isSuccess, write } = useContractWrite(config);

  useMount(() => {
    function handleKeyDown() {
      setLastAction("");
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // local storage stuff
  useUpdateEffect(() => {
    if (emailFull) {
      if (localStorage.emailFull !== emailFull) {
        console.info("Wrote email to localStorage");
        localStorage.emailFull = emailFull;
      }
    }
    if (proof) {
      if (localStorage.proof !== proof) {
        console.info("Wrote proof to localStorage");
        localStorage.proof = proof;
      }
    }
    if (publicSignals) {
      if (localStorage.publicSignals !== publicSignals) {
        console.info("Wrote publicSignals to localStorage");
        localStorage.publicSignals = publicSignals;
      }
    }
  }, [emailFull, proof, publicSignals]);

  // On file drop function to extract the text from the file
  const onFileDrop = async (file: File) => {
    if (file.name.endsWith(".eml")) {
      const content = await file.text();
      setEmailFull(content);
    } else {
      alert("Only .eml files are allowed.");
    }
  };

  return (
    <Container>
      {showBrowserWarning && (
        <TopBanner
          message={"ZK Comments only works on Chrome or Chromium-based browsers."}
        />
      )}
      <div className="title">
        <Header>ZK Comments Demo</Header>
      </div>

      <Col
        style={{
          gap: "8px",
          maxWidth: "720px",
          margin: "0 auto",
          marginBottom: "2rem",
        }}
      >
        <span style={{ color: "rgba(255, 255, 255, 0.7)" }}>
          Welcome to a demo page for ZK-Comments.
          <br /><br />
          <strong>Problem trying to solve:</strong> People want to know the comments from current employee from the "real" employees;
          however, there is no existing web2 solution allowing employees doing so without risking being found.
          <br /><br />
          <strong>Solution:</strong> Zero knowledge proof generated on user's browser without sending any sensitive data to the server
          utilizing the DKIM feature of the email.
          Visit the presentation <a href="https://example.com/zk-comments/">here</a>.
          <br />
          <br />
          If you wish to comment, you must:
        </span>
        <NumberedStep step={1}>
          Receive an email from Github, etc
        </NumberedStep>
        <NumberedStep step={2}>
          In your inbox, find that email and get the "Original Email".
        </NumberedStep>
        <NumberedStep step={3}>
          Copy paste or drop that into the box below.
        </NumberedStep>
        <NumberedStep step={4}>
          Type your `Role`, `Department`, `Comments` and `ETH Address` in the box below.
          <br />
          Please note that the `Role`, `Department` and `Comments` will be public on-chain and associated with your ETH address.
        </NumberedStep>
        <NumberedStep step={5}>
          Click <b>"Prove"</b>. Note it is completely client side and{" "}
          <a href="https://github.com/zkemail/proof-of-twitter/" target="_blank" rel="noreferrer">open source</a>,
          and no server ever sees your private information.
        </NumberedStep>
        <NumberedStep step={6}>
          Click <b>"Verify"</b> and then <b>"Attest On-Chain"</b>,
          and sign the transaction in your wallet to prove you are the account owner of the email address.
        </NumberedStep>
      </Col>
      <Main>
        <Column>
          <SubHeader>Input</SubHeader>
          <DragAndDropTextBox onFileDrop={onFileDrop} />
          <h3
            style={{
              textAlign: "center",
              marginTop: "0rem",
              marginBottom: "0rem",
            }}
          >
            OR
          </h3>
          <LabeledTextArea
            label="Full Email with Headers"
            value={emailFull}
            onChange={(e) => {
              setEmailFull(e.currentTarget.value);
            }}
          />
          <SingleLineInput
            label="Eth Address"
            value={ethereumAddress}
            onChange={(e) => {
              setEthereumAddress(e.currentTarget.value);
            }}
          />
          <SingleLineInput
            label="Department"
            value={department}
            onChange={(e) => {
              setDepartment(e.currentTarget.value);
            }}
          />
          <SingleLineInput
            label="Role"
            value={role}
            onChange={(e) => {
              setRole(e.currentTarget.value);
            }}
          />
          <LabeledTextArea
            label="Comments"
            value={comments}
            onChange={(e) => {
              setComments(e.currentTarget.value);
            }}
          />
          <Button
            data-testid="prove-button"
            disabled={
              displayMessage !== "Prove" ||
              emailFull.length === 0 ||
              ethereumAddress.length === 0
            }
            onClick={async () => {
              // Sometimes, newline encodings re-encode \r\n as just \n, so re-insert the \r so that the email hashes correctly
              function insert13Before10(a: Uint8Array): Uint8Array {
                let ret = new Uint8Array(a.length + 1000);
                let j = 0;
                for (let i = 0; i < a.length; i++) {
                  // Ensure each \n is preceded by a \r
                  if (a[i] === 10 && i > 0 && a[i - 1] !== 13) {
                    ret[j] = 13;
                    j++;
                  }
                  ret[j] = a[i];
                  j++;
                }

                return ret.slice(0, j);
              }

              // Return the Uint8Array of the email after cleaning (/n -> /r/n)
              function rawEmailToBuffer(email: string) {
                const byteArray = new TextEncoder().encode(email);
                const cleaned = insert13Before10(byteArray);
                return Buffer.from(cleaned.buffer);
              }
              const emailBuffer = rawEmailToBuffer(emailFull); // Cleaned email as buffer

              // let input: ITwitterCircuitInputs;
              let input: ICompanyEmailCircuitInputs;
              try {
                setDisplayMessage("Generating proof...");
                setStatus("generating-input");

                // input = await generateTwitterVerifierCircuitInputs(emailBuffer, ethereumAddress);
                input = await generateCompanyEmailCircuitInputs(emailBuffer, ethereumAddress);

                console.log("Generated input:", JSON.stringify(input));
              } catch (e) {
                console.log("Error generating input", e);
                setDisplayMessage("Prove");
                setStatus("error-bad-input");
                return;
              }

              console.time("zk-dl");
              recordTimeForActivity("startedDownloading");
              setDisplayMessage(
                "Downloading compressed proving files... (this may take a few minutes)"
              );
              setStatus("downloading-proof-files");
              try {
                await downloadProofFiles(
                  // @ts-ignore
                  import.meta.env.VITE_CIRCUIT_ARTIFACTS_URL,
                  CIRCUIT_NAME,
                  () => {
                    setDownloadProgress((p) => p + 1);
                  }
                );
              } catch (e) {
                console.log(e);
                setDisplayMessage("Error downloading proof files");
                setStatus("error-failed-to-download");
                return;
              }

              console.timeEnd("zk-dl");
              recordTimeForActivity("finishedDownloading");
              console.log('here i am');

              console.time("zk-gen");
              recordTimeForActivity("startedProving");
              setDisplayMessage(
                "Starting proof generation... (this will take 6-10 minutes and ~5GB RAM)"
              );
              setStatus("generating-proof");
              console.log("Starting proof generation");
              // alert("Generating proof, will fail due to input");
              const { proof, publicSignals } = await generateProof(
                input,
                // @ts-ignore
                import.meta.env.VITE_CIRCUIT_ARTIFACTS_URL,
                CIRCUIT_NAME
              );
              //const proof = JSON.parse('{"pi_a": ["19201501460375869359786976350200749752225831881815567077814357716475109214225", "11505143118120261821370828666956392917988845645366364291926723724764197308214", "1"], "pi_b": [["17114997753466635923095897108905313066875545082621248342234075865495571603410", "7192405994185710518536526038522451195158265656066550519902313122056350381280"], ["13696222194662648890012762427265603087145644894565446235939768763001479304886", "2757027655603295785352548686090997179551660115030413843642436323047552012712"], ["1", "0"]], "pi_c": ["6168386124525054064559735110298802977718009746891233616490776755671099515304", "11077116868070103472532367637450067545191977757024528865783681032080180232316", "1"], "protocol": "groth16", "curve": "bn128"}');
              //const publicSignals = JSON.parse('["0", "0", "0", "0", "0", "0", "0", "0", "32767059066617856", "30803244233155956", "0", "0", "0", "0", "27917065853693287", "28015", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "113659471951225", "0", "0", "1634582323953821262989958727173988295", "1938094444722442142315201757874145583", "375300260153333632727697921604599470", "1369658125109277828425429339149824874", "1589384595547333389911397650751436647", "1428144289938431173655248321840778928", "1919508490085653366961918211405731923", "2358009612379481320362782200045159837", "518833500408858308962881361452944175", "1163210548821508924802510293967109414", "1361351910698751746280135795885107181", "1445969488612593115566934629427756345", "2457340995040159831545380614838948388", "2612807374136932899648418365680887439", "16021263889082005631675788949457422", "299744519975649772895460843780023483", "3933359104846508935112096715593287", "556307310756571904145052207427031380052712977221"]');
              console.log("Finished proof generation");
              console.timeEnd("zk-gen");
              recordTimeForActivity("finishedProving");

              console.log("publicSignals", publicSignals);

              // alert("Done generating proof");
              setProof(JSON.stringify(proof));
              // let kek = publicSignals.map((x: string) => BigInt(x));
              // let soln = packedNBytesToString(kek.slice(0, 12));
              // let soln2 = packedNBytesToString(kek.slice(12, 147));
              // let soln3 = packedNBytesToString(kek.slice(147, 150));
              // setPublicSignals(`From: ${soln}\nTo: ${soln2}\nUsername: ${soln3}`);
              setPublicSignals(JSON.stringify(publicSignals));

              if (!input) {
                setStatus("error-failed-to-prove");
                return;
              }
              setLastAction("sign");
              setDisplayMessage("Finished computing ZK proof");
              setStatus("done");
              try {
                (window as any).cJson = JSON.stringify(input);
                console.log(
                  "wrote circuit input to window.cJson. Run copy(cJson)"
                );
              } catch (e) {
                console.error(e);
              }
            }}
          >
            {displayMessage}
          </Button>
          {displayMessage ===
            "Downloading compressed proving files... (this may take a few minutes)" && (
            <ProgressBar
              width={downloadProgress * 10}
              label={`${downloadProgress} / 10 items`}
            />
          )}
          <ProcessStatus status={status}>
            {status !== "not-started" ? (
              <div>
                Status:
                <span data-testid={"status-" + status}>{status}</span>
              </div>
            ) : (
              <div data-testid={"status-" + status}></div>
            )}
            <TimerDisplay timers={stopwatch} />
          </ProcessStatus>
        </Column>
        <Column>
          <SubHeader>Output</SubHeader>
          <LabeledTextArea
            label="Proof Output"
            value={proof}
            onChange={(e) => {
              setProof(e.currentTarget.value);
            }}
            warning={verificationMessage}
            warningColor={verificationPassed ? "green" : "red"}
          />
          <LabeledTextArea
            label="..."
            value={publicSignals}
            secret
            onChange={(e) => {
              setPublicSignals(e.currentTarget.value);
            }}
            // warning={
            // }
          />
          <Button
            disabled={emailFull.trim().length === 0 || proof.length === 0}
            onClick={async () => {
              try {
                setLastAction("verify");
                let ok = true;
                const res: boolean = await verifyProof(
                  JSON.parse(proof),
                  JSON.parse(publicSignals),
                  // @ts-ignore
                  import.meta.env.VITE_CIRCUIT_ARTIFACTS_URL,
                  CIRCUIT_NAME
                );
                console.log(res);
                if (!res) throw Error("Verification failed!");
                setVerificationMessage("Passed!");
                setVerificationPassed(ok);
              } catch (er: any) {
                setVerificationMessage("Failed to verify " + er.toString());
                setVerificationPassed(false);
              }
            }}
          >
            Verify
          </Button>
          <Button
            disabled={!verificationPassed || isLoading || isSuccess || !write}
            onClick={async () => {
              setStatus("sending-on-chain");
              write?.();
            }}
          >
            {isSuccess
              ? "Successfully sent to chain!"
              : isLoading
              ? "Confirm in wallet"
              : !write
              ? "Connect Wallet first, scroll to top!"
              : verificationPassed
              ? "Mint Twitter badge on-chain"
              : "Verify first, before minting on-chain!"}
          </Button>
          {isSuccess && (
            <div>
              Transaction:{" "}
              <a href={"https://sepolia.scrollscan.com/tx/" + data?.hash}>
                {data?.hash}
              </a>
            </div>
          )}
        </Column>
      </Main>
    </Container>
  );
};

const ProcessStatus = styled.div<{ status: string }>`
  font-size: 8px;
  padding: 8px;
  border-radius: 8px;
`;

const TimerDisplayContainer = styled.div`
  display: flex;
  flex-direction: column;
  font-size: 8px;
`;

const TimerDisplay = ({ timers }: { timers: Record<string, number> }) => {
  return (
    <TimerDisplayContainer>
      {timers["startedDownloading"] && timers["finishedDownloading"] ? (
        <div>
          Zkey Download time:&nbsp;
          <span data-testid="download-time">
            {timers["finishedDownloading"] - timers["startedDownloading"]}
          </span>
          ms
        </div>
      ) : (
        <div></div>
      )}
      {timers["startedProving"] && timers["finishedProving"] ? (
        <div>
          Proof generation time:&nbsp;
          <span data-testid="proof-time">
            {timers["finishedProving"] - timers["startedProving"]}
          </span>
          ms
        </div>
      ) : (
        <div></div>
      )}
    </TimerDisplayContainer>
  );
};

const Header = styled.span`
  font-weight: 600;
  margin-bottom: 1em;
  color: #fff;
  font-size: 2.25rem;
  line-height: 2.5rem;
  letter-spacing: -0.02em;
`;

const SubHeader = styled(Header)`
  font-size: 1.7em;
  margin-bottom: 16px;
  color: rgba(255, 255, 255, 0.9);
`;

const Main = styled(Row)`
  width: 100%;
  gap: 1rem;
`;

const Column = styled(Col)`
  width: 100%;
  gap: 1rem;
  align-self: flex-start;
  background: rgba(255, 255, 255, 0.1);
  padding: 1rem;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  margin: 0 auto;
  & .title {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  & .main {
    & .signaturePane {
      flex: 1;
      display: flex;
      flex-direction: column;
      & > :first-child {
        height: calc(30vh + 24px);
      }
    }
  }

  & .bottom {
    display: flex;
    flex-direction: column;
    align-items: center;
    & p {
      text-align: center;
    }
    & .labeledTextAreaContainer {
      align-self: center;
      max-width: 50vw;
      width: 500px;
    }
  }

  a {
    color: rgba(30, 144, 255, 0.9); /* Bright blue color */
    text-decoration: none; /* Optional: Removes the underline */
  }

  a:hover {
    color: rgba(65, 105, 225, 0.9); /* Darker blue color on hover */
  }

  a:visited {
    color: rgba(153, 50, 204, 0.9); /* Purple color for visited links */
  }

  a:active {
    color: rgba(
      255,
      69,
      0,
      0.9
    ); /* Orange-red color for active (clicked) links */
  }
`;
