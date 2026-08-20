const BASE = "https://dgbbwyztbqkystnjvkly.supabase.co/functions/v1/make-server-cbe884d8";

async function req(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
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

  orders: {
    get: (userId: string) => req(`/orders/${userId}`),
    create: (userId: string, order: object) =>
      req(`/orders/${userId}`, { method: "POST", body: JSON.stringify(order) }),
  },

  admin: {
    requestCode: () =>
      req("/admin/request-code", { method: "POST" }) as Promise<{ expiresIn: number }>,
    verifyCode: (code: string) =>
      req("/admin/verify-code", { method: "POST", body: JSON.stringify({ code }) }) as Promise<{ valid: boolean; error?: string }>,
  },

  quickChat: {
    sendMessage: (messages: { from: string; text: string; time: string }[]) =>
      req("/quick-chat/message", { method: "POST", body: JSON.stringify({ messages }) }) as Promise<{ message: string }>,
  },
};

export type User = { userId: string; email: string; name: string };

const USER_KEY = "shopwave_user";
const GUEST_KEY = "shopwave_guest_id";

export function saveUser(user: User) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearUser() {
  localStorage.removeItem(USER_KEY);
}

export function getOrCreateGuestId(): string {
  let id = localStorage.getItem(GUEST_KEY);
  if (!id) { id = `guest_${crypto.randomUUID()}`; localStorage.setItem(GUEST_KEY, id); }
  return id;
}
