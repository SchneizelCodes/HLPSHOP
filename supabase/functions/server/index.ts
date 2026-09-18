import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createClient } from "@supabase/supabase-js";

// ─── DOMAIN SCHEMAS & DTOs ────────────────────────────────────────────────────

interface UserRecord {
  user_id: string;
  email: string;
  name: string;
  password?: string;
}

interface AdminCodeRecord {
  singleton: string;
  code: string;
  expires_at: number;
}

interface CartItemDTO {
  id: number;
  name: string;
  price: number;
  qty: number;
  image: string;
  color: string;
  size: string;
  category?: string;
}

interface CartRecord {
  user_id: string;
  items: CartItemDTO[];
  updated_at: string;
}

interface WishlistRecord {
  user_id: string;
  product_ids: number[];
  updated_at: string;
}

interface OrderRecord {
  id: string;
  user_id: string;
  items: CartItemDTO[];
  amount: number;
  status: string;
  category: string;
  created_at: string;
}

interface InventoryRecord {
  sku: string;
  name: string;
  stock_level: number;
  reorder_point: number;
  warehouse_id: string;
  updated_at?: string;
}

interface TransactionLogRecord {
  id?: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: "success" | "failed" | "pending";
  actor_id: string | null;
  created_at?: string;
}

interface CategoryRecord {
  id: number;
  name: string;
}

interface ProductRecord {
  id: number;
  name: string;
  price: number;
  original_price: number;
  rating: number;
  reviews: number;
  image: string;
  category: string;
  badge: string | null;
  created_at?: string;
  updated_at?: string;
}

interface ChatMessageDTO {
  id?: number;
  from: "admin" | "assistant" | "user" | "system";
  text: string;
  time?: string;
}

interface ChatHistoryRecord {
  id: string;
  session_name: string;
  messages: ChatMessageDTO[];
  created_at: string;
  updated_at: string;
}

interface GeminiContentPart {
  text: string;
}

interface GeminiCandidate {
  content?: {
    parts?: GeminiContentPart[];
  };
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  error?: {
    message?: string;
  };
}

interface ResendErrorResponse {
  message?: string;
}

// ─── APP SETUP ────────────────────────────────────────────────────────────────

const root = new Hono();
const app = new Hono();

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

root.use("*", logger(console.log));
root.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "apikey", "x-admin-token"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

app.get("/health", (c) => c.json({ status: "ok" }));
app.get("/time", (c) => c.json({ iso: new Date().toISOString(), ts: Date.now() }));

// ─── AUTH ─────────────────────────────────────────────────────────────────────

app.post("/auth/register", async (c) => {
  const { email, name, password } = await c.req.json<{ email: string; name: string; password: string }>();
  if (!email || !name || !password) return c.json({ error: "All fields required" }, 400);

  const userId = crypto.randomUUID();
  const { error } = await supabase
    .from("users")
    .insert({ user_id: userId, email: email.toLowerCase(), name, password });

  if (error) {
    if (error.code === "23505") return c.json({ error: "An account with this email already exists" }, 400);
    return c.json({ error: "Registration failed: " + error.message }, 500);
  }

  return c.json({ userId, email: email.toLowerCase(), name });
});

app.post("/auth/login", async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>();
  if (!email || !password) return c.json({ error: "Email and password required" }, 400);

  const { data: user, error } = await supabase
    .from("users")
    .select("user_id, email, name, password")
    .eq("email", email.toLowerCase())
    .single<UserRecord>();

  if (error || !user || user.password !== password) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  return c.json({ userId: user.user_id, email: user.email, name: user.name });
});

