import { Suspense } from "react";
import {
  Store,
  Users,
  Percent,
  Zap,
  BarChart3,
  TrendingUp,
  ClipboardList,
} from "lucide-react";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { VendorRegistrationForm } from "@/components/vendor/vendor-registration-form";
import { isMultiVendorEnabled } from "@/lib/multi-vendor";
import { DEFAULT_STORE_NAME } from "@/config/branding.config";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function BecomeVendorPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const multiVendorEnabled = await isMultiVendorEnabled();
  if (!multiVendorEnabled) {
    redirect(`/${locale}`);
  }

  const t = await getTranslations({ locale });

  const features = [
    {
      icon: Users,
      title: t("vendor.registration.benefit1Title"),
      desc: t("vendor.registration.benefit1Desc"),
    },
    {
      icon: Percent,
      title: t("vendor.registration.benefit2Title"),
      desc: t("vendor.registration.benefit2Desc"),
    },
    {
      icon: Zap,
      title: t("vendor.registration.benefit3Title"),
      desc: t("vendor.registration.benefit3Desc"),
    },
    {
      icon: BarChart3,
      title: t("vendor.registration.benefit4Title"),
      desc: t("vendor.registration.benefit4Desc"),
    },
  ];

  return (
    <div className="flex flex-col lg:flex-row lg:min-h-[560px]">
      {/* Left Side - Brand Section */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden">
        {/* Smooth mesh: white highlights + dark depth over the theme primary
            (theme-neutral so it adapts to any Storify brand color) */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 15% 20%, rgba(255,255,255,0.20), transparent 45%), radial-gradient(circle at 88% 85%, rgba(0,0,0,0.40), transparent 55%), radial-gradient(circle at 95% 12%, rgba(255,255,255,0.12), transparent 42%)",
          }}
        />

        {/* Flowing decorative waves */}
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.18]"
          preserveAspectRatio="none"
          viewBox="0 0 600 900"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M-50 250 Q 200 150 400 300 T 800 280"
            fill="none"
            stroke="white"
            strokeWidth="1.5"
          />
          <path
            d="M-50 360 Q 220 240 460 400 T 850 360"
            fill="none"
            stroke="white"
            strokeWidth="1"
          />
          <path
            d="M-50 470 Q 240 360 480 520 T 880 470"
            fill="none"
            stroke="white"
            strokeWidth="1"
          />
        </svg>

        {/* Corner dot textures */}
        <DotPatch className="absolute right-8 top-10 opacity-30" />
        <DotPatch className="absolute bottom-10 left-8 opacity-20" />

        {/* Soft glow orbs */}
        <div className="absolute -top-24 -left-20 h-80 w-80 rounded-full bg-white/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-white/10 blur-3xl" />

        {/* Content */}
        <div className="relative z-10 flex w-full flex-col justify-center px-10 py-8 text-white xl:px-14">
          {/* Heading */}
          <h1 className="text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
            {t("vendor.registration.startSelling")}
          </h1>
          <p className="mt-4 max-w-md text-lg text-white/80">
            {t("vendor.registration.joinUs")}
          </p>

          {/* Features + Illustration */}
          <div className="mt-10 flex items-center gap-6">
            <div className="flex-1 space-y-6">
              {features.map((feature) => (
                <FeatureItem
                  key={feature.title}
                  icon={feature.icon}
                  title={feature.title}
                  desc={feature.desc}
                />
              ))}
            </div>

            {/* Isometric store graphic */}
            <div className="hidden w-[300px] shrink-0 xl:block">
              <StoreIllustration />
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full bg-muted/30 lg:w-1/2 flex flex-col justify-center px-4 py-6 sm:px-8 lg:px-12 xl:px-16">
        <div className="mx-auto w-full max-w-2xl">
          {/* Mobile logo */}
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <Store className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">{DEFAULT_STORE_NAME}</span>
          </div>

          {/* Form card */}
          <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-xl shadow-black/[0.04] sm:p-6">
            {/* Header */}
            <div className="mb-4">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                {t("vendor.registration.welcomeTitle")}
              </h2>
              <p className="mt-1.5 text-muted-foreground">
                {t("vendor.registration.welcomeSubtitle")}
              </p>
            </div>

            {/* Form */}
            <Suspense fallback={<FormSkeleton />}>
              <VendorRegistrationForm locale={locale} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/15 backdrop-blur-sm">
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <h3 className="font-semibold leading-tight text-white">{title}</h3>
        <p className="mt-1 text-sm leading-snug text-white/70">{desc}</p>
      </div>
    </div>
  );
}

function DotPatch({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="110"
      height="110"
      viewBox="0 0 110 110"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          id="dots-patch"
          width="18"
          height="18"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="2" cy="2" r="2" fill="white" />
        </pattern>
      </defs>
      <rect width="110" height="110" fill="url(#dots-patch)" />
    </svg>
  );
}

/**
 * Isometric storefront illustration built with inline SVG.
 * Uses white/glass tones for the structure and the theme primary
 * (var(--primary)) for accents so it adapts to any Storify brand color.
 */
