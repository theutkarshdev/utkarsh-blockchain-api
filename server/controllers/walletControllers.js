import { Connection, PublicKey } from "@solana/web3.js";
import { v4 as uuidv4 } from "uuid";
import { ENV, TokenListProvider } from "@solana/spl-token-registry";
import nodeFetch from "node-fetch";
import fetchRetry from "fetch-retry";
import { Agent as HttpsAgent } from "https";

// Initialize fetch with retries
const _fetch = fetchRetry(nodeFetch, {
  retries: 5, // Number of retry attempts
  retryDelay: (attempt, error, response) => {
    if (response && response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      if (retryAfter) {
        if (!isNaN(retryAfter)) {
          return parseInt(retryAfter, 10) * 1000;
        } else {
          const retryDate = new Date(retryAfter).getTime();
          const now = new Date().getTime();
          return Math.max(0, retryDate - now);
        }
      }
    }
    return Math.pow(2, attempt) * 1000; // Exponential backoff
  },
  retryOn: [429, 503], // Retry on specific status codes
});

// Solana connection configuration
const connection = new Connection("https://api.mainnet-beta.solana.com", {
  httpAgent: new HttpsAgent({ keepAlive: true }),
  commitment: "confirmed",
  fetch: _fetch,
});

async function getTokenMetadata(mintAddress) {
  try {
    const provider = await new TokenListProvider().resolve();
    const tokenList = provider.filterByChainId(ENV.MainnetBeta).getList();
    const tokenMap = tokenList.reduce((map, item) => {
      map.set(item.address, item);
      return map;
    }, new Map());
    return tokenMap.get(mintAddress.toBase58()) || {};
  } catch (error) {
    console.error("Error fetching token metadata:", error);
    return {};
  }
}

export const walletActivity = async (req, res) => {
  const { wallet_address: walletAddress, network, limit = 5 } = req.query;

  if (!walletAddress || !network) {
    return res.status(400).json({ error: "wallet_address and network are required" });
  }

  if (network !== "Solana") {
    return res.status(400).json({ error: "Only Solana network is supported" });
  }

  try {
    const publicKey = new PublicKey(walletAddress);
    const transactionList = await connection.getSignaturesForAddress(publicKey, { limit: parseInt(limit, 10) });

    if (transactionList.length === 0) {
      return res.json({
        status: "error",
        message: "No transactions found for this address.",
        data: [],
      });
    }

    const transactions = await Promise.all(
      transactionList.map(async (transaction, idx) => {
        const txDetails = await connection.getParsedTransaction(transaction.signature);

        if (!txDetails) {
          console.log(`Transaction not found for signature: ${transaction.signature}`);
          return null;
        }

        const {
          meta,
          transaction: {
            message: { instructions },
          },
          blockTime,
        } = txDetails;
        const fee = meta.fee || 0;
        const computeUnits = meta.computeUnitsConsumed || 0;
        const timestamp = blockTime ? new Date(blockTime * 1000).toISOString() : new Date().toISOString();

        const isTransfer = instructions.some(
          (instruction) => instruction.parsed && instruction.parsed.type === "transfer",
        );

        const type = isTransfer
          ? instructions.some((instruction) => instruction.parsed && instruction.parsed.info.source === walletAddress)
            ? "send_token"
            : "receive_token"
          : "other";

        const amount = (meta.preBalances[0] - meta.postBalances[0]).toString();
        const mintAddress = txDetails.meta?.postTokenBalances[0]?.mint || "So11111111111111111111111111111111111111112";
        const tokenMetadata = await getTokenMetadata(new PublicKey(mintAddress));

        return {
          uuid: uuidv4(),
          network,
          fee,
          compute_units_consumed: computeUnits,
          timestamp,
          type,
          wallet_address: walletAddress,
          transaction_hash: transaction.signature,
          metadata: { amount },
          token: {
            uuid: uuidv4(),
            network,
            contract_address: mintAddress,
            name: tokenMetadata.name || "",
            symbol: tokenMetadata.symbol || "",
            decimals: tokenMetadata.decimals || "",
            display_decimals: 2,
            logo_url: tokenMetadata.logoURI || "",
          },
          explorer_url: `https://solscan.io/tx/${transaction.signature}?cluster=mainnet-beta`,
        };
      }),
    );

    const validTransactions = transactions.filter((tx) => tx !== null);

    res.json({
      status: "success",
      message: "Activity retrieved successfully",
      data: validTransactions,
    });
  } catch (error) {
    console.error("Failed to fetch transactions", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
};
