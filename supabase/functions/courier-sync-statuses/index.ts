import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { corsHeaders } from "../_shared/cors.ts";
import { classifyCarryBeeTransferStatus } from "../_shared/carrybeeStatus.ts";

interface SyncRequest {
  mode?: "incremental" | "backfill";
  limit?: number;
  orderId?: string;
  cursorCreatedAt?: string;
}

interface CarryBeeConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  clientContext: string;
}

interface SyncOrderRow {
  id: string;
  order_number: string;
  status: string;
  history: Record<string, unknown> | null;
  items: Array<{ productId?: string; quantity?: number }> | null;
  carrybee_consignment_id: string;
  created_at: string;
}

interface OrderSyncResult {
  orderId: string;
  orderNumber: string;
  rawStatus: string;
  normalizedStatus: string;
  updated: boolean;
  skipped: boolean;
  error?: string;
}

const DEFAULT_INCREMENTAL_LIMIT = 250;
const DEFAULT_BACKFILL_LIMIT = 100;
const MAX_LIMIT = 500;
const CARRYBEE_ELIGIBLE_STATUSES = ["On Hold", "Processing"];
const PICKED_STATUS = "Picked";
const SYNC_CONCURRENCY = 8;
type AdminClient = ReturnType<typeof createClient>;

function isIncidentWriteFreezeEnabled() {
  const rawValue =
    Deno.env.get("INCIDENT_WRITE_FREEZE") ||
    Deno.env.get("SUPABASE_WRITE_FREEZE") ||
    Deno.env.get("DB_WRITE_FREEZE") ||
    "";

  return ["1", "true", "yes", "on"].includes(rawValue.trim().toLowerCase());
}

function getIncidentWriteFreezeReason() {
  return Deno.env.get("INCIDENT_WRITE_FREEZE_REASON")?.trim() ||
    "Courier sync is paused while the database incident is being investigated.";
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseRequestBody(text: string): SyncRequest {
  if (!text.trim()) return {};

  try {
    const parsed = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null ? parsed as SyncRequest : {};
  } catch {
    return {};
  }
}

function clampLimit(limit: unknown, fallback: number) {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.trunc(parsed), MAX_LIMIT);
}

function normalizeHistory(history: unknown): Record<string, unknown> {
  if (typeof history === "object" && history !== null && !Array.isArray(history)) {
    return { ...(history as Record<string, unknown>) };
  }

  return {};
}

function aggregateItemQuantities(items: Array<{ productId?: string; quantity?: number }> | null | undefined) {
  const quantities = new Map<string, number>();

  for (const item of items || []) {
    const productId = String(item?.productId || "").trim();
    const quantity = Number(item?.quantity || 0);
    if (!productId || !Number.isFinite(quantity) || quantity <= 0) continue;
    quantities.set(productId, (quantities.get(productId) || 0) + quantity);
  }

  return quantities;
}

async function applyOnHoldOrderStock(
  admin: AdminClient,
  items: Array<{ productId?: string; quantity?: number }> | null | undefined,
) {
  const quantities = aggregateItemQuantities(items);
  if (quantities.size === 0) return [] as Array<{ id: string; stock: number }>;

  const productIds = Array.from(quantities.keys());
  const { data: products, error } = await admin
    .from("products")
    .select("id, name, stock")
    .in("id", productIds);

  if (error) throw new Error(`Failed to fetch products for stock sync: ${error.message}`);

  const rollback = new Map<string, number>();
  const productsById = new Map<string, { id: string; name?: string; stock?: number }>(
    (products || []).map((product: any) => [product.id, product]),
  );

  for (const productId of productIds) {
    const product = productsById.get(productId);
    if (!product) {
      throw new Error(`Product ${productId} not found during stock sync`);
    }

    const currentStock = Number(product.stock || 0);
    const quantity = Number(quantities.get(productId) || 0);
    const nextStock = currentStock - quantity;
    if (nextStock < 0) {
      throw new Error(`Insufficient stock for ${product.name || productId}: need ${quantity}, have ${currentStock}`);
    }
    rollback.set(productId, currentStock);
  }

  const applied: Array<{ id: string; stock: number }> = [];
  try {
    for (const productId of productIds) {
      const nextStock = Number(rollback.get(productId) || 0) - Number(quantities.get(productId) || 0);
      const { error: updateError } = await admin
        .from("products")
        .update({ stock: nextStock })
        .eq("id", productId);

      if (updateError) {
        throw new Error(`Failed to update product ${productId}: ${updateError.message}`);
      }

      applied.push({ id: productId, stock: Number(rollback.get(productId) || 0) });
    }
  } catch (err) {
    for (const rollbackItem of applied) {
      await admin
        .from("products")
        .update({ stock: rollbackItem.stock })
        .eq("id", rollbackItem.id);
    }
    throw err;
  }

  return Array.from(rollback.entries()).map(([id, stock]) => ({ id, stock }));
}

