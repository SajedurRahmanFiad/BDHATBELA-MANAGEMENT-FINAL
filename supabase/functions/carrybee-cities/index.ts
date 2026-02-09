import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface CarryBeeRequest {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  clientContext: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: CarryBeeRequest = await req.json();
    const { baseUrl, clientId, clientSecret, clientContext } = body;

    console.log('[carrybee-cities] Received request with baseUrl:', baseUrl);

    if (!baseUrl || !clientId || !clientSecret || !clientContext) {
      console.error('[carrybee-cities] Missing required parameters');
      return new Response(
        JSON.stringify({
          error: "Missing required parameters",
          data: { cities: [] },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const apiUrl = `${baseUrl}/api/v2/cities`;
    console.log('[carrybee-cities] Calling CarryBee API:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Client-ID": clientId,
        "Client-Secret": clientSecret,
        "Client-Context": clientContext,
      },
    });

    console.log('[carrybee-cities] CarryBee API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[carrybee-cities] CarryBee API error: ${response.status} ${response.statusText}`,
        errorText
      );
      return new Response(
        JSON.stringify({
          error: `CarryBee API error: ${response.status} ${response.statusText}`,
          details: errorText,
          data: { cities: [] },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    console.log('[carrybee-cities] CarryBee API response:', JSON.stringify(data).substring(0, 200));

    let cities = [];
    
    if (data.data?.cities && Array.isArray(data.data.cities)) {
      cities = data.data.cities;
    } else if (data.cities && Array.isArray(data.cities)) {
      cities = data.cities;
    } else if (Array.isArray(data)) {
      cities = data;
    } else if (data.error) {
      console.error('[carrybee-cities] CarryBee API returned error:', data.message);
      return new Response(
        JSON.stringify({
          error: data.message || "CarryBee API error",
          data: { cities: [] },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const mappedCities = cities.map((city: any) => ({
      id: city.id,
      name: city.name,
    }));

    console.log('[carrybee-cities] Returning cities:', mappedCities.length);
    
    return new Response(JSON.stringify({ data: { cities: mappedCities } }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[carrybee-cities] Exception:", err instanceof Error ? err.message : err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
        data: { cities: [] },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
