# Debug Authentication Issue

## Current Status: USER NOT AUTHENTICATED

This means the user session is not being detected. Let's debug step by step.

## Step 1: Check Browser Console

1. Press `F12` to open Developer Tools
2. Go to **Console** tab
3. Look for these messages:

**If you see:**
```
Index - Auth State: { user: "none", loading: false, userRole: null, hasUser: false }
No user found, redirecting to /auth
```
**This means:** You're not signed in. You need to sign in.

**If you see:**
```
Index - Auth State: { user: "test@test.com", loading: false, userRole: "user", hasUser: true }
User is authenticated: test@test.com
Rendering dashboard for role: user
```
**This means:** You ARE signed in and it should work!

## Step 2: Clear Everything and Start Fresh

Open browser console (F12) and run:
```javascript
// Clear all data
localStorage.clear();
sessionStorage.clear();

// Check what's stored
console.log("LocalStorage:", localStorage);
console.log("SessionStorage:", sessionStorage);

// Reload
location.reload();
```

## Step 3: Sign In Again

After clearing and reloading:

1. You should see the **Auth page** (Sign In / Sign Up)
2. Click **"Sign In"** tab
3. Enter:
   - Email: `test@test.com`
   - Password: `test123`
4. Click **"Sign In"**

**Watch the console for:**
```
Attempting sign in for: test@test.com
Sign in successful, checking roles...
User roles: [...]
Signed in successfully!
```

## Step 4: Check Supabase Session

In console, run:
```javascript
// Check if there's a Supabase session
import { supabase } from '@/integrations/supabase/client';
supabase.auth.getSession().then(({data}) => {
  console.log("Current session:", data.session);
  console.log("User:", data.session?.user?.email);
});
```

## Step 5: Manual Session Check

If nothing works, let's check manually:

```javascript
// In browser console:
// Check localStorage for Supabase auth
Object.keys(localStorage).forEach(key => {
  if (key.includes('supabase')) {
    console.log(key, localStorage.getItem(key));
  }
});
```

## Common Issues:

### Issue 1: Not Actually Signed In
**Solution:** Go to `/auth` and sign in with `test@test.com` / `test123`

### Issue 2: Session Expired
**Solution:** Clear storage and sign in again

### Issue 3: Supabase Connection Issue
**Solution:** Check if Supabase URL and keys are correct in `.env`

### Issue 4: Browser Cache
**Solution:** Hard refresh with `Ctrl+Shift+R` or `Cmd+Shift+R`

## Quick Test Command

Run this in console to test everything:
```javascript
// Test authentication
(async () => {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    'https://dkubuzshmaekvsygrihn.supabase.co',
    'sb_publishable_C4-FTc4bfbfHqgivatjZ7Q_9V32A3_r'
  );
  
  const { data, error } = await supabase.auth.getSession();
  console.log("Session check:", data.session ? "SIGNED IN" : "NOT SIGNED IN");
  console.log("User:", data.session?.user?.email || "none");
  console.log("Error:", error);
})();
```

## What to Share

If still not working, share these from console:
1. All console messages (especially errors in red)
2. Result of session check command above
3. What page you're currently on (URL)
4. What you see on screen

## Expected Flow

1. **Not signed in** → Redirects to `/auth`
2. **Sign in** → Creates session
3. **Session created** → Redirects to `/`
4. **On `/`** → Shows dashboard

Where are you stuck in this flow?
