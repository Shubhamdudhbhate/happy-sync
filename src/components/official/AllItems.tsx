import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface Item {
  id: string;
  category: string;
  condition: string;
  seller_quoted_price: number;
  final_payout: number;
  repair_cost: number;
  selling_price: number;
  status: string;
  current_branch: string;
}

const AllItems = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchItems();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('all-items-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items'
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
      .order("created_at", { ascending: false });

    if (!error && data) {
      setItems(data);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {items.map((item) => (
        <Card key={item.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{item.category} - {item.condition}</CardTitle>
              <Badge>{item.status}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Asked:</span>
                <p className="font-medium">Rs {item.seller_quoted_price}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Payout:</span>
                <p className="font-medium">Rs {item.final_payout}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Repair:</span>
                <p className="font-medium">Rs {item.repair_cost}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Sell Price:</span>
                <p className="font-medium">Rs {item.selling_price}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default AllItems;
