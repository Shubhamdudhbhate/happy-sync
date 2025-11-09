import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";
import UserDashboard from "@/components/UserDashboard";
import OfficialDashboard from "@/components/OfficialDashboard";
import MigrationBanner from "@/components/MigrationBanner";

const Index = () => {
  const { user, loading, userRole, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <MigrationBanner />
      
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">E-Waste Management</h1>
            <p className="text-sm text-muted-foreground">
              {userRole === "official" ? "Official Portal" : "User Portal"}
            </p>
          </div>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {userRole === "official" ? <OfficialDashboard /> : <UserDashboard />}
      </main>
    </div>
  );
};

export default Index;