app.put("/auth/nickname/:userId", async (c) => {
  const userId = c.req.param("userId");
  const { nickname } = await c.req.json<{ nickname: string }>();
  if (!nickname?.trim()) return c.json({ error: "Nickname required" }, 400);

  const { data, error } = await supabase
    .from("users")
    .update({ name: nickname.trim() })
    .eq("user_id", userId)
    .select("user_id, email, name")
    .single<UserRecord>();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// ─── ADMIN AUTH & VERIFICATION ────────────────────────────────────────────────

const ADMIN_EMAIL = "joshuamanuelcamacho1@gmail.com";

app.post("/admin/request-code", async (c) => {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return c.json({ error: "Email service not configured" }, 500);

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000;

  await supabase.from("admin_codes").upsert({ singleton: "current", code, expires_at: expiresAt });

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "ShopWisely <onboarding@resend.dev>",
      to: [ADMIN_EMAIL],
      subject: "Your ShopWisely Admin Access Code",
      html: `
        <div style="font-family:sans-serif;max-width:420px;margin:0 auto;background:#0A0A0A;border-radius:16px;padding:24px;color:#fff;">
          <h2 style="color:#FF6B00;margin-top:0;">Admin Access Verification</h2>
          <p>Your one-time access code is:</p>
          <div style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#FF6B00;margin:16px 0;">${code}</div>
          <p style="color:#888;font-size:12px;">Expires in 5 minutes.</p>
        </div>
      `,
    }),
  });

  if (!emailRes.ok) {
    const err = (await emailRes.json().catch(() => ({}))) as ResendErrorResponse;
    await supabase.from("admin_codes").delete().eq("singleton", "current");
    return c.json({ error: err.message ?? "Email send failed." }, 500);
  }

  return c.json({ expiresIn: 300 });
});

app.post("/admin/verify-code", async (c) => {
  const { code } = await c.req.json<{ code: string }>();
  if (!code) return c.json({ valid: false, error: "Code required" }, 400);

  const { data: stored } = await supabase
    .from("admin_codes")
    .select("code, expires_at")
    .eq("singleton", "current")
    .single<AdminCodeRecord>();

  if (!stored) return c.json({ valid: false, error: "No active code found." }, 400);
  if (Date.now() > stored.expires_at) {
    await supabase.from("admin_codes").delete().eq("singleton", "current");
    return c.json({ valid: false, error: "Code expired." }, 400);
  }
  if (code !== stored.code) return c.json({ valid: false, error: "Incorrect code." }, 400);

  await supabase.from("admin_codes").delete().eq("singleton", "current");
  return c.json({ valid: true, token: crypto.randomUUID() });
});

// ─── CART CRUD ────────────────────────────────────────────────────────────────

app.get("/cart/:userId", async (c) => {
  const userId = c.req.param("userId");
  const { data, error } = await supabase
    .from("carts")
    .select("items")
    .eq("user_id", userId)
    .maybeSingle<Pick<CartRecord, "items">>();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data?.items ?? []);
});

app.post("/cart/:userId", async (c) => {
  const userId = c.req.param("userId");
  const item = await c.req.json<CartItemDTO>();

  const { data: current } = await supabase
    .from("carts")
    .select("items")
    .eq("user_id", userId)
    .maybeSingle<Pick<CartRecord, "items">>();

  const items: CartItemDTO[] = current?.items ?? [];
  const existingIndex = items.findIndex((i) => i.id === item.id);

  if (existingIndex > -1) {
    items[existingIndex].qty += item.qty || 1;
  } else {
    items.push(item);
  }

  const { error } = await supabase
    .from("carts")
    .upsert({ user_id: userId, items, updated_at: new Date().toISOString() });

  if (error) return c.json({ error: error.message }, 500);
  return c.json(items);
});

app.put("/cart/:userId/:productId", async (c) => {
  const userId = c.req.param("userId");
  const productId = Number(c.req.param("productId"));
  const { qty } = await c.req.json<{ qty: number }>();

  const { data: current } = await supabase
    .from("carts")
    .select("items")
    .eq("user_id", userId)
    .maybeSingle<Pick<CartRecord, "items">>();

  let items: CartItemDTO[] = current?.items ?? [];
  if (qty <= 0) {
    items = items.filter((i) => i.id !== productId);
  } else {
    items = items.map((i) => (i.id === productId ? { ...i, qty } : i));
  }

  const { error } = await supabase
    .from("carts")
    .upsert({ user_id: userId, items, updated_at: new Date().toISOString() });

  if (error) return c.json({ error: error.message }, 500);
  return c.json(items);
});

app.delete("/cart/:userId/:itemId", async (c) => {
  const userId = c.req.param("userId");
  const itemId = Number(c.req.param("itemId"));

  const { data: current } = await supabase
    .from("carts")
    .select("items")
    .eq("user_id", userId)
    .maybeSingle<Pick<CartRecord, "items">>();

  const items: CartItemDTO[] = (current?.items ?? []).filter((i) => i.id !== itemId);

  const { error } = await supabase
    .from("carts")
    .upsert({ user_id: userId, items, updated_at: new Date().toISOString() });

  if (error) return c.json({ error: error.message }, 500);
  return c.json(items);
});

