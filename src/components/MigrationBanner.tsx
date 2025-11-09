import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, ExternalLink, X } from "lucide-react";
import { runCryptoMigrations } from "@/lib/runMigrations";

const MigrationBanner = () => {
  const [needsMigration, setNeedsMigration] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    checkMigration();
  }, []);

  const checkMigration = async () => {
    const isReady = await runCryptoMigrations();
    setNeedsMigration(!isReady);
  };

  const openMigrationGuide = () => {
    window.open(
      "https://supabase.com/dashboard/project/dkubuzshmaekvsygrihn/sql/new",
      "_blank"
    );
  };

  if (!needsMigration || dismissed) return null;

  return (
    <div className="container mx-auto px-4 py-2">
      <Alert variant="default" className="relative border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
        <AlertCircle className="h-4 w-4 text-yellow-600" />
        <AlertTitle className="text-yellow-800 dark:text-yellow-200">Setup Required</AlertTitle>
        <AlertDescription className="mt-2 flex items-center justify-between text-yellow-700 dark:text-yellow-300">
          <div className="flex-1">
            <p className="mb-2 text-sm">
              Crypto payment features need database setup. Click to apply migration.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={openMigrationGuide}
                className="bg-white hover:bg-gray-100 text-xs"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Apply Migration
              </Button>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDismissed(true)}
            className="ml-4"
          >
            <X className="w-4 h-4" />
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default MigrationBanner;
