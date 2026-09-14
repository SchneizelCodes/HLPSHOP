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
app.use("/*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization", "apikey"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
}));

app.get("/health", (c) => c.json({ status: "ok" }));

app.get("/time", (c) => {
  return c.json({ iso: new Date().toISOString(), ts: Date.now() });
});

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface CartItem {
  id: number;
  name: string;
  price: number;
  qty: number;
  image: string;
  color: string;
  size: string;
}

interface OrderBody {
  items: CartItem[];
  total: number;
  address: string;
  delivery: string;
  payment: string;
}

interface OrderRow {
  id: string;
  user_id: string;
  items: CartItem[];
  total: number;
  address: string;
  delivery: string;
  payment: string;
  status: string;
  created_at: string;
  estimated_delivery: string;
}

interface ChatMessage {
  from: "admin" | "user" | "system";
  text: string;
  time: string;
}

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

  if (error || !user || user.password !== password)
    return c.json({ error: "Invalid email or password" }, 401);

  return c.json({ userId: user.user_id, email: user.email, name: user.name });
});

app.put("/auth/nickname/:userId", async (c) => {
  const { userId } = c.req.param();
  const { nickname } = await c.req.json<{ nickname: string }>();
  if (!nickname?.trim()) return c.json({ error: "Nickname required" }, 400);

  const { error } = await supabase
    .from("users")
    .update({ name: nickname.trim() })
    .eq("user_id", userId);

  if (error) return c.json({ error: "User not found" }, 404);
  return c.json({ userId, name: nickname.trim() });
});

// ─── CART ─────────────────────────────────────────────────────────────────────

app.get("/cart/:userId", async (c) => {
  const { userId } = c.req.param();
  const { data } = await supabase
    .from("carts")
    .select("items")
    .eq("user_id", userId)
    .single<{ items: CartItem[] }>();
  return c.json(data?.items ?? []);
});

app.post("/cart/:userId", async (c) => {
  const { userId } = c.req.param();
  const item = await c.req.json<CartItem>();

  const { data: existing } = await supabase
    .from("carts").select("items").eq("user_id", userId).single<{ items: CartItem[] }>();

  const cart: CartItem[] = existing?.items ?? [];
  const idx = cart.findIndex((i) => i.id === item.id);
  if (idx >= 0) cart[idx].qty += 1;
  else cart.push({ ...item, qty: 1 });

  await supabase.from("carts").upsert({ user_id: userId, items: cart });
  return c.json(cart);
});

app.put("/cart/:userId/:productId", async (c) => {
  const { userId, productId } = c.req.param();
  const { qty } = await c.req.json<{ qty: number }>();

  const { data: existing } = await supabase
    .from("carts").select("items").eq("user_id", userId).single<{ items: CartItem[] }>();

  let cart: CartItem[] = existing?.items ?? [];
  if (qty < 1) cart = cart.filter((i) => i.id !== Number(productId));
  else cart = cart.map((i) => i.id === Number(productId) ? { ...i, qty } : i);

  await supabase.from("carts").upsert({ user_id: userId, items: cart });
  return c.json(cart);
});

app.delete("/cart/:userId/:productId", async (c) => {
  const { userId, productId } = c.req.param();

  const { data: existing } = await supabase
    .from("carts").select("items").eq("user_id", userId).single<{ items: CartItem[] }>();

  const cart = (existing?.items ?? []).filter((i) => i.id !== Number(productId));
  await supabase.from("carts").upsert({ user_id: userId, items: cart });
  return c.json(cart);
});

app.delete("/cart/:userId", async (c) => {
  const { userId } = c.req.param();
  await supabase.from("carts").upsert({ user_id: userId, items: [] });
  return c.json([]);
});

// ─── WISHLIST ─────────────────────────────────────────────────────────────────

app.get("/wishlist/:userId", async (c) => {
  const { userId } = c.req.param();
  const { data } = await supabase
    .from("wishlists").select("product_ids").eq("user_id", userId).single<{ product_ids: number[] }>();
  return c.json(data?.product_ids ?? []);
});

app.post("/wishlist/:userId", async (c) => {
  const { userId } = c.req.param();
  const { productId } = await c.req.json<{ productId: number }>();

  const { data: existing } = await supabase
    .from("wishlists").select("product_ids").eq("user_id", userId).single<{ product_ids: number[] }>();

  const ids: number[] = existing?.product_ids ?? [];
  if (!ids.includes(productId)) ids.push(productId);

  await supabase.from("wishlists").upsert({ user_id: userId, product_ids: ids });
  return c.json(ids);
});

app.delete("/wishlist/:userId/:productId", async (c) => {
  const { userId, productId } = c.req.param();

  const { data: existing } = await supabase
    .from("wishlists").select("product_ids").eq("user_id", userId).single<{ product_ids: number[] }>();

  const ids = (existing?.product_ids ?? []).filter((id) => id !== Number(productId));
  await supabase.from("wishlists").upsert({ user_id: userId, product_ids: ids });
  return c.json(ids);
});

