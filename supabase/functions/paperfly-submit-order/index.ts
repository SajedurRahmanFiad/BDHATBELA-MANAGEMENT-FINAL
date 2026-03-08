import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface PaperflyOrderRequest {
  baseUrl: string;
  username: string;
  password: string;
  paperflyKey: string;
  merchantOrderReference: string;
  storeName: string;
  productBrief?: string;
  packagePrice: string;
  maxWeightKg: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: PaperflyOrderRequest = await req.json();
    const {
      baseUrl,
      username,
      password,
      paperflyKey,
      merchantOrderReference,
      storeName,
      productBrief,
      packagePrice,
      maxWeightKg,
      customerName,
      customerAddress,
      customerPhone,
    } = body;

    if (
      !baseUrl ||
      !username ||
      !password ||
      !paperflyKey ||
      !merchantOrderReference ||
      !storeName ||
      packagePrice === undefined ||
      maxWeightKg === undefined ||
      !customerName ||
      !customerAddress ||
      !customerPhone
    ) {
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

    const apiUrl = `${baseUrl.replace(/\/$/, "")}/merchant/api/service/new_order_v2.php`;
    const authValue = `Basic ${btoa(`${username}:${password}`)}`;
    const orderPayload = {
      merchantOrderReference,
      storeName,
      productBrief: productBrief || "",
      packagePrice: String(packagePrice),
      max_weight: String(maxWeightKg),
      customerName,
      customerAddress,
      customerPhone,
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": authValue,
        "paperflykey": paperflyKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({
          error: `Paperfly API error: ${response.status} ${response.statusText}`,
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
    if (Number(data?.response_code) !== 200 && !data?.success?.tracking_number) {
      return new Response(
        JSON.stringify({
          error: data?.message || data?.error || "Paperfly API returned unsuccessful response",
          data: {},
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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
