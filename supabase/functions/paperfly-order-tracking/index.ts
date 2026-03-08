import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface PaperflyTrackingRequest {
  baseUrl: string;
  username: string;
  password: string;
  referenceNumber: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: PaperflyTrackingRequest = await req.json();
    const { baseUrl, username, password, referenceNumber } = body;

    if (!baseUrl || !username || !password || !referenceNumber) {
      return new Response(
        JSON.stringify({
          error: "Missing required parameters",
          data: {},
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const apiUrl = `${baseUrl.replace(/\/$/, "")}/API-Order-Tracking`;
    const authValue = `Basic ${btoa(`${username}:${password}`)}`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": authValue,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ReferenceNumber: referenceNumber,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({
          error: `Paperfly tracking API error: ${response.status} ${response.statusText}`,
          details: errorText,
          data: {},
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
        data: {},
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
