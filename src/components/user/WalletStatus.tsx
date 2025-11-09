import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Wallet, Shield, AlertCircle } from "lucide-react";
import { validateWalletAddress, connectMetaMask, isMetaMaskInstalled } from "@/lib/crypto";

const WalletStatus = () => {
  const { user } = useAuth();
  const [walletAddress, setWalletAddress] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (user) {
      fetchWalletInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchWalletInfo = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("wallet_address, is_crypto_verified")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error fetching wallet info:", error);
        // If columns don't exist, set defaults
        setWalletAddress("");
        setIsVerified(false);
        return;
      }

      if (data) {
        setWalletAddress(data.wallet_address || "");
        setIsVerified(data.is_crypto_verified || false);
      }
    } catch (error) {
      console.error("Failed to fetch wallet info:", error);
      setWalletAddress("");
      setIsVerified(false);
    }
  };

  const handleConnectWallet = async () => {
    try {
      if (!isMetaMaskInstalled()) {
        toast.error("MetaMask is not installed. Please install MetaMask extension.");
        window.open("https://metamask.io/download/", "_blank");
        return;
      }

      const address = await connectMetaMask();
      if (address) {
        setWalletAddress(address);
        const isValid = validateWalletAddress(address);
        
        if (isValid) {
          toast.success("Wallet connected!");
        } else {
          toast.error("Invalid wallet address format");
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to connect wallet";
      toast.error(errorMessage);
    }
  };

  const handleUpdateWallet = async () => {
    if (!user) {
      toast.error("User not authenticated");
      return;
    }

    if (!walletAddress) {
      toast.error("Please enter a wallet address");
      return;
    }

    const isValid = validateWalletAddress(walletAddress);
    if (!isValid) {
      toast.error("Invalid wallet address format. Must be 42 characters starting with 0x");
      return;
    }

    setLoading(true);

    try {
      console.log("Updating wallet for user:", user.id);
      console.log("Wallet address:", walletAddress);

      // Try to update the profile directly
      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({
          wallet_address: walletAddress,
          is_crypto_verified: isValid,
        })
        .eq("id", user.id)
        .select();

      console.log("Update response:", { data, error: updateError });

      if (updateError) {
        console.error("Update error:", updateError);
        
        // Check if it's a column doesn't exist error
        if (updateError.message && (updateError.message.includes("column") || updateError.code === '42703')) {
          toast.error("Database migration not applied. Please apply the crypto payment migration first.");
          return;
        }
        
        // Check if profile doesn't exist
        if (updateError.code === 'PGRST116') {
          toast.error("Profile not found. Please sign out and sign in again.");
          return;
        }
        
        throw updateError;
      }

      setIsVerified(isValid);
      setIsEditing(false);
      toast.success("Wallet address updated and verified!");
      
      // Refresh wallet info
      await fetchWalletInfo();
    } catch (error) {
      console.error("Failed to update wallet:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update wallet. Check console for details.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Show loading or not authenticated state
  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Crypto Wallet Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Please sign in to manage your wallet
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="w-5 h-5" />
          Crypto Wallet Status
        </CardTitle>
        <CardDescription>
          Your Sepolia testnet wallet for crypto transactions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant={isVerified ? "default" : "destructive"}>
            {isVerified ? (
              <>
                <Shield className="w-3 h-3 mr-1" />
                Verified
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3 mr-1" />
                Not Verified
              </>
            )}
          </Badge>
        </div>

        {!isVerified && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <AlertCircle className="w-4 h-4 inline mr-1" />
              You need a verified wallet to participate in transactions
            </p>
          </div>
        )}

        {isEditing ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="0x..."
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                onClick={handleConnectWallet}
                className="shrink-0"
              >
                <Wallet className="w-4 h-4 mr-2" />
                Connect
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleUpdateWallet}
                disabled={loading || !walletAddress}
                className="flex-1"
              >
                {loading ? "Updating..." : "Update Wallet"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  fetchWalletInfo();
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-muted rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Wallet Address</p>
              <p className="font-mono text-sm break-all">
                {walletAddress || "No wallet connected"}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setIsEditing(true)}
              className="w-full"
            >
              {walletAddress ? "Update Wallet" : "Add Wallet"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WalletStatus;