app.delete("/cart/:userId", async (c) => {
  const userId = c.req.param("userId");
  const { error } = await supabase
    .from("carts")
    .upsert({ user_id: userId, items: [], updated_at: new Date().toISOString() });

  if (error) return c.json({ error: error.message }, 500);
  return c.json([]);
});

// ─── WISHLIST CRUD ────────────────────────────────────────────────────────────

app.get("/wishlist/:userId", async (c) => {
  const userId = c.req.param("userId");
  const { data, error } = await supabase
    .from("wishlists")
    .select("product_ids")
    .eq("user_id", userId)
    .maybeSingle<Pick<WishlistRecord, "product_ids">>();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data?.product_ids ?? []);
});

app.post("/wishlist/:userId", async (c) => {
  const userId = c.req.param("userId");
  const { productId } = await c.req.json<{ productId: number }>();

  const { data: current } = await supabase
    .from("wishlists")
    .select("product_ids")
    .eq("user_id", userId)
    .maybeSingle<Pick<WishlistRecord, "product_ids">>();

  const ids = new Set<number>(current?.product_ids ?? []);
  ids.add(productId);

  const { error } = await supabase
    .from("wishlists")
    .upsert({ user_id: userId, product_ids: Array.from(ids), updated_at: new Date().toISOString() });

  if (error) return c.json({ error: error.message }, 500);
  return c.json(Array.from(ids));
});

app.delete("/wishlist/:userId/:productId", async (c) => {
  const userId = c.req.param("userId");
  const productId = Number(c.req.param("productId"));

  const { data: current } = await supabase
    .from("wishlists")
    .select("product_ids")
    .eq("user_id", userId)
    .maybeSingle<Pick<WishlistRecord, "product_ids">>();

  const ids: number[] = (current?.product_ids ?? []).filter((id) => id !== productId);

  const { error } = await supabase
    .from("wishlists")
    .upsert({ user_id: userId, product_ids: ids, updated_at: new Date().toISOString() });

  if (error) return c.json({ error: error.message }, 500);
  return c.json(ids);
});

// ─── ORDERS CRUD ──────────────────────────────────────────────────────────────

app.get("/orders/:userId", async (c) => {
  const userId = c.req.param("userId");
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data ?? []);
});

app.post("/orders/:userId", async (c) => {
  const userId = c.req.param("userId");
  const body = await c.req.json<{ items?: CartItemDTO[]; total?: number }>();

  const orderId = `ORD-${Date.now().toString().slice(-6)}`;
  const total = Number(body.total || 0);

  const { data, error } = await supabase
    .from("orders")
    .insert({
      id: orderId,
      user_id: userId,
      items: body.items || [],
      amount: total,
      status: "Processing",
      category: body.items?.[0]?.category || "General",
      created_at: new Date().toISOString(),
    })
    .select()
    .single<OrderRecord>();

  if (error) return c.json({ error: error.message }, 500);

  await supabase.from("carts").upsert({ user_id: userId, items: [], updated_at: new Date().toISOString() });
  return c.json(data);
});

// ─── ANALYTICS ────────────────────────────────────────────────────────────────

