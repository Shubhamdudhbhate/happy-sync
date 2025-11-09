import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, ShoppingCart, Wrench, Recycle, Wallet } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AuditItem {
  id: string;
  category: string;
  status: string;
  current_branch: string;
  seller_quoted_price: number;
  final_payout: number;
  repair_cost: number;
  selling_price: number;
  created_at: string;
  updated_at: string;
  seller_id: string;
  buyer_id: string | null;
  processed_by: string | null;
}

interface AuditLog {
  item: AuditItem;
  seller_name: string;
  buyer_name: string | null;
  processor_name: string | null;
}

const AuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    fetchLogs();

    const channel = supabase
      .channel("audit-logs")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "items",
        },
        () => {
          fetchLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLogs = async () => {
    try {
      const { data: items, error } = await supabase
        .from("items")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;

      if (items) {
        const logsWithNames = await Promise.all(
          items.map(async (item) => {
            // Get seller name
            const { data: sellerProfile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", item.seller_id)
              .single();

            // Get buyer name if exists
            let buyerName = null;
            if (item.buyer_id) {
              const { data: buyerProfile } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("id", item.buyer_id)
                .single();
              buyerName = buyerProfile?.full_name || null;
            }

            // Get processor name if exists
            let processorName = null;
            if (item.processed_by) {
              const { data: processorProfile } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("id", item.processed_by)
                .single();
              processorName = processorProfile?.full_name || null;
            }

            return {
              item,
              seller_name: sellerProfile?.full_name || "Unknown",
              buyer_name: buyerName,
              processor_name: processorName,
            };
          })
        );

        setLogs(logsWithNames);
      }
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending_valuation":
        return <Package className="w-4 h-4" />;
      case "ready_to_sell":
        return <ShoppingCart className="w-4 h-4" />;
      case "sold":
        return <ShoppingCart className="w-4 h-4" />;
      case "recycled":
        return <Recycle className="w-4 h-4" />;
      default:
        return <Wrench className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending_valuation":
        return "default";
      case "ready_to_sell":
        return "secondary";
      case "sold":
        return "default";
      case "recycled":
        return "outline";
      default:
        return "destructive";
    }
  };

  const filteredLogs = statusFilter === "all" 
    ? logs 
    : logs.filter(log => log.item.status === statusFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Transaction Audit Logs</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Complete history of all item transactions
              </p>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Transactions</SelectItem>
                <SelectItem value="pending_valuation">Pending</SelectItem>
                <SelectItem value="ready_to_sell">Ready to Sell</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
                <SelectItem value="recycled">Recycled</SelectItem>
                <SelectItem value="scrapped">Scrapped</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredLogs.map((log) => (
              <Card key={log.item.id} className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(log.item.status)}
                        <h3 className="font-semibold">{log.item.category}</h3>
                        <Badge variant={getStatusColor(log.item.status)}>
                          {log.item.status.replace(/_/g, " ").toUpperCase()}
                        </Badge>
                        {log.item.current_branch && log.item.current_branch !== "N/A" && (
                          <Badge variant="outline">{log.item.current_branch}</Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Seller</p>
                          <p className="font-medium">{log.seller_name}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Seller's Ask</p>
                          <p className="font-medium">Rs {log.item.seller_quoted_price}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Payout</p>
                          {log.item.final_payout > 0 ? (
                            <div>
                              <p className="font-medium">Rs {log.item.final_payout}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Wallet className="w-3 h-3" />
                                {log.item.final_payout_eth?.toFixed(8) || "0.00000000"} ETH
                              </p>
                            </div>
                          ) : (
                            <p className="font-medium">-</p>
                          )}
                        </div>
                        <div>
                          <p className="text-muted-foreground">Submitted</p>
                          <p className="font-medium">
                            {new Date(log.item.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {log.item.status !== "pending_valuation" && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm pt-2 border-t">
                          <div>
                            <p className="text-muted-foreground">Processed By</p>
                            <p className="font-medium">{log.processor_name || "-"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Repair Cost</p>
                            {log.item.repair_cost > 0 ? (
                              <div>
                                <p className="font-medium">Rs {log.item.repair_cost}</p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Wallet className="w-3 h-3" />
                                  {log.item.repair_cost_eth?.toFixed(8) || "0.00000000"} ETH
                                </p>
                              </div>
                            ) : (
                              <p className="font-medium">-</p>
                            )}
                          </div>
                          <div>
                            <p className="text-muted-foreground">Selling Price</p>
                            {log.item.selling_price > 0 ? (
                              <div>
                                <p className="font-medium">Rs {log.item.selling_price}</p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Wallet className="w-3 h-3" />
                                  {log.item.selling_price_eth?.toFixed(8) || "0.00000000"} ETH
                                </p>
                              </div>
                            ) : (
                              <p className="font-medium">-</p>
                            )}
                          </div>
                          <div>
                            <p className="text-muted-foreground">Buyer</p>
                            <p className="font-medium">{log.buyer_name || "-"}</p>
                          </div>
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground pt-2">
                        Last updated: {new Date(log.item.updated_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredLogs.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No transactions found
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditLogs;
