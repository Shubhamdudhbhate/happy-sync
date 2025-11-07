import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useItemStore } from "@/store/itemStore";

const SellerInterface = () => {
  const [sellerName, setSellerName] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("");
  const [askingPrice, setAskingPrice] = useState("");

  const { items, addItem } = useItemStore();

  const handleRegister = () => {
    if (!sellerName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    setIsRegistered(true);
    toast.success(`Welcome, ${sellerName}! You are registered as a Seller`);
  };

  const handleSubmitItem = () => {
    if (!category || !condition || !askingPrice) {
      toast.error("Please fill all fields");
      return;
    }

    addItem({
      category,
      condition,
      sellerQuotedPrice: parseFloat(askingPrice),
      sellerName,
    });

    toast.success("Item submitted for valuation!");
    setCategory("");
    setCondition("");
    setAskingPrice("");
  };

  if (!isRegistered) {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Seller Registration</CardTitle>
          <CardDescription>Register to submit items for valuation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="sellerName">Full Name</Label>
            <Input
              id="sellerName"
              placeholder="Enter your name"
              value={sellerName}
              onChange={(e) => setSellerName(e.target.value)}
            />
          </div>
          <Button onClick={handleRegister} className="w-full">
            Register as Seller
          </Button>
        </CardContent>
      </Card>
    );
  }

  const myItems = items.filter((item) => item.sellerName === sellerName);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Submit Item for Valuation</CardTitle>
          <CardDescription>Welcome, {sellerName}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              placeholder="e.g., Mobile, Laptop, TV"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="condition">Condition</Label>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger>
                <SelectValue placeholder="Select condition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Working">Working</SelectItem>
                <SelectItem value="Repairable">Repairable</SelectItem>
                <SelectItem value="Scrap">Scrap</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="askingPrice">Asking Price (Rs)</Label>
            <Input
              id="askingPrice"
              type="number"
              placeholder="Enter your asking price"
              value={askingPrice}
              onChange={(e) => setAskingPrice(e.target.value)}
            />
          </div>

          <Button onClick={handleSubmitItem} className="w-full">
            Submit Item
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {myItems.length === 0 ? (
            <p className="text-muted-foreground">No items submitted yet</p>
          ) : (
            <div className="space-y-3">
              {myItems.map((item) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <div className="flex justify-between">
                    <div>
                      <p className="font-semibold">ID #{item.id}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.category} - {item.condition}
                      </p>
                      <p className="text-sm">Asked: Rs{item.sellerQuotedPrice}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{item.status}</p>
                      {item.finalPayout > 0 && (
                        <p className="text-sm text-green-600">Payout: Rs{item.finalPayout}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SellerInterface;
