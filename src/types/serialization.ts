/**
 * Minimal payload types for Server → Client serialization.
 * Only include fields needed by the client to reduce payload size.
 */

// ============================================================
// Multi-tenancy payload types
// ============================================================

/** Organization fields needed for UI display and routing */
export interface OrgContactPayload {
  phone: string | null
  email: string | null
  fax: string | null
  website: string | null
}

export interface OrgAddressPayload {
  building_no: string | null
  apartment_no: string | null
  postal_code: string | null
  country: string | null
  province_id: string | null
  province_name: string | null
  district_id: string | null
  district_name: string | null
  neighborhood_id: string | null
  neighborhood_name: string | null
  street_id: string | null
  street_name: string | null
}

export interface OrgBankAccountPayload {
  currency: string
  iban: string
  label: string | null
}

export interface OrgCompanyInfoPayload {
  company_title: string | null
  tax_id: string | null
  tax_office: string | null
  mersis_no: string | null
  trade_registry_no: string | null
  kep_address: string | null
  nace_code: string | null
  bank_accounts: OrgBankAccountPayload[] | null
}

export interface OrgSettingsPayload {
  fiscal_year_start_month: number | null
}

export interface OrganizationPayload {
  id: string
  name: string
  slug: string
  logo_url: string | null
  timezone: string
  currency: string
  settings: OrgSettingsPayload | null
  contact: OrgContactPayload | null
  address: OrgAddressPayload | null
  company_info: OrgCompanyInfoPayload | null
}

/** Global role (shared across all organizations) */
export interface RolePayload {
  id: string
  name: string
  description: string | null
}

/** Profile fields needed for member display */
export interface ProfilePayload {
  id: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
}

/** Current authenticated user — ProfilePayload extended with auth email for nav display */
export interface UserPayload extends ProfilePayload {
  email: string
  phone: string | null
  job_title: string | null
  department: string | null
  last_login_at: string | null
  created_at: string
  updated_at: string
}

/** Organization member — flat shape returned by get_organization_members RPC */
export interface MemberPayload {
  id: string
  organization_id: string
  user_id: string
  role_id: string
  joined_at: string
  email: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  role_name: string
  role_description: string | null
}

/** Invitation with role joined */
export interface InvitationPayload {
  id: string
  organization_id: string
  email: string
  first_name: string | null
  last_name: string | null
  role_id: string
  status: "pending" | "accepted" | "expired" | "revoked"
  token: string
  expires_at: string
  created_at: string
  roles: RolePayload
}

// ============================================================
// Accounting payload types
// ============================================================

/** Category fields needed for dropdowns and display */
export interface CategoryPayload {
  id: string
  name: string
  entry_type: "debt" | "receivable" | "both"
}

/** Account with minimal category for dropdowns and entry_type logic */
export interface AccountPayload {
  id: string
  category_id: string
  name: string
  categories: CategoryPayload
}

/** Contact person linked to a buyer/supplier sub-account */
export interface AccountContactPayload {
  id: string
  account_id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  title: string | null
}

/** Voucher type row for selects (code + id from DB) */
export interface VoucherTypePayload {
  id: number
  code: string
  sort_order: number
}


/** Ledger main list: one row per voucher (summary only) */
export interface LedgerVoucherSummaryPayload {
  id: string
  voucher_type_id: number
  voucher_type_code: string
  date: string
  title: string | null
  line_count: number
  total_debt: number
  total_receivable: number
  balance_delta: number
  created_at: string
  updated_at: string
}

/** Single line inside a voucher (detail / edit) */
export interface LedgerVoucherLinePayload {
  id: string
  voucher_id: string
  date: string
  account_id: string
  statement: string | null
  receivable: number
  debt: number
  categories: CategoryPayload
  accounts: AccountPayload
}

/** Full voucher for edit dialog (header + lines from detail fetch) */
export interface LedgerVoucherDetailPayload {
  voucher: {
    id: string
    voucher_type_id: number
    voucher_type_code: string
    date: string
    title: string | null
    line_count: number
    total_debt: number
    total_receivable: number
    balance_delta: number
  }
  lines: LedgerVoucherLinePayload[]
}

/** @deprecated Use LedgerVoucherLinePayload */
export interface LedgerEntryPayload {
  id: string
  date: string
  account_id: string
  statement: string | null
  receivable: number
  debt: number
  categories: CategoryPayload
  accounts: AccountPayload
}

/** Draft entry (same as LedgerDraftEntry, keep for consistency) */
export interface LedgerDraftEntryPayload {
  id: string
  account_id: string
  statement: string
  type: "receivable" | "debt"
  amount: string
}

export interface LedgerDraftPayload {
  id: string
  date: string | null
  entries: LedgerDraftEntryPayload[]
  voucher_type_id: number | null
  created_at: string
  updated_at: string
}

/** Aggregated totals returned by the `get_ledger_page_totals` RPC */
export interface LedgerPageTotals {
  totalCount: number
  totalDebt: number
  totalReceivable: number
}

