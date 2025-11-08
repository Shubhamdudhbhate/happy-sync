import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown } from "lucide-react";

const Financials = () => {
  const [revenue, setRevenue] = useState(0);
  const [cost, setCost] = useState(0);
  const [profit, setProfit] = useState(0);

  useEffect(() => {
    calculateFinancials();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('financials-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items'
        },
        () => {
          calculateFinancials();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const calculateFinancials = async () => {
    const { data: items } = await supabase.from("items").select("*");

    if (!items) return;

    let totalRev = 0;
    let totalCst = 0;

    items.forEach((item) => {
      // Add payout cost for all acquired items
      if (item.final_payout && item.final_payout > 0) {
        totalCst += item.final_payout;
      }
      
      // Add repair cost if exists
      if (item.repair_cost && item.repair_cost > 0) {
        totalCst += item.repair_cost;
      }

      // Add revenue based on status
      if (item.status === "sold" && item.selling_price) {
        totalRev += item.selling_price;
      } else if (item.status === "recycled") {
        // Fixed revenue for recycled items
        totalRev += 150;
      }
    });

    setRevenue(totalRev);
    setCost(totalCst);
    setProfit(totalRev - totalCst);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Rs {revenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Sales + Recycling</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">Rs {cost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Payouts + Repairs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
              Rs {profit.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Revenue - Cost</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Financial Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Total Items Sold:</span>
              <span className="font-medium">{revenue > 0 ? 'View All Items tab for details' : '0'}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Items Recycled:</span>
              <span className="font-medium">Rs 150 each</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Total Payouts:</span>
              <span className="font-medium">Paid to sellers</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Repair Costs:</span>
              <span className="font-medium">For refurbished items</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Financials;
