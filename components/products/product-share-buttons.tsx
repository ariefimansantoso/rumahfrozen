"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useTranslations } from "next-intl";
import { Check, Link2, Mail, Share2 } from "lucide-react";
import { useAppSettings } from "@/providers/app-settings-provider";
import { toast } from "@/components/ui/toast-notification";
import {
  buildCustomShareUrl,
  resolveShareSettings,
  type ShareSettings,
} from "@/lib/share-config";
import { cn } from "@/lib/utils";

interface ProductShareButtonsProps {
  productName: string;
  /** Optional canonical URL. Defaults to the current page URL on the client. */
  url?: string;
  image?: string;
  shareText?: string;
  shareSettings?: ShareSettings;
  className?: string;
}

type SvgIcon = ComponentType<{ className?: string }>;

export function ProductShareButtons({
  productName,
  url,
  image,
  shareText: shareTextProp,
  shareSettings: shareSettingsOverride,
  className,
}: ProductShareButtonsProps) {
  const t = useTranslations();
  const { shareSettings: appShareSettings } = useAppSettings();
  const shareSettings = useMemo(
    () => resolveShareSettings(shareSettingsOverride ?? appShareSettings),
    [appShareSettings, shareSettingsOverride],
  );
  const [pageUrl, setPageUrl] = useState(url ?? "");
  const [copied, setCopied] = useState(false);

  const tr = (key: string, fallback: string) =>
    t.has(key) ? t(key) : fallback;

  useEffect(() => {
    if (url) {
      setPageUrl(url);
    } else if (typeof window !== "undefined") {
      setPageUrl(window.location.href);
    }
  }, [url]);

  const getSharePageUrl = () => {
    if (pageUrl) return pageUrl;
    if (url) return url;
    if (typeof window !== "undefined") return window.location.href;
    return "";
  };

  const encodedUrl = encodeURIComponent(pageUrl);
  const shareText =
    shareTextProp ||
    tr("product.shareProduct", "Share this product with friends and family");
  const encodedText = encodeURIComponent(productName);
  const encodedImage = image ? encodeURIComponent(image) : "";

  const networks = useMemo(() => {
    const items: Array<{
      key: string;
      enabled: boolean;
      label: string;
      href: string;
      icon: SvgIcon;
      brandClass: string;
    }> = [
      {
        key: "facebook",
        enabled: shareSettings.facebook,
        label: tr("product.share.facebook", "Share on Facebook"),
        href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
        icon: FacebookGlyph,
        brandClass: "hover:border-[#1877F2] hover:text-[#1877F2]",
      },
      {
        key: "twitter",
        enabled: shareSettings.twitter,
        label: tr("product.share.twitter", "Share on X"),
        href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
        icon: XGlyph,
        brandClass: "hover:border-foreground hover:text-foreground",
      },
      {
        key: "whatsapp",
        enabled: shareSettings.whatsapp,
        label: tr("product.share.whatsapp", "Share on WhatsApp"),
        href: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
        icon: WhatsAppGlyph,
        brandClass: "hover:border-[#25D366] hover:text-[#25D366]",
      },
      {
        key: "telegram",
        enabled: shareSettings.telegram,
        label: tr("product.share.telegram", "Share on Telegram"),
        href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
        icon: TelegramGlyph,
        brandClass: "hover:border-[#229ED9] hover:text-[#229ED9]",
      },
      {
        key: "pinterest",
        enabled: shareSettings.pinterest,
        label: tr("product.share.pinterest", "Pin it"),
        href: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedText}${
          encodedImage ? `&media=${encodedImage}` : ""
        }`,
        icon: PinterestGlyph,
        brandClass: "hover:border-[#E60023] hover:text-[#E60023]",
      },
      {
        key: "linkedin",
        enabled: shareSettings.linkedin,
        label: tr("product.share.linkedin", "Share on LinkedIn"),
        href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
        icon: LinkedInGlyph,
        brandClass: "hover:border-[#0A66C2] hover:text-[#0A66C2]",
      },
    ];
    return items.filter((item) => item.enabled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareSettings, encodedUrl, encodedText, encodedImage]);

  const customLinks = useMemo(
    () =>
      shareSettings.custom
        .filter(
          (item) =>
            item.enabled && item.label.trim() && item.urlTemplate.trim(),
        )
        .map((item) => ({
          id: item.id,
          label: item.label.trim(),
          iconUrl: item.icon?.trim() || "",
          urlTemplate: item.urlTemplate,
          href: buildCustomShareUrl(item.urlTemplate, {
            url: pageUrl,
            title: productName,
            image,
          }),
        }))
        .filter((item) => item.href),
    [shareSettings.custom, pageUrl, productName, image],
  );

  const showCopy = shareSettings.copyLink;
  const showEmail = shareSettings.email;

  const hasAnything =
    showCopy ||
    showEmail ||
    networks.length > 0 ||
    customLinks.length > 0;

  if (!shareSettings.enabled || !hasAnything) return null;

  const handleCopy = async () => {
    if (!pageUrl) return;
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      toast.success(tr("product.share.copied", "Link copied"));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(tr("common.error", "Something went wrong"));
    }
  };

  const emailHref = `mailto:?subject=${encodedText}&body=${encodeURIComponent(
    `${shareText}\n${pageUrl}`,
  )}`;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="mr-1 text-sm font-medium text-foreground">
        {tr("product.share.label", "Share")}
      </span>

      {networks.map((network) => (
        <ShareLink
          key={network.key}
          href={network.href}
          getHref={() => buildNetworkShareHref(network.key, {
            url: getSharePageUrl(),
            title: productName,
            image,
          })}
          label={network.label}
          icon={network.icon}
          className={network.brandClass}
        />
      ))}

      {customLinks.map((link) => (
        <ShareLink
          key={link.id}
          href={link.href}
          label={link.label}
          icon={Share2}
          iconUrl={link.iconUrl}
          getHref={() =>
            buildCustomShareUrl(link.urlTemplate, {
              url: getSharePageUrl(),
              title: productName,
              image,
            })
          }
          className="hover:border-foreground hover:text-foreground"
        />
      ))}

      {showEmail ? (
        <ShareLink
          href={emailHref}
          label={tr("product.share.email", "Share via email")}
          icon={Mail}
          external={false}
          className="hover:border-foreground hover:text-foreground"
        />
      ) : null}

      {showCopy ? (
        <ShareButton
          label={
            copied
              ? tr("product.share.copied", "Link copied")
              : tr("product.share.copyLink", "Copy link")
          }
          icon={copied ? Check : Link2}
          onClick={handleCopy}
          className={cn(
            "hover:border-foreground hover:text-foreground",
            copied && "border-green-500 text-green-600",
          )}
        />
      ) : null}
    </div>
  );
}

const buttonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors";

function ShareButton(props: {
  label: string;
  icon: SvgIcon;
  onClick: () => void;
  className?: string;
}) {
  const { label, icon: Icon, onClick, className } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(buttonClass, className)}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function ShareLink(props: {
  href: string;
  label: string;
  icon: SvgIcon;
  /** Optional uploaded icon URL; takes precedence over the glyph when set. */
  iconUrl?: string;
  getHref?: () => string;
  external?: boolean;
  className?: string;
}) {
  const {
    href,
    label,
    icon: Icon,
    iconUrl,
    getHref,
    external = true,
    className,
  } = props;
  return (
    <a
      href={href}
      aria-label={label}
      title={label}
      className={cn(buttonClass, className)}
      onClick={(event) => {
        if (!external || !getHref) return;
        const nextHref = getHref();
        if (!nextHref) return;
        event.preventDefault();
        window.open(nextHref, "_blank", "noopener,noreferrer");
      }}
      {...(external
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
    >
      {iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={iconUrl}
          alt=""
          className="h-4 w-4 object-contain"
          aria-hidden
        />
      ) : (
        <Icon className="h-4 w-4" />
      )}
    </a>
  );
}

function buildNetworkShareHref(
  key: string,
  values: { url: string; title: string; image?: string },
) {
  const encodedCurrentUrl = encodeURIComponent(values.url);
  const encodedTitle = encodeURIComponent(values.title);
  const encodedCurrentImage = values.image
    ? encodeURIComponent(values.image)
    : "";

  if (!encodedCurrentUrl) return "";

  if (key === "facebook") {
    return `https://www.facebook.com/sharer/sharer.php?u=${encodedCurrentUrl}`;
  }
  if (key === "twitter") {
    return `https://twitter.com/intent/tweet?url=${encodedCurrentUrl}&text=${encodedTitle}`;
  }
  if (key === "whatsapp") {
    return `https://wa.me/?text=${encodedTitle}%20${encodedCurrentUrl}`;
  }
  if (key === "telegram") {
    return `https://t.me/share/url?url=${encodedCurrentUrl}&text=${encodedTitle}`;
  }
  if (key === "pinterest") {
    return `https://pinterest.com/pin/create/button/?url=${encodedCurrentUrl}&description=${encodedTitle}${
      encodedCurrentImage ? `&media=${encodedCurrentImage}` : ""
    }`;
  }
  if (key === "linkedin") {
    return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedCurrentUrl}`;
  }

  return "";
}

/* ----------------------------- Brand glyphs ----------------------------- */

function FacebookGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.78-3.9 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.44 2.91h-2.34V22c4.78-.79 8.44-4.94 8.44-9.94Z" />
    </svg>
  );
}

function XGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z" />
    </svg>
  );
}

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.13h-.01a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.11.82.83-3.04-.2-.31a8.22 8.22 0 0 1-1.26-4.36c0-4.54 3.7-8.23 8.24-8.23a8.2 8.2 0 0 1 5.82 2.42 8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.16.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  );
}

function TelegramGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M21.94 4.64 18.6 20.4c-.25 1.1-.9 1.37-1.83.85l-5.05-3.72-2.44 2.35c-.27.27-.5.5-1.02.5l.36-5.16 9.39-8.49c.41-.36-.09-.56-.63-.2L4.16 13.1l-5-1.57c-1.09-.34-1.11-1.09.23-1.61L20.53 3.1c.9-.34 1.69.2 1.41 1.54Z" />
    </svg>
  );
}

function PinterestGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2C6.48 2 2 6.48 2 12c0 4.24 2.64 7.86 6.36 9.32-.09-.79-.17-2.01.03-2.88.18-.78 1.17-4.97 1.17-4.97s-.3-.6-.3-1.49c0-1.39.81-2.43 1.81-2.43.85 0 1.27.64 1.27 1.41 0 .86-.55 2.14-.83 3.33-.24 1 .5 1.81 1.48 1.81 1.78 0 3.14-1.87 3.14-4.58 0-2.39-1.72-4.07-4.18-4.07-2.85 0-4.52 2.13-4.52 4.34 0 .86.33 1.78.74 2.28.08.1.09.19.07.29-.08.32-.25 1-.28 1.14-.04.18-.15.22-.34.13-1.26-.59-2.05-2.43-2.05-3.91 0-3.18 2.31-6.1 6.66-6.1 3.5 0 6.22 2.49 6.22 5.82 0 3.47-2.19 6.27-5.23 6.27-1.02 0-1.98-.53-2.31-1.16l-.63 2.4c-.23.88-.85 1.98-1.26 2.65.95.29 1.95.45 3 .45 5.52 0 10-4.48 10-10S17.52 2 12 2Z" />
    </svg>
  );
}

function LinkedInGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14ZM7.12 20.45H3.55V9h3.57v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
    </svg>
  );
}
