import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Image as ImageIcon, Wallet, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getExchangeRate, simulatePurchaseTransaction, logCryptoTransaction, COMPANY_WALLET_ADDRESS } from "@/lib/crypto";

interface Item {
  id: string;
  category: string;
  condition: string;
  selling_price: number;
  selling_price_eth: number;
  created_at: string;
}

interface ItemMedia {
  file_path: string;
  file_type: string;
}

const BrowseItems = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchCategory, setSearchCategory] = useState("");
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [mediaFiles, setMediaFiles] = useState<ItemMedia[]>([]);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [exchangeRate, setExchangeRate] = useState(250000);
  const [buyerWallet, setBuyerWallet] = useState("");
  const [isBuyerVerified, setIsBuyerVerified] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    fetchItems();
    fetchUserWallet();
    fetchExchangeRate();

    const channel = supabase
      .channel("browse-items")
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchExchangeRate = async () => {
    const rate = await getExchangeRate();
    setExchangeRate(rate);
  };

  const fetchUserWallet = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("wallet_address, is_crypto_verified")
      .eq("id", user.id)
      .single();

    if (data) {
      setBuyerWallet(data.wallet_address || "");
      setIsBuyerVerified(data.is_crypto_verified || false);
    }
  };

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .eq("status", "ready_to_sell")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setItems(data);
    }
    setLoading(false);
  };

  const handleViewItem = async (item: Item) => {
    setSelectedItem(item);
    
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

  const handlePurchase = async (itemId: string) => {
    if (!user) {
      toast.error("You must be logged in to purchase");
      return;
    }

    // Validate buyer has verified wallet
    if (!isBuyerVerified || !buyerWallet) {
      toast.error("You must have a verified crypto wallet to make purchases. Please update your profile.");
      return;
    }

    setPurchasing(true);

    try {
      // Get item details
      const { data: itemData, error: itemError } = await supabase
        .from("items")
        .select("*")
        .eq("id", itemId)
        .single();

      if (itemError || !itemData) {
        throw new Error("Failed to fetch item details");
      }

      const sellingPriceRs = itemData.selling_price;
      const sellingPriceEth = itemData.selling_price_eth;

      // Simulate crypto purchase transaction
      toast.info("Initiating crypto payment transaction...");
      
      let transactionHash;
      try {
        transactionHash = await simulatePurchaseTransaction(buyerWallet, sellingPriceEth);
        toast.success("Crypto payment transaction confirmed!");
      } catch (txError) {
        const errorMessage = txError instanceof Error ? txError.message : "Unknown error";
        toast.error(`Crypto transaction failed: ${errorMessage}`);
        throw new Error("Crypto payment failed");
      }

      // Update item status
      const { data, error } = await supabase
        .from("items")
        .update({
          status: "sold",
          buyer_id: user.id,
        })
        .eq("id", itemId)
        .select();

      if (error) {
        console.error("Purchase error:", error);
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error("Failed to update item. You may not have permission.");
      }

      // Log crypto transaction
      await logCryptoTransaction(
        itemId,
        "purchase",
        buyerWallet,
        COMPANY_WALLET_ADDRESS,
        sellingPriceRs,
        sellingPriceEth,
        exchangeRate,
        transactionHash
      );

      toast.success("Item purchased successfully with crypto payment!");
      setSelectedItem(null);
      fetchItems();
    } catch (error) {
      console.error("Purchase failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Error purchasing item";
      toast.error(errorMessage);
    } finally {
      setPurchasing(false);
    }
  };

  const filteredItems = searchCategory
    ? items.filter((item) =>
        item.category.toLowerCase().includes(searchCategory.toLowerCase())
      )
    : items;

  const categories = [...new Set(items.map((item) => item.category))];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {!isBuyerVerified && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-semibold text-yellow-800 dark:text-yellow-200">
                  Wallet Verification Required
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  You need a verified crypto wallet to purchase items. Please update your wallet in the dashboard.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Search Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search by category (e.g., Mobile, Laptop)"
            value={searchCategory}
            onChange={(e) => setSearchCategory(e.target.value)}
          />
          
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchCategory(cat)}
                >
                  {cat}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">No items available for sale</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <Card key={item.id} className="shadow-md hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">{item.category}</CardTitle>
                <p className="text-sm text-muted-foreground">{item.condition}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-2xl font-bold text-primary">
                    Rs {item.selling_price}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <Wallet className="w-3 h-3" />
                    {item.selling_price_eth?.toFixed(8) || "0.00000000"} ETH
                  </div>
                </div>
                <Button onClick={() => handleViewItem(item)} className="w-full" variant="outline">
                  <ImageIcon className="w-4 h-4 mr-2" />
                  View Details
                </Button>
                <Button 
                  onClick={() => handlePurchase(item.id)} 
                  className="w-full"
                  disabled={!isBuyerVerified || purchasing}
                >
                  {purchasing ? "Processing..." : "Purchase with Crypto"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedItem?.category}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Condition</p>
                <p className="font-medium">{selectedItem?.condition}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Price</p>
                <p className="text-2xl font-bold text-primary">
                  Rs {selectedItem?.selling_price}
                </p>
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                  <Wallet className="w-3 h-3" />
                  {selectedItem?.selling_price_eth?.toFixed(8) || "0.00000000"} ETH
                </div>
              </div>
            </div>
            
            {mediaUrls.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Media Files</p>
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
              </div>
            )}
            
            {!isBuyerVerified && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  You need a verified wallet to purchase this item
                </p>
              </div>
            )}
            
            <Button
              onClick={() => selectedItem && handlePurchase(selectedItem.id)}
              className="w-full"
              disabled={!isBuyerVerified || purchasing}
            >
              {purchasing ? "Processing Payment..." : "Purchase with Crypto"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BrowseItems;
