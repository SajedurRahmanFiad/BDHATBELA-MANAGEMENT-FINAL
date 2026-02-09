# Supabase Edge Function Deployment Guide

## Option 1: Manual Deployment via Dashboard (Recommended)

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Select your project: **ozjddzasadgffjjeqntc**
3. Navigate to **Functions** in the left sidebar
4. Click **Create a new function**
5. Name it: `carrybee-stores`
6. Select TypeScript
7. Click **Create**
8. Replace the default code with the content from: `supabase/functions/carrybee-stores/index.ts`
9. Click **Deploy**

---

## Option 2: Deploy via supabase.io Dashboard Using Function Code

Your function code is in:
- `supabase/functions/carrybee-stores/index.ts` 
- `supabase/functions/_shared/cors.ts`

### What to paste in Supabase Dashboard:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CarryBeeRequest {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  clientContext: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: CarryBeeRequest = await req.json();
    const { baseUrl, clientId, clientSecret, clientContext } = body;

    console.log('[carrybee-stores] Received request with baseUrl:', baseUrl);

    // Validate required parameters
    if (!baseUrl || !clientId || !clientSecret || !clientContext) {
      console.error('[carrybee-stores] Missing required parameters');
      return new Response(
        JSON.stringify({
          error: "Missing required parameters",
          data: { stores: [] },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Call CarryBee API
    const apiUrl = `${baseUrl}/api/v2/stores`;
    console.log('[carrybee-stores] Calling CarryBee API:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Client-ID": clientId,
        "Client-Secret": clientSecret,
        "Client-Context": clientContext,
      },
    });

    console.log('[carrybee-stores] CarryBee API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[carrybee-stores] CarryBee API error: ${response.status} ${response.statusText}`,
        errorText
      );
      return new Response(
        JSON.stringify({
          error: `CarryBee API error: ${response.status} ${response.statusText}`,
          details: errorText,
          data: { stores: [] },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    console.log('[carrybee-stores] CarryBee API response:', JSON.stringify(data).substring(0, 200));

    // Handle different response structures
    let stores = [];
    
    if (data.data?.stores && Array.isArray(data.data.stores)) {
      stores = data.data.stores;
    } else if (data.stores && Array.isArray(data.stores)) {
      stores = data.stores;
    } else if (Array.isArray(data)) {
      stores = data;
    } else if (data.error) {
      console.error('[carrybee-stores] CarryBee API returned error:', data.message);
      return new Response(
        JSON.stringify({
          error: data.message || "CarryBee API error",
          data: { stores: [] },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Map stores to { id, name } format
    const mappedStores = stores.map((store: any) => ({
      id: store.id,
      name: store.name,
    }));

    console.log('[carrybee-stores] Returning stores:', mappedStores.length);
    
    return new Response(JSON.stringify({ data: { stores: mappedStores } }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[carrybee-stores] Exception:", err instanceof Error ? err.message : err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
        data: { stores: [] },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
```

---

## After Deployment:

1. The function URL will be: `https://ozjddzasadgffjjeqntc.supabase.co/functions/v1/carrybee-stores`
2. Your React app will automatically call this endpoint
3. Test it from browser console:
   ```javascript
   fetch('https://ozjddzasadgffjjeqntc.supabase.co/functions/v1/carrybee-stores', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       baseUrl: 'https://developers.carrybee.com',
       clientId: '8c8272c7-9645-4059-9dfd-96ca97f3',
       clientSecret: '80b0626c-ea1d-42b3-9a6f-ae05bfd7',
       clientContext: '2jsZY5XM6frIweSW1QskAbjEyC d0Hi'
     })
   }).then(r => r.json()).then(console.log)
   ```

4. Then test in the Settings page - enter your CarryBee credentials and the Store ID dropdown should populate!