app.get("/analytics/sales/total", async (c) => {
  const range = c.req.query("range") || "month";
  const category = c.req.query("category");

  let query = supabase.from("orders").select("amount, created_at, category, status");

  if (category) {
    query = query.eq("category", category);
  }

  const now = new Date();
  if (range === "today") {
    now.setHours(0, 0, 0, 0);
    query = query.gte("created_at", now.toISOString());
  } else if (range === "week") {
    now.setDate(now.getDate() - 7);
    query = query.gte("created_at", now.toISOString());
  } else if (range === "month") {
    now.setMonth(now.getMonth() - 1);
    query = query.gte("created_at", now.toISOString());
  } else if (range === "year") {
    now.setFullYear(now.getFullYear() - 1);
    query = query.gte("created_at", now.toISOString());
  }

  const { data: orders, error } = await query;
  if (error) return c.json({ error: error.message }, 500);

  const safeOrders = (orders ?? []) as OrderRecord[];
  const totalRevenue = safeOrders.reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const orderCount = safeOrders.length;
  const averageOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

  const dateMap: Record<string, number> = {};
  for (const o of safeOrders) {
    const d = o.created_at ? o.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10);
    dateMap[d] = (dateMap[d] || 0) + Number(o.amount || 0);
  }

  const historicalBreakdown = Object.entries(dateMap)
    .map(([date, sales]) => ({ date, sales }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return c.json({
    totalRevenue,
    orderCount,
    averageOrderValue,
    historicalBreakdown,
  });
});

app.get("/analytics/recommendations", async (c) => {
  const { data: lowStock } = await supabase
    .from("inventory")
    .select("name, stock_level, reorder_point")
    .filter("stock_level", "lte", "reorder_point");

  const recommendations = [];

  if (lowStock && lowStock.length > 0) {
    recommendations.push({
      id: "rec-stock-alert",
      title: "Restock Warning",
      type: "inventory",
      impact: "high",
      description: `${lowStock.length} items have fallen below their reorder threshold.`,
    });
  }

  recommendations.push({
    id: "rec-bundle-strategy",
    title: "Basket Expansion Strategy",
    type: "pricing",
    impact: "medium",
    description: "Bundle top complementary items to increase Average Order Value.",
  });

  return c.json({ recommendations });
});

// ─── INVENTORY & LOGS ─────────────────────────────────────────────────────────

app.get("/inventory", async (c) => {
  const { data, error } = await supabase
    .from("inventory")
    .select("*")
    .order("stock_level", { ascending: true });

  if (error) return c.json({ error: error.message }, 500);
  return c.json((data ?? []) as InventoryRecord[]);
});

app.put("/inventory/:sku", async (c) => {
  const { sku } = c.req.param();
  const body = await c.req.json<{ stock_level?: number; reorder_point?: number }>();

  const { data, error } = await supabase
    .from("inventory")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("sku", sku)
    .select()
    .single<InventoryRecord>();

  if (error) return c.json({ error: error.message }, 500);

  const logPayload: Record<string, unknown> = { sku, ...body };
  await supabase.from("transaction_logs").insert({
    event_type: "inventory_adjustment",
    payload: logPayload,
    status: "success",
    actor_id: "admin",
  } satisfies TransactionLogRecord);

  return c.json(data);
});

app.get("/logs", async (c) => {
  const limit = Number(c.req.query("limit") || 50);
  const event_type = c.req.query("event_type");

  let query = supabase
    .from("transaction_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (event_type) {
    query = query.eq("event_type", event_type);
  }

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);
  return c.json((data ?? []) as TransactionLogRecord[]);
});

// ─── CATEGORIES CRUD ─────────────────────────────────────────────────────────

app.get("/categories", async (c) => {
  const { data, error } = await supabase
    .from("categories")
    .select("name")
    .order("id", { ascending: true });
  if (error) return c.json({ error: error.message }, 500);
  return c.json(((data ?? []) as CategoryRecord[]).map((row) => row.name));
});

app.post("/admin/categories", async (c) => {
  const { name } = await c.req.json<{ name: string }>();
  if (!name?.trim()) return c.json({ error: "Category name required" }, 400);

  const { data, error } = await supabase
    .from("categories")
    .insert({ name: name.trim() })
    .select()
    .single<CategoryRecord>();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

app.delete("/admin/categories/:name", async (c) => {
  const name = decodeURIComponent(c.req.param("name"));
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("name", name);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true });
});

// ─── ADMIN OPERATIONS COPILOT (Gemini + DB Context) ───────────────────────────

app.post("/admin/chat/message", async (c) => {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) return c.json({ error: "GEMINI_API_KEY secret not set" }, 500);

  const { messages } = await c.req.json<{
    messages: ChatMessageDTO[];
  }>();

  if (!Array.isArray(messages) || messages.length === 0) {
    return c.json({ error: "messages array required" }, 400);
  }

  const rawContents = messages
    .filter((m) => m.text?.trim())
    .map((m) => ({
      role: m.from === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: m.text }],
    }));

  const contents: { role: "user" | "model"; parts: { text: string }[] }[] = [];
  for (const item of rawContents) {
    if (contents.length > 0 && contents[contents.length - 1].role === item.role) {
      contents[contents.length - 1].parts[0].text += `\n${item.parts[0].text}`;
    } else {
      contents.push({ role: item.role, parts: [{ text: item.parts[0].text }] });
    }
  }

  while (contents.length > 0 && contents[contents.length - 1].role === "model") {
    contents.pop();
  }

  if (contents.length === 0) {
    return c.json({ error: "No user turn found in message history" }, 400);
  }

  const [inventoryRes, ordersRes] = await Promise.all([
    supabase.from("inventory").select("sku, name, stock_level, reorder_point").limit(20),
    supabase.from("orders").select("id, amount, status, category, created_at").order("created_at", { ascending: false }).limit(10),
  ]);

  const liveContext = JSON.stringify({
    inventorySnapshot: (inventoryRes.data as InventoryRecord[]) ?? [],
    recentOrdersSnapshot: (ordersRes.data as OrderRecord[]) ?? [],
  });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [
            {
              text: `You are the ShopWisely Operations Copilot, an internal assistant for store operations, inventory management, and business analytics.
Live store context:
${liveContext}
Directly reference this data when answering. Be concise, structured, and helpful.`,
            },
          ],
        },
        contents,
        generationConfig: { maxOutputTokens: 600, temperature: 0.2 },
      }),
    },
  );

  const data = (await res.json()) as GeminiResponse;
  if (!res.ok) {
    return c.json({ error: data.error?.message ?? "Gemini API request failed" }, 500);
  }

  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "Operations snapshot analyzed. All systems operational.";
  return c.json({ message: reply });
});

