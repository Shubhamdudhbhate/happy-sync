import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useItemStore } from "@/store/itemStore";

const BuyerInterface = () => {
  const [buyerName, setBuyerName] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);
  const [searchCategory, setSearchCategory] = useState("");

  const { items, buyItem } = useItemStore();

  const handleRegister = () => {
    if (!buyerName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    setIsRegistered(true);
    toast.success(`Welcome, ${buyerName}! You are registered as a Buyer`);
  };

  const handleBuy = (itemId: number) => {
    buyItem(itemId, buyerName);
    toast.success("Item purchased successfully!");
  };

  if (!isRegistered) {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Buyer Registration</CardTitle>
          <CardDescription>Register to browse and purchase items</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="buyerName">Full Name</Label>
            <Input
              id="buyerName"
              placeholder="Enter your name"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
            />
          </div>
          <Button onClick={handleRegister} className="w-full">
            Register as Buyer
          </Button>
        </CardContent>
      </Card>
    );
  }

  const availableItems = items.filter((item) => item.status === "Ready to Sell");
  const categories = [...new Set(availableItems.map((item) => item.category))];

  const filteredItems = searchCategory
    ? availableItems.filter((item) => item.category.toLowerCase().includes(searchCategory.toLowerCase()))
    : availableItems;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Browse Items</CardTitle>
          <CardDescription>Welcome, {buyerName}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="search">Search by Category</Label>
            <Input
              id="search"
              placeholder="e.g., Mobile, Laptop"
              value={searchCategory}
              onChange={(e) => setSearchCategory(e.target.value)}
            />
          </div>

          {categories.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">Available Categories:</p>
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
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items Ready to Sell</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredItems.length === 0 ? (
            <p className="text-muted-foreground">No items available for sale</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredItems.map((item) => (
                <Card key={item.id}>
                  <CardHeader>
                    <CardTitle>ID #{item.id} - {item.category}</CardTitle>
                    <CardDescription>Condition: {item.condition}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-2xl font-bold">Rs{item.sellingPrice}</p>
                    <Button onClick={() => handleBuy(item.id)} className="w-full">
                      Purchase
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BuyerInterface;
