import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import * as kv from "./kv_store.tsx";

const app = new Hono();

app.use("*", logger(console.log));
app.use("/*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
}));

app.get("/make-server-cbe884d8/health", (c) => c.json({ status: "ok" }));

// Server time endpoint
app.get("/make-server-cbe884d8/time", (c) => {
  return c.json({ iso: new Date().toISOString(), ts: Date.now() });
});

// Update nickname
app.put("/make-server-cbe884d8/auth/nickname/:userId", async (c) => {
  const { userId } = c.req.param();
  const { nickname } = await c.req.json();
  if (!nickname?.trim()) return c.json({ error: "Nickname required" }, 400);
  // Find and update the user record by userId
  const all = await kv.getByPrefix("user:");
  const userRecord = (all as any[]).find((u: any) => u?.userId === userId);
  if (!userRecord) return c.json({ error: "User not found" }, 404);
  userRecord.name = nickname.trim();
  await kv.set(`user:${userRecord.email}`, userRecord);
  return c.json({ userId, name: nickname.trim() });
});

// ─── AUTH ─────────────────────────────────────────────────────────────────────

app.post("/make-server-cbe884d8/auth/register", async (c) => {
  const { email, name, password } = await c.req.json();
  if (!email || !name || !password) return c.json({ error: "All fields required" }, 400);
  const existing = await kv.get(`user:${email.toLowerCase()}`);
  if (existing) return c.json({ error: "An account with this email already exists" }, 400);
  const userId = crypto.randomUUID();
  await kv.set(`user:${email.toLowerCase()}`, { userId, email: email.toLowerCase(), name, password, createdAt: new Date().toISOString() });
  return c.json({ userId, email: email.toLowerCase(), name });
});

app.post("/make-server-cbe884d8/auth/login", async (c) => {
  const { email, password } = await c.req.json();
  if (!email || !password) return c.json({ error: "Email and password required" }, 400);
  const user = await kv.get(`user:${email.toLowerCase()}`);
  if (!user || user.password !== password) return c.json({ error: "Invalid email or password" }, 401);
  return c.json({ userId: user.userId, email: user.email, name: user.name });
});

// ─── CART ─────────────────────────────────────────────────────────────────────

app.get("/make-server-cbe884d8/cart/:userId", async (c) => {
  const { userId } = c.req.param();
  const cart = await kv.get(`cart:${userId}`) ?? [];
  return c.json(cart);
});

app.post("/make-server-cbe884d8/cart/:userId", async (c) => {
  const { userId } = c.req.param();
  const item = await c.req.json();
  const cart: any[] = await kv.get(`cart:${userId}`) ?? [];
  const idx = cart.findIndex((i) => i.id === item.id);
  if (idx >= 0) cart[idx].qty += 1;
  else cart.push({ ...item, qty: 1 });
  await kv.set(`cart:${userId}`, cart);
  return c.json(cart);
});

app.put("/make-server-cbe884d8/cart/:userId/:productId", async (c) => {
  const { userId, productId } = c.req.param();
  const { qty } = await c.req.json();
  let cart: any[] = await kv.get(`cart:${userId}`) ?? [];
  if (qty < 1) cart = cart.filter((i) => i.id !== Number(productId));
  else cart = cart.map((i) => i.id === Number(productId) ? { ...i, qty } : i);
  await kv.set(`cart:${userId}`, cart);
  return c.json(cart);
});

app.delete("/make-server-cbe884d8/cart/:userId/:productId", async (c) => {
  const { userId, productId } = c.req.param();
  const cart = ((await kv.get(`cart:${userId}`)) ?? []).filter((i: any) => i.id !== Number(productId));
  await kv.set(`cart:${userId}`, cart);
  return c.json(cart);
});

app.delete("/make-server-cbe884d8/cart/:userId", async (c) => {
  const { userId } = c.req.param();
  await kv.set(`cart:${userId}`, []);
  return c.json([]);
});

// ─── WISHLIST ─────────────────────────────────────────────────────────────────

app.get("/make-server-cbe884d8/wishlist/:userId", async (c) => {
  const { userId } = c.req.param();
  const wishlist = await kv.get(`wishlist:${userId}`) ?? [];
  return c.json(wishlist);
});

