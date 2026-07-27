import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
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

Deno.serve(app.fetch);