function StoreIllustration() {
  return (
    <div className="relative h-[340px] w-full">
      {/* Floating: Total Sales */}
      <div className="absolute left-0 top-2 z-20 w-40 rounded-2xl border border-white/20 bg-white/10 p-3 shadow-2xl shadow-black/20 backdrop-blur-md">
        <div className="text-[10px] font-medium uppercase tracking-wide text-white/70">
          Total Sales
        </div>
        <div className="mt-0.5 text-lg font-bold text-white">$23,456</div>
        <svg
          className="mt-1 h-6 w-full"
          viewBox="0 0 120 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M2 24 L24 16 L44 20 L66 8 L88 12 L118 2"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="118" cy="2" r="2.5" fill="white" />
        </svg>
      </div>

      {/* Floating: Orders badge */}
      <div className="absolute right-0 top-16 z-20 flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-3 py-2 shadow-2xl shadow-black/20 backdrop-blur-md">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
          <ClipboardList className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="text-sm font-bold leading-none text-white">2,245</div>
          <div className="text-[10px] text-white/70">Orders</div>
        </div>
      </div>

      {/* Floating: Growth badge */}
      <div className="absolute bottom-6 left-2 z-20 flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-3 py-2 shadow-2xl shadow-black/20 backdrop-blur-md">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
          <TrendingUp className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="text-sm font-bold leading-none text-white">+18%</div>
          <div className="text-[10px] text-white/70">Growth</div>
        </div>
      </div>

      {/* The store */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 320 300"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="roofGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0.78" />
          </linearGradient>
          <linearGradient id="leftGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.82" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0.62" />
          </linearGradient>
          <linearGradient id="rightGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0.40" />
          </linearGradient>
          <clipPath id="awnLeft">
            <polygon points="160,131 74,88 74,108 160,151" />
          </clipPath>
          <clipPath id="awnRight">
            <polygon points="160,131 246,88 246,108 160,151" />
          </clipPath>
        </defs>

        {/* Ground shadow */}
        <ellipse cx="160" cy="248" rx="130" ry="34" fill="#000000" opacity="0.10" />

        {/* Platform thickness */}
        <polygon points="20,190 160,260 160,274 20,204" fill="#ffffff" opacity="0.18" />
        <polygon points="160,260 300,190 300,204 160,274" fill="#ffffff" opacity="0.10" />
        {/* Platform top */}
        <polygon
          points="160,120 300,190 160,260 20,190"
          fill="#ffffff"
          opacity="0.26"
        />
        <polygon
          points="160,120 300,190 160,260 20,190"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.35"
          strokeWidth="1"
        />

        {/* Walls */}
        <polygon points="160,223 74,180 74,88 160,131" fill="url(#leftGrad)" />
        <polygon points="160,223 246,180 246,88 160,131" fill="url(#rightGrad)" />
        {/* Roof */}
        <polygon points="160,131 74,88 160,45 246,88" fill="url(#roofGrad)" />

        {/* Awnings (white band + primary stripes) */}
        <g clipPath="url(#awnLeft)">
          <rect x="74" y="78" width="86" height="82" fill="#ffffff" opacity="0.96" />
          <rect x="74" y="78" width="11" height="82" fill="var(--primary)" opacity="0.9" />
          <rect x="96" y="78" width="11" height="82" fill="var(--primary)" opacity="0.9" />
          <rect x="118" y="78" width="11" height="82" fill="var(--primary)" opacity="0.9" />
          <rect x="140" y="78" width="11" height="82" fill="var(--primary)" opacity="0.9" />
        </g>
        <g clipPath="url(#awnRight)">
          <rect x="160" y="78" width="86" height="82" fill="#ffffff" opacity="0.82" />
          <rect x="164" y="78" width="11" height="82" fill="var(--primary)" opacity="0.7" />
          <rect x="186" y="78" width="11" height="82" fill="var(--primary)" opacity="0.7" />
          <rect x="208" y="78" width="11" height="82" fill="var(--primary)" opacity="0.7" />
          <rect x="230" y="78" width="11" height="82" fill="var(--primary)" opacity="0.7" />
        </g>
        {/* Awning lower edges */}
        <line x1="160" y1="151" x2="74" y2="108" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1" />
        <line x1="160" y1="151" x2="246" y2="108" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="1" />

        {/* Door on left wall */}
        <polygon
          points="146,216 120,203 120,150 146,163"
          fill="var(--primary)"
          fillOpacity="0.35"
        />
        <polygon
          points="146,216 120,203 120,150 146,163"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.6"
          strokeWidth="1.5"
        />
        <line x1="141" y1="186" x2="141" y2="199" stroke="#ffffff" strokeOpacity="0.8" strokeWidth="2" strokeLinecap="round" />

        {/* Window on left wall (beside the door) */}
        <polygon
          points="92,150 110,159 110,185 92,176"
          fill="#ffffff"
          opacity="0.32"
        />
        <polygon
          points="92,150 110,159 110,185 92,176"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.6"
          strokeWidth="1.5"
        />

        {/* STORE sign on the right wall (below the awning) */}
        <g transform="matrix(1,-0.5,0,1,201,182)">
          <text
            x="0"
            y="0"
            fill="#ffffff"
            fillOpacity="0.95"
            fontSize="12"
            fontWeight="700"
            letterSpacing="1.5"
            textAnchor="middle"
          >
            STORE
          </text>
        </g>

        {/* Roof finial */}
        <line x1="160" y1="45" x2="160" y2="28" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="2" strokeLinecap="round" />
        <circle cx="160" cy="26" r="4" fill="#ffffff" opacity="0.92" />
      </svg>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
      <Skeleton className="h-12 w-full rounded-lg" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
      <Skeleton className="h-12 w-full rounded-lg" />
    </div>
  );
}