app.post("/make-server-cbe884d8/wishlist/:userId", async (c) => {
  const { userId } = c.req.param();
  const { productId } = await c.req.json();
  const wishlist: number[] = await kv.get(`wishlist:${userId}`) ?? [];
  if (!wishlist.includes(productId)) wishlist.push(productId);
  await kv.set(`wishlist:${userId}`, wishlist);
  return c.json(wishlist);
});

app.delete("/make-server-cbe884d8/wishlist/:userId/:productId", async (c) => {
  const { userId, productId } = c.req.param();
  const wishlist = ((await kv.get(`wishlist:${userId}`)) ?? []).filter((id: number) => id !== Number(productId));
  await kv.set(`wishlist:${userId}`, wishlist);
  return c.json(wishlist);
});

// ─── ORDERS ───────────────────────────────────────────────────────────────────

app.get("/make-server-cbe884d8/orders/:userId", async (c) => {
  const { userId } = c.req.param();
  const orders = await kv.get(`orders:${userId}`) ?? [];
  return c.json(orders);
});

app.post("/make-server-cbe884d8/orders/:userId", async (c) => {
  const { userId } = c.req.param();
  const body = await c.req.json();
  const orders: any[] = await kv.get(`orders:${userId}`) ?? [];
  const orderId = `#ORD-${Date.now().toString().slice(-6)}`;
  const order = {
    id: orderId,
    items: body.items,
    total: body.total,
    address: body.address,
    delivery: body.delivery,
    payment: body.payment,
    status: "To Ship",
    createdAt: new Date().toISOString(),
    estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  };
  orders.unshift(order);
  await kv.set(`orders:${userId}`, orders);
  await kv.set(`cart:${userId}`, []);
  return c.json(order);
});

// ─── ADMIN CODE ───────────────────────────────────────────────────────────────

const ADMIN_EMAIL = "joshuamanuelcamacho1@gmail.com";

app.post("/make-server-cbe884d8/admin/request-code", async (c) => {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return c.json({ error: "Email service not configured" }, 500);

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000;
  await kv.set("admin_code_pending", { code, expiresAt });

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
    const err = await emailRes.json().catch(() => ({}));
    // Clean up the stored code if email failed
    await kv.del("admin_code_pending");
    return c.json({ error: (err as any).message ?? "Failed to send email. Check Resend API key." }, 500);
  }

  // Code is NOT returned — it only lives in the email
  return c.json({ expiresIn: 300 });
});

app.post("/make-server-cbe884d8/admin/verify-code", async (c) => {
  const { code } = await c.req.json();
  if (!code) return c.json({ valid: false, error: "Code required" }, 400);
  const stored = await kv.get("admin_code_pending");
  if (!stored) return c.json({ valid: false, error: "No active code — request a new one." }, 400);
  if (Date.now() > stored.expiresAt) {
    await kv.del("admin_code_pending");
    return c.json({ valid: false, error: "Code expired — request a new one." }, 400);
  }
  if (code !== stored.code) return c.json({ valid: false, error: "Incorrect code." }, 400);
  await kv.del("admin_code_pending");
  return c.json({ valid: true });
});

// ─── QUICK CHAT (OpenAI) ──────────────────────────────────────────────────────

app.post("/make-server-cbe884d8/quick-chat/message", async (c) => {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) return c.json({ error: "OPENAI_API_KEY secret not set" }, 500);

  const { messages } = await c.req.json();
  if (!Array.isArray(messages)) return c.json({ error: "messages array required" }, 400);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a friendly, concise customer support assistant for ShopWisely — a premium fashion and apparel online store. Help with orders, returns, product recommendations, sizing, shipping, and general questions. Keep responses warm and under 3 sentences unless more detail is needed.",
        },
        ...messages
          .filter((m: any) => m.from !== "system")
          .map((m: any) => ({
            role: m.from === "admin" ? "assistant" : "user",
            content: m.text,
          })),
      ],
      max_tokens: 400,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return c.json({ error: (err as any).error?.message ?? "OpenAI request failed" }, 500);
  }

  const data = await res.json();
  return c.json({ message: (data as any).choices[0].message.content });
});

Deno.serve(app.fetch);
