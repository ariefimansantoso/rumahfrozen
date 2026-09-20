/**
 * Application-wide constants
 */

// Order statuses with labels and colors
export const ORDER_STATUS_CONFIG = {
  pending: {
    label: "Pending",
    color: "bg-yellow-100 text-yellow-800",
    description: "Order is awaiting processing",
  },
  processing: {
    label: "Processing",
    color: "bg-blue-100 text-blue-800",
    description: "Order is being prepared",
  },
  shipped: {
    label: "Shipped",
    color: "bg-purple-100 text-purple-800",
    description: "Order has been shipped",
  },
  delivered: {
    label: "Delivered",
    color: "bg-green-100 text-green-800",
    description: "Order has been delivered",
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-red-100 text-red-800",
    description: "Order has been cancelled",
  },
} as const;

// Payment statuses with labels and colors
export const PAYMENT_STATUS_CONFIG = {
  pending: {
    label: "Pending",
    color: "bg-yellow-100 text-yellow-800",
  },
  paid: {
    label: "Paid",
    color: "bg-green-100 text-green-800",
  },
  partially_paid: {
    label: "Partially paid",
    color: "bg-orange-100 text-orange-800",
  },
  refunded: {
    label: "Refunded",
    color: "bg-gray-100 text-gray-800",
  },
  partially_refunded: {
    label: "Partially refunded",
    color: "bg-cyan-100 text-cyan-800",
  },
} as const;

// Vendor statuses with labels and colors
export const VENDOR_STATUS_CONFIG = {
  pending: {
    label: "Pending Approval",
    color: "bg-yellow-100 text-yellow-800",
  },
  approved: {
    label: "Approved",
    color: "bg-green-100 text-green-800",
  },
  suspended: {
    label: "Suspended",
    color: "bg-red-100 text-red-800",
  },
} as const;

// Product statuses with labels, descriptions, and colors
export const PRODUCT_STATUS_CONFIG = {
  active: {
    label: "Active",
    description: "Sell via selected sales channels and markets",
    color: "bg-green-100 text-green-800",
  },
  draft: {
    label: "Draft",
    description: "Not visible on selected sales channels or markets",
    color: "bg-gray-100 text-gray-800",
  },
  unlisted: {
    label: "Unlisted",
    description: "Accessible only by direct link",
    color: "bg-yellow-100 text-yellow-800",
  },
} as const;

// Navigation items for different roles
export const ADMIN_NAV_ITEMS = [
  { label: "Dashboard", href: "/admin/dashboard", icon: "LayoutDashboard" },
  { label: "Users", href: "/admin/users", icon: "Users" },
  { label: "Vendors", href: "/admin/vendors", icon: "Store" },
  { label: "Products", href: "/admin/products", icon: "Package" },
  { label: "Categories", href: "/admin/categories", icon: "Tags" },
  { label: "Brands", href: "/admin/brands", icon: "Tag" },
  { label: "Orders", href: "/admin/orders", icon: "ShoppingCart" },
  { label: "Settings", href: "/admin/settings", icon: "Settings" },
] as const;

export const VENDOR_NAV_ITEMS = [
  { label: "Dashboard", href: "/vendor/dashboard", icon: "LayoutDashboard" },
  { label: "Products", href: "/vendor/products", icon: "Package" },
  { label: "Orders", href: "/vendor/orders", icon: "ShoppingCart" },
  { label: "Analytics", href: "/vendor/analytics", icon: "BarChart" },
  { label: "Settings", href: "/vendor/settings", icon: "Settings" },
] as const;

export const CUSTOMER_NAV_ITEMS = [
  { label: "My Orders", href: "/account/orders", icon: "ShoppingBag" },
  { label: "My Wishlist", href: "/wishlist", icon: "Heart" },
  { label: "My Addresses", href: "/addresses", icon: "MapPin" },
  { label: "Account Settings", href: "/settings", icon: "Settings" },
] as const;

// Sorting options for products
export const PRODUCT_SORT_OPTIONS = [
  { label: "Newest", value: "createdAt:desc" },
  { label: "Oldest", value: "createdAt:asc" },
  { label: "Price: Low to High", value: "price:asc" },
  { label: "Price: High to Low", value: "price:desc" },
  { label: "Name: A to Z", value: "name:asc" },
  { label: "Name: Z to A", value: "name:desc" },
  { label: "Best Selling", value: "totalSales:desc" },
  { label: "Top Rated", value: "rating:desc" },
] as const;

// Items per page options
export const PER_PAGE_OPTIONS = [12, 24, 48, 96] as const;

// Payment methods
export const PAYMENT_METHODS = [
  { id: "card", label: "Credit/Debit Card", icon: "CreditCard" },
  { id: "paypal", label: "PayPal", icon: "Wallet" },
  { id: "razorpay", label: "Razorpay", icon: "Wallet" },
  { id: "paystack", label: "Paystack", icon: "Wallet" },
  { id: "cod", label: "Cash on Delivery", icon: "Banknote" },
] as const;

// Countries list
export const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola",
  "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
  "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus",
  "Belgium", "Belize", "Benin", "Bhutan", "Bolivia",
  "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria",
  "Burkina Faso", "Burundi", "Cambodia", "Cameroon", "Canada",
  "Chile", "China", "Colombia", "Costa Rica", "Croatia",
  "Cuba", "Cyprus", "Czech Republic", "Denmark", "Dominican Republic",
  "Ecuador", "Egypt", "El Salvador", "Estonia", "Ethiopia",
  "Fiji", "Finland", "France", "Georgia", "Germany",
  "Ghana", "Greece", "Guatemala", "Guinea", "Guyana",
  "Haiti", "Honduras", "Hong Kong", "Hungary", "Iceland",
  "India", "Indonesia", "Iran", "Iraq", "Ireland",
  "Israel", "Italy", "Jamaica", "Japan", "Jordan",
  "Kazakhstan", "Kenya", "Kuwait", "Kyrgyzstan", "Laos",
  "Latvia", "Lebanon", "Liberia", "Libya", "Lithuania",
  "Luxembourg", "Macao", "Malaysia", "Maldives", "Mali",
  "Malta", "Mauritius", "Mexico", "Moldova", "Monaco",
  "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar",
  "Namibia", "Nepal", "Netherlands", "New Zealand", "Nicaragua",
  "Niger", "Nigeria", "North Macedonia", "Norway", "Oman",
  "Pakistan", "Palestine", "Panama", "Papua New Guinea", "Paraguay",
  "Peru", "Philippines", "Poland", "Portugal", "Qatar",
  "Romania", "Russia", "Rwanda", "Saudi Arabia", "Senegal",
  "Serbia", "Sierra Leone", "Singapore", "Slovakia", "Slovenia",
  "Somalia", "South Africa", "South Korea", "Spain", "Sri Lanka",
  "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
  "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Togo",
  "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Uganda",
  "Ukraine", "United Arab Emirates", "United Kingdom", "United States",
  "Uruguay", "Uzbekistan", "Venezuela", "Vietnam", "Yemen",
  "Zambia", "Zimbabwe",
] as const;

// Floating label CSS classes for Shopify-style inputs
export const FLOATING_INPUT_CLASS =
  "peer h-14 rounded-lg pt-6 pb-1.5 text-base placeholder-transparent";
export const FLOATING_LABEL_CLASS =
  "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground transition-all duration-150 peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-xs peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-xs";