/** Merged PR row for Changelog Lab (RSC → client) */
export interface ChangelogPullRequestPayload {
  number: number
  title: string
  /** ISO timestamp if merged; empty string if open */
  mergedAt: string
  /** Empty string for open (unmerged) PRs */
  mergeCommitSha: string
  baseRef: string
  headRef: string
  state: "open" | "merged"
}

// ============================================================
// Stock module payload types
// ============================================================

export interface StockVatRatePayload {
  id: number
  code: string | null
  rate: number
  sort_order: number
}

export interface StockUnitPayload {
  id: number
  code: string
  sort_order: number
}

export interface StockCategoryPayload {
  id: string
  name: string
  created_at: string
  updated_at: string
  product_count?: number
}

export interface StockProductPayload {
  id: string
  organization_id: string
  category_id: string | null
  category_name: string | null
  unit_id: number
  unit_code: string
  name: string
  description: string | null
  vat_rate: number
  current_unit_price: number
  current_stock: number
  min_stock_level: number | null
  max_stock_level: number | null
  created_at: string
  updated_at: string
}

export interface StockWarehousePayload {
  id: string
  name: string
  created_at: string
  updated_at: string
  kpi?: {
    productCount: number
    totalStockValue: number
    lowStockCount: number
    totalEntry3m: number
    totalExit3m: number
    lastMovementDate: string | null
  }
}

export interface StockReceiptLinePayload {
  id: string
  receipt_id?: string
  product_id: string
  product_name: string
  unit_code: string
  quantity: number
  unit_price: number
  line_total: number
}

export interface StockReceiptPayload {
  id: string
  organization_id: string
  warehouse_id: string
  warehouse_name: string | null
  type: "entry" | "exit"
  date: string
  notes: string | null
  created_by?: string | null
  created_at: string
  updated_at?: string
  lines: StockReceiptLinePayload[]
  line_count?: number
  total_value?: number
}

export interface StockReceiptTemplateLinePayload {
  id: string
  template_id: string
  product_id: string
  product_name: string
  unit_id?: number
  unit_code: string
  current_unit_price?: number
  default_quantity: number | null
  sort_order?: number
}

export interface StockReceiptTemplatePayload {
  id: string
  organization_id: string
  name: string
  type: "entry" | "exit"
  warehouse_id: string | null
  warehouse_name: string | null
  notes: string | null
  created_at: string
  updated_at: string
  lines: StockReceiptTemplateLinePayload[]
  line_count?: number
}

// --- Dashboard payload ---

export interface StockLowStockProductPayload {
  product_id: string
  product_name: string
  description: string | null
  current_stock: number
  min_stock_level: number
  max_stock_level: number | null
  unit_code: string
}

/** Warehouse-product row from `get_org_stock_alerts`. */
export interface StockWarehouseAlertPayload {
  warehouse_id: string
  warehouse_name: string
  product_id: string
  product_name: string
  description: string | null
  current_stock: number
  min_stock_level: number
  max_stock_level: number | null
  unit_code: string
}

export interface StockOrgAlertsPayload {
  totalCount: number
  outCount: number
  criticalCount: number
  items: StockWarehouseAlertPayload[]
}

export interface StockTopProductPayload {
  product_id: string
  product_name: string
  total_entry: number
  total_exit: number
  /** Sum of entry + exit quantities in the current month. */
  total_movement: number
  unit_code: string
}

/** Row from `get_stock_product_activity` for the dashboard activity card. */
export interface StockProductActivityPayload {
  product_id: string
  product_name: string
  description: string | null
  unit_code: string
  total_exit: number
  avg_daily_exit: number
  daily_exit_trend: number[]
}

export interface StockWarehouseDistributionPayload {
  warehouse_id: string
  warehouse_name: string
  total_value: number
}

export interface StockCategoryDistributionPayload {
  category_id: string | null
  category_name: string
  total_value: number
}

export interface StockMonthlyTrendPayload {
  month: string
  total_entry: number
  total_exit: number
  /** Sum of line totals (quantity × unit_price) for entry receipts in the month. */
  total_entry_value: number
  /** Sum of line totals for exit receipts in the month. */
  total_exit_value: number
}

/** Daily aggregation variant used when date range < 2 months */
export interface StockDailyTrendPayload {
  date: string
  total_entry: number
  total_exit: number
  total_entry_value: number
  total_exit_value: number
}

export interface StockRecentMovementPayload {
  date: string
  type: "entry" | "exit"
  notes: string
  warehouse_id: string
  warehouse_name: string
  product_id: string
  product_name: string
  quantity: number
  unit_code: string
  unit_price: number
  line_total: number
}

/** Stock overview dashboard RPC payload (slim). */
export interface StockDashboardPayload {
  totalStockValue: number
  activeProductCount: number
  totalProductCount: number
  warehouseDistribution: StockWarehouseDistributionPayload[]
  categoryDistribution: StockCategoryDistributionPayload[]
  monthlyTrend: StockMonthlyTrendPayload[]
}

