import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, ShoppingCart, Wallet } from "lucide-react";
import SellItemForm from "./user/SellItemForm";
import MyListings from "./user/MyListings";
import BrowseItems from "./user/BrowseItems";
import WalletStatus from "./user/WalletStatus";

const UserDashboard = () => {
  return (
    <div className="space-y-6">
      <WalletStatus />
      <Tabs defaultValue="sell" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-2xl mx-auto">
          <TabsTrigger value="sell" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Sell Items
          </TabsTrigger>
          <TabsTrigger value="my-items" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            My Listings
          </TabsTrigger>
          <TabsTrigger value="buy" className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            Browse & Buy
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sell" className="mt-6">
          <SellItemForm />
        </TabsContent>

        <TabsContent value="my-items" className="mt-6">
          <MyListings />
        </TabsContent>

        <TabsContent value="buy" className="mt-6">
          <BrowseItems />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UserDashboard;
