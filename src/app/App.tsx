import { useState, useEffect, useCallback, useRef } from "react";
import {  
  type InventoryItem, 
  type TransactionLog,
  type Product,
  type ChatHistoryItem,
  api, 
  loadUser, 
  saveUser, 
  clearUser, 
  getOrCreateGuestId, 
  type User 
} from "../lib/api";
import {
  Home, Search, ShoppingCart, Heart, User as UserIcon, ChevronRight, ChevronLeft, Star,
  CreditCard, CheckCircle, Package, Settings,
  Bell, Gift, HelpCircle, MessageCircle, Minus, Plus,
  X, Mail, Send, Eye, EyeOff,
  TrendingUp, Zap, LogOut, Grid, List, Lock,
  Monitor, Smartphone, LayoutGrid, Shield, Bot, RefreshCw,
  Activity, KeyRound, Award, Check
} from "lucide-react";
import myImage from "../imports/logo.jpg";

// ─── DOMAIN INTERFACES ────────────────────────────────────────────────────────

interface OrderItem {
  id: string;
  total: number;
  status: string;
  created_at?: string;
  items?: CartItem[];
}

interface SalesTelemetryData {
  totalRevenue: number;
  orderCount: number;
  averageOrderValue: number;
  historicalBreakdown: { date: string; sales: number }[];
}

// ─── EMBEDDED ML BUSINESS ANALYTICS ENGINE ───────────────────────────────────