export interface StockReceiptCountsPayload {
  entry: number
  exit: number
}

// --- Product detail payload ---

export interface StockWarehouseStockPayload {
  warehouse_id: string
  warehouse_name: string
  quantity: number
}

export interface StockProductDetailPayload {
  product: StockProductPayload
  stockSummary: {
    currentTotalStock: number
    warehouseCount: number
    totalEntry3m: number
    totalExit3m: number
    avgDailyConsumption: number
    warehouseBreakdown: StockWarehouseStockPayload[]
  }
  priceHistory: Array<{
    date: string
    unit_price: number
    old_price: number | null
    source: string
  }>
  entryExitMonthly: StockMonthlyTrendPayload[]
  recentMovements: StockRecentMovementPayload[]
}

// --- Warehouse detail payload ---

export interface StockWarehouseProductStockPayload {
  product_id: string
  product_name: string
  description: string | null
  category_id: string | null
  category_name: string | null
  unit_code: string
  current_stock: number
  current_unit_price: number
  total_value: number
  min_stock_level: number | null
  max_stock_level: number | null
  is_low_stock: boolean
}

export interface StockWarehouseDetailPayload {
  warehouse: StockWarehousePayload
  kpiSummary: {
    productCount: number
    totalStockValue: number
    totalEntry3m: number
    totalExit3m: number
    lowStockCount: number
  }
  stockSummary: StockWarehouseProductStockPayload[]
  monthlyChart: StockMonthlyTrendPayload[]
  recentMovements: StockRecentMovementPayload[]
}

// --- Stock Count payloads ---

export interface StockCountLinePayload {
  id: string
  productId: string
  productName: string
  unitCode: string
  categoryName?: string | null
  systemQuantity: number
  countedQuantity: number | null
  difference: number
  /** Set by get_stock_count_detail RPC for counted lines. */
  isConsistent?: boolean
}

export interface StockCountPayload {
  id: string
  warehouseId: string
  warehouseName: string
  countedBy: string
  countedByName?: string
  countedByProfile: {
    firstName: string | null
    lastName: string | null
    avatarUrl: string | null
  } | null
  countDate: string
  description: string | null
  createdAt: string
  updatedAt: string
  lines: StockCountLinePayload[]
  /** Counted lines only (same as lines.length). */
  inconsistentLines: StockCountLinePayload[]
  /** Lines with counted_quantity set. */
  countedProducts: number
  /** Active products in the count warehouse (denominator for Ürünler KPI). */
  warehouseProductCount: number
  consistentCount: number
  inconsistentCount: number
  /** Sum of |difference| over inconsistent counted lines (SQL). */
  totalAbsDifference: number
}

export interface StockCountListItemPayload {
  id: string
  warehouseId: string
  warehouseName: string
  countedBy: string
  countedByProfile: {
    firstName: string | null
    lastName: string | null
    avatarUrl: string | null
  } | null
  countDate: string
  description: string | null
  createdAt: string
  totalProducts: number
  countedProducts: number
  consistentCount: number
  inconsistentCount: number
}

// --- Global search ---

export type StockGlobalSearchEntityType =
  | "product"
  | "warehouse"
  | "category"
  | "count"
  | "receipt"
  | "template"

export interface StockGlobalSearchProductItem {
  type: "product"
  id: string
  name: string
  description: string | null
  categoryName: string | null
}

export interface StockGlobalSearchWarehouseItem {
  type: "warehouse"
  id: string
  name: string
}

export interface StockGlobalSearchCategoryItem {
  type: "category"
  id: string
  name: string
  productCount: number
}

export interface StockGlobalSearchCountItem {
  type: "count"
  id: string
  warehouseId: string
  warehouseName: string
  countDate: string
  description: string | null
}

export interface StockGlobalSearchReceiptItem {
  type: "receipt"
  id: string
  receiptType: "entry" | "exit"
  date: string
  warehouseName: string | null
  notes: string | null
}

export interface StockGlobalSearchTemplateItem {
  type: "template"
  id: string
  name: string
  templateType: "entry" | "exit"
  warehouseName: string | null
}

export interface StockGlobalSearchResultsPayload {
  products: StockGlobalSearchProductItem[]
  warehouses: StockGlobalSearchWarehouseItem[]
  categories: StockGlobalSearchCategoryItem[]
  productsHasMore: boolean
  warehousesHasMore: boolean
  categoriesHasMore: boolean
  counts: StockGlobalSearchCountItem[]
  receipts: StockGlobalSearchReceiptItem[]
  templates: StockGlobalSearchTemplateItem[]
  countsHasMore: boolean
  receiptsHasMore: boolean
  templatesHasMore: boolean
}

export interface StockRecentSearchItemPayload {
  entityType: StockGlobalSearchEntityType
  entityId: string
  warehouseId?: string
  title: string
  subtitle: string | null
  clickedAt: string
}
