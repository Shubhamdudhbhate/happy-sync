import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface UserProfile {
  id: string;
  full_name: string;
  created_at: string;
}

interface UserWithRole extends UserProfile {
  role: string;
  items_sold: number;
  items_bought: number;
}

const AllUsers = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      // Fetch all profiles with their roles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      if (profiles) {
        // Fetch roles and activity for each user
        const usersWithData = await Promise.all(
          profiles.map(async (profile) => {
            // Get user role
            const { data: roleData } = await supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", profile.id)
              .single();

            // Count items sold
            const { count: soldCount } = await supabase
              .from("items")
              .select("*", { count: "exact", head: true })
              .eq("seller_id", profile.id);

            // Count items bought
            const { count: boughtCount } = await supabase
              .from("items")
              .select("*", { count: "exact", head: true })
              .eq("buyer_id", profile.id);

            return {
              ...profile,
              role: roleData?.role || "user",
              items_sold: soldCount || 0,
              items_bought: boughtCount || 0,
            };
          })
        );

        setUsers(usersWithData);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
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
      <Card>
        <CardHeader>
          <CardTitle>All Registered Users</CardTitle>
          <p className="text-sm text-muted-foreground">
            Total Users: {users.length}
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user) => (
              <Card key={user.id} className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg">{user.full_name}</h3>
                        <Badge variant={user.role === "official" ? "default" : "secondary"}>
                          {user.role === "official" ? "Official/Worker" : "User (Seller/Buyer)"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        User ID: {user.id.substring(0, 8)}...
                      </p>
                      <div className="grid grid-cols-3 gap-4 pt-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Joined</p>
                          <p className="text-sm font-medium">
                            {new Date(user.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Items Sold</p>
                          <p className="text-sm font-medium">{user.items_sold}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Items Bought</p>
                          <p className="text-sm font-medium">{user.items_bought}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AllUsers;
