/**
 * Crypto Payment Utilities for Sepolia ETH Integration
 */

import { supabase } from "@/integrations/supabase/client";

// Type for MetaMask ethereum provider
interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isMetaMask?: boolean;
}

// Extend Window interface
declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

// Company wallet address (for receiving payments and sending payouts)
export const COMPANY_WALLET_ADDRESS = "0xd1b6d088b8f3e291ced23419302f15b4f1f88530";

/**
 * Validates Ethereum wallet address format
 */
export const validateWalletAddress = (address: string): boolean => {
  if (!address) return false;
  
  // Check if it starts with 0x and is 42 characters long
  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
  return ethAddressRegex.test(address);
};

/**
 * Fetches the current Rs to ETH exchange rate from system config
 */
export const getExchangeRate = async (): Promise<number> => {
  const { data, error } = await supabase
    .from("system_config")
    .select("config_value")
    .eq("config_key", "rs_to_eth_rate")
    .single();

  if (error || !data) {
    console.error("Error fetching exchange rate:", error);
    return 250000; // Default fallback
  }

  return parseFloat(data.config_value);
};

/**
 * Converts Rs to ETH using the current exchange rate
 */
export const convertRsToEth = (amountRs: number, exchangeRate: number): number => {
  if (amountRs <= 0 || exchangeRate <= 0) return 0;
  return amountRs / exchangeRate;
};

// Alias for convenience
export const rsToEth = convertRsToEth;

/**
 * Converts ETH to Rs using the current exchange rate
 */
export const convertEthToRs = (amountEth: number, exchangeRate: number): number => {
  if (amountEth <= 0 || exchangeRate <= 0) return 0;
  return amountEth * exchangeRate;
};

/**
 * Formats ETH amount for display (8 decimal places)
 */
export const formatEthAmount = (amount: number): string => {
  return amount.toFixed(8);
};

/**
 * Formats Rs amount for display (2 decimal places)
 */
export const formatRsAmount = (amount: number): string => {
  return amount.toFixed(2);
};

/**
 * Formats dual currency display
 */
export const formatDualCurrency = (amountRs: number, amountEth: number): string => {
  return `Rs ${formatRsAmount(amountRs)} / ${formatEthAmount(amountEth)} ETH`;
};

/**
 * Checks if MetaMask is installed
 */
export const isMetaMaskInstalled = (): boolean => {
  if (typeof window === "undefined") return false;
  return typeof window.ethereum !== "undefined";
};

/**
 * Connects to MetaMask and returns the user's wallet address
 */
export const connectMetaMask = async (): Promise<string | null> => {
  if (!isMetaMaskInstalled()) {
    throw new Error("MetaMask is not installed. Please install MetaMask to continue.");
  }

  try {
    const ethereum = window.ethereum;
    if (!ethereum) throw new Error("Ethereum provider not found");
    
    const accounts = await ethereum.request({
      method: "eth_requestAccounts",
    }) as string[];

    if (accounts && accounts.length > 0) {
      return accounts[0];
    }

    return null;
  } catch (error) {
    console.error("Error connecting to MetaMask:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to connect to MetaMask";
    throw new Error(errorMessage);
  }
};

/**
 * Switches MetaMask to Sepolia testnet
 */
export const switchToSepolia = async (): Promise<void> => {
  if (!isMetaMaskInstalled()) {
    throw new Error("MetaMask is not installed");
  }

  try {
    const ethereum = window.ethereum;
    if (!ethereum) throw new Error("Ethereum provider not found");
    
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0xaa36a7" }], // Sepolia chainId
    });
  } catch (error) {
    // If Sepolia is not added, add it
    const errorCode = error && typeof error === 'object' && 'code' in error ? (error as { code: number }).code : null;
    if (errorCode === 4902) {
      const ethereum = window.ethereum;
      if (!ethereum) throw new Error("Ethereum provider not found");
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0xaa36a7",
            chainName: "Sepolia Test Network",
            nativeCurrency: {
              name: "SepoliaETH",
              symbol: "ETH",
              decimals: 18,
            },
            rpcUrls: ["https://sepolia.infura.io/v3/"],
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
          },
        ],
      });
    } else {
      throw error;
    }
  }
};

/**
 * Simulates sending ETH payment (for payout to seller)
 */
export const simulatePayoutTransaction = async (
  toAddress: string,
  amountEth: number
): Promise<string> => {
  if (!isMetaMaskInstalled()) {
    throw new Error("MetaMask is not installed");
  }

  if (!validateWalletAddress(toAddress)) {
    throw new Error("Invalid recipient wallet address");
  }

  try {
    // Ensure we're on Sepolia
    await switchToSepolia();

    // Convert ETH to Wei (1 ETH = 10^18 Wei)
    const amountWei = Math.floor(amountEth * 1e18);
    const hexAmount = "0x" + amountWei.toString(16);

    // Simulate transaction
    const ethereum = window.ethereum;
    if (!ethereum) throw new Error("Ethereum provider not found");
    
    const transactionHash = await ethereum.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: COMPANY_WALLET_ADDRESS,
          to: toAddress,
          value: hexAmount,
          gas: "0x5208", // 21000 gas
        },
      ],
    }) as string;

    return transactionHash;
  } catch (error) {
    console.error("Error simulating payout transaction:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to simulate payout transaction";
    throw new Error(errorMessage);
  }
};

/**
 * Simulates receiving ETH payment (for purchase from buyer)
 */
export const simulatePurchaseTransaction = async (
  fromAddress: string,
  amountEth: number
): Promise<string> => {
  if (!isMetaMaskInstalled()) {
    throw new Error("MetaMask is not installed");
  }

  if (!validateWalletAddress(fromAddress)) {
    throw new Error("Invalid sender wallet address");
  }

  try {
    // Ensure we're on Sepolia
    await switchToSepolia();

    // Convert ETH to Wei
    const amountWei = Math.floor(amountEth * 1e18);
    const hexAmount = "0x" + amountWei.toString(16);

    // Simulate transaction from buyer to company
    const ethereum = window.ethereum;
    if (!ethereum) throw new Error("Ethereum provider not found");
    
    const transactionHash = await ethereum.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: fromAddress,
          to: COMPANY_WALLET_ADDRESS,
          value: hexAmount,
          gas: "0x5208",
        },
      ],
    }) as string;

    return transactionHash;
  } catch (error) {
    console.error("Error simulating purchase transaction:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to simulate purchase transaction";
    throw new Error(errorMessage);
  }
};

/**
 * Logs crypto transaction to database
 */
export const logCryptoTransaction = async (
  itemId: string,
  transactionType: "payout" | "purchase",
  fromAddress: string,
  toAddress: string,
  amountRs: number,
  amountEth: number,
  exchangeRate: number,
  transactionHash?: string
) => {
  const { error } = await supabase.from("crypto_transactions").insert({
    item_id: itemId,
    transaction_type: transactionType,
    from_address: fromAddress,
    to_address: toAddress,
    amount_rs: amountRs,
    amount_eth: amountEth,
    exchange_rate: exchangeRate,
    transaction_hash: transactionHash || `simulated_${Date.now()}`,
    status: transactionHash ? "confirmed" : "pending",
    confirmed_at: transactionHash ? new Date().toISOString() : null,
  });

  if (error) {
    console.error("Error logging crypto transaction:", error);
    throw error;
  }
};

// Type definitions for MetaMask
// Note: Using 'any' for ethereum object as MetaMask types are not included
// In production, consider installing @metamask/providers for proper typing
