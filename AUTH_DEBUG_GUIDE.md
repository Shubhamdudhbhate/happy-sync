# Authentication Debug Guide

## Issues Fixed

I've updated the authentication system to fix sign-in issues. Here's what was changed:

### Changes Made to `src/pages/Auth.tsx`

1. **Sign Up Improvements:**
   - Added email confirmation check
   - Better error handling for role creation
   - Added console logging for debugging
   - Changed success message to prompt user to sign in (instead of auto-navigating)

2. **Sign In Improvements:**
   - Added detailed console logging at each step
   - Better validation for email/password
   - Improved error messages showing available roles
   - Better handling when roles don't exist
   - More descriptive error messages

## How to Test

### Step 1: Open Browser Console
Press `F12` or `Ctrl+Shift+I` to open Developer Tools and check the Console tab.

### Step 2: Try Sign Up
1. Select "User Login" or "Official Login"
2. Fill in the form
3. Connect your MetaMask wallet
4. Click "Create Account"
5. **Check console for any errors**

### Step 3: Try Sign In
1. Make sure you select the SAME login type (User/Official) that you signed up with
2. Enter your email and password
3. Click "Sign In"
4. **Check console for detailed logs:**
   - "Attempting sign in for: [email]"
   - "Sign in successful, checking roles..."
   - "User roles: [...]"

## Common Issues & Solutions

### Issue 1: Email Confirmation Required
**Symptom:** After sign up, you see "Please check your email to confirm"
**Solution:** 
- Check your Supabase dashboard: Authentication → Settings → Email Auth
- Disable "Enable email confirmations" if you want instant access
- Or check your email and click the confirmation link

### Issue 2: Wrong Login Type Selected
**Symptom:** "You don't have [type] access. Your available roles: [roles]"
**Solution:** 
- Switch to the correct login type button (User/Official) before signing in
- The button you click determines which role you're trying to access

### Issue 3: Role Not Created During Sign Up
**Symptom:** Console shows "No roles found, creating role..."
**Solution:** 
- This is normal if roles weren't created during sign-up
- The system will create the role automatically during sign-in
- If it fails, check the console for database errors

### Issue 4: Database Schema Issues
**Symptom:** Errors about missing columns (wallet_address, is_crypto_verified)
**Solution:**
- These are database migration issues
- The app will still work for basic auth, but wallet features won't work
- You need to apply the database migrations (see migration files in `supabase/migrations/`)

## Supabase Dashboard Checks

### Check 1: Email Confirmation Settings
1. Go to: https://supabase.com/dashboard/project/dkubuzshmaekvsygrihn/auth/settings
2. Scroll to "Email Auth"
3. Check if "Enable email confirmations" is ON or OFF
4. If ON, users must confirm email before signing in

### Check 2: Check User Roles Table
1. Go to: https://supabase.com/dashboard/project/dkubuzshmaekvsygrihn/editor
2. Click on "user_roles" table
3. After sign-up, check if a role was created for your user
4. The `user_id` should match your auth user ID
5. The `role` should be either "user" or "official"

### Check 3: Check Auth Users
1. Go to: https://supabase.com/dashboard/project/dkubuzshmaekvsygrihn/auth/users
2. Find your user
3. Check if "Email Confirmed" is true or false
4. If false and email confirmation is required, that's why sign-in fails

## Testing Steps

1. **Clear everything and start fresh:**
   ```bash
   # Open browser console and run:
   localStorage.clear()
   sessionStorage.clear()
   # Then refresh the page
   ```

2. **Sign Up with Console Open:**
   - Watch for any errors in console
   - Note the success/error messages

3. **Sign In with Console Open:**
   - Watch the detailed logs
   - Note which step fails (if any)

4. **Check Supabase Dashboard:**
   - Verify user was created
   - Verify role was created
   - Check email confirmation status

## Quick Fix Options

### Option A: Disable Email Confirmation (Fastest)
1. Go to Supabase Dashboard → Authentication → Settings
2. Disable "Enable email confirmations"
3. Try sign up again

### Option B: Confirm Email
1. Check your email inbox
2. Click the confirmation link
3. Then try to sign in

### Option C: Manually Create Role
1. Go to Supabase Dashboard → Table Editor → user_roles
2. Click "Insert row"
3. Add: user_id (your auth user ID), role ("user" or "official")
4. Then try to sign in

## Need More Help?

Run the app with:
```bash
npm run dev
```

Then:
1. Open browser console (F12)
2. Try to sign in
3. Copy ALL console messages
4. Share them for further debugging
