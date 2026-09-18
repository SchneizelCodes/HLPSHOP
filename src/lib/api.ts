const BASE = "https://dgbbwyztbqkystnjvkly.supabase.co/functions/v1/server";
const ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ?? "";

async function req(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      ...options?.headers,
    },
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(data.error ?? data.message ?? "Request failed");
  return data;
}

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type User = { userId: string; email: string; name: string; role?: "admin" | "user" };
export type TimeRange = "today" | "week" | "month" | "quarter" | "year" | "custom";



export interface SalesFilter {
  range?: TimeRange;
  startDate?: string;
  endDate?: string;
  category?: string;
}

export interface AnalyticsQuery {
  question: string;
  context?: Record<string, any>;
}

export interface InventoryItem {
  sku: string;
  name: string;
  stock_level: number;
  reorder_point: number;
  warehouse_id: string;
  updated_at: string;
}

export interface TransactionLog {
  id: string;
  event_type: string;
  payload: Record<string, any>;
  status: "success" | "failed" | "pending";
  actor_id: string | null;
  created_at: string;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  originalPrice: number;
  rating: number;
  reviews: number;
  image: string;
  category: string;
  badge?: string;
}

// ─── API CLIENT ───────────────────────────────────────────────────────────────

export const api = {

  orders: {
    get: (userId: string) => req(`/orders/${userId}`),
    create: (userId: string, order: object) =>
      req(`/orders/${userId}`, { method: "POST", body: JSON.stringify(order) }),
  },

  cart: {
  get: (userId: string) => req(`/cart/${userId}`),
  add: (userId: string, item: object) =>
    req(`/cart/${userId}`, { method: "POST", body: JSON.stringify(item) }),
  update: (userId: string, productId: number, qty: number) =>
    req(`/cart/${userId}/${productId}`, { method: "PUT", body: JSON.stringify({ qty }) }),
  remove: (userId: string, productId: number) =>
    req(`/cart/${userId}/${productId}`, { method: "DELETE" }),
  clear: (userId: string) =>
    req(`/cart/${userId}`, { method: "DELETE" }),
},

wishlist: {
  get: (userId: string) => req(`/wishlist/${userId}`),
  add: (userId: string, productId: number) =>
    req(`/wishlist/${userId}`, { method: "POST", body: JSON.stringify({ productId }) }),
  remove: (userId: string, productId: number) =>
    req(`/wishlist/${userId}/${productId}`, { method: "DELETE" }),
},

  time: {
    get: () => req("/time") as Promise<{ iso: string; ts: number }>,
  },

  auth: {
    login: (email: string, password: string) =>
      req("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
    register: (email: string, name: string, password: string) =>
      req("/auth/register", { method: "POST", body: JSON.stringify({ email, name, password }) }),
    setNickname: (userId: string, nickname: string) =>
      req(`/auth/nickname/${userId}`, { method: "PUT", body: JSON.stringify({ nickname }) }),
  },

  admin: {
    requestCode: () =>
      req("/admin/request-code", { method: "POST" }) as Promise<{ expiresIn: number }>,
    verifyCode: (code: string) =>
      req("/admin/verify-code", {
        method: "POST",
        body: JSON.stringify({ code }),
      }) as Promise<{ valid: boolean; token?: string; error?: string }>,

    // Operations Copilot Chat
    chat: {
      sendMessage: (
        messages: { from: "admin" | "assistant"; text: string; time: string }[],
        adminToken?: string,
      ) =>
        req("/admin/chat/message", {
          method: "POST",
          headers: adminToken ? { "x-admin-token": adminToken } : {},
          body: JSON.stringify({ messages }),
        }) as Promise<{ message: string }>,
    },

    // Inventory Endpoints
    inventory: {
      getAll: (adminToken?: string) =>
        req("/inventory", {
          headers: adminToken ? { "x-admin-token": adminToken } : {},
        }) as Promise<InventoryItem[]>,
      updateStock: (sku: string, stock_level: number, adminToken?: string) =>
        req(`/inventory/${sku}`, {
          method: "PUT",
          headers: adminToken ? { "x-admin-token": adminToken } : {},
          body: JSON.stringify({ stock_level }),
        }) as Promise<InventoryItem>,
    },
    
    

    // Transaction & Audit Logs
    logs: {
      getAll: (filters?: { limit?: number; event_type?: string }, adminToken?: string) => {
        const query = filters ? `?${new URLSearchParams(filters as Record<string, string>).toString()}` : "";
        return req(`/logs${query}`, {
          headers: adminToken ? { "x-admin-token": adminToken } : {},
        }) as Promise<TransactionLog[]>;
      },
    },
  },

  analytics: {
    getTotalSales: (filters?: SalesFilter) => {
      const params = filters ? `?${new URLSearchParams(filters as Record<string, string>).toString()}` : "";
      return req(`/analytics/sales/total${params}`) as Promise<{
        totalRevenue: number;
        orderCount: number;
        averageOrderValue: number;
        historicalBreakdown: { date: string; sales: number }[];
      }>;
    },

    getRecommendations: (category?: string) => {
      const query = category ? `?category=${encodeURIComponent(category)}` : "";
      return req(`/analytics/recommendations${query}`) as Promise<{
        recommendations: {
          id: string;
          title: string;
          type: "pricing" | "inventory" | "marketing" | "retention";
          impact: "high" | "medium" | "low";
          description: string;
        }[];
      }>;
    },
  },

  categories: {
    getAll: () => req("/categories") as Promise<string[]>,
    create: (name: string) =>
      req("/admin/categories", {
        method: "POST",
        body: JSON.stringify({ name }),
      }) as Promise<{ name: string }>,
    delete: (name: string) =>
      req(`/admin/categories/${encodeURIComponent(name)}`, {
        method: "DELETE",
      }) as Promise<{ success: boolean }>,
  },

  products: {
    getAll: (params?: { q?: string; category?: string }) => {
      const qs = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : "";
      return req(`/products${qs}`) as Promise<Product[]>;
    },
    create: (product: Partial<Product> & { stockLevel?: number }) =>
      req("/admin/products", {
        method: "POST",
        body: JSON.stringify(product),
      }) as Promise<Product>,
    update: (id: number, product: Partial<Product>) =>
      req(`/admin/products/${id}`, {
        method: "PUT",
        body: JSON.stringify(product),
      }) as Promise<Product>,
    delete: (id: number) =>
      req(`/admin/products/${id}`, {
        method: "DELETE",
      }) as Promise<{ success: boolean }>,
  },
};

// ─── LOCAL STORAGE HELPERS ───────────────────────────────────────────────────

const USER_KEY = "shopwave_user";
const GUEST_KEY = "shopwave_guest_id";

export function saveUser(user: User) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearUser() {
  localStorage.removeItem(USER_KEY);
}

export function getOrCreateGuestId(): string {
  let id = localStorage.getItem(GUEST_KEY);
  if (!id) {
    id = `guest_${crypto.randomUUID()}`;
    localStorage.setItem(GUEST_KEY, id);
  }
  return id;
}

export interface InventoryItem {
  sku: string;
  name: string;
  stock_level: number;
  reorder_point: number;
  warehouse_id: string;
  updated_at: string;
}

export interface TransactionLog {
  id: string;
  event_type: string;
  payload: Record<string, any>;
  status: "success" | "failed" | "pending";
  actor_id: string | null;
  created_at: string;
}