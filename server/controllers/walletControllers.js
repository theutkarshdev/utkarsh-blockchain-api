import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { v4 as uuidv4 } from "uuid";
import { ENV, TokenListProvider } from "@solana/spl-token-registry";

async function getTokenMetadata(mintAddress) {
  try {
    // Get the token list provider
    const provider = await new TokenListProvider().resolve();
    const tokenList = provider.filterByChainId(ENV.MainnetBeta).getList();

    // Create a map of tokens for quick lookup
    const tokenMap = tokenList.reduce((map, item) => {
      map.set(item.address, item);
      return map;
    }, new Map());

    // Retrieve token metadata
    const token = tokenMap.get(mintAddress.toBase58());
    return token;
  } catch (error) {
    console.error("Error fetching token metadata:", error);
  }
}

export const walletActivity = async (req, res) => {
  const { wallet_address, network } = req.query;

  if (!wallet_address || !network) {
    return res.status(400).json({ error: "wallet_address and network are required" });
  }

  if (network !== "Solana") {
    return res.status(400).json({ error: "Only Solana network is supported" });
  }

  try {
    const connection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");
    const publicKey = new PublicKey(wallet_address);
    let transactionList = await connection.getSignaturesForAddress(publicKey, { limit: 2 });
    if (transactionList.length === 0) {
      return res.json({
        status: "error",
        message: "No transactions found for this address.",
        data: [],
      });
    }

    // Fetch the transaction details
    const transactions = await Promise.all(
      transactionList.map(async (transaction) => {
        const txDetails = await connection.getParsedTransaction(transaction.signature);

        if (!txDetails) {
          console.log(`Transaction not found for signature: ${transaction.signature}`);
          return null;
        }

        const fee = txDetails.meta.fee || 0; // Transaction fee
        const computeUnits = txDetails.meta.computeUnitsConsumed || 0; // Compute units
        const timestamp = txDetails.blockTime
          ? new Date(txDetails.blockTime * 1000).toISOString()
          : new Date().toISOString(); // Timestamp
        const isSendToken = txDetails.transaction.message.instructions.some(
          (instruction) => instruction.parsed && instruction.parsed.type === "transfer",
        );
        const type = isSendToken ? "send_token" : "receive_token";
        const amount = (txDetails.meta.preBalances[0] - txDetails.meta.postBalances[0]).toString();
        const tokenMetadata = await getTokenMetadata(
          new PublicKey(txDetails.meta?.postTokenBalances[0]?.mint || "So11111111111111111111111111111111111111112"),
        );

        return {
          uuid: uuidv4(),
          network: network,
          fee,
          compute_units_consumed: computeUnits,
          timestamp,
          type,
          wallet_address,
          transaction_hash: transaction.signature,
          metadata: { amount },
          token: {
            uuid: uuidv4(),
            network: network,
            contract_address: txDetails.meta?.postTokenBalances[0]?.mint,
            name: tokenMetadata?.name || "",
            symbol: tokenMetadata?.symbol || "",
            decimals: tokenMetadata?.decimals || "",
            display_decimals: 2,
            logo_url: tokenMetadata?.logoURI || "",
          },
          explorer_url: `https://solscan.io/tx/${transaction.signature}?cluster=mainnet-beta`,
        };
      }),
    );

    // Remove null transactions
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
