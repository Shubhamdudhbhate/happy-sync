/**
 * Auto-migration runner for crypto payment features
 * This will run automatically when the app starts
 */

import { supabase } from "@/integrations/supabase/client";

export const runCryptoMigrations = async () => {
  console.log("🔄 Checking crypto payment schema...");

  try {
    // Check if wallet_address column exists in profiles
    const { data: profileCheck, error: profileError } = await supabase
      .from("profiles")
      .select("wallet_address")
      .limit(1);

    // If column doesn't exist, we need to run migrations
    if (profileError && profileError.message.includes("column")) {
      console.log("⚠️ Crypto payment columns not found. Please apply the migration manually.");
      console.log("📋 Go to: https://supabase.com/dashboard/project/dkubuzshmaekvsygrihn/sql/new");
      console.log("📝 Copy and run the SQL from: supabase/migrations/20251109000000_add_crypto_payment_support.sql");
      return false;
    }

    // Check if system_config table exists
    const { error: configError } = await supabase
      .from("system_config")
      .select("config_key")
      .limit(1);

    if (configError && configError.message.includes("does not exist")) {
      console.log("⚠️ System config table not found. Please apply the migration manually.");
      console.log("📋 Go to: https://supabase.com/dashboard/project/dkubuzshmaekvsygrihn/sql/new");
      return false;
    }

    console.log("✅ Crypto payment schema is ready!");
    return true;
  } catch (error) {
    console.error("❌ Error checking schema:", error);
    return false;
  }
};

/**
 * Initialize crypto payment features
 * Call this when the app starts
 */
export const initializeCryptoPayments = async () => {
  const isReady = await runCryptoMigrations();
  
  if (!isReady) {
    console.warn("⚠️ Crypto payment features may not work until migration is applied.");
    console.warn("📖 See APPLY_MIGRATION.md for instructions.");
  }
  
  return isReady;
};
