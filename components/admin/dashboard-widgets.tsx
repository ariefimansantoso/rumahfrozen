"use client";

import { useTranslations } from "next-intl";
import {
  TrendingUp,
  Activity,
  DollarSign,
  ShoppingCart,
  Users,
  Search,
  Settings,
  Bell,
  MoreVertical,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils";

// --- Summary Stats Card ---
interface SummaryCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  iconBg?: string;
  badge?: React.ReactNode;
}

export function SummaryStatCard({
  label,
  value,
  subValue,
  icon,
  iconBg,
  badge,
}: SummaryCardProps) {
  return (
    <Card className="rounded-2xl border-none shadow-sm h-full hover:shadow-md transition-shadow">
      <CardContent className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "h-12 w-12 rounded-full flex items-center justify-center text-primary-foreground",
              iconBg || "bg-gray-100 text-gray-600",
            )}
          >
            {icon}
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <div className="flex items-center gap-2">
              <h3 className="text-2xl font-bold">{value}</h3>
              {badge}
            </div>
            {subValue && (
              <p className="text-xs text-muted-foreground mt-1">{subValue}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Revenue Bar Chart ---
export function RevenueBarChart({
  data,
  title,
}: {
  data: any[];
  title?: string;
}) {
  // Map data to match simpler months for display
  const chartData = data.map((d) => ({
    name: d.month,
    revenue: d.income, // Remap income to revenue
  }));

  return (
    <Card className="rounded-2xl border-none shadow-sm h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-[#1A564F]">
          {title || "Total Revenue 2025"}
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[300px] w-full pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barSize={20}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="oklch(0.92 0 0)"
            />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#9CA3AF", fontSize: 12 }}
              interval={0}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#9CA3AF", fontSize: 12 }}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip
              cursor={{ fill: "transparent" }}
              contentStyle={{
                borderRadius: "12px",
                border: "none",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
              }}
            />
            <Bar
              dataKey="revenue"
              fill="#1A564F" // Dark Green from design
              radius={[4, 4, 0, 0]}
              background={{ fill: "#F3F4F6" }}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// --- Customer Volume Donut Chart ---
const CUSTOMER_DATA = [
  { name: "New Customer", value: 15, color: "#1A564F" }, // Dark Green
  { name: "Current Customer", value: 85, color: "#E5E7EB" }, // Gray
];

export function CustomerVolumeChart({
  title,
  newCustomerLabel,
  currentCustomerLabel,
}: {
  title?: string;
  newCustomerLabel?: string;
  currentCustomerLabel?: string;
}) {
  const newLabel = newCustomerLabel || "New Customer";
  const currentLabel = currentCustomerLabel || "Current Customer";

  const customerData = [
    { name: newLabel, value: 15, color: "#1A564F" }, // Dark Green
    { name: currentLabel, value: 85, color: "#E5E7EB" }, // Gray
  ];

  return (
    <Card className="rounded-2xl border-none shadow-sm h-full">
      <CardHeader>
        <CardTitle className="text-lg text-[#1A564F]">
          {title || "Customer Volume"}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center p-0 pb-6">
        <div className="relative h-[200px] w-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={customerData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={0}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
                stroke="none"
              >
                {CUSTOMER_DATA.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Center Label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xl font-bold text-[#1A564F]">+15%</span>
            <span className="text-xs text-muted-foreground">{newLabel}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex w-full justify-center gap-6 mt-2 px-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-[#1A564F]" />
            <div className="flex flex-col">
              <span className="text-xs font-bold">15%</span>
              <span className="text-[10px] text-muted-foreground">
                {newLabel}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-[#E5E7EB]" />
            <div className="flex flex-col">
              <span className="text-xs font-bold">85%</span>
              <span className="text-[10px] text-muted-foreground">
                {currentLabel}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Traffic Analytics ---
// Mock Logos
const GoogleLogo = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.11c-.22-.66-.35-1.36-.35-2.11s.13-1.45.35-2.11V7.05H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.95l3.66-2.84z"
    />
    <path
      fill="#EA4335"
      d="M12 4.62c1.61 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.09 14.97 0 12 0 7.7 0 3.99 2.47 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);
const InstagramLogo = () => (
  <svg
    viewBox="0 0 24 24"
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect
      x="2"
      y="2"
      width="20"
      height="20"
      rx="5"
      ry="5"
      stroke="#E1306C"
    ></rect>
    <path
      d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"
      stroke="#E1306C"
    ></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" stroke="#E1306C"></line>
  </svg>
);
const MetaLogo = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path
      fill="#0668E1"
      d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
    />
  </svg>
);
const LinkedInLogo = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path
      fill="#0077B5"
      d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"
    />
  </svg>
);

export function TrafficAnalyticCard({
  title,
  subtitle,
}: {
  title?: string;
  subtitle?: string;
}) {
  const data = [
    {
      name: "Google",
      value: "220K",
      color: "bg-gray-100",
      width: "90%",
      icon: GoogleLogo,
    },
    {
      name: "Instagram",
      value: "124K",
      color: "bg-gray-100",
      width: "50%",
      icon: InstagramLogo,
    },
    {
      name: "Meta",
      value: "64K",
      color: "bg-gray-100",
      width: "30%",
      icon: MetaLogo,
    },
    {
      name: "Linkedin",
      value: "61K",
      color: "bg-gray-100",
      width: "25%",
      icon: LinkedInLogo,
    },
  ];
  return (
    <Card className="rounded-2xl border-none shadow-sm h-full">
      <CardHeader>
        <CardTitle className="text-lg text-[#1A564F]">
          {title || "Traffic Analytic"}
        </CardTitle>
        <div className="mt-2">
          <h4 className="text-2xl font-bold">298,475</h4>
          <p className="text-xs text-muted-foreground">
            {subtitle || "Total Views from 4 platforms"}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.map((item) => (
          <div key={item.name} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <item.icon />
              </div>
              <span>{item.value}</span>
            </div>
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gray-200 rounded-full"
                style={{ width: item.width }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// --- Sales Funnel ---
interface SalesFunnelProps {
  title?: string;
  productViewLabel?: string;
  addToCartLabel?: string;
  initiateCheckoutLabel?: string;
  purchaseLabel?: string;
  insightsLabel?: string;
  dropoffLabel?: string;
}

export function SalesFunnelChart({
  title,
  productViewLabel,
  addToCartLabel,
  initiateCheckoutLabel,
  purchaseLabel,
  insightsLabel,
  dropoffLabel,
}: SalesFunnelProps) {
  return (
    <Card className="rounded-2xl border-none shadow-sm h-full">
      <CardHeader>
        <CardTitle className="text-lg text-[#1A564F]">
          {title || "Sales Funnel"}
        </CardTitle>
      </CardHeader>
      <CardContent className="relative min-h-[250px] flex items-center justify-center pt-8">
        {/* Simplified CSS Funnel Representation */}
        <div className="w-full max-w-2xl flex relative h-40">
          {/* Step 1: Product View */}
          <div className="flex-1 relative z-30 group">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-50 to-emerald-100 transform skew-x-12 origin-bottom-left scale-95 opacity-50" />
            <div className="relative pl-4 pt-2">
              <p className="text-xs text-muted-foreground">
                {productViewLabel || "Product View"}
              </p>
              <h4 className="font-bold">4.3K</h4>
            </div>
          </div>

          {/* Step 2: Add to Cart (Highlighted) */}
          <div className="flex-1 relative z-40 -ml-4">
            <div className="absolute inset-0 bg-[#1A564F] transform -skew-x-12 scale-110 shadow-lg text-white p-4 clip-custom">
              <p className="text-xs opacity-90">
                {addToCartLabel || "Add to Cart"}
              </p>
              <h4 className="font-bold text-xl">914</h4>
              <p className="text-[10px] mt-2 flex items-center gap-1 cursor-pointer">
                {insightsLabel || "Insights"}{" "}
                <ArrowRightIcon className="w-3 h-3" />
              </p>
            </div>
          </div>

          {/* Step 3: Initiate Checkout */}
          <div className="flex-1 relative z-30 -ml-4">
            <div className="absolute inset-0 bg-[#D1FAE5] transform skew-x-12 origin-top-left scale-90 flex items-center">
              <div className="pl-12 pt-4">
                <p className="text-xs text-muted-foreground">
                  {initiateCheckoutLabel || "Initiate Checkout"}
                </p>
                <h4 className="font-bold">872</h4>
              </div>
            </div>
          </div>

          {/* Step 4: Purchase */}
          <div className="flex-1 relative z-20 -ml-8">
            <div className="absolute inset-0 bg-[#A7F3D0] transform -skew-x-12 origin-bottom-right scale-75 flex items-center justify-center"></div>
            <div className="relative pl-8 pt-4">
              <p className="text-xs text-muted-foreground">
                {purchaseLabel || "Purchase"}
              </p>
              <h4 className="font-bold">463</h4>
            </div>
          </div>
        </div>

        {/* Legend / Dropoff Label */}
        <div className="absolute bottom-4 text-xs text-muted-foreground w-full text-center">
          {dropoffLabel ||
            "Funnel showing user drop-off from visit to purchase."}
        </div>
      </CardContent>
    </Card>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

// --- Top Selling Products List ---
interface TopProduct {
  name: string;
  price: string | number;
  rating?: number;
  image?: string;
  totalSold?: number;
}

const DEFAULT_PRODUCTS: TopProduct[] = [
  {
    name: "Stylish Running Shoes (Blue, 8)",
    price: "$22",
    rating: 4,
    image:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100&q=80",
  },
  {
    name: "Max Women Sling Bag",
    price: "$10",
    rating: 3,
    image:
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=100&q=80",
  },
  {
    name: "Men Slim Fit Casual Shirt",
    price: "$100",
    rating: 4,
    image:
      "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=100&q=80",
  },
  {
    name: "Thunder, With 60H Backup...",
    price: "$240",
    rating: 5,
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=100&q=80",
  },
];

export function TopSellingProductsList({
  title,
  products,
}: {
  title?: string;
  products?: TopProduct[];
}) {
  const t = useTranslations();
  const displayProducts = products || DEFAULT_PRODUCTS;

  return (
    <Card className="rounded-2xl border-none shadow-sm h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg text-[#1A564F]">
          {title ||
            t("vendor.topProducts")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {displayProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t("vendor.dashboardWidgets.noProductsYet")}
          </p>
        ) : (
          displayProducts.slice(0, 5).map((prod, i) => {
            const priceDisplay =
              typeof prod.price === "number"
                ? `$${prod.price.toFixed(2)}`
                : prod.price;
            const rating = prod.rating ?? 0;

            return (
              <div key={i} className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                  {prod.image ? (
                    <img
                      src={prod.image}
                      alt={prod.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">
                      {t("vendor.dashboardWidgets.noImage")}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium truncate">{prod.name}</h4>
                  <div className="flex text-yellow-400 text-[10px]">
                    {[...Array(5)].map((_, starI) => (
                      <span key={starI}>
                        {starI < rating ? (
                          "★"
                        ) : (
                          <span className="text-gray-200">★</span>
                        )}
                      </span>
                    ))}
                  </div>
                  {prod.totalSold !== undefined && (
                    <p className="text-[10px] text-muted-foreground">
                      {t("vendor.dashboardWidgets.soldCount", {
                        count: prod.totalSold,
                      })}
                    </p>
                  )}
                </div>
                <div className="font-bold text-sm">{priceDisplay}</div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

// Export a dummy for non-used components to avoid build errors if still imported
export function WelcomeCard({ name }: { name: string }) {
  return null;
}
export function DetailedStatsCard() {
  return null;
}
export function SaleByGenderChart() {
  return null;
}
export function YearlySalesChart() {
  return null;
}
export function BestSalesmanTable() {
  return null;
}
