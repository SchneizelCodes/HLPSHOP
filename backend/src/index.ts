import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import * as kv from "./kv_store.js";

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

// Fixed business owner email — change this to the real admin email
const ADMIN_EMAIL = "admin@shopwisely.com";

app.post("/make-server-cbe884d8/admin/request-code", async (c) => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5-minute window
  await kv.set("admin_code_pending", { code, expiresAt });
  // Production: send `code` via email to ADMIN_EMAIL here
  // For now: returning code directly so it can be displayed on screen
  return c.json({ adminEmail: ADMIN_EMAIL, code, expiresIn: 300 });
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
  const openaiKey = process.env.OPENAI_API_KEY;
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

import { serve } from "../node_modules/@hono/node-server/dist/index.cjs";

serve(app);
