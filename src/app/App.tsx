import { useState, useEffect, useCallback, useRef } from "react";
import { api, loadUser, saveUser, clearUser, getOrCreateGuestId, type User } from "../lib/api";
import {
  Home, Search, ShoppingCart, Heart, User as UserIcon, ChevronRight, ChevronLeft, Star,
  MapPin, Truck, CreditCard, CheckCircle, Package, RotateCcw, Settings,
  Bell, Gift, HelpCircle, MessageCircle, Filter, ArrowUpDown, Minus, Plus,
  X, Camera, ChevronDown, Clock, Tag, Award, Phone, Mail, Send, Eye, EyeOff,
  TrendingUp, Zap, ShoppingBag, Check, Wallet, Building2, Banknote, Edit2,
  Trash2, LogOut, Copy, ImageIcon, Share2, Grid, List, Lock, Globe,
  Monitor, Smartphone, LayoutGrid, Shield, FileText, Bot, KeyRound, RefreshCw
} from "lucide-react";

// ─── GREETING + CLOCK HOOKS ───────────────────────────────────────────────────

// Fetches server time once, then ticks locally every second
function useServerClock() {
  const [time, setTime] = useState<Date | null>(null);
  useEffect(() => {
    api.time.get()
      .then(({ ts }) => {
        const offset = Date.now() - ts; // ms diff between client and server
        setTime(new Date(ts));
        const id = setInterval(() => setTime(new Date(Date.now() - offset)), 1000);
        return () => clearInterval(id);
      })
      .catch(() => {
        // fallback to client time
        setTime(new Date());
        const id = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(id);
      });
  }, []);
  return time;
}

function getGreeting(name: string, hour: number, style: number): string {
  const timeWord = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
  switch (style) {
    case 0: return `Good ${timeWord}, ${name}`;
    case 1: return `Welcome Back, ${name}`;
    case 2: return `Hi, ${name}`;
    case 3: return `Hello, ${name}`;
    default: return `Good Day, ${name}`;
  }
}

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Page =
  | "home" | "category" | "search" | "product" | "wishlist" | "cart"
  | "login" | "nickname" | "shipping-addr" | "delivery" | "payment" | "order-review" | "confirmation"
  | "orders" | "order-detail" | "tracking" | "rating" | "return"
  | "profile" | "account-settings" | "address-book" | "payment-methods" | "notifications"
  | "coupons" | "loyalty" | "help" | "faq" | "contact" | "live-chat"
  | "about" | "shipping-policy" | "return-policy" | "privacy" | "terms" | "quick-chat";

type LayoutMode = "mobile" | "desktop";

interface CartItem {
  id: number; name: string; price: number; qty: number; image: string; color: string; size: string;
}

interface Product {
  id: number; name: string; price: number; originalPrice: number; rating: number; reviews: number;
  image: string; category: string; badge?: string;
}

// ─── DATA ─────────────────────────────────────────────────────────────────────

const PRODUCTS: Product[] = [
  { id: 1, name: "Air Zoom Pegasus 40", price: 129.99, originalPrice: 159.99, rating: 4.8, reviews: 2341, image: "photo-1542291026-7eec264c27ff", category: "Shoes", badge: "Best Seller" },
  { id: 2, name: "Ultra Boost 23", price: 189.99, originalPrice: 220.00, rating: 4.7, reviews: 1876, image: "photo-1608231387042-66d1773d3028", category: "Shoes", badge: "New" },
  { id: 3, name: "Classic Leather Jacket", price: 299.00, originalPrice: 399.00, rating: 4.6, reviews: 934, image: "photo-1551028719-00167b16eac5", category: "Outerwear" },
  { id: 4, name: "Merino Wool Sweater", price: 89.00, originalPrice: 120.00, rating: 4.9, reviews: 567, image: "photo-1576566588028-4147f3842f27", category: "Tops", badge: "Sale" },
  { id: 5, name: "Slim Fit Chinos", price: 69.99, originalPrice: 89.99, rating: 4.5, reviews: 1203, image: "photo-1624378439575-d8705ad7ae80", category: "Bottoms" },
  { id: 6, name: "Crossbody Mini Bag", price: 149.00, originalPrice: 180.00, rating: 4.7, reviews: 445, image: "photo-1548036328-c9fa89d128fa", category: "Bags", badge: "Trending" },
  { id: 7, name: "Polarized Sunglasses", price: 59.99, originalPrice: 79.99, rating: 4.4, reviews: 789, image: "photo-1572635196237-14b3f281503f", category: "Accessories" },
  { id: 8, name: "Stainless Steel Watch", price: 249.00, originalPrice: 320.00, rating: 4.8, reviews: 1102, image: "photo-1523275335684-37898b6baf30", category: "Watches", badge: "Premium" },
];

const CATEGORIES = ["All", "Shoes", "Tops", "Bottoms", "Outerwear", "Bags", "Accessories", "Watches"];

// ─── SHARED UI ATOMS ──────────────────────────────────────────────────────────

function StarRating({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={size} className={i <= Math.floor(rating) ? "fill-[#FF6B00] text-[#FF6B00]" : "fill-[#2A2A2A] text-[#2A2A2A]"} />
      ))}
    </div>
  );
}

function BadgeLabel({ label }: { label: string }) {
  const colors: Record<string, string> = {
    "Best Seller": "bg-[#FF6B00] text-white",
    "New": "bg-blue-500 text-white",
    "Sale": "bg-red-500 text-white",
    "Trending": "bg-purple-500 text-white",
    "Premium": "bg-yellow-500 text-black",
  };
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wide ${colors[label] || "bg-muted text-muted-foreground"}`}>
      {label}
    </span>
  );
}

function Btn({ children, variant = "primary", size = "md", className = "", onClick, disabled, full }: {
  children: React.ReactNode; variant?: "primary" | "secondary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md" | "lg"; className?: string; onClick?: () => void; disabled?: boolean; full?: boolean;
}) {
  const base = "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-5 py-2.5 text-sm", lg: "px-6 py-3.5 text-base" };
  const variants = {
    primary: "bg-[#FF6B00] text-white hover:bg-[#E05A00] active:scale-[0.98]",
    secondary: "bg-[#1E1E1E] text-foreground border border-border hover:border-[rgba(255,107,0,0.4)] hover:bg-[#252525]",
    ghost: "text-muted-foreground hover:text-foreground hover:bg-[#1E1E1E]",
    outline: "border border-[#FF6B00] text-[#FF6B00] hover:bg-[#FF6B00]/10",
    danger: "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20",
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${full ? "w-full" : ""} ${className}`}
      onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function Input({ label, type = "text", placeholder, icon, value, onChange }: {
  label?: string; type?: string; placeholder?: string; icon?: React.ReactNode;
  value?: string; onChange?: (v: string) => void;
}) {
  const [showPw, setShowPw] = useState(false);
  const inputType = type === "password" ? (showPw ? "text" : "password") : type;
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</div>}
        <input type={inputType} placeholder={placeholder} value={value} onChange={e => onChange?.(e.target.value)}
          className={`w-full bg-[#1E1E1E] border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]/20 transition-all ${icon ? "pl-10" : "pl-4"} ${type === "password" ? "pr-10" : "pr-4"} py-3`} />
        {type === "password" && (
          <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPw(!showPw)}>
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-bold text-foreground">{title}</h2>
      {action && <button className="text-xs text-[#FF6B00] font-semibold flex items-center gap-0.5" onClick={onAction}>{action}<ChevronRight size={14} /></button>}
    </div>
  );
}

// ─── PRODUCT CARD ─────────────────────────────────────────────────────────────

