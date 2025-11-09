import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Wallet, AlertCircle } from "lucide-react";
import { getExchangeRate, convertRsToEth, formatDualCurrency, simulatePayoutTransaction, logCryptoTransaction, COMPANY_WALLET_ADDRESS } from "@/lib/crypto";

interface Item {
  id: string;
  category: string;
  condition: string;
  seller_quoted_price: number;
  created_at: string;
  seller_id: string;
}

interface ItemMedia {
  file_path: string;
  file_type: string;
}

const PendingItems = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [mediaFiles, setMediaFiles] = useState<ItemMedia[]>([]);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [finalPayout, setFinalPayout] = useState("");
  const [decision, setDecision] = useState("");
  const [repairCost, setRepairCost] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [processing, setProcessing] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(250000);
  const [sellerWallet, setSellerWallet] = useState("");
  const [isSellerVerified, setIsSellerVerified] = useState(false);

  useEffect(() => {
    fetchItems();

    const channel = supabase
      .channel("pending-items")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "items",
        },
        () => {
          fetchItems();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .eq("status", "pending_valuation")
      .order("created_at", { ascending: true });

    if (!error && data) {
      setItems(data);
    }
    setLoading(false);
  };

  const handleViewItem = async (item: Item) => {
    setSelectedItem(item);
    setFinalPayout("");
    setDecision("");
    setRepairCost("");
    setSellingPrice("");
    
    // Fetch exchange rate
    const rate = await getExchangeRate();
    setExchangeRate(rate);
    
    // Fetch seller's wallet info
    const { data: sellerProfile } = await supabase
      .from("profiles")
      .select("wallet_address, is_crypto_verified")
      .eq("id", item.seller_id)
      .single();
    
    if (sellerProfile) {
      setSellerWallet(sellerProfile.wallet_address || "");
      setIsSellerVerified(sellerProfile.is_crypto_verified || false);
    }
    
    const { data: media } = await supabase
      .from("item_media")
      .select("*")
      .eq("item_id", item.id);

    if (media) {
      setMediaFiles(media);
      
      const urls = await Promise.all(
        media.map(async (m) => {
          const { data } = supabase.storage
            .from("item-media")
            .getPublicUrl(m.file_path);
          return data.publicUrl;
        })
      );
      
      setMediaUrls(urls);
    }
  };

  const handleProcess = async () => {
    if (!selectedItem || !user) return;

    // Validate seller has verified wallet
    if (!isSellerVerified || !sellerWallet) {
      toast.error("Seller does not have a verified crypto wallet. Cannot process payout.");
      return;
    }

    setProcessing(true);

    try {
      let status = "";
      let currentBranch = "";
      
      switch (decision) {
        case "recycle":
          status = "recycled";
          currentBranch = "Recycle";
          break;
        case "refurbish":
          status = "ready_to_sell";
          currentBranch = "Refurbish & Sell";
          break;
        case "scrap":
          status = "scrapped";
          currentBranch = "Scrap/Not Usable";
          break;
      }

      const payoutRs = parseFloat(finalPayout);
      const payoutEth = convertRsToEth(payoutRs, exchangeRate);
      const repairCostRs = decision === "refurbish" ? parseFloat(repairCost || "0") : 0;
      const repairCostEth = convertRsToEth(repairCostRs, exchangeRate);
      const sellingPriceRs = decision === "refurbish" ? parseFloat(sellingPrice || "0") : (decision === "recycle" ? 150 : 0);
      const sellingPriceEth = convertRsToEth(sellingPriceRs, exchangeRate);

      // Simulate crypto payout transaction
      toast.info("Initiating crypto payout transaction...");
      
      let transactionHash;
      try {
        transactionHash = await simulatePayoutTransaction(sellerWallet, payoutEth);
        toast.success("Crypto payout transaction confirmed!");
      } catch (txError) {
        const errorMessage = txError instanceof Error ? txError.message : "Unknown error";
        toast.error(`Crypto transaction failed: ${errorMessage}`);
        throw new Error("Crypto payout failed");
      }

      // Update item with ETH values
      const { error } = await supabase
        .from("items")
        .update({
          final_payout: payoutRs,
          final_payout_eth: payoutEth,
          repair_cost: repairCostRs,
          repair_cost_eth: repairCostEth,
          selling_price: sellingPriceRs,
          selling_price_eth: sellingPriceEth,
          status,
          current_branch: currentBranch,
          processed_by: user.id,
        })
        .eq("id", selectedItem.id);

      if (error) throw error;

      // Log crypto transaction
      await logCryptoTransaction(
        selectedItem.id,
        "payout",
        COMPANY_WALLET_ADDRESS,
        sellerWallet,
        payoutRs,
        payoutEth,
        exchangeRate,
        transactionHash
      );

      toast.success("Item processed successfully with crypto payout!");
      setSelectedItem(null);
      fetchItems();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error processing item";
      toast.error(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">No pending items to process</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
        {items.map((item) => (
          <Card key={item.id} className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg">{item.category}</CardTitle>
              <p className="text-sm text-muted-foreground">{item.condition}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Asking Price:</span>
                  <span className="font-medium">Rs {item.seller_quoted_price}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Submitted: {new Date(item.created_at).toLocaleDateString()}
                </div>
              </div>
              <Button onClick={() => handleViewItem(item)} className="w-full">
                Process Item
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Process Item: {selectedItem?.category}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Item Details</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Category</p>
                  <p className="font-medium">{selectedItem?.category}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Condition</p>
                  <p className="font-medium">{selectedItem?.condition}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Seller's Ask</p>
                  <p className="text-lg font-bold">Rs {selectedItem?.seller_quoted_price}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Submitted</p>
                  <p>{selectedItem && new Date(selectedItem.created_at).toLocaleDateString()}</p>
                </div>
              </CardContent>
            </Card>

            {mediaUrls.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Media Files</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {mediaUrls.map((url, index) => (
                      <div key={index} className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                        {mediaFiles[index]?.file_type.startsWith("image/") ? (
                          <img src={url} alt={`Item ${index + 1}`} className="w-full h-full object-cover" />
                        ) : (
                          <video src={url} controls className="w-full h-full" />
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Seller Wallet Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  <span className="text-sm font-mono">{sellerWallet || "No wallet"}</span>
                  <Badge variant={isSellerVerified ? "default" : "destructive"}>
                    {isSellerVerified ? "Verified" : "Not Verified"}
                  </Badge>
                </div>
                {!isSellerVerified && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-2">
                    <p className="text-xs text-yellow-800 dark:text-yellow-200">
                      <AlertCircle className="w-3 h-3 inline mr-1" />
                      Seller must verify wallet before payout
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Exchange Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">1 ETH = Rs {exchangeRate.toLocaleString()}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Valuation & Decision</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Final Payout to Seller</Label>
                  <Input
                    type="number"
                    value={finalPayout}
                    onChange={(e) => setFinalPayout(e.target.value)}
                    placeholder="Enter payout amount in Rs"
                    min="0"
                    step="0.01"
                  />
                  {finalPayout && (
                    <p className="text-sm text-muted-foreground">
                      ETH Equivalent: {convertRsToEth(parseFloat(finalPayout), exchangeRate).toFixed(8)} ETH
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Decision</Label>
                  <Select value={decision} onValueChange={setDecision}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recycle">Recycle (Avg Rs 1500 revenue)</SelectItem>
                      <SelectItem value="refurbish">Refurbish & Sell</SelectItem>
                      <SelectItem value="scrap">Scrap/Unusable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {decision === "refurbish" && (
                  <>
                    <div className="space-y-2">
                      <Label>Repair/Refurbish Cost (Rs)</Label>
                      <Input
                        type="number"
                        value={repairCost}
                        onChange={(e) => setRepairCost(e.target.value)}
                        placeholder="Enter repair cost"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Final Selling Price (Rs)</Label>
                      <Input
                        type="number"
                        value={sellingPrice}
                        onChange={(e) => setSellingPrice(e.target.value)}
                        placeholder="Enter selling price"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </>
                )}

                <Button
                  onClick={handleProcess}
                  disabled={!finalPayout || !decision || processing}
                  className="w-full"
                >
                  {processing ? "Processing..." : "Complete Processing"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PendingItems;