class BusinessAnalyticsML {
  /**
   * Linear Regression Model: y = mx + b for Sales Trajectory & Projection
   */
  static forecastRevenue(dailySales: { date: string; sales: number }[], periodsAhead = 3) {
    if (!dailySales || dailySales.length < 2) {
      return { trend: "insufficient_data", slope: 0, predictions: [] };
    }

    const n = dailySales.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    dailySales.forEach((pt, i) => {
      sumX += i;
      sumY += pt.sales;
      sumXY += i * pt.sales;
      sumXX += i * i;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const predictions: number[] = [];
    for (let j = 1; j <= periodsAhead; j++) {
      const futureIndex = n - 1 + j;
      const forecastVal = Math.max(0, slope * futureIndex + intercept);
      predictions.push(Number(forecastVal.toFixed(2)));
    }

    return {
      trend: slope > 0.05 ? "upward" : slope < -0.05 ? "downward" : "flat",
      dailyGrowthVelocity: Number(slope.toFixed(2)),
      predictions,
    };
  }

  /**
   * Inventory Depletion & Restock Vulnerability Classifier
   */
  static evaluateInventoryDepletion(inventory: InventoryItem[]) {
    return inventory
      .map((item) => {
        const ratio = item.stock_level / Math.max(1, item.reorder_point);
        let riskLevel: "CRITICAL" | "MODERATE" | "HEALTHY" = "HEALTHY";
        if (ratio <= 0.5) riskLevel = "CRITICAL";
        else if (ratio <= 1.0) riskLevel = "MODERATE";

        return {
          sku: item.sku,
          name: item.name,
          stock: item.stock_level,
          ratio: Number(ratio.toFixed(2)),
          riskLevel,
        };
      })
      .sort((a, b) => a.ratio - b.ratio);
  }
}

// ─── GREETING + CLOCK HOOKS ───────────────────────────────────────────────────

function useServerClock() {
  const [time, setTime] = useState<Date | null>(null);
  useEffect(() => {
    api.time.get()
      .then(({ ts }) => {
        const offset = Date.now() - ts;
        setTime(new Date(ts));
        const id = setInterval(() => setTime(new Date(Date.now() - offset)), 1000);
        return () => clearInterval(id);
      })
      .catch(() => {
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
  | "about" | "shipping-policy" | "return-policy" | "privacy" | "terms" | "quick-chat" | "admin-dashboard";

type LayoutMode = "mobile" | "desktop";

interface CartItem {
  id: number;
  name: string;
  price: number;
  qty: number;
  image: string;
  color: string;
  size: string;
  category?: string;
}

interface SharedProps {
  onNavigate: (p: Page, id?: number) => void;
  onAddToCart: (p: Product) => void;
  onToggleWishlist: (id: number) => void;
  wishlist: number[];
  products: Product[];
  categories: string[];
}

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
  const base = "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";
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
      {action && <button className="text-xs text-[#FF6B00] font-semibold flex items-center gap-0.5 cursor-pointer" onClick={onAction}>{action}<ChevronRight size={14} /></button>}
    </div>
  );
}

// ─── PRODUCT CARD ─────────────────────────────────────────────────────────────

function ProductCard({ product, onNavigate, onAddToCart, onToggleWishlist, isWishlisted, compact }: {
  product: Product; onNavigate: (p: Page, id?: number) => void;
  onAddToCart: (p: Product) => void; onToggleWishlist: (id: number) => void;
  isWishlisted: boolean; compact?: boolean;
}) {
  const imageSrc = product.image.startsWith("http") || product.image.startsWith("/")
    ? product.image
    : `https://images.unsplash.com/${product.image}?w=400&h=400&fit=crop&auto=format`;

  return (
    <div className="bg-card rounded-xl overflow-hidden border border-border hover:border-[rgba(255,107,0,0.35)] transition-all duration-200 group cursor-pointer"
      onClick={() => onNavigate("product", product.id)}>
      <div className={`relative bg-[#1A1A1A] ${compact ? "aspect-[4/3]" : "aspect-square"}`}>
        <img 
          src={imageSrc}
          alt={product.name} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
        />
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
            <span className="text-sm font-bold text-foreground">${product.price.toFixed(2)}</span>
            <span className="text-xs text-muted-foreground line-through">${product.originalPrice.toFixed(2)}</span>
          </div>
          <button className="w-7 h-7 rounded-lg bg-[#FF6B00] flex items-center justify-center hover:bg-[#E05A00] transition-colors cursor-pointer"
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
      className="fixed bottom-6 right-4 z-[9999] flex items-center gap-2 bg-[#1A1A1A] border border-[rgba(255,107,0,0.4)] text-foreground text-xs font-semibold px-3.5 py-2.5 rounded-full shadow-xl hover:bg-[#252525] hover:border-[#FF6B00] transition-all duration-200 cursor-pointer"
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
        <button className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center cursor-pointer" onClick={onBack}>
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

function DesktopSidebar({ current, onNavigate, cartCount, user, onLogout, isAdmin, onAdminAccess, onRevokeAdmin }: {
  current: Page; onNavigate: (p: Page) => void; cartCount: number; notifCount: number;
  user: User | null; onLogout: () => void;
  isAdmin: boolean; onAdminAccess: () => void; onRevokeAdmin: () => void;
}) {
  return (
    <aside className="fixed left-0 top-0 bottom-0 w-56 bg-[#0F0F0F] border-r border-border flex flex-col z-40">
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <img 
            src={myImage} 
            alt="Logo" 
            className="w-8 h-8 rounded-full aspect-square object-cover object-center flex-none" 
          />
          <span className="text-base font-extrabold text-foreground">HealthyLifePhil</span>
          {isAdmin && (
            <span className="ml-auto text-[9px] bg-[#FF6B00]/15 text-[#FF6B00] border border-[#FF6B00]/25 px-1.5 py-0.5 rounded-md font-bold tracking-wide flex-none">
              ADMIN
            </span>
          )}
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-semibold px-2 mb-2">Menu</p>
        {DESKTOP_NAV.map(({ icon: Icon, label, page }) => {
          const isActive = current === page;
          const badge = page === "cart" ? cartCount : 0;
          return (
            <button key={page}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left cursor-pointer ${isActive ? "bg-[#FF6B00]/15 text-[#FF6B00]" : "text-muted-foreground hover:text-foreground hover:bg-[#1A1A1A]"}`}
              onClick={() => onNavigate(page)}>
              <Icon size={17} />
              <span className="flex-1">{label}</span>
              {badge > 0 && <span className="w-5 h-5 bg-[#FF6B00] text-white text-[10px] font-bold rounded-full flex items-center justify-center">{badge > 9 ? "9+" : badge}</span>}
            </button>
          );
        })}

        {isAdmin && (
          <>
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-semibold px-2 mb-2 mt-4">Admin</p>
            <button
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left cursor-pointer ${current === "quick-chat" ? "bg-[#FF6B00]/15 text-[#FF6B00]" : "text-muted-foreground hover:text-foreground hover:bg-[#1A1A1A]"}`}
              onClick={() => onNavigate("quick-chat")}>
              <MessageCircle size={17} />
              <span className="flex-1">Quick Chat</span>
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full flex-none" />
            </button>
            <button
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left cursor-pointer ${current === "admin-dashboard" ? "bg-[#FF6B00]/15 text-[#FF6B00]" : "text-muted-foreground hover:text-foreground hover:bg-[#1A1A1A]"}`}
              onClick={() => onNavigate("admin-dashboard")}>
              <LayoutGrid size={17} />
              <span className="flex-1">Dashboard</span>
            </button>
          </>
        )}
      </nav>

      <div className="px-3 py-4 border-t border-border space-y-0.5">
        {DESKTOP_BOTTOM_NAV.map(({ icon: Icon, label, page }) => {
          const isActive = current === page;
          return (
            <button key={page}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left cursor-pointer ${isActive ? "bg-[#FF6B00]/15 text-[#FF6B00]" : "text-muted-foreground hover:text-foreground hover:bg-[#1A1A1A]"}`}
              onClick={() => onNavigate(page)}>
              <Icon size={17} />
              {label}
            </button>
          );
        })}

        {isAdmin ? (
          <button onClick={onRevokeAdmin}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150 text-left cursor-pointer">
            <Shield size={17} />
            Revoke Admin
          </button>
        ) : (
          <button onClick={onAdminAccess}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-[#1A1A1A] transition-all duration-150 text-left cursor-pointer">
            <Shield size={17} />
            Admin Access
          </button>
        )}

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

function DesktopTopBar({ current, onNavigate, cartCount, notifCount, greeting }: {
  current: Page; onNavigate: (p: Page) => void; cartCount: number; notifCount: number; greeting: string; serverTime: Date | null;
}) {
  const [search, setSearch] = useState("");
  const pageLabel: Partial<Record<Page, string>> = {
    home: greeting, category: "All Categories", search: "Search",
    product: "Product Details", wishlist: "Wishlist", cart: "Shopping Cart",
    orders: "My Orders", profile: "Profile", help: "Help Center",
    notifications: "Notifications", coupons: "Coupons", loyalty: "Loyalty",
  };
  return (
    <header className="fixed top-0 left-56 right-0 h-14 bg-[#0A0A0A]/95 backdrop-blur-sm border-b border-border flex items-center px-6 gap-4 z-30">
      <h1 className="text-sm font-bold text-foreground flex-none">{pageLabel[current] || "ShopWisely"}</h1>
      <div className="flex-1 max-w-sm relative mx-auto">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} onFocus={() => onNavigate("search")}
          placeholder="Search products, brands..."
          className="w-full bg-[#1A1A1A] border border-border rounded-xl pl-8 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#FF6B00] transition-all" />
      </div>
      <div className="flex items-center gap-2 flex-none">
        <button className="relative w-8 h-8 rounded-xl bg-[#1A1A1A] border border-border flex items-center justify-center hover:border-[rgba(255,107,0,0.4)] transition-colors cursor-pointer"
          onClick={() => onNavigate("notifications")}>
          <Bell size={15} className="text-muted-foreground" />
          {notifCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-[#FF6B00] rounded-full" />}
        </button>
        <button className="relative w-8 h-8 rounded-xl bg-[#1A1A1A] border border-border flex items-center justify-center hover:border-[rgba(255,107,0,0.4)] transition-colors cursor-pointer"
          onClick={() => onNavigate("cart")}>
          <ShoppingCart size={15} className="text-muted-foreground" />
          {cartCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#FF6B00] text-white text-[9px] font-bold rounded-full flex items-center justify-center">{cartCount > 9 ? "9+" : cartCount}</span>}
        </button>
      </div>
    </header>
  );
}

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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to send email. Try again.";
      setCodeError(message);
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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Verification failed. Try again.";
      setCodeError(message);
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
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-[#1A1A1A] transition-colors disabled:opacity-50 cursor-pointer">
                No
              </button>
              <button onClick={requestCode} disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-[#FF6B00] text-white text-sm font-semibold hover:bg-[#E05F00] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer">
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
                className="w-full py-2 text-xs text-[#FF6B00] hover:text-[#E05F00] transition-colors flex items-center justify-center gap-1.5 mb-1 cursor-pointer">
                <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
                Resend code
              </button>
            )}
            <div className="flex gap-3 mt-2">
              <button onClick={() => { setStep(1); setInputCode(""); setCodeError(""); }} disabled={loading}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-[#1A1A1A] transition-colors disabled:opacity-50 cursor-pointer">
                Back
              </button>
              <button onClick={handleVerify} disabled={inputCode.length !== 6 || loading || countdown === 0}
                className="flex-1 py-2.5 rounded-xl bg-[#FF6B00] text-white text-sm font-semibold hover:bg-[#E05F00] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer">
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

function MobileHomePage({ onNavigate, onAddToCart, onToggleWishlist, wishlist, products, categories, greeting }: SharedProps & { cartCount: number; greeting: string; serverTime: Date | null }) {
  const [activeBanner, setActiveBanner] = useState(0);
  const banners = [
    { bg: "from-[#FF6B00] to-[#FF3D00]", title: "New Season", subtitle: "Up to 50% off selected styles" },
    { bg: "from-blue-600 to-blue-900", title: "Premium Picks", subtitle: "Curated just for you" },
    { bg: "from-purple-700 to-purple-900", title: "Flash Sale", subtitle: "Today only — don't miss out" },
  ];

  return (
    <div className="pb-24 min-h-screen bg-background">
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-extrabold text-foreground leading-none">{greeting}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative w-9 h-9 rounded-xl bg-muted flex items-center justify-center cursor-pointer" onClick={() => onNavigate("notifications")}>
              <Bell size={18} className="text-foreground" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#FF6B00] rounded-full" />
            </button>
            <button className="w-9 h-9 rounded-xl overflow-hidden cursor-pointer" onClick={() => onNavigate("profile")}>
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
        <div>
          <div className={`bg-gradient-to-br ${banners[activeBanner].bg} rounded-2xl p-5 h-36 relative overflow-hidden`}>
            <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide">Limited Time</span>
            <h2 className="text-2xl font-extrabold text-white mt-2 leading-none">{banners[activeBanner].title}</h2>
            <p className="text-white/80 text-sm mt-1">{banners[activeBanner].subtitle}</p>
            <button className="absolute bottom-4 left-5 bg-white text-[#111] text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer" onClick={() => onNavigate("category")}>Shop Now</button>
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full" />
          </div>
          <div className="flex gap-1.5 justify-center mt-2.5">
            {banners.map((_, i) => (
              <button key={i} className={`h-1.5 rounded-full transition-all cursor-pointer ${i === activeBanner ? "w-5 bg-[#FF6B00]" : "w-1.5 bg-[#2A2A2A]"}`} onClick={() => setActiveBanner(i)} />
            ))}
          </div>
        </div>

        <div>
          <SectionHeader title="Browse Categories" action="See All" onAction={() => onNavigate("category")} />
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {categories.filter(c => c !== "All").map(cat => (
              <button key={cat} className="flex-none bg-[#1A1A1A] border border-border rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-[#FF6B00] cursor-pointer transition-colors" onClick={() => onNavigate("category")}>
                {cat}
              </button>
            ))}
          </div>
        </div>

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

        <div>
          <SectionHeader title="Featured Products" action="View All" onAction={() => onNavigate("category")} />
          <div className="grid grid-cols-2 gap-3">
            {products.slice(0, 4).map(p => (
              <ProductCard key={p.id} product={p} onNavigate={onNavigate} onAddToCart={onAddToCart} onToggleWishlist={onToggleWishlist} isWishlisted={wishlist.includes(p.id)} />
            ))}
          </div>
        </div>

        <div>
          <SectionHeader title="Trending Now" action="See More" onAction={() => onNavigate("category")} />
          <div className="space-y-3">
            {products.slice(4).map(p => (
              <div key={p.id} className="flex gap-3 bg-card rounded-xl p-3 border border-border cursor-pointer hover:border-[rgba(255,107,0,0.3)] transition-colors" onClick={() => onNavigate("product", p.id)}>
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#1A1A1A] flex-none">
                  <img src={p.image.startsWith("http") ? p.image : `https://images.unsplash.com/${p.image}?w=80&h=80&fit=crop&auto=format`} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{p.category}</p>
                  <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                  <StarRating rating={p.rating} size={10} />
                </div>
                <div className="flex flex-col items-end justify-between flex-none">
                  <button onClick={e => { e.stopPropagation(); onToggleWishlist(p.id); }} className="cursor-pointer">
                    <Heart size={13} className={wishlist.includes(p.id) ? "fill-[#FF6B00] text-[#FF6B00]" : "text-muted-foreground"} />
                  </button>
                  <span className="text-sm font-bold text-foreground">${p.price.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DesktopHomePage({ onNavigate, onAddToCart, onToggleWishlist, wishlist, products, categories }: SharedProps) {
  const [activeCategory, setActiveCategory] = useState("All");
  const filtered = activeCategory === "All" ? products : products.filter(p => p.category === activeCategory);

  return (
    <div className="p-8 space-y-8">
      <div className="grid grid-cols-3 gap-5">
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

      <div>
        <SectionHeader title="Browse by Category" action="View All" onAction={() => onNavigate("category")} />
        <div className="flex gap-2 flex-wrap">
          {categories.map(cat => (
            <button key={cat}
              className={`text-xs font-semibold px-4 py-2 rounded-full border transition-all cursor-pointer ${activeCategory === cat ? "bg-[#FF6B00] text-white border-[#FF6B00]" : "border-border text-muted-foreground hover:border-[rgba(255,107,0,0.4)] hover:text-foreground"}`}
              onClick={() => setActiveCategory(cat)}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div>
        <SectionHeader title={activeCategory === "All" ? "All Products" : activeCategory} action="See More" onAction={() => onNavigate("category")} />
        <div className="grid grid-cols-4 gap-4">
          {filtered.map(p => (
            <ProductCard key={p.id} product={p} onNavigate={onNavigate} onAddToCart={onAddToCart}
              onToggleWishlist={onToggleWishlist} isWishlisted={wishlist.includes(p.id)} compact />
          ))}
        </div>
      </div>
    </div>
  );
}

function CategoryPage({ onNavigate, onAddToCart, onToggleWishlist, wishlist, products, categories, isDesktop, onBack }: SharedProps & { isDesktop: boolean; onBack: () => void }) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const filtered = activeCategory === "All" ? products : products.filter(p => p.category === activeCategory);
  const cols = isDesktop ? "grid-cols-4" : "grid-cols-2";

  return (
    <div className={`${isDesktop ? "p-8" : "pb-24"} min-h-screen bg-background`}>
      {!isDesktop && (
        <MobileTopBar title="All Products" onBack={onBack}
          actions={
            <div className="flex gap-2">
              <button className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer ${viewMode === "grid" ? "bg-[#FF6B00] text-white" : "bg-muted text-muted-foreground"}`} onClick={() => setViewMode("grid")}><Grid size={15} /></button>
              <button className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer ${viewMode === "list" ? "bg-[#FF6B00] text-white" : "bg-muted text-muted-foreground"}`} onClick={() => setViewMode("list")}><List size={15} /></button>
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
              <button className={`w-9 h-9 rounded-xl flex items-center justify-center border cursor-pointer ${viewMode === "grid" ? "bg-[#FF6B00] text-white border-[#FF6B00]" : "border-border text-muted-foreground"}`} onClick={() => setViewMode("grid")}><Grid size={16} /></button>
              <button className={`w-9 h-9 rounded-xl flex items-center justify-center border cursor-pointer ${viewMode === "list" ? "bg-[#FF6B00] text-white border-[#FF6B00]" : "border-border text-muted-foreground"}`} onClick={() => setViewMode("list")}><List size={16} /></button>
            </div>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-3 mb-4" style={{ scrollbarWidth: "none" }}>
          {categories.map(cat => (
            <button key={cat} className={`flex-none text-xs font-semibold px-3.5 py-2 rounded-full border transition-all cursor-pointer ${activeCategory === cat ? "bg-[#FF6B00] text-white border-[#FF6B00]" : "border-border text-muted-foreground hover:border-[rgba(255,107,0,0.4)]"}`}
              onClick={() => setActiveCategory(cat)}>{cat}</button>
          ))}
        </div>

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
                  <img src={p.image.startsWith("http") ? p.image : `https://images.unsplash.com/${p.image}?w=120&h=120&fit=crop&auto=format`} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{p.category}</p>
                  <p className={`font-semibold text-foreground ${isDesktop ? "text-base" : "text-sm"}`}>{p.name}</p>
                  <StarRating rating={p.rating} size={isDesktop ? 13 : 11} />
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-base font-bold">${p.price.toFixed(2)}</span>
                      <span className="text-xs text-muted-foreground line-through">${p.originalPrice.toFixed(2)}</span>
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

function SearchPage({ onNavigate, onAddToCart, onToggleWishlist, wishlist, products, isDesktop }: SharedProps & { isDesktop: boolean }) {
  const [query, setQuery] = useState("");
  const results = query ? products.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) || p.category.toLowerCase().includes(query.toLowerCase())) : [];

  return (
    <div className={`${isDesktop ? "p-8" : "pb-24"} min-h-screen bg-background`}>
      {!isDesktop && (
        <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-sm border-b border-border px-4 py-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={e => setQuery(e.target.value)} autoFocus placeholder="Search products..."
              className="w-full bg-[#1E1E1E] border border-border rounded-xl pl-9 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#FF6B00]" />
            {query && <button className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer" onClick={() => setQuery("")}><X size={15} className="text-muted-foreground" /></button>}
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
              {query && <button className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer" onClick={() => setQuery("")}><X size={15} className="text-muted-foreground" /></button>}
            </div>
          </div>
        )}

        {query ? (
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
        ) : (
          <div className="text-center py-12 text-muted-foreground text-sm">Type something to search the live store.</div>
        )}
      </div>
    </div>
  );
}

function ProductPage({ productId, onNavigate, onAddToCart, onToggleWishlist, wishlist, products, isDesktop }: SharedProps & { productId: number; isDesktop: boolean }) {
  const product = products.find(p => p.id === productId) || products[0];
  const [qty, setQty] = useState(1);
  const [selectedColor, setSelectedColor] = useState("Black");
  const [selectedSize, setSelectedSize] = useState("M");
  const colors = ["Black", "White", "Tan", "Navy"];
  const sizes = ["XS", "S", "M", "L", "XL", "XXL"];

  if (!product) return <div className="p-8 text-center text-muted-foreground">Product not found.</div>;

  const discount = product.originalPrice > product.price 
    ? Math.round((1 - product.price / product.originalPrice) * 100) 
    : 0;

  const imageSrc = product.image.startsWith("http") || product.image.startsWith("/")
    ? product.image
    : `https://images.unsplash.com/${product.image}?w=600&h=600&fit=crop&auto=format`;

  return (
    <div className={`${isDesktop ? "p-8" : "pb-24"} min-h-screen bg-background`}>
      <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 cursor-pointer" onClick={() => onNavigate("category")}>
        <ChevronLeft size={16} /> Back to Products
      </button>
      <div className={`grid ${isDesktop ? "grid-cols-2 gap-10 max-w-5xl" : "grid-cols-1 gap-6"}`}>
        <div className="aspect-square rounded-2xl overflow-hidden bg-[#1A1A1A] relative">
          <img src={imageSrc} alt={product.name} className="w-full h-full object-cover" />
          {discount > 0 && <div className="absolute top-4 left-4 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-lg">-{discount}%</div>}
          <button className={`absolute top-4 right-4 w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer ${wishlist.includes(product.id) ? "bg-[#FF6B00]" : "bg-black/60"}`}
            onClick={() => onToggleWishlist(product.id)}>
            <Heart size={16} className={wishlist.includes(product.id) ? "fill-white text-white" : "text-white"} />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-xs text-[#FF6B00] font-semibold uppercase tracking-wide">{product.category}</p>
          <h1 className="text-2xl md:text-3xl font-extrabold text-foreground">{product.name}</h1>
          <div className="flex items-center gap-3">
            <StarRating rating={product.rating} size={14} />
            <span className="text-sm text-muted-foreground">{product.rating} ({product.reviews.toLocaleString()} reviews)</span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl md:text-3xl font-extrabold text-foreground">${product.price.toFixed(2)}</span>
            <span className="text-lg text-muted-foreground line-through">${product.originalPrice.toFixed(2)}</span>
          </div>

          <div>
            <p className="text-sm font-semibold mb-2">Color: <span className="text-[#FF6B00]">{selectedColor}</span></p>
            <div className="flex gap-2">
              {colors.map(c => (
                <button key={c} className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${selectedColor === c ? "border-[#FF6B00] bg-[#FF6B00]/10 text-[#FF6B00]" : "border-border text-muted-foreground"}`}
                  onClick={() => setSelectedColor(c)}>{c}</button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold mb-2">Size: <span className="text-[#FF6B00]">{selectedSize}</span></p>
            <div className="flex gap-2">
              {sizes.map(s => (
                <button key={s} className={`w-10 h-10 rounded-xl text-sm font-semibold border cursor-pointer ${selectedSize === s ? "border-[#FF6B00] bg-[#FF6B00] text-white" : "border-border text-muted-foreground"}`}
                  onClick={() => setSelectedSize(s)}>{s}</button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4">
            <div className="flex items-center gap-3 bg-muted rounded-xl p-1">
              <button className="w-8 h-8 rounded-lg bg-card flex items-center justify-center cursor-pointer" onClick={() => setQty(Math.max(1, qty - 1))}><Minus size={14} /></button>
              <span className="text-sm font-bold w-5 text-center">{qty}</span>
              <button className="w-8 h-8 rounded-lg bg-card flex items-center justify-center cursor-pointer" onClick={() => setQty(qty + 1)}><Plus size={14} /></button>
            </div>
            <Btn full size="lg" onClick={() => { onAddToCart(product); onNavigate("cart"); }}>
              Add to Cart — ${(product.price * qty).toFixed(2)}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function WishlistPage({ onNavigate, wishlist, onToggleWishlist, onAddToCart, products, isDesktop }: SharedProps & { isDesktop: boolean }) {
  const items = products.filter(p => wishlist.includes(p.id));
  return (
    <div className={`${isDesktop ? "p-8" : "pb-24"} min-h-screen bg-background`}>
      {!isDesktop && <MobileTopBar title={`Wishlist (${items.length})`} onBack={() => onNavigate("home")} />}
      <div className={isDesktop ? "" : "px-4 pt-4"}>
        {items.length === 0 ? (
          <div className="text-center py-20">
            <Heart size={48} className="text-muted-foreground mx-auto mb-4" />
            <p className="text-foreground font-semibold text-lg">Your wishlist is empty</p>
            <Btn className="mt-4" onClick={() => onNavigate("category")}>Browse Products</Btn>
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
  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const total = subtotal;

  return (
    <div className={`${isDesktop ? "p-8" : "pb-24"} min-h-screen bg-background`}>
      {!isDesktop && <MobileTopBar title={`Cart (${cart.length})`} onBack={() => onNavigate("home")} />}
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {cart.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingCart size={48} className="text-muted-foreground mx-auto mb-4" />
            <p className="text-foreground font-semibold text-lg">Your cart is empty</p>
            <Btn className="mt-4" onClick={() => onNavigate("category")}>Start Shopping</Btn>
          </div>
        ) : (
          <div className="space-y-4">
            {cart.map(item => (
              <div key={item.id} className="bg-card border border-border rounded-xl p-3 flex gap-3">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#1A1A1A] flex-none">
                  <img src={item.image.startsWith("http") ? item.image : `https://images.unsplash.com/${item.image}?w=100&h=100&fit=crop`} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">${item.price.toFixed(2)}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <button className="w-6 h-6 rounded-md bg-muted flex items-center justify-center cursor-pointer" onClick={() => onUpdateQty(item.id, item.qty - 1)}><Minus size={11} /></button>
                    <span className="text-xs font-bold w-4 text-center">{item.qty}</span>
                    <button className="w-6 h-6 rounded-md bg-muted flex items-center justify-center cursor-pointer" onClick={() => onUpdateQty(item.id, item.qty + 1)}><Plus size={11} /></button>
                  </div>
                </div>
                <button className="self-start text-muted-foreground hover:text-red-400 cursor-pointer" onClick={() => onRemove(item.id)}><X size={15} /></button>
              </div>
            ))}
            <div className="border-t border-border pt-4 flex justify-between font-bold text-lg">
              <span>Total:</span>
              <span className="text-[#FF6B00]">${total.toFixed(2)}</span>
            </div>
            <Btn full size="lg" onClick={() => onNavigate("shipping-addr")}>Proceed to Checkout</Btn>
          </div>
        )}
      </div>
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
    } catch {
      // Graceful local progression
    }
    onDone(nickname.trim());
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <img src={myImage} alt="Logo" className="w-16 h-16 rounded-full aspect-square object-cover object-center mx-auto mb-6" />
        <h1 className="text-3xl font-extrabold text-foreground mb-2">What should we call you?</h1>
        <p className="text-muted-foreground text-sm mb-6">Choose a nickname for your shopping journey.</p>
        <div className="mb-6">
          <input value={nickname} onChange={e => setNickname(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()}
            placeholder="e.g. Alex, Kai…" maxLength={24} autoFocus
            className="w-full bg-[#1E1E1E] border border-border rounded-2xl px-5 py-4 text-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#FF6B00] text-center font-semibold transition-all" />
        </div>
        <Btn full size="lg" onClick={submit} disabled={loading || !nickname.trim()}>{loading ? "Saving…" : "Continue"}</Btn>
        <button className="mt-4 text-sm text-muted-foreground hover:text-foreground cursor-pointer" onClick={() => onDone("Guest")}>Skip</button>
      </div>
    </div>
  );
}

function LoginPage({ onLogin }: { onNavigate: (p: Page) => void; onLogin: (user: User, isNew?: boolean) => void }) {
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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Something went wrong";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <img src={myImage} alt="Logo" className="w-14 h-14 rounded-full aspect-square object-cover object-center mx-auto mb-6" />
        <h1 className="text-3xl font-extrabold text-foreground text-center mb-1">{mode === "login" ? "Welcome back" : "Create account"}</h1>
        <p className="text-muted-foreground text-sm text-center mb-6">{mode === "login" ? "Sign in to continue" : "Start your smart shopping today"}</p>
        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}
        <div className="space-y-4 mb-6">
          <Input label="Email" type="email" placeholder="you@example.com" icon={<Mail size={15} />} value={email} onChange={setEmail} />
          {mode === "register" && <Input label="Full Name" placeholder="Alex Kim" icon={<UserIcon size={15} />} value={name} onChange={setName} />}
          <Input label="Password" type="password" placeholder="••••••••" icon={<Lock size={15} />} value={password} onChange={setPassword} />
        </div>
        <Btn full size="lg" onClick={submit} disabled={loading || !email || !password || (mode === "register" && !name)}>
          {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
        </Btn>
        <div className="flex items-center gap-3 my-5"><div className="flex-1 h-px bg-border" /><span className="text-xs text-muted-foreground">or</span><div className="flex-1 h-px bg-border" /></div>
        <Btn full variant="ghost" onClick={() => onLogin({ userId: getOrCreateGuestId(), email: "guest@shopwave.com", name: "Guest" })}>Continue as Guest</Btn>
        <p className="text-center text-sm text-muted-foreground mt-6">
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button className="text-[#FF6B00] font-semibold cursor-pointer" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}

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
  return (
    <div className="min-h-screen bg-background">
      <CheckoutProgress step={1} />
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">
        <h2 className="text-lg font-bold text-foreground">Shipping Address</h2>
        <div className="bg-card border border-[#FF6B00] rounded-xl p-4">
          <p className="text-sm font-semibold">Alex Kim</p>
          <p className="text-xs text-muted-foreground mt-1">42 Sunset Boulevard, Apt 8B, Los Angeles, CA 90028</p>
        </div>
        <Btn full size="lg" onClick={() => onNavigate("delivery")}>Continue</Btn>
      </div>
    </div>
  );
}

function DeliveryPage({ onNavigate }: { onNavigate: (p: Page) => void }) {
  return (
    <div className="min-h-screen bg-background">
      <CheckoutProgress step={2} />
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">
        <h2 className="text-lg font-bold text-foreground">Delivery Method</h2>
        <div className="bg-card border border-[#FF6B00] rounded-xl p-4 flex justify-between items-center">
          <div><p className="text-sm font-semibold">Standard Delivery</p><p className="text-xs text-muted-foreground">5–7 business days</p></div>
          <span className="text-sm font-bold text-green-400">Free</span>
        </div>
        <Btn full size="lg" onClick={() => onNavigate("payment")}>Continue</Btn>
      </div>
    </div>
  );
}

function PaymentPage({ onNavigate }: { onNavigate: (p: Page) => void }) {
  return (
    <div className="min-h-screen bg-background">
      <CheckoutProgress step={3} />
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">
        <h2 className="text-lg font-bold text-foreground">Payment Method</h2>
        <div className="bg-card border border-[#FF6B00] rounded-xl p-4 flex items-center gap-3">
          <CreditCard size={18} className="text-[#FF6B00]" />
          <div><p className="text-sm font-semibold">Credit Card</p><p className="text-xs text-muted-foreground">Visa ending in 4242</p></div>
        </div>
        <Btn full size="lg" onClick={() => onNavigate("order-review")}>Review Order</Btn>
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
        <h2 className="text-lg font-bold text-foreground">Review and Place Order</h2>
        <div className="bg-card border border-border rounded-xl p-4 flex justify-between font-bold">
          <span>Total</span>
          <span className="text-[#FF6B00]">${total.toFixed(2)}</span>
        </div>
        <Btn full size="lg" onClick={handlePlace} disabled={loading}>{loading ? "Placing Order…" : "Place Order"}</Btn>
      </div>
    </div>
  );
}

function ConfirmationPage({ onNavigate, orderId }: { onNavigate: (p: Page) => void; orderId: string }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-6"><CheckCircle size={40} className="text-green-400" /></div>
      <h1 className="text-2xl font-extrabold text-foreground mb-2">Order Confirmed!</h1>
      <p className="text-sm text-muted-foreground mb-6">Tracking ID: {orderId}</p>
      <Btn onClick={() => onNavigate("home")}>Continue Shopping</Btn>
    </div>
  );
}

function OrdersPage({ onNavigate, isDesktop, userId }: { onNavigate: (p: Page) => void; isDesktop: boolean; userId?: string }) {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    api.orders.get(userId)
      .then(data => setOrders(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div className={`${isDesktop ? "p-8" : "pb-24"} min-h-screen bg-background`}>
      {!isDesktop && <MobileTopBar title="My Orders" onBack={() => onNavigate("profile")} />}
      <div className="max-w-2xl mx-auto p-4 space-y-3">
        {loading ? <p className="text-muted-foreground text-center py-10">Loading...</p> : orders.length === 0 ? (
          <p className="text-center text-muted-foreground py-10">No orders placed yet.</p>
        ) : (
          orders.map((o) => (
            <div key={o.id} className="bg-card border border-border rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="font-bold text-foreground text-sm">{o.id}</p>
                <p className="text-xs text-muted-foreground mt-1">${Number(o.total).toFixed(2)}</p>
              </div>
              <span className="text-xs font-semibold px-2 py-1 rounded bg-muted text-[#FF6B00]">{o.status}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ProfilePage({ onNavigate, isDesktop, user, onLogout }: { onNavigate: (p: Page) => void; isDesktop: boolean; user: User | null; onLogout: () => void }) {
  return (
    <div className={`${isDesktop ? "p-8" : "pb-24"} min-h-screen bg-background`}>
      <div className="max-w-md mx-auto p-6 space-y-6 text-center">
        <div className="w-16 h-16 rounded-full bg-[#FF6B00] text-white flex items-center justify-center font-bold text-2xl mx-auto">
          {(user?.name ?? "G")[0].toUpperCase()}
        </div>
        <div>
          <h2 className="text-xl font-bold">{user?.name ?? "Guest"}</h2>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </div>
        <div className="space-y-2 text-left">
          <button className="w-full p-3 rounded-xl bg-card border border-border flex justify-between items-center cursor-pointer" onClick={() => onNavigate("orders")}>
            <span>My Orders</span><ChevronRight size={14} />
          </button>
        </div>
        <Btn full variant="danger" onClick={onLogout}>Sign Out</Btn>
      </div>
    </div>
  );
}

// ─── ADMIN LAYOUT (sliding nav) ───────────────────────────────────────────────

const ADMIN_NAV_ITEMS = [
  { icon: MessageCircle, label: "Quick Chat", page: "quick-chat" as Page },
  { icon: LayoutGrid,    label: "Dashboard",  page: "admin-dashboard" as Page },
];

function AdminLayout({ children, current, onNavigate, isDesktop }: {
  children: React.ReactNode; current: Page; onNavigate: (p: Page) => void; isDesktop: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`flex ${isDesktop ? "h-[calc(100vh-56px)]" : "h-[calc(100vh-4rem)]"}`}>
      <div
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        style={{ width: expanded ? 192 : 48, transition: "width 200ms cubic-bezier(0.4,0,0.2,1)" }}
        className="flex-none bg-[#080808] border-r border-border flex flex-col overflow-hidden z-20 relative"
      >
        <div className={`flex items-center gap-2.5 border-b border-border flex-none ${expanded ? "px-4 py-4" : "justify-center px-2 py-4"}`}>
          <div className="w-6 h-6 bg-[#FF6B00] rounded-md flex items-center justify-center flex-none">
            <Shield size={12} className="text-white" />
          </div>
          {expanded && <span className="text-xs font-bold text-foreground whitespace-nowrap">Admin Panel</span>}
        </div>

        <nav className="flex-1 px-2 py-3 space-y-1">
          {ADMIN_NAV_ITEMS.map(({ icon: Icon, label, page }) => {
            const isActive = current === page;
            return (
              <button key={page} onClick={() => onNavigate(page)}
                className={`w-full flex items-center gap-3 py-2.5 rounded-xl transition-all duration-150 cursor-pointer ${expanded ? "px-3 text-left" : "px-0 justify-center"} ${isActive ? "bg-[#FF6B00]/15 text-[#FF6B00]" : "text-muted-foreground hover:text-foreground hover:bg-[#1A1A1A]"}`}>
                <Icon size={16} className="flex-none" />
                {expanded && <span className="text-sm font-medium whitespace-nowrap">{label}</span>}
              </button>
            );
          })}
        </nav>

        <div className={`flex-none border-t border-border px-2 py-3 ${expanded ? "" : "flex justify-center"}`}>
          <div className={`flex items-center gap-2 ${expanded ? "px-3" : "justify-center"}`}>
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full flex-none animate-pulse" />
            {expanded && <span className="text-[10px] text-muted-foreground whitespace-nowrap">Systems Online</span>}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden min-w-0">
        {children}
      </div>
    </div>
  );
}

// ─── ADMIN DASHBOARD PAGE (With Live Product CRUD) ─────────────────────────────

function AdminDashboardPage({
  products,
  onRefreshProducts,
  categories,
  onRefreshCategories,
}: {
  isDesktop: boolean;
  products: Product[];
  onRefreshProducts: () => void;
  categories: string[];
  onRefreshCategories: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<SalesTelemetryData | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [logs, setLogs] = useState<TransactionLog[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "products" | "inventory" | "logs">("overview");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formOriginalPrice, setFormOriginalPrice] = useState("");
  const [formImage, setFormImage] = useState("");
  const [formCategory, setFormCategory] = useState("Shoes");
  const [formBadge, setFormBadge] = useState("");
  const [savingProduct, setSavingProduct] = useState(false);

  const [newCatInput, setNewCatInput] = useState("");
  const [catActionLoading, setCatActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sales, inv, lg] = await Promise.all([
        api.analytics.getTotalSales({ range: "month" }),
        api.admin.inventory.getAll(),
        api.admin.logs.getAll({ limit: 10 }),
      ]);
      setSalesData(sales);
      setInventory(inv);
      setLogs(lg);
    } catch (err: unknown) {
      console.error("Failed to load admin telemetry", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStockUpdate = async (sku: string, current: number, delta: number) => {
    const next = Math.max(0, current + delta);
    try {
      await api.admin.inventory.updateStock(sku, next);
      setInventory(prev => prev.map(item => item.sku === sku ? { ...item, stock_level: next } : item));
    } catch (err: unknown) {
      console.error("Stock update failed", err);
    }
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setFormName("");
    setFormPrice("");
    setFormOriginalPrice("");
    setFormImage("");
    const defaultCat = categories.find(c => c !== "All") || "General";
    setFormCategory(defaultCat);
    setFormBadge("");
    setNewCatInput("");
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormPrice(String(p.price));
    setFormOriginalPrice(String(p.originalPrice));
    setFormImage(p.image);
    setFormCategory(p.category);
    setFormBadge(p.badge || "");
    setNewCatInput("");
    setIsModalOpen(true);
  };

  const handleAddCategory = async () => {
    const trimmed = newCatInput.trim();
    if (!trimmed) return;
    setCatActionLoading(true);
    try {
      await api.categories.create(trimmed);
      setFormCategory(trimmed);
      setNewCatInput("");
      onRefreshCategories();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add category";
      alert(message);
    } finally {
      setCatActionLoading(false);
    }
  };

  const handleDeleteCategory = async (catName: string) => {
    if (!confirm(`Delete category "${catName}"?`)) return;
    setCatActionLoading(true);
    try {
      await api.categories.delete(catName);
      onRefreshCategories();
      if (formCategory === catName) {
        const fallback = categories.find(c => c !== "All" && c !== catName) || "General";
        setFormCategory(fallback);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete category";
      alert(message);
    } finally {
      setCatActionLoading(false);
    }
  };

  const handleSaveProduct = async () => {
    if (!formName.trim() || !formPrice) return;
    setSavingProduct(true);
    const payload = {
      name: formName.trim(),
      price: parseFloat(formPrice) || 0,
      originalPrice: parseFloat(formOriginalPrice) || parseFloat(formPrice) || 0,
      image: formImage.trim() || "photo-1542291026-7eec264c27ff",
      category: formCategory,
      badge: formBadge.trim() || undefined,
    };

    try {
      if (editingProduct) {
        await api.products.update(editingProduct.id, payload);
      } else {
        await api.products.create(payload);
      }
      setIsModalOpen(false);
      onRefreshProducts();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Error saving product";
      alert(`Error saving product: ${message}`);
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (confirm("Are you sure you want to delete this product?")) {
      try {
        await api.products.delete(id);
        onRefreshProducts();
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Error deleting product";
        alert(`Error: ${message}`);
      }
    }
  };

  const lowStockCount = inventory.filter(i => i.stock_level <= i.reorder_point).length;

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-foreground">Admin Operations & Analytics</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Live store telemetry, inventory, and catalog management</p>
          </div>
          <button
            onClick={() => { loadData(); onRefreshProducts(); onRefreshCategories(); }}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-[#161616] text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-[#FF6B00]/40 transition-colors cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-[#FF6B00]" : ""} />
            Refresh Data
          </button>
        </div>

        <div className="flex gap-2 border-b border-border pb-3">
          {(["overview", "products", "inventory", "logs"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-xs font-bold px-4 py-2 rounded-xl transition-all capitalize cursor-pointer ${
                activeTab === tab
                  ? "bg-[#FF6B00] text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between text-muted-foreground mb-2">
                  <span className="text-xs font-semibold">Total Revenue</span>
                  <TrendingUp size={16} className="text-[#FF6B00]" />
                </div>
                <p className="text-2xl font-black text-foreground">
                  ${salesData?.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "0.00"}
                </p>
                <p className="text-[10px] text-green-400 mt-1">Past 30 Days</p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between text-muted-foreground mb-2">
                  <span className="text-xs font-semibold">Total Orders</span>
                  <Package size={16} className="text-blue-400" />
                </div>
                <p className="text-2xl font-black text-foreground">{salesData?.orderCount ?? 0}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Processed</p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between text-muted-foreground mb-2">
                  <span className="text-xs font-semibold">Avg Order Value</span>
                  <CreditCard size={16} className="text-purple-400" />
                </div>
                <p className="text-2xl font-black text-foreground">
                  ${salesData?.averageOrderValue.toFixed(2) ?? "0.00"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">Per transaction</p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between text-muted-foreground mb-2">
                  <span className="text-xs font-semibold">Low Stock Alerts</span>
                  <Activity size={16} className="text-red-400" />
                </div>
                <p className={`text-2xl font-black ${lowStockCount > 0 ? "text-red-400" : "text-foreground"}`}>
                  {lowStockCount}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">Items below threshold</p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-sm font-bold text-foreground mb-4">Historical Revenue (Daily)</h3>
              {(!salesData?.historicalBreakdown || salesData.historicalBreakdown.length === 0) ? (
                <p className="text-xs text-muted-foreground py-8 text-center">No transactions recorded for this period.</p>
              ) : (
                <div className="space-y-2">
                  {salesData.historicalBreakdown.slice(-7).map(({ date, sales }) => (
                    <div key={date} className="flex items-center justify-between py-2 border-b border-border/50 text-xs">
                      <span className="text-muted-foreground font-mono">{date}</span>
                      <span className="font-bold text-foreground">${Number(sales).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: LIVE PRODUCTS CRUD */}
        {activeTab === "products" && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">Live Catalog Management</h3>
                <p className="text-xs text-muted-foreground">Manage active listings and homepage display</p>
              </div>
              <Btn size="sm" onClick={openAddModal}>+ Add New Product</Btn>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#121212] text-muted-foreground border-b border-border">
                  <tr>
                    <th className="p-3">Image</th>
                    <th className="p-3">Product Name</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Price</th>
                    <th className="p-3">Badge</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {products.map(p => (
                    <tr key={p.id} className="hover:bg-[#161616]">
                      <td className="p-3">
                        <img
                          src={p.image.startsWith("http") ? p.image : `https://images.unsplash.com/${p.image}?w=80&h=80&fit=crop`}
                          alt=""
                          className="w-9 h-9 rounded-lg object-cover bg-neutral-800"
                        />
                      </td>
                      <td className="p-3 font-semibold text-foreground">{p.name}</td>
                      <td className="p-3 text-muted-foreground">{p.category}</td>
                      <td className="p-3 font-bold">${p.price.toFixed(2)}</td>
                      <td className="p-3">{p.badge ? <BadgeLabel label={p.badge} /> : "—"}</td>
                      <td className="p-3 text-right space-x-2">
                        <button onClick={() => openEditModal(p)} className="text-blue-400 hover:underline cursor-pointer">Edit</button>
                        <button onClick={() => handleDeleteProduct(p.id)} className="text-red-400 hover:underline cursor-pointer">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: LIVE INVENTORY */}
        {activeTab === "inventory" && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Live Warehouse Stock</h3>
              <span className="text-xs text-muted-foreground">{inventory.length} active SKUs</span>
            </div>
            {inventory.length === 0 ? (
              <p className="text-xs text-muted-foreground py-10 text-center">No inventory found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#121212] text-muted-foreground border-b border-border">
                    <tr>
                      <th className="p-3">SKU</th>
                      <th className="p-3">Item Name</th>
                      <th className="p-3">Warehouse</th>
                      <th className="p-3">Level</th>
                      <th className="p-3 text-right">Adjustment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {inventory.map(item => {
                      const isLow = item.stock_level <= item.reorder_point;
                      return (
                        <tr key={item.sku} className="hover:bg-[#161616]">
                          <td className="p-3 font-mono text-muted-foreground">{item.sku}</td>
                          <td className="p-3 font-semibold text-foreground">{item.name}</td>
                          <td className="p-3 text-muted-foreground">{item.warehouse_id}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-md font-bold ${isLow ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-green-500/10 text-green-400"}`}>
                              {item.stock_level} units
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => handleStockUpdate(item.sku, item.stock_level, -1)}
                                className="w-6 h-6 rounded bg-[#222] text-muted-foreground hover:text-white flex items-center justify-center cursor-pointer"
                              >
                                -
                              </button>
                              <button
                                onClick={() => handleStockUpdate(item.sku, item.stock_level, 1)}
                                className="w-6 h-6 rounded bg-[#222] text-muted-foreground hover:text-white flex items-center justify-center cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: AUDIT LOGS */}
        {activeTab === "logs" && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Audit & Transaction Log</h3>
              <span className="text-xs text-muted-foreground">Recent entries</span>
            </div>
            {logs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-10 text-center">No logs recorded yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {logs.map(log => (
                  <div key={log.id} className="p-4 flex items-center justify-between text-xs hover:bg-[#141414]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground uppercase tracking-wide">{log.event_type}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${log.status === "success" ? "text-green-400 bg-green-400/10" : "text-red-400 bg-red-400/10"}`}>
                          {log.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono mt-1">
                        Actor: {log.actor_id ?? "system"} | Payload: {JSON.stringify(log.payload)}
                      </p>
                    </div>
                    <span className="text-muted-foreground font-mono text-[10px]">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Product Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-foreground">
              {editingProduct ? "Edit Product Details" : "Add New Store Product"}
            </h3>
            
            <Input label="Product Name" value={formName} onChange={setFormName} placeholder="e.g. Vintage Denim Jacket" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Price ($)" value={formPrice} onChange={setFormPrice} placeholder="99.99" />
              <Input label="Original Price ($)" value={formOriginalPrice} onChange={setFormOriginalPrice} placeholder="129.99" />
            </div>
            <Input label="Image URL or Unsplash ID" value={formImage} onChange={setFormImage} placeholder="https://... or photo-xxx" />
            
            {/* Category Select + Add/Delete Controls */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Category</label>
                <span className="text-[11px] text-muted-foreground">Select, add, or delete</span>
              </div>
              
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="bg-[#1E1E1E] border border-border rounded-xl text-sm p-3 text-foreground focus:outline-none focus:border-[#FF6B00]"
              >
                {categories.filter((c) => c !== "All").map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <div className="flex flex-wrap gap-1.5 pt-1 max-h-24 overflow-y-auto">
                {categories.filter((c) => c !== "All").map((cat) => (
                  <span
                    key={cat}
                    className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border ${
                      formCategory === cat 
                        ? "border-[#FF6B00] bg-[#FF6B00]/15 text-[#FF6B00]" 
                        : "border-border bg-[#161616] text-muted-foreground"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setFormCategory(cat)}
                      className="cursor-pointer"
                    >
                      {cat}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat)}
                      className="hover:text-red-400 text-muted-foreground/60 transition-colors cursor-pointer"
                      title={`Remove ${cat}`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2 mt-1">
                <input
                  value={newCatInput}
                  onChange={(e) => setNewCatInput(e.target.value)}
                  placeholder="New category name..."
                  className="flex-1 bg-[#1A1A1A] border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#FF6B00]"
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  disabled={!newCatInput.trim() || catActionLoading}
                  className="px-3 py-2 rounded-xl bg-[#222] hover:bg-[#2A2A2A] border border-border text-xs font-semibold text-foreground disabled:opacity-40 cursor-pointer"
                >
                  + Add
                </button>
              </div>
            </div>

            <Input label="Badge (Optional)" value={formBadge} onChange={setFormBadge} placeholder="e.g. Best Seller, New, Sale" />

            <div className="flex justify-end gap-3 pt-2">
              <Btn variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Btn>
              <Btn onClick={handleSaveProduct} disabled={savingProduct}>
                {savingProduct ? "Saving..." : editingProduct ? "Update Product" : "Create Product"}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── QUICK CHAT PAGE (ADMIN COPILOT + ML ENGINE + STATE PERSISTENCE) ──────────

interface ChatMessage {
  id: number;
  from: "admin" | "user" | "system";
  text: string;
  time: string;
}

const STORAGE_CHAT_KEY = "shopwisely_admin_active_chat";
const STORAGE_DRAFT_KEY = "shopwisely_admin_chat_draft";
const STORAGE_SESSION_ID = "shopwisely_admin_active_session_id";

function QuickChatPage({ isDesktop }: { isDesktop: boolean; isAdmin: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem(STORAGE_CHAT_KEY);
    if (saved) {
      try { 
        return JSON.parse(saved) as ChatMessage[]; 
      } catch {
        // Fallback to default
      }
    }
    return [
      {
        id: 1,
        from: "system",
        text: "ShopWisely Business Analytics ML Copilot Active",
        time: "",
      },
      {
        id: 2,
        from: "admin",
        text: "Operations Copilot active with statistical ML forecast models. Ask for sales forecasts, depletion risks, or database audits.",
        time: "09:00",
      },
    ];
  });

  const [input, setInput] = useState<string>(() => {
    return localStorage.getItem(STORAGE_DRAFT_KEY) || "";
  });

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_SESSION_ID) || null;
  });

  const [historyList, setHistoryList] = useState<ChatHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_CHAT_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(STORAGE_DRAFT_KEY, input);
  }, [input]);

  const loadHistory = useCallback(async () => {
    try {
      const data = await api.admin.chat.getHistory();
      setHistoryList(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      console.error("Failed to load chat history", e);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const nowStr = () => {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  const handleResetChat = () => {
    if (confirm("Reset current conversation? Your draft and current messages will be cleared.")) {
      const freshMessages: ChatMessage[] = [
        {
          id: 1,
          from: "system",
          text: "ShopWisely Business Analytics ML Copilot Active",
          time: "",
        },
        {
          id: 2,
          from: "admin",
          text: "Session refreshed. Statistical models online. How can I assist your business analysis?",
          time: nowStr(),
        },
      ];
      setMessages(freshMessages);
      setInput("");
      setCurrentSessionId(null);
      localStorage.removeItem(STORAGE_CHAT_KEY);
      localStorage.removeItem(STORAGE_DRAFT_KEY);
      localStorage.removeItem(STORAGE_SESSION_ID);
    }
  };

  const saveSessionToDb = async (msgsToSave: ChatMessage[]) => {
    try {
      const firstUserMsg = msgsToSave.find(m => m.from === "user")?.text;
      const title = firstUserMsg ? firstUserMsg.slice(0, 26) + "..." : "Analytics Query";

      const res = await api.admin.chat.saveSession({
        sessionId: currentSessionId || undefined,
        sessionName: title,
        messages: msgsToSave,
      });

      if (res?.id) {
        setCurrentSessionId(res.id);
        localStorage.setItem(STORAGE_SESSION_ID, res.id);
      }
      loadHistory();
    } catch (err: unknown) {
      console.error("Auto-save to history failed", err);
    }
  };

  const handleRunMLForecast = async () => {
    setIsLoading(true);
    try {
      const sales = await api.analytics.getTotalSales({ range: "month" });
      const inventory = await api.admin.inventory.getAll();

      const forecast = BusinessAnalyticsML.forecastRevenue(sales.historicalBreakdown || [], 3);
      const stockRisks = BusinessAnalyticsML.evaluateInventoryDepletion(inventory || []);
      const criticalItems = stockRisks.filter(r => r.riskLevel === "CRITICAL");

      const mlSummary = `**ML Business Intelligence Report**:\n` +
        `• **Revenue Trend**: ${forecast.trend.toUpperCase()} (Velocity: $${forecast.dailyGrowthVelocity}/day)\n` +
        `• **Next 3-Day Projected Revenues**: ${forecast.predictions.length > 0 ? forecast.predictions.map(p => `$${p}`).join(", ") : "Computing..."}\n` +
        `• **Stock Depletion Risk**: ${criticalItems.length} item(s) in critical depletion boundary.`;

      const botMsg: ChatMessage = {
        id: Date.now(),
        from: "admin",
        text: mlSummary,
        time: nowStr()
      };

      const updated = [...messages, botMsg];
      setMessages(updated);
      await saveSessionToDb(updated);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "ML analysis error";
      alert("ML Analysis error: " + message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (textOverride?: string) => {
    const textToSend = (textOverride ?? input).trim();
    if (!textToSend || isLoading) return;

    setInput("");
    localStorage.removeItem(STORAGE_DRAFT_KEY);

    const userMsg: ChatMessage = { id: Date.now(), from: "user", text: textToSend, time: nowStr() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setIsLoading(true);

    try {
      const payload = nextMessages
        .filter(m => m.from !== "system")
        .map(m => ({
          from: m.from === "admin" ? ("assistant" as const) : ("admin" as const),
          text: m.text,
          time: m.time,
        }));

      const res = await api.admin.chat.sendMessage(payload);
      const botReply: ChatMessage = {
        id: Date.now() + 1,
        from: "admin",
        text: res.message,
        time: nowStr(),
      };

      const finalMessages = [...nextMessages, botReply];
      setMessages(finalMessages);
      await saveSessionToDb(finalMessages);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Internal telemetry error";
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          from: "system",
          text: `Telemetry Notice: ${message}`,
          time: "",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const restoreSession = (item: ChatHistoryItem) => {
    if (item?.messages && Array.isArray(item.messages)) {
      setMessages(item.messages);
      setCurrentSessionId(item.id);
      localStorage.setItem(STORAGE_SESSION_ID, item.id);
      setShowHistory(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background relative">
      <div className="flex-none px-4 py-3 border-b border-border bg-[#0F0F0F] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#FF6B00]/15 flex items-center justify-center">
            <Bot size={17} className="text-[#FF6B00]" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground leading-none">Analytics & ML Copilot</p>
            <p className="text-[10px] text-green-400 mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              State Persistent across pages
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunMLForecast}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[#FF6B00]/30 bg-[#FF6B00]/10 text-xs font-semibold text-[#FF6B00] hover:bg-[#FF6B00]/20 transition-colors cursor-pointer"
            title="Execute client-side machine learning sales and stock models"
          >
            <TrendingUp size={13} />
            <span className="hidden sm:inline">Run ML Forecast</span>
          </button>

          <button
            onClick={() => setShowHistory(!showHistory)}
            className="px-2.5 py-1.5 rounded-xl border border-border bg-[#161616] text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            History ({historyList.length}/10)
          </button>

          <button
            onClick={handleResetChat}
            className="p-2 rounded-xl border border-border bg-[#161616] text-muted-foreground hover:text-foreground hover:border-[#FF6B00]/40 transition-colors cursor-pointer"
            title="Reset Chat & Clear Drafts"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {showHistory && (
        <div className="absolute top-14 right-0 bottom-0 w-72 bg-[#121212] border-l border-border z-30 p-4 flex flex-col shadow-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">Saved Sessions (Max 10)</span>
            <button onClick={() => setShowHistory(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
              <X size={15} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-3 space-y-2">
            {historyList.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No saved chat history in database.</p>
            ) : (
              historyList.map((item) => (
                <button
                  key={item.id}
                  onClick={() => restoreSession(item)}
                  className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                    currentSessionId === item.id
                      ? "border-[#FF6B00] bg-[#FF6B00]/10 text-foreground font-bold"
                      : "border-border bg-[#181818] text-muted-foreground hover:text-foreground hover:border-border/80"
                  }`}
                >
                  <p className="truncate">{item.session_name}</p>
                  <span className="text-[10px] text-muted-foreground/60 mt-1 block">
                    {new Date(item.updated_at).toLocaleDateString()} · {item.messages?.length || 0} messages
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.from === "admin" ? "justify-start" : msg.from === "user" ? "justify-end" : "justify-center"
            }`}
          >
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                msg.from === "admin"
                  ? "bg-[#1E1E1E] text-foreground border border-border leading-relaxed whitespace-pre-wrap"
                  : msg.from === "user"
                  ? "bg-[#FF6B00] text-white"
                  : "bg-[#161616] text-xs text-muted-foreground border border-border"
              }`}
            >
              <p className="text-sm">{msg.text}</p>
              {msg.time && (
                <p className={`text-[10px] mt-1 ${msg.from === "admin" ? "text-muted-foreground" : "text-white/70"}`}>
                  {msg.time}
                </p>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[#1E1E1E] border border-border px-4 py-3 rounded-2xl text-xs text-muted-foreground animate-pulse">
              Running model inference & reading metrics…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex-none p-3 border-t border-border bg-background flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Draft message (persists when switching pages)..."
          className="flex-1 bg-[#1A1A1A] border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#FF6B00] transition-colors"
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || isLoading}
          className="w-10 h-10 bg-[#FF6B00] hover:bg-[#E05F00] text-white rounded-xl flex items-center justify-center transition-colors disabled:opacity-40 cursor-pointer flex-none"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}

// ─── MAIN APP COMPONENT ───────────────────────────────────────────────────────

export default function App() {
  const [layout, setLayout] = useState<LayoutMode>("mobile");
  const [page, setPage] = useState<Page>("login");
  const [productId, setProductId] = useState<number>(1);
  const [user, setUser] = useState<User | null>(() => loadUser());
  const [pendingNewUser, setPendingNewUser] = useState<User | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<number[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(["All", "Shoes", "Tops", "Bottoms", "Outerwear", "Bags", "Accessories", "Watches"]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<string>("#ORD-000000");
  const [greetingStyle] = useState(() => Math.floor(Math.random() * 5));
  const serverTime = useServerClock();
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      const list = await api.products.getAll();
      setProducts(list);
    } catch (err: unknown) {
      console.error("Failed to load products", err);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const list = await api.categories.getAll();
      if (Array.isArray(list) && list.length > 0) {
        setCategories(["All", ...list.filter(c => c !== "All")]);
      }
    } catch (e: unknown) {
      console.error("Failed to load categories", e);
    }
  }, []);

  const loadUserData = useCallback(async (u: User) => {
    try {
      const [cartData, wishlistData] = await Promise.all([
        api.cart.get(u.userId),
        api.wishlist.get(u.userId),
      ]);
      setCart(Array.isArray(cartData) ? cartData : []);
      setWishlist(Array.isArray(wishlistData) ? wishlistData : []);
    } catch {
      // Graceful local state retention
    }
    setDataLoaded(true);
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    const saved = loadUser();
    if (saved) {
      setUser(saved);
      loadUserData(saved).then(() => setPage("home"));
    } else {
      setPage("login");
      setDataLoaded(true);
    }
  }, [fetchProducts, fetchCategories, loadUserData]);

  const handleLogin = async (u: User, isNew?: boolean) => {
    if (isNew) {
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

  const addToCart = useCallback(async (product: Product) => {
    const item: CartItem = { 
      id: product.id, 
      name: product.name, 
      price: product.price, 
      qty: 1, 
      image: product.image, 
      color: "Black", 
      size: "M", 
      category: product.category 
    };
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
  const shared: SharedProps = { 
    onNavigate: navigate, 
    onAddToCart: addToCart, 
    onToggleWishlist: toggleWishlist, 
    wishlist, 
    products,
    categories
  };

  const displayName = user?.name ?? "Guest";
  const greetingHour = serverTime ? serverTime.getHours() : new Date().getHours();
  const greeting = getGreeting(displayName, greetingHour, greetingStyle);

  if (!dataLoaded) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <img src={myImage} alt="Logo" className="w-14 h-14 rounded-full aspect-square object-cover object-center" />
        <p className="text-muted-foreground text-sm animate-pulse">Loading ShopWisely…</p>
      </div>
    );
  }

  const fullscreenPages: Page[] = ["login", "nickname", "shipping-addr", "delivery", "payment", "order-review", "confirmation"];
  const isFullscreen = fullscreenPages.includes(page);

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
      case "quick-chat":
        return (
          <AdminLayout current={page} onNavigate={navigate} isDesktop={isDesktop}>
            <QuickChatPage isDesktop={isDesktop} isAdmin={isAdmin} />
          </AdminLayout>
        );
      case "admin-dashboard":
        return (
          <AdminLayout current={page} onNavigate={navigate} isDesktop={isDesktop}>
            <AdminDashboardPage
              isDesktop={isDesktop}
              products={products}
              onRefreshProducts={fetchProducts}
              categories={categories}
              onRefreshCategories={fetchCategories}
            />
          </AdminLayout>
        );
      default:
        return <MobileHomePage {...shared} cartCount={cartCount} greeting={greeting} serverTime={serverTime} />;
    }
  };

  return (
    <div className="bg-background min-h-screen" style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}>
      {isFullscreen ? (
        renderContent()
      ) : isDesktop ? (
        <>
          <DesktopSidebar current={page} onNavigate={navigate} cartCount={cartCount} notifCount={2} user={user} onLogout={handleLogout}
            isAdmin={isAdmin} onAdminAccess={() => setShowAdminModal(true)} onRevokeAdmin={() => { setIsAdmin(false); if (page === "quick-chat") navigate("home"); }} />
          <DesktopTopBar current={page} onNavigate={navigate} cartCount={cartCount} notifCount={2} greeting={greeting} serverTime={serverTime} />
          <DesktopContent>{renderContent()}</DesktopContent>
        </>
      ) : (
        <div className="max-w-lg mx-auto relative">
          {renderContent()}
          <MobileBottomNav current={page} onNavigate={navigate} cartCount={cartCount} />
        </div>
      )}

      <LayoutToggle mode={layout} onToggle={() => setLayout(l => l === "mobile" ? "desktop" : "mobile")} />

      {!isDesktop && isAdmin && !isFullscreen && (
        <button
          onClick={() => navigate("quick-chat")}
          className="fixed bottom-24 right-4 z-40 w-12 h-12 bg-[#FF6B00] rounded-2xl shadow-lg flex items-center justify-center hover:bg-[#E05F00] transition-colors cursor-pointer">
          <MessageCircle size={20} className="text-white" />
        </button>
      )}

      {!isDesktop && !isAdmin && !isFullscreen && (
        <button
          onClick={() => setShowAdminModal(true)}
          className="fixed bottom-24 right-4 z-40 w-10 h-10 bg-[#1A1A1A] border border-border rounded-xl flex items-center justify-center hover:border-[#FF6B00]/40 transition-colors cursor-pointer">
          <Shield size={16} className="text-muted-foreground" />
        </button>
      )}

      {showAdminModal && (
        <AdminAccessModal
          onClose={() => setShowAdminModal(false)}
          onGrantAccess={() => { setIsAdmin(true); setShowAdminModal(false); }}
        />
      )}
    </div>
  );
}