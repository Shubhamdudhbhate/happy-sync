import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, X, Wallet } from "lucide-react";
import { getExchangeRate, rsToEth, formatEthAmount } from "@/lib/crypto";

const SellItemForm = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("");
  const [price, setPrice] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [exchangeRate, setExchangeRate] = useState(250000);
  const [estimatedEth, setEstimatedEth] = useState(0);

  useEffect(() => {
    fetchExchangeRate();
  }, []);

  useEffect(() => {
    if (price) {
      const priceNum = parseFloat(price);
      if (!isNaN(priceNum)) {
        setEstimatedEth(rsToEth(priceNum, exchangeRate));
      }
    } else {
      setEstimatedEth(0);
    }
  }, [price, exchangeRate]);

  const fetchExchangeRate = async () => {
    try {
      const rate = await getExchangeRate();
      setExchangeRate(rate);
    } catch (error) {
      console.error("Error fetching exchange rate:", error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);

    try {
      const { data: item, error: itemError } = await supabase
        .from("items")
        .insert({
          seller_id: user.id,
          category,
          condition,
          seller_quoted_price: parseFloat(price),
        })
        .select()
        .single();

      if (itemError) throw itemError;

      if (files.length > 0 && item) {
        for (const file of files) {
          const fileExt = file.name.split(".").pop();
          const fileName = `${user.id}/${item.id}/${Math.random()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("item-media")
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          await supabase.from("item_media").insert({
            item_id: item.id,
            file_path: fileName,
            file_type: file.type,
          });
        }
      }

      toast.success("Item submitted for valuation!");
      setCategory("");
      setCondition("");
      setPrice("");
      setFiles([]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error submitting item";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle>Submit Item for Valuation</CardTitle>
        <CardDescription>
          Provide details about your e-waste item. Our team will evaluate and make an offer.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              placeholder="e.g., Mobile, Laptop, TV, Tablet"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="condition">Condition</Label>
            <Select value={condition} onValueChange={setCondition} required>
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

          <div className="space-y-2">
            <Label htmlFor="price">Your Asking Price (Rs)</Label>
            <Input
              id="price"
              type="number"
              placeholder="Enter your expected price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              min="0"
              step="0.01"
            />
            {estimatedEth > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded-md">
                <Wallet className="w-4 h-4" />
                <span>Estimated: {formatEthAmount(estimatedEth)} ETH</span>
                <span className="text-xs">(1 ETH = Rs {exchangeRate.toLocaleString()})</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="files">Upload Photos/Videos (Optional)</Label>
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById("file-upload")?.click()}
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                Choose Files
              </Button>
              <input
                id="file-upload"
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            {files.length > 0 && (
              <div className="space-y-2 mt-4">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm truncate flex-1">{file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Submitting..." : "Submit Item"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default SellItemForm;
