import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createClient } from "@supabase/supabase-js";

const app = new Hono().basePath("/server");

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

app.use("*", logger(console.log));
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "apikey", "x-admin-token"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

app.get("/health", (c) => c.json({ status: "ok" }));

app.get("/time", (c) => {
  return c.json({ iso: new Date().toISOString(), ts: Date.now() });
});

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
    return c.json({ error: "Registration failed" }, 500);
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
    .single<{ user_id: string; email: string; name: string; password: string }>();

  if (error || !user || user.password !== password) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  return c.json({ userId: user.user_id, email: user.email, name: user.name });
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
    const err = (await emailRes.json().catch(() => ({}))) as { message?: string };
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
    .single<{ code: string; expires_at: number }>();

  if (!stored) return c.json({ valid: false, error: "No active code found." }, 400);
  if (Date.now() > stored.expires_at) {
    await supabase.from("admin_codes").delete().eq("singleton", "current");
    return c.json({ valid: false, error: "Code expired." }, 400);
  }
  if (code !== stored.code) return c.json({ valid: false, error: "Incorrect code." }, 400);

  await supabase.from("admin_codes").delete().eq("singleton", "current");
  return c.json({ valid: true, token: crypto.randomUUID() });
});

// ─── ANALYTICS ────────────────────────────────────────────────────────────────

app.get("/analytics/sales/total", async (c) => {
  const range = c.req.query("range") || "month";
  const category = c.req.query("category");

  let query = supabase.from("orders").select("amount, created_at, category, status");

  if (category) {
    query = query.eq("category", category);
  }

  // Calculate cutoff timestamp
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

  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const orderCount = orders.length;
  const averageOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

  // Group historical revenue by date
  const dateMap: Record<string, number> = {};
  for (const o of orders) {
    const d = o.created_at.slice(0, 10);
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
  return c.json(data);
});

app.put("/inventory/:sku", async (c) => {
  const { sku } = c.req.param();
  const body = await c.req.json<{ stock_level?: number; reorder_point?: number }>();

  const { data, error } = await supabase
    .from("inventory")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("sku", sku)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);

  // Log the change
  await supabase.from("transaction_logs").insert({
    event_type: "inventory_adjustment",
    payload: { sku, ...body },
    status: "success",
    actor_id: "admin",
  });

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
  return c.json(data);
});

// ─── CATEGORIES CRUD ─────────────────────────────────────────────────────────

app.get("/categories", async (c) => {
  const { data, error } = await supabase
    .from("categories")
    .select("name")
    .order("id", { ascending: true });
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data.map((row) => row.name));
});

app.post("/admin/categories", async (c) => {
  const { name } = await c.req.json<{ name: string }>();
  if (!name?.trim()) return c.json({ error: "Category name required" }, 400);

  const { data, error } = await supabase
    .from("categories")
    .insert({ name: name.trim() })
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

app.delete("/admin/categories/:name", async (c) => {
  const name = c.req.param("name");
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("name", name);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true });
});

// ─── ADMIN OPERATIONS COPILOT (Gemini + DB Context) ───────────────────────────

interface GeminiResponse {
  candidates: { content: { parts: { text: string }[] } }[];
}

app.post("/admin/chat/message", async (c) => {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) return c.json({ error: "GEMINI_API_KEY secret not set" }, 500);

  const { messages } = await c.req.json<{
    messages: { from: "admin" | "assistant"; text: string; time: string }[];
  }>();

  if (!Array.isArray(messages)) return c.json({ error: "messages array required" }, 400);

  // Pull live database metrics to give Gemini operational context
  const [inventoryRes, ordersRes] = await Promise.all([
    supabase.from("inventory").select("sku, name, stock_level, reorder_point").limit(20),
    supabase.from("orders").select("id, amount, status, category, created_at").order("created_at", { ascending: false }).limit(10),
  ]);

  const liveContext = JSON.stringify({
    inventorySnapshot: inventoryRes.data ?? [],
    recentOrdersSnapshot: ordersRes.data ?? [],
  });

  const contents = messages.map((m) => ({
    role: m.from === "assistant" ? "model" : "user",
    parts: [{ text: m.text }],
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [
            {
              text: `You are the ShopWisely Operations Copilot, an internal assistant for store operations, inventory management, and business analytics.
You have real-time access to the store database:
${liveContext}

When answering inquiries about stock levels, orders, bottlenecks, or revenue metrics, directly reference the data provided above. Be direct, analytical, and structured.`,
            },
          ],
        },
        contents,
        generationConfig: { maxOutputTokens: 600, temperature: 0.2 },
      }),
    },
  );

  if (!res.ok) {
    const err = (await res.json()) as { error?: { message?: string } };
    return c.json({ error: err.error?.message ?? "Gemini request failed" }, 500);
  }

  const data = (await res.json()) as GeminiResponse;
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "Unable to analyze live operations.";

  return c.json({ message: reply });
});

// ─── PRODUCTS CRUD ───────────────────────────────────────────────────────────

// Public: Get all products (supports category & search query)
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

  // Map snake_case database fields to camelCase frontend schema
  const mapped = data.map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
    originalPrice: Number(p.original_price),
    rating: Number(p.rating),
    reviews: p.reviews,
    image: p.image,
    category: p.category,
    badge: p.badge,
  }));

  return c.json(mapped);
});

// Admin: Create product
app.post("/admin/products", async (c) => {
  const body = await c.req.json();
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
    .single();

  if (error) return c.json({ error: error.message }, 500);

  // Automatically add an inventory tracking record for this product
  await supabase.from("inventory").insert({
    sku: `SKU-${data.id}`,
    name: data.name,
    stock_level: body.stockLevel || 20,
    reorder_point: 5,
    warehouse_id: "wh-main",
  });

  return c.json(data);
});

// Admin: Update product
app.put("/admin/products/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

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
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// Admin: Delete product
app.delete("/admin/products/:id", async (c) => {
  const id = c.req.param("id");
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true });
});

Deno.serve(app.fetch);