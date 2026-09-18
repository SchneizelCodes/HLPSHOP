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

export const api = {
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

    // Admin-only analytics chat
    chat: {
      sendMessage: (
        adminToken: string,
        messages: { from: "admin" | "assistant"; text: string; time: string }[]
      ) =>
        req("/admin/chat/message", {
          method: "POST",
          headers: { "x-admin-token": adminToken },
          body: JSON.stringify({ messages }),
        }) as Promise<{ message: string; suggestions?: string[] }>,
    },
  },

  analytics: {
    // Total sales & historical metrics lookup
    getTotalSales: (filters?: SalesFilter) => {
      const params = new URLSearchParams(filters as Record<string, string>).toString();
      return req(`/analytics/sales/total${params ? `?${params}` : ""}`) as Promise<{
        totalRevenue: number;
        orderCount: number;
        averageOrderValue: number;
        historicalBreakdown: { date: string; sales: number }[];
      }>;
    },

    // AI/Gemini business insights & natural language queries
    askInsights: (payload: AnalyticsQuery) =>
      req("/analytics/insights/query", {
        method: "POST",
        body: JSON.stringify(payload),
      }) as Promise<{
        answer: string;
        charts?: { type: string; data: any };
        keyMetrics?: Record<string, number | string>;
      }>,

    // Recommended optimization steps based on sales & trend patterns
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
};

export type User = { userId: string; email: string; name: string; role?: "admin" | "user" };

const USER_KEY = "shopwave_user";

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