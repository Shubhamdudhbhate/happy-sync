import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface Item {
  id: string;
  category: string;
  condition: string;
  seller_quoted_price: number;
  final_payout: number;
  selling_price: number;
  status: string;
  created_at: string;
  updated_at: string;
}

const MyListings = () => {
  const { user } = useAuth();
  const [soldItems, setSoldItems] = useState<Item[]>([]);
  const [purchasedItems, setPurchasedItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchItems = async () => {
      // Fetch items I'm selling
      const { data: sold } = await supabase
        .from("items")
        .select("*")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false });

      // Fetch items I purchased
      const { data: purchased } = await supabase
        .from("items")
        .select("*")
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false });

      if (sold) setSoldItems(sold);
      if (purchased) setPurchasedItems(purchased);
      setLoading(false);
    };

    fetchItems();

    const channel = supabase
      .channel("my-items")
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
  }, [user]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending_valuation: "secondary",
      ready_to_sell: "default",
      sold: "default",
      recycled: "secondary",
      scrapped: "destructive",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {status.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Items I'm Selling Section */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Items I'm Selling</h2>
        {soldItems.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">No items submitted for sale yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {soldItems.map((item) => (
              <Card key={item.id} className="shadow-md hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{item.category}</CardTitle>
                      <CardDescription>{item.condition}</CardDescription>
                    </div>
                    {getStatusBadge(item.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Your Asking Price:</span>
                    <span className="font-medium">Rs {item.seller_quoted_price}</span>
                  </div>
                  {item.final_payout > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Final Payout:</span>
                      <span className="font-bold text-primary">Rs {item.final_payout}</span>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground pt-2">
                    Submitted: {new Date(item.created_at).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Items I Purchased Section */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Items I Purchased</h2>
        {purchasedItems.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">No items purchased yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {purchasedItems.map((item) => (
              <Card key={item.id} className="shadow-md hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{item.category}</CardTitle>
                      <CardDescription>{item.condition}</CardDescription>
                    </div>
                    <Badge variant="default">PURCHASED</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Purchase Price:</span>
                    <span className="font-bold text-primary">Rs {item.selling_price || 0}</span>
                  </div>
                  <div className="text-xs text-muted-foreground pt-2">
                    Purchased: {new Date(item.updated_at).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyListings;
