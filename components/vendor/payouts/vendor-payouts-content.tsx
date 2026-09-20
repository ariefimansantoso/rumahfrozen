"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  PayoutsTableCard,
  usePayoutStatusTabs,
  type PayoutTableRow,
} from "@/components/payouts/payouts-table-card";
import { useListQuery } from "@/hooks/use-list-query";

interface VendorPayoutsContentProps {
  locale: string;
  initialPage?: number;
  initialSearch?: string;
  initialStatus?: string;
  initialSortBy?: string;
  initialSortOrder?: "asc" | "desc";
}

export function VendorPayoutsContent({
  locale,
  initialPage = 1,
  initialSearch = "",
  initialStatus = "all",
  initialSortBy = "createdAt",
  initialSortOrder = "desc",
}: VendorPayoutsContentProps) {
  const t = useTranslations();
  const router = useRouter();
  const tabs = usePayoutStatusTabs();

  const list = useListQuery<PayoutTableRow>({
    endpoint: "/api/vendor/payouts",
    initialPage,
    initialPageSize: 20,
    initialSearch,
    initialTab: initialStatus,
    initialSortBy,
    initialSortOrder,
    errorMessage: t("common.error"),
  });

  return (
    <div className="space-y-6">
      <div className="-mt-2">
        <h1 className="text-3xl font-bold">
          {t("vendor.payoutsPage.title")}
        </h1>
        <p className="text-muted-foreground">
          {t("vendor.payoutsPage.subtitle")}
        </p>
      </div>

      <PayoutsTableCard
        locale={locale}
        data={list.items}
        isLoading={list.isLoading}
        title={t("vendor.payoutsPage.listSection.title")}
        detailHref={(row) => `/${locale}/vendor/payouts/${row._id}`}
        onRowOpen={(row) => router.push(`/${locale}/vendor/payouts/${row._id}`)}
        tabs={tabs}
        activeTab={list.activeTab}
        onTabChange={list.handleTabChange}
        searchPlaceholder={t("vendor.payoutsPage.listSection.searchPlaceholder")}
        searchValue={list.search}
        onSearchChange={list.handleSearchChange}
        filterValues={{ status: list.activeTab }}
        pagination={list.pagination}
        onPageChange={list.handlePageChange}
        onPageSizeChange={list.handlePageSizeChange}
        sortColumn={list.sortBy}
        sortDirection={list.sortOrder}
        onSortChange={list.handleSortChange}
        rowActionsHeader={t("vendor.payoutsPage.listSection.columns.details")}
        emptyMessage={t("vendor.payoutsPage.listSection.empty")}
      />
    </div>
  );
}
