import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface CarryBeeRequest {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  clientContext: string;
  cityId: string;
  zoneId: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: CarryBeeRequest = await req.json();
    const { baseUrl, clientId, clientSecret, clientContext, cityId, zoneId } = body;

    console.log('[carrybee-areas] Received request with baseUrl:', baseUrl, 'cityId:', cityId, 'zoneId:', zoneId);

    if (!baseUrl || !clientId || !clientSecret || !clientContext || !cityId || !zoneId) {
      console.error('[carrybee-areas] Missing required parameters');
      return new Response(
        JSON.stringify({
          error: "Missing required parameters",
          data: { areas: [] },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const apiUrl = `${baseUrl}/api/v2/cities/${cityId}/zones/${zoneId}/areas`;
    console.log('[carrybee-areas] Calling CarryBee API:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Client-ID": clientId,
        "Client-Secret": clientSecret,
        "Client-Context": clientContext,
      },
    });

    console.log('[carrybee-areas] CarryBee API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[carrybee-areas] CarryBee API error: ${response.status} ${response.statusText}`,
        errorText
      );
      return new Response(
        JSON.stringify({
          error: `CarryBee API error: ${response.status} ${response.statusText}`,
          details: errorText,
          data: { areas: [] },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    console.log('[carrybee-areas] CarryBee API response:', JSON.stringify(data).substring(0, 200));

    let areas = [];
    
    if (data.data?.areas && Array.isArray(data.data.areas)) {
      areas = data.data.areas;
    } else if (data.areas && Array.isArray(data.areas)) {
      areas = data.areas;
    } else if (Array.isArray(data)) {
      areas = data;
    } else if (data.error) {
      console.error('[carrybee-areas] CarryBee API returned error:', data.message);
      return new Response(
        JSON.stringify({
          error: data.message || "CarryBee API error",
          data: { areas: [] },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const mappedAreas = areas.map((area: any) => ({
      id: area.id,
      name: area.name,
    }));

    console.log('[carrybee-areas] Returning areas:', mappedAreas.length);
    
    return new Response(JSON.stringify({ data: { areas: mappedAreas } }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[carrybee-areas] Exception:", err instanceof Error ? err.message : err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
        data: { areas: [] },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
