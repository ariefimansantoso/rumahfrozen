export function formatCurrency(
  amount: number,
  currency: string,
  locale?: string,
  options?: Intl.NumberFormatOptions,
): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const currencyCode = (currency || "USD").toUpperCase();

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      ...options,
    }).format(safeAmount);
  } catch {
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeAmount);
    return `${formatted} ${currencyCode}`;
  }
}