// ─── PRODUCTS CRUD ───────────────────────────────────────────────────────────

app.get("/products", async (c) => {
  const query = c.req.query("q");
  const category = c.req.query("category");

  let dbQuery = supabase.from("products").select("*").order("id", { ascending: true });

  if (category && category !== "All") {
    dbQuery = dbQuery.eq("category", category);
  }
  if (query) {
    dbQuery = dbQuery.ilike("name", `%${query}%`);
  }

  const { data, error } = await dbQuery;
  if (error) return c.json({ error: error.message }, 500);

  const records = (data ?? []) as ProductRecord[];
  const mapped = records.map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
    originalPrice: Number(p.original_price),
    rating: Number(p.rating),
    reviews: p.reviews,
    image: p.image,
    category: p.category,
    badge: p.badge ?? undefined,
  }));

  return c.json(mapped);
});

app.post("/admin/products", async (c) => {
  const body = await c.req.json<{
    name: string;
    price: number;
    originalPrice?: number;
    rating?: number;
    reviews?: number;
    image: string;
    category: string;
    badge?: string | null;
    stockLevel?: number;
  }>();

  const { data, error } = await supabase
    .from("products")
    .insert({
      name: body.name,
      price: body.price,
      original_price: body.originalPrice || body.price,
      rating: body.rating || 5.0,
      reviews: body.reviews || 0,
      image: body.image,
      category: body.category,
      badge: body.badge || null,
    })
    .select()
    .single<ProductRecord>();

  if (error) return c.json({ error: error.message }, 500);

  try {
    await supabase.from("inventory").insert({
      sku: `SKU-${data.id}`,
      name: data.name,
      stock_level: body.stockLevel || 20,
      reorder_point: 5,
      warehouse_id: "wh-main",
    });
  } catch {
    // Non-blocking fallback
  }

  return c.json(data);
});

app.put("/admin/products/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json<{
    name: string;
    price: number;
    originalPrice?: number;
    image: string;
    category: string;
    badge?: string | null;
  }>();

  const { data, error } = await supabase
    .from("products")
    .update({
      name: body.name,
      price: body.price,
      original_price: body.originalPrice,
      image: body.image,
      category: body.category,
      badge: body.badge,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single<ProductRecord>();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

app.delete("/admin/products/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true });
});

// ─── ADMIN ANALYTICS CHAT & HISTORY CRUD ──────────────────────────────────────

app.get("/admin/chat/history", async (c) => {
  const { data, error } = await supabase
    .from("admin_chat_history")
    .select("id, session_name, messages, updated_at")
    .order("updated_at", { ascending: false })
    .limit(10);

  if (error) return c.json({ error: error.message }, 500);
  return c.json((data ?? []) as ChatHistoryRecord[]);
});

app.post("/admin/chat/history", async (c) => {
  const { sessionId, sessionName, messages } = await c.req.json<{
    sessionId?: string;
    sessionName?: string;
    messages: ChatMessageDTO[];
  }>();

  if (!messages || messages.length === 0) {
    return c.json({ error: "Messages payload required" }, 400);
  }

  const payload: {
    id?: string;
    messages: ChatMessageDTO[];
    updated_at: string;
    session_name: string;
  } = {
    messages,
    updated_at: new Date().toISOString(),
    session_name: sessionName || `Analysis ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
  };

  if (sessionId) {
    payload.id = sessionId;
  }

  const { data, error } = await supabase
    .from("admin_chat_history")
    .upsert(payload)
    .select()
    .single<ChatHistoryRecord>();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

root.route("/functions/v1/server", app);
root.route("/server", app);
root.route("/", app);

Deno.serve(root.fetch);