function ProductCard({ product, onNavigate, onAddToCart, onToggleWishlist, isWishlisted, compact }: {
  product: Product; onNavigate: (p: Page, id?: number) => void;
  onAddToCart: (p: Product) => void; onToggleWishlist: (id: number) => void;
  isWishlisted: boolean; compact?: boolean;
}) {
  return (
    <div className="bg-card rounded-xl overflow-hidden border border-border hover:border-[rgba(255,107,0,0.35)] transition-all duration-200 group cursor-pointer"
      onClick={() => onNavigate("product", product.id)}>
      <div className={`relative bg-[#1A1A1A] ${compact ? "aspect-[4/3]" : "aspect-square"}`}>
        <img src={`https://images.unsplash.com/${product.image}?w=400&h=400&fit=crop&auto=format`}
          alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        <button className={`absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${isWishlisted ? "bg-[#FF6B00]" : "bg-black/60 hover:bg-black/80"}`}
          onClick={e => { e.stopPropagation(); onToggleWishlist(product.id); }}>
          <Heart size={13} className={isWishlisted ? "fill-white text-white" : "text-white"} />
        </button>
        {product.badge && <div className="absolute top-2.5 left-2.5"><BadgeLabel label={product.badge} /></div>}
      </div>
      <div className="p-3">
        <p className="text-[11px] text-muted-foreground mb-0.5">{product.category}</p>
        <p className="text-sm font-semibold text-foreground leading-snug mb-1.5 truncate">{product.name}</p>
        <div className="flex items-center gap-1.5 mb-2">
          <StarRating rating={product.rating} />
          <span className="text-[11px] text-muted-foreground">({product.reviews.toLocaleString()})</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold text-foreground">${product.price}</span>
            <span className="text-xs text-muted-foreground line-through">${product.originalPrice}</span>
          </div>
          <button className="w-7 h-7 rounded-lg bg-[#FF6B00] flex items-center justify-center hover:bg-[#E05A00] transition-colors"
            onClick={e => { e.stopPropagation(); onAddToCart(product); }}>
            <Plus size={13} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── LAYOUT TOGGLE BUTTON ─────────────────────────────────────────────────────

function LayoutToggle({ mode, onToggle }: { mode: LayoutMode; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="fixed bottom-6 right-4 z-[9999] flex items-center gap-2 bg-[#1A1A1A] border border-[rgba(255,107,0,0.4)] text-foreground text-xs font-semibold px-3.5 py-2.5 rounded-full shadow-xl hover:bg-[#252525] hover:border-[#FF6B00] transition-all duration-200"
      title="Toggle layout mode"
    >
      {mode === "mobile" ? (
        <><Monitor size={14} className="text-[#FF6B00]" /><span>Desktop View</span></>
      ) : (
        <><Smartphone size={14} className="text-[#FF6B00]" /><span>Mobile View</span></>
      )}
    </button>
  );
}

// ─── MOBILE SHELL ─────────────────────────────────────────────────────────────

function MobileBottomNav({ current, onNavigate, cartCount }: { current: Page; onNavigate: (p: Page) => void; cartCount: number }) {
  const items = [
    { icon: Home, label: "Home", page: "home" as Page },
    { icon: Search, label: "Search", page: "search" as Page },
    { icon: ShoppingCart, label: "Cart", page: "cart" as Page, badge: cartCount },
    { icon: Heart, label: "Wishlist", page: "wishlist" as Page },
    { icon: UserIcon, label: "Account", page: "profile" as Page },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#111111] border-t border-border z-40">
      <div className="flex max-w-lg mx-auto">
        {items.map(({ icon: Icon, label, page, badge }) => {
          const active = current === page || (page === "profile" && ["profile","account-settings","address-book","payment-methods","notifications","coupons","loyalty"].includes(current));
          return (
            <button key={page} className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${active ? "text-[#FF6B00]" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => onNavigate(page)}>
              <div className="relative">
                <Icon size={20} />
                {!!badge && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#FF6B00] text-white text-[9px] font-bold rounded-full flex items-center justify-center">{(badge as number) > 9 ? "9+" : badge}</span>}
              </div>
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function MobileTopBar({ title, onBack, actions }: { title: string; onBack?: () => void; actions?: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
      {onBack && (
        <button className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center" onClick={onBack}>
          <ChevronLeft size={18} className="text-foreground" />
        </button>
      )}
      <h1 className="text-base font-bold text-foreground flex-1">{title}</h1>
      {actions}
    </div>
  );
}

// ─── DESKTOP SHELL ────────────────────────────────────────────────────────────

const DESKTOP_NAV = [
  { icon: Home, label: "Home", page: "home" as Page },
  { icon: LayoutGrid, label: "Categories", page: "category" as Page },
  { icon: Search, label: "Search", page: "search" as Page },
  { icon: Package, label: "My Orders", page: "orders" as Page },
  { icon: Heart, label: "Wishlist", page: "wishlist" as Page },
  { icon: ShoppingCart, label: "Cart", page: "cart" as Page },
];

const DESKTOP_BOTTOM_NAV = [
  { icon: UserIcon, label: "Profile", page: "profile" as Page },
  { icon: HelpCircle, label: "Help", page: "help" as Page },
  { icon: Settings, label: "Settings", page: "account-settings" as Page },
];

function DesktopSidebar({ current, onNavigate, cartCount, notifCount, user, onLogout, isAdmin, onAdminAccess, onRevokeAdmin }: {
  current: Page; onNavigate: (p: Page) => void; cartCount: number; notifCount: number;
  user: User | null; onLogout: () => void;
  isAdmin: boolean; onAdminAccess: () => void; onRevokeAdmin: () => void;
}) {
  return (
    <aside className="fixed left-0 top-0 bottom-0 w-56 bg-[#0F0F0F] border-r border-border flex flex-col z-40">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#FF6B00] rounded-xl flex items-center justify-center flex-none">
            <span className="text-white text-[11px] font-black tracking-tight">SW</span>
          </div>
          <span className="text-base font-extrabold text-foreground">ShopWisely</span>
          {isAdmin && (
            <span className="ml-auto text-[9px] bg-[#FF6B00]/15 text-[#FF6B00] border border-[#FF6B00]/25 px-1.5 py-0.5 rounded-md font-bold tracking-wide flex-none">
              ADMIN
            </span>
          )}
        </div>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-semibold px-2 mb-2">Menu</p>
        {DESKTOP_NAV.map(({ icon: Icon, label, page }) => {
          const isActive = current === page;
          const badge = page === "cart" ? cartCount : 0;
          return (
            <button key={page}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left ${isActive ? "bg-[#FF6B00]/15 text-[#FF6B00]" : "text-muted-foreground hover:text-foreground hover:bg-[#1A1A1A]"}`}
              onClick={() => onNavigate(page)}>
              <Icon size={17} />
              <span className="flex-1">{label}</span>
              {badge > 0 && <span className="w-5 h-5 bg-[#FF6B00] text-white text-[10px] font-bold rounded-full flex items-center justify-center">{badge > 9 ? "9+" : badge}</span>}
            </button>
          );
        })}

        {/* Quick Chat — admin only */}
        {isAdmin && (
          <>
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-semibold px-2 mb-2 mt-4">Admin</p>
            <button
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left ${current === "quick-chat" ? "bg-[#FF6B00]/15 text-[#FF6B00]" : "text-muted-foreground hover:text-foreground hover:bg-[#1A1A1A]"}`}
              onClick={() => onNavigate("quick-chat")}>
              <MessageCircle size={17} />
              <span className="flex-1">Quick Chat</span>
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full flex-none" />
            </button>
          </>
        )}
      </nav>

      {/* Bottom Nav */}
      <div className="px-3 py-4 border-t border-border space-y-0.5">
        {DESKTOP_BOTTOM_NAV.map(({ icon: Icon, label, page }) => {
          const isActive = current === page;
          return (
            <button key={page}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left ${isActive ? "bg-[#FF6B00]/15 text-[#FF6B00]" : "text-muted-foreground hover:text-foreground hover:bg-[#1A1A1A]"}`}
              onClick={() => onNavigate(page)}>
              <Icon size={17} />
              {label}
            </button>
          );
        })}

        {/* Admin access trigger / revoke */}
        {isAdmin ? (
          <button onClick={onRevokeAdmin}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150 text-left">
            <Shield size={17} />
            Revoke Admin
          </button>
        ) : (
          <button onClick={onAdminAccess}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-[#1A1A1A] transition-all duration-150 text-left">
            <Shield size={17} />
            Admin Access
          </button>
        )}

        {/* User avatar row */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 mt-1">
          <div className="w-7 h-7 rounded-full bg-[#FF6B00]/20 flex items-center justify-center flex-none">
            <span className="text-xs font-bold text-[#FF6B00]">{(user?.name ?? "G")[0].toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{user?.name ?? "Guest"}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
          </div>
          <LogOut size={14} className="text-muted-foreground hover:text-red-400 cursor-pointer transition-colors" onClick={onLogout} />
        </div>
      </div>
    </aside>
  );
}

function DesktopTopBar({ current, onNavigate, cartCount, notifCount }: {
  current: Page; onNavigate: (p: Page) => void; cartCount: number; notifCount: number;
}) {
  const [search, setSearch] = useState("");
  const pageLabel: Partial<Record<Page, string>> = {
    home: "Welcome back, Alex 👋", category: "All Categories", search: "Search",
    product: "Product Details", wishlist: "Wishlist", cart: "Shopping Cart",
    orders: "My Orders", profile: "Profile", help: "Help Center",
    notifications: "Notifications", coupons: "Coupons", loyalty: "Loyalty",
  };
  return (
    <header className="fixed top-0 left-56 right-0 h-14 bg-[#0A0A0A]/95 backdrop-blur-sm border-b border-border flex items-center px-6 gap-4 z-30">
      <h1 className="text-sm font-bold text-foreground flex-none">{pageLabel[current] || "ShopWisely"}</h1>
      {/* Search */}
      <div className="flex-1 max-w-sm relative mx-auto">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} onFocus={() => onNavigate("search")}
          placeholder="Search products, brands..."
          className="w-full bg-[#1A1A1A] border border-border rounded-xl pl-8 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#FF6B00] transition-all" />
      </div>
      <div className="flex items-center gap-2 flex-none">
        <button className="relative w-8 h-8 rounded-xl bg-[#1A1A1A] border border-border flex items-center justify-center hover:border-[rgba(255,107,0,0.4)] transition-colors"
          onClick={() => onNavigate("notifications")}>
          <Bell size={15} className="text-muted-foreground" />
          {notifCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-[#FF6B00] rounded-full" />}
        </button>
        <button className="relative w-8 h-8 rounded-xl bg-[#1A1A1A] border border-border flex items-center justify-center hover:border-[rgba(255,107,0,0.4)] transition-colors"
          onClick={() => onNavigate("cart")}>
          <ShoppingCart size={15} className="text-muted-foreground" />
          {cartCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#FF6B00] text-white text-[9px] font-bold rounded-full flex items-center justify-center">{cartCount > 9 ? "9+" : cartCount}</span>}
        </button>
      </div>
    </header>
  );
}

// Content wrapper for desktop (offsets sidebar + top bar)
function DesktopContent({ children }: { children: React.ReactNode }) {
  return (
    <main className="ml-56 mt-14 min-h-screen bg-background">
      {children}
    </main>
  );
}

// ─── ADMIN ACCESS MODAL ───────────────────────────────────────────────────────

function AdminAccessModal({ onClose, onGrantAccess }: { onClose: () => void; onGrantAccess: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [inputCode, setInputCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [countdown, setCountdown] = useState(0);

  // Countdown timer for code expiry
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  const requestCode = async () => {
    setLoading(true);
    setCodeError("");
    try {
      const data = await api.admin.requestCode();
      setCountdown(data.expiresIn);
      setStep(2);
    } catch (e: any) {
      setCodeError(e.message ?? "Failed to send email. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (inputCode.length !== 6) return;
    setLoading(true);
    setCodeError("");
    try {
      const data = await api.admin.verifyCode(inputCode);
      if (data.valid) {
        onGrantAccess();
        onClose();
      } else {
        setCodeError(data.error ?? "Incorrect code.");
      }
    } catch (e: any) {
      setCodeError(e.message ?? "Verification failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const mmss = `${String(Math.floor(countdown / 60)).padStart(2, "0")}:${String(countdown % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm overflow-hidden">
        {step === 1 ? (
          <div className="p-6">
            <div className="w-12 h-12 bg-[#FF6B00]/15 rounded-xl flex items-center justify-center mb-4">
              <Shield size={22} className="text-[#FF6B00]" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-1">Admin Access</h2>
            <p className="text-sm text-muted-foreground mb-6">Are you an authorized admin for ShopWisely?</p>
            {codeError && <p className="text-xs text-red-400 mb-3">{codeError}</p>}
            <div className="flex gap-3">
              <button onClick={onClose} disabled={loading}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-[#1A1A1A] transition-colors disabled:opacity-50">
                No
              </button>
              <button onClick={requestCode} disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-[#FF6B00] text-white text-sm font-semibold hover:bg-[#E05F00] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <RefreshCw size={14} className="animate-spin" /> : null}
                {loading ? "Sending…" : "Yes, I am"}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="w-12 h-12 bg-[#FF6B00]/15 rounded-xl flex items-center justify-center mb-4">
              <KeyRound size={22} className="text-[#FF6B00]" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-1">Check Your Email</h2>
            <p className="text-sm text-muted-foreground mb-4">A 6-digit code was sent to the admin email address. Enter it below to continue.</p>

            {/* Email sent confirmation */}
            <div className="bg-[#0F0F0F] border border-border rounded-xl p-4 mb-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#FF6B00]/15 flex items-center justify-center flex-none">
                <Mail size={15} className="text-[#FF6B00]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">Code sent successfully</p>
                <p className="text-[11px] text-muted-foreground">j***@gmail.com</p>
              </div>
              {countdown > 0 ? (
                <span className="text-[11px] font-semibold text-[#FF6B00] flex-none">{mmss}</span>
              ) : (
                <span className="text-[11px] text-red-400 flex-none">Expired</span>
              )}
            </div>

            <input
              value={inputCode}
              onChange={e => { setInputCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setCodeError(""); }}
              onKeyDown={e => e.key === "Enter" && handleVerify()}
              placeholder="Enter 6-digit code"
              className="w-full bg-[#1A1A1A] border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#FF6B00] text-center tracking-[0.3em] transition-all"
            />
            {codeError && <p className="text-xs text-red-400 mt-2 text-center">{codeError}</p>}
            {countdown === 0 && (
              <button onClick={requestCode} disabled={loading}
                className="w-full py-2 text-xs text-[#FF6B00] hover:text-[#E05F00] transition-colors flex items-center justify-center gap-1.5 mb-1">
                <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
                Resend code
              </button>
            )}
            <div className="flex gap-3 mt-2">
              <button onClick={() => { setStep(1); setInputCode(""); setCodeError(""); }} disabled={loading}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-[#1A1A1A] transition-colors disabled:opacity-50">
                Back
              </button>
              <button onClick={handleVerify} disabled={inputCode.length !== 6 || loading || countdown === 0}
                className="flex-1 py-2.5 rounded-xl bg-[#FF6B00] text-white text-sm font-semibold hover:bg-[#E05F00] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {loading ? <RefreshCw size={14} className="animate-spin" /> : null}
                {loading ? "Verifying…" : "Verify"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PAGE COMPONENTS ──────────────────────────────────────────────────────────

interface SharedProps {
  onNavigate: (p: Page, id?: number) => void;
  onAddToCart: (p: Product) => void;
  onToggleWishlist: (id: number) => void;
  wishlist: number[];
}

// ── HOME PAGE ─────────────────────────────────────────────────────────────────

function MobileHomePage({ onNavigate, onAddToCart, onToggleWishlist, wishlist, cartCount, userName }: SharedProps & { cartCount: number; userName: string }) {
  const [activeBanner, setActiveBanner] = useState(0);
  const banners = [
    { bg: "from-[#FF6B00] to-[#FF3D00]", title: "New Season", subtitle: "Up to 50% off selected styles" },
    { bg: "from-blue-600 to-blue-900", title: "Premium Picks", subtitle: "Curated just for you" },
    { bg: "from-purple-700 to-purple-900", title: "Flash Sale", subtitle: "Today only — don't miss out" },
  ];

  return (
    <div className="pb-24 min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-muted-foreground">Good morning,</p>
            <h1 className="text-lg font-extrabold text-foreground leading-none">{userName} 👋</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative w-9 h-9 rounded-xl bg-muted flex items-center justify-center" onClick={() => onNavigate("notifications")}>
              <Bell size={18} className="text-foreground" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#FF6B00] rounded-full" />
            </button>
            <button className="w-9 h-9 rounded-xl overflow-hidden" onClick={() => onNavigate("profile")}>
              <img src="/imports/02d558c3-fe14-4e79-9729-0f12abdbac14.jpg" alt="Avatar" className="w-full h-full object-cover" />
            </button>
          </div>
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input onFocus={() => onNavigate("search")} placeholder="Search products, brands..."
            className="w-full bg-[#1E1E1E] border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#FF6B00]" />
        </div>
      </div>

      <div className="px-4 pt-4 space-y-6">
        {/* Hero Banner */}
        <div>
          <div className={`bg-gradient-to-br ${banners[activeBanner].bg} rounded-2xl p-5 h-36 relative overflow-hidden`}>
            <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide">Limited Time</span>
            <h2 className="text-2xl font-extrabold text-white mt-2 leading-none">{banners[activeBanner].title}</h2>
            <p className="text-white/80 text-sm mt-1">{banners[activeBanner].subtitle}</p>
            <button className="absolute bottom-4 left-5 bg-white text-[#111] text-xs font-bold px-3 py-1.5 rounded-lg" onClick={() => onNavigate("category")}>Shop Now</button>
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full" />
          </div>
          <div className="flex gap-1.5 justify-center mt-2.5">
            {banners.map((_, i) => (
              <button key={i} className={`h-1.5 rounded-full transition-all ${i === activeBanner ? "w-5 bg-[#FF6B00]" : "w-1.5 bg-[#2A2A2A]"}`} onClick={() => setActiveBanner(i)} />
            ))}
          </div>
        </div>

        {/* Categories */}
        <div>
          <SectionHeader title="Browse Categories" action="See All" onAction={() => onNavigate("category")} />
          <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {[{ label: "Shoes", img: "photo-1542291026-7eec264c27ff" }, { label: "Bags", img: "photo-1548036328-c9fa89d128fa" }, { label: "Watches", img: "photo-1523275335684-37898b6baf30" }, { label: "Tops", img: "photo-1576566588028-4147f3842f27" }, { label: "Glasses", img: "photo-1572635196237-14b3f281503f" }].map(cat => (
              <button key={cat.label} className="flex-none flex flex-col items-center gap-2" onClick={() => onNavigate("category")}>
                <div className="w-16 h-16 rounded-2xl bg-[#1A1A1A] overflow-hidden border border-border">
                  <img src={`https://images.unsplash.com/${cat.img}?w=80&h=80&fit=crop&auto=format`} alt={cat.label} className="w-full h-full object-cover" />
                </div>
                <span className="text-xs text-muted-foreground font-medium">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Promo row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-border rounded-2xl p-4">
            <Zap size={18} className="text-[#FF6B00] mb-2" />
            <p className="text-xs text-muted-foreground">Flash Deal</p>
            <p className="text-sm font-bold text-foreground">Ends in 3:42:15</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <Gift size={18} className="text-purple-400 mb-2" />
            <p className="text-xs text-muted-foreground">Vouchers</p>
            <p className="text-sm font-bold text-foreground">12 Available</p>
          </div>
        </div>

        {/* Featured */}
        <div>
          <SectionHeader title="Featured Products" action="View All" onAction={() => onNavigate("category")} />
          <div className="grid grid-cols-2 gap-3">
            {PRODUCTS.slice(0, 4).map(p => (
              <ProductCard key={p.id} product={p} onNavigate={onNavigate} onAddToCart={onAddToCart} onToggleWishlist={onToggleWishlist} isWishlisted={wishlist.includes(p.id)} />
            ))}
          </div>
        </div>

        {/* Trending list */}
        <div>
          <SectionHeader title="Trending Now" action="See More" onAction={() => onNavigate("category")} />
          <div className="space-y-3">
            {PRODUCTS.slice(4).map(p => (
              <div key={p.id} className="flex gap-3 bg-card rounded-xl p-3 border border-border cursor-pointer hover:border-[rgba(255,107,0,0.3)] transition-colors" onClick={() => onNavigate("product", p.id)}>
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#1A1A1A] flex-none">
                  <img src={`https://images.unsplash.com/${p.image}?w=80&h=80&fit=crop&auto=format`} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{p.category}</p>
                  <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                  <StarRating rating={p.rating} size={10} />
                </div>
                <div className="flex flex-col items-end justify-between flex-none">
                  <button onClick={e => { e.stopPropagation(); onToggleWishlist(p.id); }}>
                    <Heart size={13} className={wishlist.includes(p.id) ? "fill-[#FF6B00] text-[#FF6B00]" : "text-muted-foreground"} />
                  </button>
                  <span className="text-sm font-bold text-foreground">${p.price}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DesktopHomePage({ onNavigate, onAddToCart, onToggleWishlist, wishlist }: SharedProps) {
  const [activeCategory, setActiveCategory] = useState("All");
  const filtered = activeCategory === "All" ? PRODUCTS : PRODUCTS.filter(p => p.category === activeCategory);

  return (
    <div className="p-8 space-y-8">
      {/* Hero + Stats Row */}
      <div className="grid grid-cols-3 gap-5">
        {/* Main Hero */}
        <div className="col-span-2 bg-gradient-to-br from-[#FF6B00] to-[#C84B00] rounded-2xl p-8 relative overflow-hidden min-h-[200px] flex flex-col justify-between">
          <div>
            <span className="text-xs bg-white/20 text-white px-3 py-1 rounded-full font-semibold uppercase tracking-wide">New Season</span>
            <h2 className="text-4xl font-extrabold text-white mt-4 leading-tight">Up to 50% off<br />selected styles</h2>
            <p className="text-white/75 mt-2 text-sm">Free shipping on orders over $100</p>
          </div>
          <Btn variant="secondary" className="self-start !bg-white !text-[#111] !border-transparent hover:!bg-gray-100" onClick={() => onNavigate("category")}>
            Shop the Sale
          </Btn>
          <div className="absolute -right-10 -top-10 w-48 h-48 bg-white/10 rounded-full" />
          <div className="absolute right-8 bottom-0 w-32 h-32 bg-white/5 rounded-full" />
        </div>

        {/* Stats Column */}
        <div className="flex flex-col gap-4">
          {[
            { icon: Package, label: "Active Orders", value: "3", color: "text-blue-400", bg: "bg-blue-400/10" },
            { icon: Gift, label: "Vouchers Ready", value: "12", color: "text-[#FF6B00]", bg: "bg-[#FF6B00]/10" },
            { icon: Award, label: "Loyalty Points", value: "2,450", color: "text-yellow-400", bg: "bg-yellow-400/10" },
          ].map(stat => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="flex-1 bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center flex-none`}>
                  <Icon size={18} className={stat.color} />
                </div>
                <div>
                  <p className="text-xl font-extrabold text-foreground leading-none">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Categories Bar */}
      <div>
        <SectionHeader title="Browse by Category" action="View All" onAction={() => onNavigate("category")} />
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(cat => (
            <button key={cat}
              className={`text-xs font-semibold px-4 py-2 rounded-full border transition-all ${activeCategory === cat ? "bg-[#FF6B00] text-white border-[#FF6B00]" : "border-border text-muted-foreground hover:border-[rgba(255,107,0,0.4)] hover:text-foreground"}`}
              onClick={() => setActiveCategory(cat)}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div>
        <SectionHeader title={activeCategory === "All" ? "All Products" : activeCategory} action="See More" onAction={() => onNavigate("category")} />
        <div className="grid grid-cols-4 gap-4">
          {filtered.map(p => (
            <ProductCard key={p.id} product={p} onNavigate={onNavigate} onAddToCart={onAddToCart}
              onToggleWishlist={onToggleWishlist} isWishlisted={wishlist.includes(p.id)} compact />
          ))}
        </div>
      </div>

      {/* Bottom Promo Banner */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Zap, title: "Flash Deal", sub: "Ends in 3:42:15", color: "text-[#FF6B00]", bg: "bg-[#FF6B00]/10 border-[#FF6B00]/20" },
          { icon: Truck, title: "Free Shipping", sub: "On orders over $100", color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
          { icon: RotateCcw, title: "Easy Returns", sub: "30-day hassle-free returns", color: "text-green-400", bg: "bg-green-400/10 border-green-400/20" },
        ].map(item => {
          const Icon = item.icon;
          return (
            <div key={item.title} className={`border rounded-2xl p-5 flex items-center gap-4 ${item.bg}`}>
              <Icon size={22} className={item.color} />
              <div>
                <p className="text-sm font-bold text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.sub}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── OTHER PAGES (shared between mobile/desktop, width adapts via container) ────

function CategoryPage({ onNavigate, onAddToCart, onToggleWishlist, wishlist, isDesktop, onBack }: SharedProps & { isDesktop: boolean; onBack: () => void }) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showFilter, setShowFilter] = useState(false);
  const filtered = activeCategory === "All" ? PRODUCTS : PRODUCTS.filter(p => p.category === activeCategory);

  const cols = isDesktop ? "grid-cols-4" : "grid-cols-2";

  return (
    <div className={`${isDesktop ? "p-8" : "pb-24"} min-h-screen bg-background`}>
      {!isDesktop && (
        <MobileTopBar title="All Products" onBack={onBack}
          actions={
            <div className="flex gap-2">
              <button className={`w-8 h-8 rounded-lg flex items-center justify-center ${viewMode === "grid" ? "bg-[#FF6B00] text-white" : "bg-muted text-muted-foreground"}`} onClick={() => setViewMode("grid")}><Grid size={15} /></button>
              <button className={`w-8 h-8 rounded-lg flex items-center justify-center ${viewMode === "list" ? "bg-[#FF6B00] text-white" : "bg-muted text-muted-foreground"}`} onClick={() => setViewMode("list")}><List size={15} /></button>
            </div>
          } />
      )}
      <div className={isDesktop ? "" : "px-4 pt-4"}>
        {isDesktop && (
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-extrabold text-foreground">All Products</h2>
              <p className="text-muted-foreground text-sm mt-0.5">{filtered.length} items available</p>
            </div>
            <div className="flex gap-2">
              <button className={`w-9 h-9 rounded-xl flex items-center justify-center border ${viewMode === "grid" ? "bg-[#FF6B00] text-white border-[#FF6B00]" : "border-border text-muted-foreground"}`} onClick={() => setViewMode("grid")}><Grid size={16} /></button>
              <button className={`w-9 h-9 rounded-xl flex items-center justify-center border ${viewMode === "list" ? "bg-[#FF6B00] text-white border-[#FF6B00]" : "border-border text-muted-foreground"}`} onClick={() => setViewMode("list")}><List size={16} /></button>
            </div>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-3 mb-4" style={{ scrollbarWidth: "none" }}>
          {CATEGORIES.map(cat => (
            <button key={cat} className={`flex-none text-xs font-semibold px-3.5 py-2 rounded-full border transition-all ${activeCategory === cat ? "bg-[#FF6B00] text-white border-[#FF6B00]" : "border-border text-muted-foreground hover:border-[rgba(255,107,0,0.4)]"}`}
              onClick={() => setActiveCategory(cat)}>{cat}</button>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-4">
          <button className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-3 py-2 rounded-lg" onClick={() => setShowFilter(!showFilter)}>
            <Filter size={13} /> Filters
          </button>
          <span className="text-xs text-muted-foreground">{filtered.length} products</span>
        </div>

        {showFilter && (
          <div className="bg-card border border-border rounded-xl p-4 mb-4">
            <p className="text-sm font-semibold mb-3">Price Range</p>
            <div className="flex gap-2 flex-wrap">
              {["Under $50", "$50–$100", "$100–$200", "$200+"].map(r => (
                <button key={r} className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:border-[#FF6B00] hover:text-[#FF6B00]">{r}</button>
              ))}
            </div>
          </div>
        )}

        {viewMode === "grid" ? (
          <div className={`grid ${cols} gap-4`}>
            {filtered.map(p => (
              <ProductCard key={p.id} product={p} onNavigate={onNavigate} onAddToCart={onAddToCart}
                onToggleWishlist={onToggleWishlist} isWishlisted={wishlist.includes(p.id)} compact={isDesktop} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(p => (
              <div key={p.id} className="flex gap-4 bg-card rounded-xl p-4 border border-border cursor-pointer hover:border-[rgba(255,107,0,0.3)]" onClick={() => onNavigate("product", p.id)}>
                <div className={`${isDesktop ? "w-24 h-24" : "w-20 h-20"} rounded-xl overflow-hidden bg-[#1A1A1A] flex-none`}>
                  <img src={`https://images.unsplash.com/${p.image}?w=120&h=120&fit=crop&auto=format`} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{p.category}</p>
                  <p className={`font-semibold text-foreground ${isDesktop ? "text-base" : "text-sm"}`}>{p.name}</p>
                  <StarRating rating={p.rating} size={isDesktop ? 13 : 11} />
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-base font-bold">${p.price}</span>
                      <span className="text-xs text-muted-foreground line-through">${p.originalPrice}</span>
                    </div>
                    <Btn size="sm" onClick={() => onAddToCart(p)}>Add to Cart</Btn>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SearchPage({ onNavigate, onAddToCart, onToggleWishlist, wishlist, isDesktop }: SharedProps & { isDesktop: boolean }) {
  const [query, setQuery] = useState("");
  const recent = ["Air Jordan", "Leather Jacket", "Minimal Watch", "Canvas Bag"];
  const trending = ["Ultra Boost", "Sunglasses", "Chinos", "Wool Sweater"];
  const results = query ? PRODUCTS.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) || p.category.toLowerCase().includes(query.toLowerCase())) : [];

  return (
    <div className={`${isDesktop ? "p-8" : "pb-24"} min-h-screen bg-background`}>
      {!isDesktop && (
        <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-sm border-b border-border px-4 py-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={e => setQuery(e.target.value)} autoFocus placeholder="Search products..."
              className="w-full bg-[#1E1E1E] border border-border rounded-xl pl-9 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#FF6B00]" />
            {query && <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setQuery("")}><X size={15} className="text-muted-foreground" /></button>}
          </div>
        </div>
      )}
      <div className={isDesktop ? "" : "px-4 pt-4"}>
        {isDesktop && (
          <div className="mb-6">
            <h2 className="text-2xl font-extrabold text-foreground mb-4">Search</h2>
            <div className="relative max-w-lg">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={query} onChange={e => setQuery(e.target.value)} autoFocus placeholder="Search products, brands, categories..."
                className="w-full bg-[#1A1A1A] border border-border rounded-2xl pl-11 pr-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#FF6B00]" />
              {query && <button className="absolute right-4 top-1/2 -translate-y-1/2" onClick={() => setQuery("")}><X size={15} className="text-muted-foreground" /></button>}
            </div>
          </div>
        )}

        {!query ? (
          <div className={isDesktop ? "grid grid-cols-2 gap-8" : "space-y-6"}>
            <div>
              <p className="text-sm font-semibold text-foreground mb-3">Recent Searches</p>
              <div className="flex flex-wrap gap-2">
                {recent.map(r => (
                  <button key={r} className="flex items-center gap-1.5 text-xs bg-muted px-3 py-1.5 rounded-full text-muted-foreground hover:text-foreground" onClick={() => setQuery(r)}>
                    <Clock size={11} /> {r}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground mb-3">Trending</p>
              <div className="flex flex-wrap gap-2">
                {trending.map(r => (
                  <button key={r} className="flex items-center gap-1.5 text-xs bg-[#FF6B00]/10 px-3 py-1.5 rounded-full text-[#FF6B00] border border-[#FF6B00]/20" onClick={() => setQuery(r)}>
                    <TrendingUp size={11} /> {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-4">{results.length} results for "{query}"</p>
            <div className={`grid ${isDesktop ? "grid-cols-4" : "grid-cols-2"} gap-4`}>
              {results.map(p => (
                <ProductCard key={p.id} product={p} onNavigate={onNavigate} onAddToCart={onAddToCart}
                  onToggleWishlist={onToggleWishlist} isWishlisted={wishlist.includes(p.id)} compact={isDesktop} />
              ))}
            </div>
            {results.length === 0 && (
              <div className="text-center py-20">
                <Search size={40} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-foreground font-semibold">No results found</p>
                <p className="text-muted-foreground text-sm mt-1">Try different keywords</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ProductPage({ productId, onNavigate, onAddToCart, onToggleWishlist, wishlist, isDesktop }: SharedProps & { productId: number; isDesktop: boolean }) {
  const product = PRODUCTS.find(p => p.id === productId) || PRODUCTS[0];
  const [qty, setQty] = useState(1);
  const [selectedColor, setSelectedColor] = useState("Black");
  const [selectedSize, setSelectedSize] = useState("M");
  const [activeTab, setActiveTab] = useState<"desc" | "reviews">("desc");
  const colors = ["Black", "White", "Tan", "Navy"];
  const sizes = ["XS", "S", "M", "L", "XL", "XXL"];
  const discount = Math.round((1 - product.price / product.originalPrice) * 100);
  const onBack = () => onNavigate("category");

  const content = (
    <div className="space-y-5 pb-28">
      {/* Colors */}
      <div>
        <p className="text-sm font-semibold mb-2.5">Color: <span className="text-[#FF6B00]">{selectedColor}</span></p>
        <div className="flex gap-2 flex-wrap">
          {colors.map(c => (
            <button key={c} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${selectedColor === c ? "border-[#FF6B00] bg-[#FF6B00]/10 text-[#FF6B00]" : "border-border text-muted-foreground"}`}
              onClick={() => setSelectedColor(c)}>{c}</button>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-sm font-semibold">Size: <span className="text-[#FF6B00]">{selectedSize}</span></p>
          <button className="text-xs text-muted-foreground underline">Size Guide</button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {sizes.map(s => (
            <button key={s} className={`w-12 h-10 rounded-xl text-sm font-semibold border transition-all ${selectedSize === s ? "border-[#FF6B00] bg-[#FF6B00] text-white" : "border-border text-muted-foreground"}`}
              onClick={() => setSelectedSize(s)}>{s}</button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Quantity</p>
        <div className="flex items-center gap-3 bg-muted rounded-xl p-1">
          <button className="w-8 h-8 rounded-lg bg-card flex items-center justify-center" onClick={() => setQty(Math.max(1, qty - 1))}><Minus size={14} /></button>
          <span className="text-sm font-bold w-5 text-center">{qty}</span>
          <button className="w-8 h-8 rounded-lg bg-card flex items-center justify-center" onClick={() => setQty(qty + 1)}><Plus size={14} /></button>
        </div>
      </div>
      <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2.5">
        <CheckCircle size={15} className="text-green-400" />
        <p className="text-sm text-green-400 font-medium">In Stock — 23 items left</p>
      </div>
      <div>
        <div className="flex border-b border-border">
          {(["desc", "reviews"] as const).map(tab => (
            <button key={tab} className={`flex-1 py-2.5 text-sm font-semibold border-b-2 transition-colors ${activeTab === tab ? "border-[#FF6B00] text-[#FF6B00]" : "border-transparent text-muted-foreground"}`}
              onClick={() => setActiveTab(tab)}>{tab === "desc" ? "Description" : "Reviews"}</button>
          ))}
        </div>
        <div className="py-4">
          {activeTab === "desc" ? (
            <p className="text-sm text-muted-foreground leading-relaxed">Crafted with premium materials and meticulous attention to detail, the {product.name} delivers unmatched style and comfort. Sustainably sourced materials ensure both quality and conscience.</p>
          ) : (
            <div className="space-y-4">
              {[{ name: "Sarah M.", rating: 5, text: "Absolutely love this! True to size.", date: "3 days ago" }, { name: "James K.", rating: 4, text: "Great quality. Would buy again.", date: "1 week ago" }].map((r, i) => (
                <div key={i} className="border-b border-border pb-4 last:border-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#FF6B00]/20 flex items-center justify-center"><span className="text-xs font-bold text-[#FF6B00]">{r.name[0]}</span></div>
                      <span className="text-sm font-semibold text-foreground">{r.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{r.date}</span>
                  </div>
                  <StarRating rating={r.rating} size={11} />
                  <p className="text-xs text-muted-foreground mt-1">{r.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <Btn variant="secondary" onClick={() => onNavigate("cart")}><ShoppingCart size={16} /></Btn>
        <Btn full size="lg" onClick={() => { onAddToCart(product); onNavigate("cart"); }}>
          Add to Cart — ${(product.price * qty).toFixed(2)}
        </Btn>
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <div className="p-8 min-h-screen bg-background">
        <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6" onClick={onBack}>
          <ChevronLeft size={16} /> Back to Products
        </button>
        <div className="grid grid-cols-2 gap-10 max-w-5xl">
          {/* Left: Image */}
          <div>
            <div className="aspect-square rounded-2xl overflow-hidden bg-[#1A1A1A] relative">
              <img src={`https://images.unsplash.com/${product.image}?w=600&h=600&fit=crop&auto=format`} alt={product.name} className="w-full h-full object-cover" />
              {discount > 0 && <div className="absolute top-4 left-4 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-lg">-{discount}%</div>}
              <button className={`absolute top-4 right-4 w-10 h-10 rounded-xl flex items-center justify-center ${wishlist.includes(product.id) ? "bg-[#FF6B00]" : "bg-black/60"}`}
                onClick={() => onToggleWishlist(product.id)}>
                <Heart size={16} className={wishlist.includes(product.id) ? "fill-white text-white" : "text-white"} />
              </button>
            </div>
          </div>
          {/* Right: Details */}
          <div>
            <p className="text-xs text-[#FF6B00] font-semibold uppercase tracking-wide mb-1">{product.category}</p>
            <h1 className="text-3xl font-extrabold text-foreground">{product.name}</h1>
            <div className="flex items-center gap-3 mt-2 mb-4">
              <StarRating rating={product.rating} size={14} />
              <span className="text-sm text-muted-foreground">{product.rating} ({product.reviews.toLocaleString()} reviews)</span>
            </div>
            <div className="flex items-baseline gap-3 mb-6">
              <span className="text-3xl font-extrabold text-foreground">${product.price}</span>
              <span className="text-lg text-muted-foreground line-through">${product.originalPrice}</span>
              <span className="text-sm text-red-400 font-semibold">Save ${(product.originalPrice - product.price).toFixed(2)}</span>
            </div>
            {content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 min-h-screen bg-background">
      <div className="relative h-80 bg-[#1A1A1A]">
        <img src={`https://images.unsplash.com/${product.image}?w=600&h=500&fit=crop&auto=format`} alt={product.name} className="w-full h-full object-cover" />
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 pt-8">
          <button className="w-9 h-9 rounded-xl bg-black/60 flex items-center justify-center" onClick={onBack}><ChevronLeft size={18} className="text-white" /></button>
          <button className={`w-9 h-9 rounded-xl flex items-center justify-center ${wishlist.includes(product.id) ? "bg-[#FF6B00]" : "bg-black/60"}`} onClick={() => onToggleWishlist(product.id)}>
            <Heart size={15} className={wishlist.includes(product.id) ? "fill-white text-white" : "text-white"} />
          </button>
        </div>
        {discount > 0 && <div className="absolute top-20 left-4 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded">-{discount}%</div>}
      </div>
      <div className="px-4 pt-4">
        <p className="text-xs text-[#FF6B00] font-semibold uppercase tracking-wide">{product.category}</p>
        <h1 className="text-xl font-extrabold text-foreground mt-0.5">{product.name}</h1>
        <div className="flex items-center gap-3 mt-2">
          <StarRating rating={product.rating} size={13} />
          <span className="text-sm text-muted-foreground">{product.rating} ({product.reviews.toLocaleString()} reviews)</span>
        </div>
        <div className="flex items-baseline gap-2 mt-3 mb-5">
          <span className="text-2xl font-extrabold text-foreground">${product.price}</span>
          <span className="text-base text-muted-foreground line-through">${product.originalPrice}</span>
        </div>
        {content}
      </div>
    </div>
  );
}

// ── SIMPLE SHARED PAGES ───────────────────────────────────────────────────────

function WishlistPage({ onNavigate, wishlist, onToggleWishlist, onAddToCart, isDesktop }: SharedProps & { isDesktop: boolean }) {
  const items = PRODUCTS.filter(p => wishlist.includes(p.id));
  return (
    <div className={`${isDesktop ? "p-8" : "pb-24"} min-h-screen bg-background`}>
      {!isDesktop && <MobileTopBar title={`Wishlist (${items.length})`} onBack={() => onNavigate("home")} />}
      <div className={isDesktop ? "" : "px-4 pt-4"}>
        {isDesktop && <h2 className="text-2xl font-extrabold text-foreground mb-6">Wishlist ({items.length})</h2>}
        {items.length === 0 ? (
          <div className="text-center py-20">
            <Heart size={48} className="text-muted-foreground mx-auto mb-4" />
            <p className="text-foreground font-semibold text-lg">Your wishlist is empty</p>
            <p className="text-muted-foreground text-sm mt-1 mb-6">Save items you love by tapping the heart</p>
            <Btn onClick={() => onNavigate("category")}>Browse Products</Btn>
          </div>
        ) : (
          <div className={`grid ${isDesktop ? "grid-cols-4" : "grid-cols-2"} gap-4`}>
            {items.map(p => (
              <ProductCard key={p.id} product={p} onNavigate={onNavigate} onAddToCart={onAddToCart}
                onToggleWishlist={onToggleWishlist} isWishlisted compact={isDesktop} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CartPage({ onNavigate, cart, onUpdateQty, onRemove, isDesktop }: {
  onNavigate: (p: Page) => void; cart: CartItem[]; onUpdateQty: (id: number, qty: number) => void;
  onRemove: (id: number) => void; isDesktop: boolean;
}) {
  const [voucher, setVoucher] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState("");
  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const discount = appliedVoucher ? subtotal * 0.1 : 0;
  const shipping = subtotal > 100 ? 0 : 9.99;
  const total = subtotal - discount + shipping;

  const cartItems = (
    <div className="space-y-3">
      {cart.map(item => (
        <div key={item.id} className="bg-card border border-border rounded-xl p-3 flex gap-3">
          <div className="w-20 h-20 rounded-xl overflow-hidden bg-[#1A1A1A] flex-none">
            <img src={`https://images.unsplash.com/${item.image}?w=100&h=100&fit=crop&auto=format`} alt={item.name} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{item.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{item.color} · Size {item.size}</p>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2 bg-muted rounded-lg p-0.5">
                <button className="w-6 h-6 rounded-md bg-card flex items-center justify-center" onClick={() => onUpdateQty(item.id, item.qty - 1)}><Minus size={11} /></button>
                <span className="text-xs font-bold w-4 text-center">{item.qty}</span>
                <button className="w-6 h-6 rounded-md bg-card flex items-center justify-center" onClick={() => onUpdateQty(item.id, item.qty + 1)}><Plus size={11} /></button>
              </div>
              <span className="text-sm font-bold">${(item.price * item.qty).toFixed(2)}</span>
            </div>
          </div>
          <button className="self-start p-1 text-muted-foreground hover:text-red-400" onClick={() => onRemove(item.id)}><X size={15} /></button>
        </div>
      ))}
    </div>
  );

  const summary = (
    <div className="bg-card border border-border rounded-xl p-4 space-y-2.5">
      <p className="text-sm font-bold text-foreground mb-3">Order Summary</p>
      <div className="flex gap-2 mb-3">
        <input value={voucher} onChange={e => setVoucher(e.target.value.toUpperCase())} placeholder="Voucher code"
          className="flex-1 bg-[#1E1E1E] border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#FF6B00]" />
        <Btn size="sm" onClick={() => { if (voucher) setAppliedVoucher(voucher); }}>Apply</Btn>
      </div>
      {appliedVoucher && <p className="text-xs text-green-400 flex items-center gap-1"><CheckCircle size={11} />Code applied — 10% off!</p>}
      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
      {discount > 0 && <div className="flex justify-between text-sm"><span className="text-green-400">Discount</span><span className="text-green-400">-${discount.toFixed(2)}</span></div>}
      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Shipping</span><span className={shipping === 0 ? "text-green-400" : ""}>{shipping === 0 ? "FREE" : `$${shipping.toFixed(2)}`}</span></div>
      <div className="border-t border-border pt-2.5 flex justify-between font-bold">
        <span>Total</span><span className="text-[#FF6B00] text-base">${total.toFixed(2)}</span>
      </div>
      <Btn full size="lg" onClick={() => onNavigate("shipping-addr")} className="mt-3">Proceed to Checkout <ChevronRight size={16} /></Btn>
    </div>
  );

  return (
    <div className={`${isDesktop ? "p-8" : "pb-24"} min-h-screen bg-background`}>
      {!isDesktop && <MobileTopBar title={`Cart (${cart.length})`} onBack={() => onNavigate("home")} />}
      <div className={isDesktop ? "" : "px-4 pt-4"}>
        {isDesktop && <h2 className="text-2xl font-extrabold text-foreground mb-6">Shopping Cart ({cart.length})</h2>}
        {cart.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingCart size={48} className="text-muted-foreground mx-auto mb-4" />
            <p className="text-foreground font-semibold text-lg">Your cart is empty</p>
            <p className="text-muted-foreground text-sm mt-1 mb-6">Add items to get started</p>
            <Btn onClick={() => onNavigate("category")}>Start Shopping</Btn>
          </div>
        ) : isDesktop ? (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-3">{cartItems}</div>
            <div>{summary}</div>
          </div>
        ) : (
          <div className="space-y-4">{cartItems}{summary}</div>
        )}
      </div>
    </div>
  );
}

// Generic page shell for secondary pages
function GenericPage({ title, onBack, isDesktop, children }: { title: string; onBack: () => void; isDesktop: boolean; children: React.ReactNode }) {
  return (
    <div className={`${isDesktop ? "p-8" : "pb-24"} min-h-screen bg-background`}>
      {!isDesktop && <MobileTopBar title={title} onBack={onBack} />}
      {isDesktop && (
        <div className="mb-6 flex items-center gap-3">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" onClick={onBack}><ChevronLeft size={16} />Back</button>
          <span className="text-muted-foreground">/</span>
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
        </div>
      )}
      <div className={isDesktop ? "max-w-2xl space-y-4" : "px-4 pt-4 space-y-4"}>{children}</div>
    </div>
  );
}

function NicknamePage({ user, onDone }: { user: User; onDone: (nickname: string) => void }) {
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!nickname.trim()) return;
    setLoading(true);
    try {
      await api.auth.setNickname(user.userId, nickname.trim());
    } catch {}
    onDone(nickname.trim());
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 bg-[#FF6B00] rounded-2xl flex items-center justify-center mb-8 mx-auto">
          <span className="text-white text-lg font-black tracking-tight">SW</span>
        </div>
        <h1 className="text-3xl font-extrabold text-foreground mb-2">What should we call you?</h1>
        <p className="text-muted-foreground text-sm mb-10">Choose a nickname — this is how we'll greet you in the app.</p>

        <div className="mb-6">
          <input
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            placeholder="e.g. Alex, Kai, Sam…"
            maxLength={24}
            autoFocus
            className="w-full bg-[#1E1E1E] border border-border rounded-2xl px-5 py-4 text-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00]/20 text-center font-semibold transition-all"
          />
        </div>

        <Btn full size="lg" onClick={submit} disabled={loading || !nickname.trim()}>
          {loading ? "Saving…" : "Continue"}
        </Btn>

        <button className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => onDone("Guest")}>
          Skip for now
        </button>
      </div>
    </div>
  );
}

function LoginPage({ onNavigate, onLogin }: { onNavigate: (p: Page) => void; onLogin: (user: User, isNew?: boolean) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      const isNew = mode === "register";
      const user = isNew
        ? await api.auth.register(email, name, password)
        : await api.auth.login(email, password);
      onLogin(user, isNew);
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="w-12 h-12 bg-[#FF6B00] rounded-2xl flex items-center justify-center mb-8 mx-auto">
          <span className="text-white text-sm font-black tracking-tight">SW</span>
        </div>
        <h1 className="text-3xl font-extrabold text-foreground text-center mb-1">{mode === "login" ? "Welcome back" : "Create account"}</h1>
        <p className="text-muted-foreground text-sm text-center mb-8">{mode === "login" ? "Sign in to continue shopping" : "Join thousands of happy shoppers"}</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4 mb-6">
          <Input label="Email" type="email" placeholder="you@example.com" icon={<Mail size={15} />} value={email} onChange={setEmail} />
          {mode === "register" && <Input label="Full Name" placeholder="Alex Kim" icon={<UserIcon size={15} />} value={name} onChange={setName} />}
          <Input label="Password" type="password" placeholder="••••••••" icon={<Lock size={15} />} value={password} onChange={setPassword} />
        </div>

        <Btn full size="lg" onClick={submit} disabled={loading || !email || !password || (mode === "register" && !name)}>
          {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
        </Btn>

        <div className="flex items-center gap-3 my-5"><div className="flex-1 h-px bg-border" /><span className="text-xs text-muted-foreground">or</span><div className="flex-1 h-px bg-border" /></div>
        <Btn full variant="ghost" onClick={() => onLogin({ userId: getOrCreateGuestId(), email: "guest@shopwave.com", name: "Guest" })}>
          Continue as Guest
        </Btn>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button className="text-[#FF6B00] font-semibold" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}

// Checkout pages (same for both layouts since they're focused flows)
function CheckoutProgress({ step }: { step: number }) {
  const steps = ["Cart", "Address", "Delivery", "Payment", "Review"];
  return (
    <div className="flex items-center justify-center gap-0 px-4 py-3 bg-background border-b border-border">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < step ? "bg-[#FF6B00] text-white" : i === step ? "border-2 border-[#FF6B00] text-[#FF6B00]" : "bg-muted text-muted-foreground"}`}>
              {i < step ? <Check size={12} /> : i + 1}
            </div>
            <span className={`text-[9px] mt-0.5 ${i === step ? "text-[#FF6B00]" : "text-muted-foreground"}`}>{s}</span>
          </div>
          {i < steps.length - 1 && <div className={`h-px w-8 mx-1 mb-3 ${i < step ? "bg-[#FF6B00]" : "bg-border"}`} />}
        </div>
      ))}
    </div>
  );
}

function ShippingAddrPage({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const [selected, setSelected] = useState(0);
  return (
    <div className="min-h-screen bg-background">
      <CheckoutProgress step={1} />
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-3">
        <h2 className="text-lg font-bold text-foreground mb-4">Shipping Address</h2>
        {[{ name: "Alex Kim", addr: "42 Sunset Boulevard, Apt 8B", city: "Los Angeles, CA 90028", default: true }, { name: "Office", addr: "1500 Market Street, Suite 200", city: "San Francisco, CA 94102", default: false }].map((a, i) => (
          <button key={i} className={`w-full text-left bg-card border rounded-xl p-4 ${selected === i ? "border-[#FF6B00] bg-[#FF6B00]/5" : "border-border"}`} onClick={() => setSelected(i)}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-4 h-4 rounded-full border-2 flex-none ${selected === i ? "bg-[#FF6B00] border-[#FF6B00]" : "border-[#3A3A3A]"}`} />
              <span className="text-sm font-semibold text-foreground">{a.name}</span>
              {a.default && <span className="text-[10px] bg-[#FF6B00]/20 text-[#FF6B00] px-1.5 py-0.5 rounded font-semibold">Default</span>}
            </div>
            <p className="text-xs text-muted-foreground pl-6">{a.addr}, {a.city}</p>
          </button>
        ))}
        <button className="w-full border border-dashed border-border rounded-xl p-4 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:border-[#FF6B00] hover:text-[#FF6B00]">
          <Plus size={16} />Add New Address
        </button>
        <Btn full size="lg" onClick={() => onNavigate("delivery")}>Continue <ChevronRight size={16} /></Btn>
      </div>
    </div>
  );
}

function DeliveryPage({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const [selected, setSelected] = useState(0);
  const methods = [{ name: "Standard Delivery", days: "5–7 business days", price: "Free", icon: Truck }, { name: "Express Delivery", days: "2–3 business days", price: "$9.99", icon: Zap }, { name: "Next Day", days: "Delivered tomorrow", price: "$19.99", icon: Clock }];
  return (
    <div className="min-h-screen bg-background">
      <CheckoutProgress step={2} />
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-3">
        <h2 className="text-lg font-bold text-foreground mb-4">Delivery Method</h2>
        {methods.map((m, i) => {
          const Icon = m.icon;
          return (
            <button key={i} className={`w-full text-left bg-card border rounded-xl p-4 ${selected === i ? "border-[#FF6B00] bg-[#FF6B00]/5" : "border-border"}`} onClick={() => setSelected(i)}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selected === i ? "bg-[#FF6B00] text-white" : "bg-muted text-muted-foreground"}`}><Icon size={18} /></div>
                <div className="flex-1"><p className="text-sm font-semibold text-foreground">{m.name}</p><p className="text-xs text-muted-foreground">{m.days}</p></div>
                <span className={`text-sm font-bold ${m.price === "Free" ? "text-green-400" : ""}`}>{m.price}</span>
              </div>
            </button>
          );
        })}
        <Btn full size="lg" onClick={() => onNavigate("payment")}>Continue <ChevronRight size={16} /></Btn>
      </div>
    </div>
  );
}

function PaymentPage({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const [selected, setSelected] = useState(0);
  const methods = [{ name: "Credit / Debit Card", sub: "Visa, Mastercard, Amex", icon: CreditCard }, { name: "E-Wallet", sub: "PayPal, Apple Pay", icon: Wallet }, { name: "Bank Transfer", sub: "Direct bank payment", icon: Building2 }, { name: "Cash on Delivery", sub: "Pay when you receive", icon: Banknote }];
  return (
    <div className="min-h-screen bg-background">
      <CheckoutProgress step={3} />
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-3">
        <h2 className="text-lg font-bold text-foreground mb-4">Payment Method</h2>
        {methods.map((m, i) => {
          const Icon = m.icon;
          return (
            <button key={i} className={`w-full text-left bg-card border rounded-xl p-4 ${selected === i ? "border-[#FF6B00] bg-[#FF6B00]/5" : "border-border"}`} onClick={() => setSelected(i)}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selected === i ? "bg-[#FF6B00] text-white" : "bg-muted text-muted-foreground"}`}><Icon size={18} /></div>
                <div className="flex-1"><p className="text-sm font-semibold text-foreground">{m.name}</p><p className="text-xs text-muted-foreground">{m.sub}</p></div>
                <div className={`w-4 h-4 rounded-full border-2 ${selected === i ? "border-[#FF6B00] bg-[#FF6B00]" : "border-[#3A3A3A]"}`} />
              </div>
            </button>
          );
        })}
        {selected === 0 && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <Input label="Card Number" placeholder="4242 4242 4242 4242" icon={<CreditCard size={14} />} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Expiry" placeholder="MM / YY" />
              <Input label="CVV" placeholder="•••" />
            </div>
          </div>
        )}
        <Btn full size="lg" onClick={() => onNavigate("order-review")}>Continue <ChevronRight size={16} /></Btn>
      </div>
    </div>
  );
}

function OrderReviewPage({ onNavigate, cart, onPlaceOrder }: { onNavigate: (p: Page) => void; cart: CartItem[]; onPlaceOrder: () => Promise<void> }) {
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const [loading, setLoading] = useState(false);

  const handlePlace = async () => {
    setLoading(true);
    await onPlaceOrder();
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <CheckoutProgress step={4} />
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">
        <h2 className="text-lg font-bold text-foreground mb-4">Review Order</h2>
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          {cart.slice(0, 2).map(item => (
            <div key={item.id} className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#1A1A1A]"><img src={`https://images.unsplash.com/${item.image}?w=60&h=60&fit=crop&auto=format`} alt={item.name} className="w-full h-full object-cover" /></div>
              <div className="flex-1 min-w-0"><p className="text-xs font-semibold text-foreground truncate">{item.name}</p><p className="text-xs text-muted-foreground">Qty: {item.qty}</p></div>
              <span className="text-xs font-bold">${(item.price * item.qty).toFixed(2)}</span>
            </div>
          ))}
        </div>
        {[["Shipping", "42 Sunset Blvd, Apt 8B, LA, CA"], ["Delivery", "Standard (5–7 days)"], ["Payment", "Visa •••• 4242"]].map(([label, val]) => (
          <div key={label} className="bg-card border border-border rounded-xl px-4 py-3 flex justify-between">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-xs font-semibold text-foreground">{val}</span>
          </div>
        ))}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex justify-between font-bold"><span>Total</span><span className="text-[#FF6B00] text-lg">${total.toFixed(2)}</span></div>
        </div>
        <Btn full size="lg" onClick={handlePlace} disabled={loading}>
          {loading ? "Placing Order…" : "Place Order"}
        </Btn>
      </div>
    </div>
  );
}

function ConfirmationPage({ onNavigate, orderId }: { onNavigate: (p: Page) => void; orderId: string }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-6"><CheckCircle size={40} className="text-green-400" /></div>
      <h1 className="text-2xl font-extrabold text-foreground mb-2">Order Placed!</h1>
      <p className="text-muted-foreground text-sm mb-4">Your order has been saved to your account</p>
      <div className="bg-[#FF6B00]/10 border border-[#FF6B00]/20 rounded-xl px-5 py-3 mb-6">
        <p className="text-xs text-muted-foreground">Order Number</p>
        <p className="text-lg font-bold text-[#FF6B00]">{orderId}</p>
      </div>
      <p className="text-xs text-muted-foreground mb-8">Estimated delivery: <span className="text-foreground font-semibold">5–7 business days</span></p>
      <div className="flex gap-3 w-full max-w-xs">
        <Btn variant="secondary" full onClick={() => onNavigate("orders")}>My Orders</Btn>
        <Btn full onClick={() => onNavigate("home")}>Continue</Btn>
      </div>
    </div>
  );
}

// Orders, Tracking, Profile — full implementations
function OrdersPage({ onNavigate, isDesktop, userId }: { onNavigate: (p: Page) => void; isDesktop: boolean; userId?: string }) {
  const [activeTab, setActiveTab] = useState("All");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const tabs = ["All", "To Pay", "To Ship", "Shipped", "Delivered", "Cancelled"];
  const statusColor: Record<string, string> = { Shipped: "text-blue-400 bg-blue-400/10", Delivered: "text-green-400 bg-green-400/10", Cancelled: "text-red-400 bg-red-400/10", "To Ship": "text-orange-400 bg-orange-400/10", "To Pay": "text-yellow-400 bg-yellow-400/10" };

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    api.orders.get(userId)
      .then(data => setOrders(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const filtered = activeTab === "All" ? orders : orders.filter((o: any) => o.status === activeTab);

  return (
    <div className={`${isDesktop ? "p-8" : "pb-24"} min-h-screen bg-background`}>
      {!isDesktop && <MobileTopBar title="My Orders" onBack={() => onNavigate("profile")} />}
      {isDesktop && <h2 className="text-2xl font-extrabold text-foreground mb-6">My Orders</h2>}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4" style={{ scrollbarWidth: "none" }}>
        {tabs.map(tab => (
          <button key={tab} className={`flex-none text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${activeTab === tab ? "bg-[#FF6B00] text-white" : "text-muted-foreground bg-muted"}`}
            onClick={() => setActiveTab(tab)}>{tab}</button>
        ))}
      </div>
      <div className={isDesktop ? "space-y-3 max-w-2xl" : "px-4 space-y-3"}>
        {loading ? (
          <div className="text-center py-16"><p className="text-muted-foreground text-sm animate-pulse">Loading orders…</p></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Package size={40} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-foreground font-semibold">No orders yet</p>
            <p className="text-muted-foreground text-sm mt-1">Your placed orders will appear here</p>
          </div>
        ) : filtered.map((order: any) => {
          const firstItem = order.items?.[0];
          const itemCount = order.items?.length ?? 0;
          return (
            <button key={order.id} className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-[rgba(255,107,0,0.3)] transition-colors" onClick={() => onNavigate("order-detail")}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-foreground">{order.id}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor[order.status] ?? "text-muted-foreground bg-muted"}`}>{order.status}</span>
              </div>
              <div className="flex items-center gap-3">
                {firstItem && (
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#1A1A1A] flex-none">
                    <img src={`https://images.unsplash.com/${firstItem.image}?w=80&h=80&fit=crop&auto=format`} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {itemCount} item{itemCount !== 1 ? "s" : ""}</p>
                  <p className="text-base font-bold text-foreground mt-0.5">${Number(order.total).toFixed(2)}</p>
                </div>
                <ChevronRight size={16} className="text-muted-foreground" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProfilePage({ onNavigate, isDesktop, user, onLogout }: { onNavigate: (p: Page) => void; isDesktop: boolean; user: User | null; onLogout: () => void }) {
  const menuItems = [
    { icon: Package, label: "My Orders", page: "orders" as Page },
    { icon: MapPin, label: "Address Book", page: "address-book" as Page },
    { icon: CreditCard, label: "Payment Methods", page: "payment-methods" as Page },
    { icon: Bell, label: "Notifications", page: "notifications" as Page, badge: "5" },
    { icon: Tag, label: "Coupons & Vouchers", page: "coupons" as Page },
    { icon: Award, label: "Loyalty & Rewards", page: "loyalty" as Page },
    { icon: Settings, label: "Account Settings", page: "account-settings" as Page },
    { icon: HelpCircle, label: "Help Center", page: "help" as Page },
  ];

  return (
    <div className={`${isDesktop ? "p-8" : "pb-24"} min-h-screen bg-background`}>
      {!isDesktop && <MobileTopBar title="My Account" />}
      {isDesktop && <h2 className="text-2xl font-extrabold text-foreground mb-6">My Account</h2>}
      <div className={isDesktop ? "grid grid-cols-3 gap-6" : "px-4 pt-4"}>
        {/* Profile Card */}
        <div className={isDesktop ? "col-span-1 space-y-4" : "mb-6"}>
          <div className="bg-gradient-to-br from-[#FF6B00] to-[#FF3D00] rounded-2xl p-5 relative overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white/20 flex-none bg-white/20 flex items-center justify-center">
                <span className="text-2xl font-bold text-white">{(user?.name ?? "G")[0].toUpperCase()}</span>
              </div>
              <div>
                <p className="text-lg font-extrabold text-white leading-none">{user?.name ?? "Guest"}</p>
                <p className="text-white/70 text-xs mt-0.5">{user?.email}</p>
              </div>
            </div>
            <div className="absolute -right-8 -top-8 w-28 h-28 bg-white/10 rounded-full" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[["28", "Orders"], ["4", "Reviews"], ["2,450", "Points"]].map(([val, label]) => (
              <div key={label} className="bg-card border border-border rounded-xl p-3 text-center">
                <p className="text-base font-extrabold text-foreground">{val}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Menu */}
        <div className={isDesktop ? "col-span-2" : ""}>
          <div className="bg-card border border-border rounded-2xl overflow-hidden mb-4">
            {menuItems.map(({ icon: Icon, label, page, badge }, i) => (
              <button key={page} className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[#1E1E1E] transition-colors text-left ${i < menuItems.length - 1 ? "border-b border-border" : ""}`}
                onClick={() => onNavigate(page)}>
                <Icon size={17} className="text-muted-foreground flex-none" />
                <span className="text-sm font-medium text-foreground flex-1">{label}</span>
                {badge && <span className="text-[10px] bg-[#FF6B00] text-white w-5 h-5 rounded-full flex items-center justify-center font-bold">{badge}</span>}
                <ChevronRight size={14} className="text-muted-foreground" />
              </button>
            ))}
          </div>
          <Btn full variant="danger" onClick={onLogout}><LogOut size={16} />Sign Out</Btn>
        </div>
      </div>
    </div>
  );
}

function SimplePage({ title, onBack, isDesktop, onNavigate }: { title: string; onBack: () => void; isDesktop: boolean; onNavigate: (p: Page) => void }) {
  // Generic placeholder for secondary pages
  const content: Record<string, { icon: React.ReactNode; text: string }> = {
    "Order Details": { icon: <Package size={32} className="text-[#FF6B00]" />, text: "View complete order information, tracking, and receipt." },
    "Order Tracking": { icon: <Truck size={32} className="text-blue-400" />, text: "Track your shipment in real-time with live updates." },
    "Write a Review": { icon: <Star size={32} className="text-yellow-400" />, text: "Share your experience and help other shoppers." },
    "Return / Refund": { icon: <RotateCcw size={32} className="text-green-400" />, text: "Request a return or refund within 30 days of delivery." },
    "Account Settings": { icon: <Settings size={32} className="text-[#FF6B00]" />, text: "Manage your personal details, password, and preferences." },
    "Address Book": { icon: <MapPin size={32} className="text-[#FF6B00]" />, text: "Manage your saved shipping addresses." },
    "Payment Methods": { icon: <CreditCard size={32} className="text-[#FF6B00]" />, text: "Add or remove credit cards and payment options." },
    "Notifications": { icon: <Bell size={32} className="text-[#FF6B00]" />, text: "View and manage your notification preferences." },
    "Coupons": { icon: <Tag size={32} className="text-[#FF6B00]" />, text: "View your available discount codes and vouchers." },
    "Loyalty & Rewards": { icon: <Award size={32} className="text-yellow-400" />, text: "Track your loyalty points and membership tier benefits." },
    "Help Center": { icon: <HelpCircle size={32} className="text-[#FF6B00]" />, text: "Find answers to common questions and get support." },
    "FAQ": { icon: <MessageCircle size={32} className="text-[#FF6B00]" />, text: "Browse frequently asked questions." },
    "Contact Us": { icon: <Mail size={32} className="text-blue-400" />, text: "Reach out to our support team via email, chat, or phone." },
    "Live Chat": { icon: <MessageCircle size={32} className="text-green-400" />, text: "Chat with a support agent — average wait time is 2 minutes." },
    "About Us": { icon: <ShoppingBag size={32} className="text-[#FF6B00]" />, text: "Learn about ShopWisely's mission and story." },
    "Shipping Policy": { icon: <Truck size={32} className="text-[#FF6B00]" />, text: "Read our full shipping terms and delivery information." },
    "Return Policy": { icon: <RotateCcw size={32} className="text-[#FF6B00]" />, text: "Review our 30-day return and refund policy." },
    "Privacy Policy": { icon: <Shield size={32} className="text-blue-400" />, text: "Understand how we collect and protect your data." },
    "Terms & Conditions": { icon: <FileText size={32} className="text-muted-foreground" />, text: "Read the terms governing your use of ShopWisely." },
  };
  const c = content[title];

  return (
    <div className={`${isDesktop ? "p-8" : "pb-24"} min-h-screen bg-background`}>
      {!isDesktop && <MobileTopBar title={title} onBack={onBack} />}
      {isDesktop && (
        <div className="mb-6 flex items-center gap-3">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" onClick={onBack}><ChevronLeft size={16} />Back</button>
          <span className="text-muted-foreground">/</span>
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
        </div>
      )}
      {c && (
        <div className={`${isDesktop ? "max-w-2xl" : "px-4 pt-4"}`}>
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <div className="flex justify-center mb-4">{c.icon}</div>
            <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground mb-6">{c.text}</p>
            <Btn onClick={onBack}>Go Back</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── QUICK CHAT PAGE ──────────────────────────────────────────────────────────

interface ChatMessage {
  id: number; from: "admin" | "user" | "system"; text: string; time: string;
}

function QuickChatPage({ isDesktop, isAdmin }: { isDesktop: boolean; isAdmin: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 1, from: "system", text: "ShopWisely AI Support — powered by OpenAI", time: "" },
    { id: 2, from: "admin", text: "Hello! Welcome to ShopWisely support. How can I help you today?", time: "09:00" },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const nowStr = () => {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");

    const userMsg: ChatMessage = { id: Date.now(), from: "user", text, time: nowStr() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setIsLoading(true);

    try {
      const chatHistory = nextMessages.filter(m => m.from !== "system");
      const data = await api.quickChat.sendMessage(chatHistory);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        from: "admin",
        text: data.message,
        time: nowStr(),
      }]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        from: "system",
        text: `AI error: ${e.message ?? "Unable to reach OpenAI. Check your API key."}`,
        time: "",
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`flex flex-col ${isDesktop ? "h-[calc(100vh-56px)]" : "h-screen"}`}>
      {!isDesktop && <MobileTopBar title="Quick Chat" />}

      {/* Chat header */}
      <div className="flex-none px-4 py-3 border-b border-border bg-[#0F0F0F] flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#FF6B00]/15 flex items-center justify-center flex-none">
          <Bot size={18} className="text-[#FF6B00]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">AI Support Chat</p>
          <p className="text-[11px] text-green-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
            Connected · gpt-4o-mini
          </p>
        </div>
        {isAdmin && (
          <span className="flex-none text-[10px] bg-[#FF6B00]/15 text-[#FF6B00] border border-[#FF6B00]/25 px-2.5 py-1 rounded-full font-bold tracking-wide">
            ADMIN
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map(msg =>
          msg.from === "system" ? (
            <div key={msg.id} className="flex justify-center">
              <span className="text-[11px] text-muted-foreground bg-[#1A1A1A] border border-border px-3 py-1.5 rounded-full flex items-center gap-1.5">
                <Bot size={11} />
                {msg.text}
              </span>
            </div>
          ) : (
            <div key={msg.id} className={`flex ${msg.from === "admin" ? "justify-start" : "justify-end"}`}>
              {msg.from === "admin" && (
                <div className="w-6 h-6 rounded-full bg-[#FF6B00]/20 flex items-center justify-center flex-none mr-2 mt-1">
                  <Bot size={12} className="text-[#FF6B00]" />
                </div>
              )}
              <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl space-y-0.5 ${
                msg.from === "admin"
                  ? "bg-[#1E1E1E] border border-border text-foreground rounded-tl-sm"
                  : "bg-[#FF6B00] text-white rounded-tr-sm"
              }`}>
                <p className="text-sm leading-snug">{msg.text}</p>
                <p className={`text-[10px] ${msg.from === "admin" ? "text-muted-foreground" : "text-white/60"}`}>{msg.time}</p>
              </div>
            </div>
          )
        )}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="w-6 h-6 rounded-full bg-[#FF6B00]/20 flex items-center justify-center flex-none mr-2 mt-1">
              <Bot size={12} className="text-[#FF6B00]" />
            </div>
            <div className="bg-[#1E1E1E] border border-border px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className={`flex-none px-4 py-3 border-t border-border bg-background flex items-center gap-2.5 ${!isDesktop ? "mb-16" : ""}`}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage()}
          placeholder={isLoading ? "AI is typing…" : "Type a message…"}
          disabled={isLoading}
          className="flex-1 bg-[#1A1A1A] border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#FF6B00] transition-all disabled:opacity-60"
        />
        <button onClick={sendMessage} disabled={!input.trim() || isLoading}
          className="w-10 h-10 flex-none bg-[#FF6B00] rounded-xl flex items-center justify-center hover:bg-[#E05F00] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          <Send size={16} className="text-white" />
        </button>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [layout, setLayout] = useState<LayoutMode>("mobile");
  const [page, setPage] = useState<Page>("login");
  const [productId, setProductId] = useState<number>(1);
  const [user, setUser] = useState<User | null>(() => loadUser());
  const [pendingNewUser, setPendingNewUser] = useState<User | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<number[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<string>("#ORD-000000");
  // Pick a random greeting style once per session (0–4)
  const [greetingStyle] = useState(() => Math.floor(Math.random() * 5));
  const serverTime = useServerClock();
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);

  // Load cart + wishlist from Supabase when user is available
  const loadUserData = useCallback(async (u: User) => {
    try {
      const [cartData, wishlistData] = await Promise.all([
        api.cart.get(u.userId),
        api.wishlist.get(u.userId),
      ]);
      setCart(Array.isArray(cartData) ? cartData : []);
      setWishlist(Array.isArray(wishlistData) ? wishlistData : []);
    } catch { /* silent — offline fallback */ }
    setDataLoaded(true);
  }, []);

  // On mount: restore session and load data
  useEffect(() => {
    const saved = loadUser();
    if (saved) {
      setUser(saved);
      loadUserData(saved).then(() => setPage("home"));
    } else {
      setPage("login");
      setDataLoaded(true);
    }
  }, []);

  const handleLogin = async (u: User, isNew?: boolean) => {
    if (isNew) {
      // New account: go to nickname page before loading data
      setPendingNewUser(u);
      setPage("nickname");
      return;
    }
    setUser(u);
    saveUser(u);
    await loadUserData(u);
    setPage("home");
  };

  const handleNicknameDone = async (nickname: string) => {
    if (!pendingNewUser) return;
    const finalUser: User = { ...pendingNewUser, name: nickname };
    setUser(finalUser);
    saveUser(finalUser);
    setPendingNewUser(null);
    await loadUserData(finalUser);
    setPage("home");
  };

  const handleLogout = () => {
    clearUser();
    setUser(null);
    setCart([]);
    setWishlist([]);
    setPage("login");
  };

  const navigate = (p: Page, id?: number) => {
    if (id) setProductId(id);
    setPage(p);
    window.scrollTo({ top: 0 });
  };

  // Cart mutations — optimistic update + Supabase sync
  const addToCart = useCallback(async (product: Product) => {
    const item: CartItem = { id: product.id, name: product.name, price: product.price, qty: 1, image: product.image, color: "Black", size: "M" };
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, item];
    });
    if (user) {
      try { await api.cart.add(user.userId, item); } catch {}
    }
  }, [user]);

  const updateQty = useCallback(async (id: number, qty: number) => {
    setCart(prev => qty < 1 ? prev.filter(i => i.id !== id) : prev.map(i => i.id === id ? { ...i, qty } : i));
    if (user) {
      try {
        if (qty < 1) await api.cart.remove(user.userId, id);
        else await api.cart.update(user.userId, id, qty);
      } catch {}
    }
  }, [user]);

  const removeFromCart = useCallback(async (id: number) => {
    setCart(prev => prev.filter(i => i.id !== id));
    if (user) {
      try { await api.cart.remove(user.userId, id); } catch {}
    }
  }, [user]);

  // Wishlist mutations — optimistic + Supabase sync
  const toggleWishlist = useCallback(async (id: number) => {
    const isInList = wishlist.includes(id);
    setWishlist(prev => isInList ? prev.filter(i => i !== id) : [...prev, id]);
    if (user) {
      try {
        if (isInList) await api.wishlist.remove(user.userId, id);
        else await api.wishlist.add(user.userId, id);
      } catch {}
    }
  }, [user, wishlist]);

  // Place order — saves to Supabase, clears cart
  const placeOrder = useCallback(async () => {
    const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
    if (user) {
      try {
        const order = await api.orders.create(user.userId, {
          items: cart,
          total,
          address: "42 Sunset Blvd, Apt 8B, Los Angeles, CA 90028",
          delivery: "Standard (5–7 days)",
          payment: "Visa •••• 4242",
        });
        setLastOrderId(order.id);
      } catch {}
    }
    setCart([]);
    navigate("confirmation");
  }, [user, cart]);

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const isDesktop = layout === "desktop";
  const shared: SharedProps = { onNavigate: navigate, onAddToCart: addToCart, onToggleWishlist: toggleWishlist, wishlist };

  const displayName = user?.name ?? "Guest";
  const greetingHour = serverTime ? serverTime.getHours() : new Date().getHours();
  const greeting = getGreeting(displayName, greetingHour, greetingStyle);

  // Loading screen while restoring session
  if (!dataLoaded) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="w-14 h-14 bg-[#FF6B00] rounded-2xl flex items-center justify-center">
          <span className="text-white text-base font-black tracking-tight">SW</span>
        </div>
        <p className="text-muted-foreground text-sm animate-pulse">Loading ShopWisely…</p>
      </div>
    );
  }

  const fullscreenPages: Page[] = ["login", "nickname", "shipping-addr", "delivery", "payment", "order-review", "confirmation"];
  const isFullscreen = fullscreenPages.includes(page);

  const simplePagesMap: Partial<Record<Page, string>> = {
    "order-detail": "Order Details", "tracking": "Order Tracking", "rating": "Write a Review",
    "return": "Return / Refund", "account-settings": "Account Settings", "address-book": "Address Book",
    "payment-methods": "Payment Methods", "notifications": "Notifications", "coupons": "Coupons",
    "loyalty": "Loyalty & Rewards", "help": "Help Center", "faq": "FAQ", "contact": "Contact Us",
    "live-chat": "Live Chat", "about": "About Us", "shipping-policy": "Shipping Policy",
    "return-policy": "Return Policy", "privacy": "Privacy", "terms": "Terms & Conditions",
  };

  const renderContent = () => {
    if (page === "login") return <LoginPage onNavigate={navigate} onLogin={handleLogin} />;
    if (page === "nickname") return <NicknamePage user={pendingNewUser ?? { userId: "", email: "", name: "" }} onDone={handleNicknameDone} />;

    switch (page) {
      case "home":
        return isDesktop
          ? <DesktopHomePage {...shared} />
          : <MobileHomePage {...shared} cartCount={cartCount} greeting={greeting} serverTime={serverTime} />;
      case "category":
        return <CategoryPage {...shared} isDesktop={isDesktop} onBack={() => navigate("home")} />;
      case "search":
        return <SearchPage {...shared} isDesktop={isDesktop} />;
      case "product":
        return <ProductPage {...shared} productId={productId} isDesktop={isDesktop} />;
      case "wishlist":
        return <WishlistPage {...shared} isDesktop={isDesktop} />;
      case "cart":
        return <CartPage onNavigate={navigate} cart={cart} onUpdateQty={updateQty} onRemove={removeFromCart} isDesktop={isDesktop} />;
      case "shipping-addr": return <ShippingAddrPage onNavigate={navigate} />;
      case "delivery": return <DeliveryPage onNavigate={navigate} />;
      case "payment": return <PaymentPage onNavigate={navigate} />;
      case "order-review": return <OrderReviewPage onNavigate={navigate} cart={cart} onPlaceOrder={placeOrder} />;
      case "confirmation": return <ConfirmationPage onNavigate={navigate} orderId={lastOrderId} />;
      case "orders": return <OrdersPage onNavigate={navigate} isDesktop={isDesktop} userId={user?.userId} />;
      case "profile": return <ProfilePage onNavigate={navigate} isDesktop={isDesktop} user={user} onLogout={handleLogout} />;
      case "quick-chat": return <QuickChatPage isDesktop={isDesktop} isAdmin={isAdmin} />;
      default:
        if (simplePagesMap[page]) {
          const backPage: Page = ["orders", "order-detail", "tracking", "rating", "return"].includes(page) ? "orders"
            : ["account-settings", "address-book", "payment-methods", "notifications", "coupons", "loyalty"].includes(page) ? "profile"
            : "help";
          return <SimplePage title={simplePagesMap[page]!} onBack={() => navigate(backPage)} isDesktop={isDesktop} onNavigate={navigate} />;
        }
        return <MobileHomePage {...shared} cartCount={cartCount} greeting={greeting} serverTime={serverTime} />;
    }
  };

  return (
    <div className="bg-background min-h-screen" style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}>
      {isFullscreen ? (
        // Full-screen pages (checkout, login) have no shell
        renderContent()
      ) : isDesktop ? (
        // Desktop: sidebar + top bar + content
        <>
          <DesktopSidebar current={page} onNavigate={navigate} cartCount={cartCount} notifCount={2} user={user} onLogout={handleLogout}
            isAdmin={isAdmin} onAdminAccess={() => setShowAdminModal(true)} onRevokeAdmin={() => { setIsAdmin(false); if (page === "quick-chat") navigate("home"); }} />
          <DesktopTopBar current={page} onNavigate={navigate} cartCount={cartCount} notifCount={2} greeting={greeting} serverTime={serverTime} />
          <DesktopContent>{renderContent()}</DesktopContent>
        </>
      ) : (
        // Mobile: centered column + bottom nav
        <div className="max-w-lg mx-auto relative">
          {renderContent()}
          <MobileBottomNav current={page} onNavigate={navigate} cartCount={cartCount} />
        </div>
      )}

      {/* Layout Toggle — always visible */}
      <LayoutToggle mode={layout} onToggle={() => setLayout(l => l === "mobile" ? "desktop" : "mobile")} />

      {/* Mobile: floating admin Quick Chat button (admin only) */}
      {!isDesktop && isAdmin && !isFullscreen && (
        <button
          onClick={() => navigate("quick-chat")}
          className="fixed bottom-24 right-4 z-40 w-12 h-12 bg-[#FF6B00] rounded-2xl shadow-lg flex items-center justify-center hover:bg-[#E05F00] transition-colors">
          <MessageCircle size={20} className="text-white" />
        </button>
      )}

      {/* Mobile: admin access button (non-admin, non-fullscreen) */}
      {!isDesktop && !isAdmin && !isFullscreen && (
        <button
          onClick={() => setShowAdminModal(true)}
          className="fixed bottom-24 right-4 z-40 w-10 h-10 bg-[#1A1A1A] border border-border rounded-xl flex items-center justify-center hover:border-[#FF6B00]/40 transition-colors">
          <Shield size={16} className="text-muted-foreground" />
        </button>
      )}

      {/* Admin Access Modal */}
      {showAdminModal && (
        <AdminAccessModal
          onClose={() => setShowAdminModal(false)}
          onGrantAccess={() => { setIsAdmin(true); setShowAdminModal(false); }}
        />
      )}
    </div>
  );
}
