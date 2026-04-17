import * as sb from "@switchboard-xyz/on-demand";
import { OracleQuote } from "@switchboard-xyz/on-demand";
import * as dotenv from "dotenv";

dotenv.config();
//const FEED_ID = "4cd1cad962425681af07b9254b7d804de3ca3446fbfd1371bb258d2c75059812";
const FEED_ID = "0xaf3a39b12f5c052d81eb8c62bb86f4691fce2c2e0c88b39f83801978b6f203c3";

async function main() {
    // Step 1: Load environment (auto-detects network)
    const { program, keypair, connection, crossbar, queue } =
        await sb.AnchorUtils.loadEnv();

    console.log("Queue:", queue.pubkey.toBase58());
    console.log("Network:", crossbar.getNetwork());

    // Step 2: Derive the canonical oracle account from feed ID
    const [quoteAccount] = OracleQuote.getCanonicalPubkey(
        queue.pubkey,
        [FEED_ID]
    );
    console.log("Quote Account:", quoteAccount.toBase58());

    // Step 3: Simulate the feed to see current value
    const simResult = await crossbar.simulateFeed(FEED_ID);
    console.log("Simulated feed result:", simResult);

    // Step 4: Create managed update instructions
    const updateInstructions = await queue.fetchManagedUpdateIxs(
        crossbar,
        [FEED_ID],
        {
            variableOverrides: {
                MASSIVE_API_KEY: process.env.MASSIVE_API_KEY!,
                EARNINGSAPI_KEY: process.env.EARNINGSAPI_KEY!,
            },
            instructionIdx: 0,  // Ed25519 instruction index
            payer: keypair.publicKey,
        }
    );

    // Step 5: Create your program's instruction
    const readOracleIx = await program.methods
        .readOracleData()
        .accounts({
            quoteAccount: quoteAccount,
            // Sysvars are added automatically by Anchor
        })
        .instruction();

    // Step 6: Build and send the transaction
    const tx = await sb.asV0Tx({
        connection,
        ixs: [...updateInstructions, readOracleIx],
        signers: [keypair],
        computeUnitPrice: 20_000,
        computeUnitLimitMultiple: 1.1,
    });

    // Step 7: Simulate and send
    const sim = await connection.simulateTransaction(tx);
    console.log(sim.value.logs?.join("\n"));

    if (!sim.value.err) {
        const sig = await connection.sendTransaction(tx);
        console.log("Transaction:", sig);
    }
}

main();
