import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Recycle, Shield, Wallet } from "lucide-react";
import { validateWalletAddress, connectMetaMask, isMetaMaskInstalled } from "@/lib/crypto";

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loginType, setLoginType] = useState<"user" | "official">("user");
  const [walletAddress, setWalletAddress] = useState("");
  const [isWalletVerified, setIsWalletVerified] = useState(false);

  const handleConnectWallet = async () => {
    try {
      if (!isMetaMaskInstalled()) {
        toast.error("MetaMask is not installed. Please install MetaMask extension.");
        window.open("https://metamask.io/download/", "_blank");
        return;
      }

      const address = await connectMetaMask();
      if (address) {
        setWalletAddress(address);
        const isValid = validateWalletAddress(address);
        setIsWalletVerified(isValid);
        
        if (isValid) {
          toast.success("Wallet connected and verified!");
        } else {
          toast.error("Invalid wallet address format");
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to connect wallet";
      toast.error(errorMessage);
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const fullName = formData.get("fullName") as string;

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        toast.success("Account created! Please sign in.");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error creating account";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success("Signed in successfully!");
      navigate("/");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error signing in";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-eco-light via-background to-eco-light/50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary mb-4">
            <Recycle className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">E-Waste Management</h1>
          <p className="text-muted-foreground">Sustainable recycling solutions</p>
        </div>

        <div className="flex gap-4 mb-6">
          <Button
            variant={loginType === "user" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setLoginType("user")}
          >
            <Recycle className="w-4 h-4 mr-2" />
            User Login
          </Button>
          <Button
            variant={loginType === "official" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setLoginType("official")}
          >
            <Shield className="w-4 h-4 mr-2" />
            Official Login
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{loginType === "user" ? "User Portal" : "Official Portal"}</CardTitle>
            <CardDescription>
              {loginType === "user" 
                ? "Buy and sell e-waste items" 
                : "Manage and process e-waste items"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      name="email"
                      type="email"
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      name="fullName"
                      type="text"
                      placeholder="Your name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      name="email"
                      type="email"
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Crypto Wallet (Optional - for transactions)</Label>
                    <div className="flex gap-2">
                      <Input
                        value={walletAddress}
                        placeholder="Connect MetaMask wallet (optional)"
                        readOnly
                        className={isWalletVerified ? "border-green-500" : ""}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleConnectWallet}
                        className="shrink-0"
                      >
                        <Wallet className="w-4 h-4 mr-2" />
                        Connect
                      </Button>
                    </div>
                    {isWalletVerified && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        Wallet verified
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      You can add a Sepolia testnet wallet later to participate in transactions
                    </p>
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
