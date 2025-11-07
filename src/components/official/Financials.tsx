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

    if (items) {
      let totalRevenue = 0;
      let totalCost = 0;

      items.forEach((item) => {
        if (item.status === "sold") {
          totalRevenue += item.selling_price;
          totalCost += item.final_payout + item.repair_cost;
        } else if (item.status === "recycled") {
          totalRevenue += 150;
          totalCost += item.final_payout;
        } else if (item.final_payout > 0) {
          totalCost += item.final_payout + item.repair_cost;
        }
      });

      setRevenue(totalRevenue);
      setCost(totalCost);
      setProfit(totalRevenue - totalCost);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-3 max-w-4xl mx-auto">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          <TrendingUp className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">Rs {revenue.toFixed(2)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
          <TrendingDown className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">Rs {cost.toFixed(2)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
          <DollarSign className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${profit >= 0 ? 'text-primary' : 'text-destructive'}`}>
            Rs {profit.toFixed(2)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Financials;