async function rollbackProductStocks(
  admin: AdminClient,
  rollback: Array<{ id: string; stock: number }>,
) {
  for (const product of rollback) {
    await admin
      .from("products")
      .update({ stock: product.stock })
      .eq("id", product.id);
  }
}

async function fetchCarryBeeConfig(admin: AdminClient): Promise<CarryBeeConfig | null> {
  const { data, error } = await admin
    .from("courier_settings")
    .select("carrybee_base_url, carrybee_client_id, carrybee_client_secret, carrybee_client_context")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read courier settings: ${error.message}`);
  }

  const baseUrl = String(data?.carrybee_base_url || "").trim();
  const clientId = String(data?.carrybee_client_id || "").trim();
  const clientSecret = String(data?.carrybee_client_secret || "").trim();
  const clientContext = String(data?.carrybee_client_context || "").trim();

  if (!baseUrl || !clientId || !clientSecret || !clientContext) {
    return null;
  }

  return { baseUrl, clientId, clientSecret, clientContext };
}

async function fetchCarryBeeDetails(config: CarryBeeConfig, consignmentId: string) {
  const detailsUrl = `${config.baseUrl.replace(/\/$/, "")}/api/v2/orders/${encodeURIComponent(consignmentId)}/details`;
  const response = await fetch(detailsUrl, {
    method: "GET",
    headers: {
      "Client-ID": config.clientId,
      "Client-Secret": config.clientSecret,
      "Client-Context": config.clientContext,
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`CarryBee API error: ${response.status} ${response.statusText}${details ? ` - ${details}` : ""}`);
  }

  return await response.json();
}

async function processOrder(
  admin: AdminClient,
  config: CarryBeeConfig,
  row: SyncOrderRow,
): Promise<OrderSyncResult> {
  try {
    const payload = await fetchCarryBeeDetails(config, row.carrybee_consignment_id);
    const statusInfo = classifyCarryBeeTransferStatus(payload);

    if (!statusInfo.rawStatus) {
      return {
        orderId: row.id,
        orderNumber: row.order_number,
        rawStatus: "",
        normalizedStatus: "",
        skipped: true,
        updated: false,
        error: "CarryBee response did not include transfer_status",
      };
    }

    if (!statusInfo.isKnown) {
      console.warn(
        `[courier-sync-statuses] Unknown CarryBee transfer status for ${row.order_number}: ${statusInfo.rawStatus}`,
      );
    }

    if (!statusInfo.isPickedOrBeyond) {
      return {
        orderId: row.id,
        orderNumber: row.order_number,
        rawStatus: statusInfo.rawStatus,
        normalizedStatus: statusInfo.normalizedStatus,
        skipped: true,
        updated: false,
      };
    }

    let stockRollback: Array<{ id: string; stock: number }> = [];
    if (row.status === "On Hold") {
      stockRollback = await applyOnHoldOrderStock(admin, row.items);
    }

    const nextHistory = normalizeHistory(row.history);
    nextHistory.picked = nextHistory.picked ||
      `Marked picked automatically from CarryBee transfer status "${statusInfo.rawStatus}" on ${new Date().toISOString()}`;

    const { data, error } = await admin
      .from("orders")
      .update({
        status: PICKED_STATUS,
        history: nextHistory,
      })
      .eq("id", row.id)
      .in("status", CARRYBEE_ELIGIBLE_STATUSES)
      .select("id");

    if (error || !data || data.length === 0) {
      if (stockRollback.length > 0) {
        await rollbackProductStocks(admin, stockRollback);
      }

      const message = error?.message || "Order update returned no rows";
      throw new Error(message);
    }

    return {
      orderId: row.id,
      orderNumber: row.order_number,
      rawStatus: statusInfo.rawStatus,
      normalizedStatus: statusInfo.normalizedStatus,
      skipped: false,
      updated: true,
    };
  } catch (err) {
    return {
      orderId: row.id,
      orderNumber: row.order_number,
      rawStatus: "",
      normalizedStatus: "",
      skipped: true,
      updated: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  handler: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex = nextIndex++;
      if (currentIndex >= items.length) return;
      results[currentIndex] = await handler(items[currentIndex]);
    }
  }

  const workerCount = Math.min(Math.max(concurrency, 1), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const body = parseRequestBody(rawBody);
    const mode = body.mode === "backfill" ? "backfill" : "incremental";
    const limit = clampLimit(body.limit, mode === "backfill" ? DEFAULT_BACKFILL_LIMIT : DEFAULT_INCREMENTAL_LIMIT);

    if (isIncidentWriteFreezeEnabled()) {
      return jsonResponse(202, {
        data: {
          mode,
          checked: 0,
          updated: 0,
          hasMore: false,
          nextCursorCreatedAt: null,
          statusCounts: {},
          errors: [],
          updatedOrders: [],
          reason: "incident-write-freeze",
          message: getIncidentWriteFreezeReason(),
        },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(500, {
        error: "Missing Supabase environment variables",
        data: {},
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const carryBeeConfig = await fetchCarryBeeConfig(admin);
    if (!carryBeeConfig) {
      return jsonResponse(200, {
        data: {
          mode,
          checked: 0,
          updated: 0,
          hasMore: false,
          nextCursorCreatedAt: null,
          statusCounts: {},
          errors: [],
          updatedOrders: [],
          reason: "missing-carrybee-config",
        },
      });
    }

    let query = admin
      .from("orders")
      .select("id, order_number, status, history, items, carrybee_consignment_id, created_at")
      .not("carrybee_consignment_id", "is", null)
      .neq("carrybee_consignment_id", "")
      .in("status", CARRYBEE_ELIGIBLE_STATUSES);

    if (body.orderId) {
      query = query.eq("id", body.orderId);
    } else if (mode === "backfill") {
      if (body.cursorCreatedAt) {
        query = query.gt("created_at", body.cursorCreatedAt);
      }
      query = query.order("created_at", { ascending: true }).limit(limit);
    } else {
      query = query.order("created_at", { ascending: false }).limit(limit);
    }

    const { data: rows, error } = await query;
    if (error) {
      return jsonResponse(500, {
        error: `Failed to load orders: ${error.message}`,
        data: {},
      });
    }

    const orders = (rows || []) as SyncOrderRow[];
    const results = await mapWithConcurrency(orders, SYNC_CONCURRENCY, (row) => processOrder(admin, carryBeeConfig, row));

    const statusCounts: Record<string, number> = {};
    const errors = results
      .filter((result) => result.error)
      .map((result) => ({
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        error: result.error,
      }));

    for (const result of results) {
      const key = result.normalizedStatus || "unknown";
      statusCounts[key] = (statusCounts[key] || 0) + 1;
    }

    return jsonResponse(200, {
      data: {
        mode,
        checked: orders.length,
        updated: results.filter((result) => result.updated).length,
        hasMore: !body.orderId && orders.length === limit,
        nextCursorCreatedAt: orders.length > 0 ? orders[orders.length - 1].created_at : null,
        statusCounts,
        errors,
        updatedOrders: results
          .filter((result) => result.updated)
          .map((result) => ({
            orderId: result.orderId,
            orderNumber: result.orderNumber,
            rawStatus: result.rawStatus,
          })),
      },
    });
  } catch (err) {
    return jsonResponse(500, {
      error: err instanceof Error ? err.message : "Unknown error",
      data: {},
    });
  }
});