// ─── ORDERS ───────────────────────────────────────────────────────────────────

const mapOrder = (o: OrderRow) => ({
  id: o.id,
  items: o.items,
  total: o.total,
  address: o.address,
  delivery: o.delivery,
  payment: o.payment,
  status: o.status,
  createdAt: o.created_at,
  estimatedDelivery: o.estimated_delivery,
});

app.get("/orders/:userId", async (c) => {
  const { userId } = c.req.param();
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .returns<OrderRow[]>();
  return c.json((data ?? []).map(mapOrder));
});

app.post("/orders/:userId", async (c) => {
  const { userId } = c.req.param();
  const body = await c.req.json<OrderBody>();

  const orderId = `#ORD-${Date.now().toString().slice(-6)}`;
  const estimatedDelivery = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const { error } = await supabase.from("orders").insert({
    id: orderId,
    user_id: userId,
    items: body.items,
    total: body.total,
    address: body.address,
    delivery: body.delivery,
    payment: body.payment,
    status: "To Ship",
    estimated_delivery: estimatedDelivery,
  });

  if (error) return c.json({ error: "Failed to create order" }, 500);

  await supabase.from("carts").upsert({ user_id: userId, items: [] });

  return c.json({
    id: orderId,
    items: body.items,
    total: body.total,
    address: body.address,
    delivery: body.delivery,
    payment: body.payment,
    status: "To Ship",
    estimatedDelivery,
  });
});

// ─── ADMIN CODE ───────────────────────────────────────────────────────────────

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
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "ShopWisely <onboarding@resend.dev>",
      to: [ADMIN_EMAIL],
      subject: "Your ShopWisely Admin Access Code",
      html: `
        <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:420px;margin:0 auto;background:#0A0A0A;border-radius:16px;overflow:hidden;">
          <div style="background:#FF6B00;padding:24px 32px;">
            <h1 style="margin:0;color:#fff;font-size:20px;font-weight:800;letter-spacing:-0.5px;">ShopWisely</h1>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Admin Access Verification</p>
          </div>
          <div style="padding:32px;">
            <p style="color:#F0F0F0;font-size:15px;margin:0 0 8px;">Your one-time access code:</p>
            <div style="background:#141414;border:1px solid rgba(255,107,0,0.3);border-radius:12px;padding:20px;text-align:center;margin:16px 0;">
              <span style="font-size:36px;font-weight:900;letter-spacing:10px;color:#FF6B00;">${code}</span>
            </div>
            <p style="color:#888;font-size:12px;margin:0;">Expires in <strong style="color:#F0F0F0;">5 minutes</strong>. Do not share this code with anyone.</p>
          </div>
          <div style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.08);">
            <p style="color:#555;font-size:11px;margin:0;">If you did not request this code, ignore this email.</p>
          </div>
        </div>
      `,
    }),
  });

  if (!emailRes.ok) {
    const err = await emailRes.json().catch(() => ({ message: undefined })) as { message?: string };
    await supabase.from("admin_codes").delete().eq("singleton", "current");
    return c.json({ error: err.message ?? `Email send failed (${emailRes.status}). Check Resend API key.` }, 500);
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

  if (!stored) return c.json({ valid: false, error: "No active code — request a new one." }, 400);
  if (Date.now() > stored.expires_at) {
    await supabase.from("admin_codes").delete().eq("singleton", "current");
    return c.json({ valid: false, error: "Code expired — request a new one." }, 400);
  }
  if (code !== stored.code) return c.json({ valid: false, error: "Incorrect code." }, 400);

  await supabase.from("admin_codes").delete().eq("singleton", "current");
  return c.json({ valid: true });
});

// ─── QUICK CHAT (Gemini) ─────────────────────────────────────────────────────

interface GeminiResponse {
  candidates: { content: { parts: { text: string }[] } }[];
}

app.post("/quick-chat/message", async (c) => {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) return c.json({ error: "GEMINI_API_KEY secret not set" }, 500);

  const { messages } = await c.req.json<{ messages: ChatMessage[] }>();
  if (!Array.isArray(messages)) return c.json({ error: "messages array required" }, 400);

  const contents = messages
    .filter((m) => m.from !== "system")
    .map((m) => ({
      role: m.from === "admin" ? "model" : "user",
      parts: [{ text: m.text }],
    }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{
            text: "You are a friendly, concise customer support assistant for ShopWisely — a premium fashion and apparel online store. Help with orders, returns, product recommendations, sizing, shipping, and general questions. Keep responses warm and under 3 sentences unless more detail is needed.",
          }],
        },
        contents,
        generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.json() as { error?: { message?: string } };
    return c.json({ error: err.error?.message ?? "Gemini request failed" }, 500);
  }

  const data = await res.json() as GeminiResponse;
  return c.json({ message: data.candidates[0].content.parts[0].text });
});

Deno.serve(app.fetch);
