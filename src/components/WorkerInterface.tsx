import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useItemStore } from "@/store/itemStore";

const WorkerInterface = () => {
  const { items, processItem, calculateFinancials } = useItemStore();
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [finalPayout, setFinalPayout] = useState("");
  const [decision, setDecision] = useState("");
  const [repairCost, setRepairCost] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");

  const pendingItems = items.filter((item) => item.status === "REQUEST: Awaiting Valuation");
  const financials = calculateFinancials();

  const handleProcess = () => {
    if (!selectedItemId || !finalPayout || !decision) {
      toast.error("Please fill all required fields");
      return;
    }

    const processData: any = {
      finalPayout: parseFloat(finalPayout),
      decision,
    };

    if (decision === "refurbish" && repairCost) {
      processData.repairCost = parseFloat(repairCost);
    }

    if (decision === "refurbish" && sellingPrice) {
      processData.sellingPrice = parseFloat(sellingPrice);
    }

    processItem(selectedItemId, processData);
    toast.success("Item processed successfully!");

    setSelectedItemId(null);
    setFinalPayout("");
    setDecision("");
    setRepairCost("");
    setSellingPrice("");
  };

  return (
    <Tabs defaultValue="process" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="process">Process Items</TabsTrigger>
        <TabsTrigger value="inventory">Inventory</TabsTrigger>
        <TabsTrigger value="financials">Financials</TabsTrigger>
      </TabsList>

      <TabsContent value="process" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Process New Requests</CardTitle>
            <CardDescription>Valuation and decision making</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingItems.length === 0 ? (
              <p className="text-muted-foreground">No pending items</p>
            ) : (
              <>
                <div>
                  <Label htmlFor="itemSelect">Select Item</Label>
                  <Select
                    value={selectedItemId?.toString()}
                    onValueChange={(val) => setSelectedItemId(parseInt(val))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose item to process" />
                    </SelectTrigger>
                    <SelectContent>
                      {pendingItems.map((item) => (
                        <SelectItem key={item.id} value={item.id.toString()}>
                          ID #{item.id} - {item.category} (Asked: Rs{item.sellerQuotedPrice})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedItemId && (
                  <>
                    <div>
                      <Label htmlFor="finalPayout">Final Payout to Seller (Rs)</Label>
                      <Input
                        id="finalPayout"
                        type="number"
                        value={finalPayout}
                        onChange={(e) => setFinalPayout(e.target.value)}
                      />
                    </div>

                    <div>
                      <Label htmlFor="decision">Decision</Label>
                      <Select value={decision} onValueChange={setDecision}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose decision" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="recycle">Recycle (Fixed Rs150 revenue)</SelectItem>
                          <SelectItem value="refurbish">Refurbish & Sell</SelectItem>
                          <SelectItem value="scrap">Scrap/Not Usable</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {decision === "refurbish" && (
                      <>
                        <div>
                          <Label htmlFor="repairCost">Repair Cost (Rs)</Label>
                          <Input
                            id="repairCost"
                            type="number"
                            value={repairCost}
                            onChange={(e) => setRepairCost(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="sellingPrice">Selling Price (Rs)</Label>
                          <Input
                            id="sellingPrice"
                            type="number"
                            value={sellingPrice}
                            onChange={(e) => setSellingPrice(e.target.value)}
                          />
                        </div>
                      </>
                    )}

                    <Button onClick={handleProcess} className="w-full">
                      Process Item
                    </Button>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="inventory" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Company Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="text-muted-foreground">No items in inventory</p>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="grid gap-2">
                      <div className="flex justify-between">
                        <span className="font-semibold">ID #{item.id}</span>
                        <span className="text-sm">{item.status}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span>Category: {item.category}</span>
                        <span>Condition: {item.condition}</span>
                        <span>Asked: Rs{item.sellerQuotedPrice}</span>
                        {item.finalPayout > 0 && <span>Payout: Rs{item.finalPayout}</span>}
                        {item.repairCost > 0 && <span>Repair: Rs{item.repairCost}</span>}
                        {item.sellingPrice > 0 && <span>Sell Price: Rs{item.sellingPrice}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="financials" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">Rs{financials.revenue.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Sales + Recycle</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Total Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">Rs{financials.cost.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Payouts + Repairs</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Net Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold ${financials.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                Rs{financials.profit.toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">Revenue - Cost</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Transaction Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total Items:</span>
                <span className="font-semibold">{items.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Pending Requests:</span>
                <span className="font-semibold">{items.filter((i) => i.status === "REQUEST: Awaiting Valuation").length}</span>
              </div>
              <div className="flex justify-between">
                <span>Ready to Sell:</span>
                <span className="font-semibold">{items.filter((i) => i.status === "Ready to Sell").length}</span>
              </div>
              <div className="flex justify-between">
                <span>Sold:</span>
                <span className="font-semibold">{items.filter((i) => i.status === "Sold").length}</span>
              </div>
              <div className="flex justify-between">
                <span>Recycled:</span>
                <span className="font-semibold">{items.filter((i) => i.status === "Recycled").length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};

export default WorkerInterface;
