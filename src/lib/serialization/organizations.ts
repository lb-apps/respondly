import type { Organization } from "@/types/database"
import type {
  OrganizationPayload,
  OrgAddressPayload,
  OrgBankAccountPayload,
  OrgCompanyInfoPayload,
  OrgContactPayload,
  OrgSettingsPayload,
} from "@/types/serialization"

function asRecord(val: unknown): Record<string, unknown> {
  return val != null && typeof val === "object" && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : {}
}

function strOrNull(val: unknown): string | null {
  return val != null && val !== "" ? String(val) : null
}

function numOrNull(val: unknown): number | null {
  const n = Number(val)
  return Number.isFinite(n) ? n : null
}

export function toOrganizationPayload(org: Organization): OrganizationPayload {
  const c = asRecord(org.contact)
  const a = asRecord(org.address)
  const ci = asRecord(org.company_info)
  const s = asRecord(org.settings)

  const contact: OrgContactPayload = {
    phone: strOrNull(c.phone),
    email: strOrNull(c.email),
    fax: strOrNull(c.fax),
    website: strOrNull(c.website),
  }

  const address: OrgAddressPayload = {
    building_no: strOrNull(a.building_no),
    apartment_no: strOrNull(a.apartment_no),
    postal_code: strOrNull(a.postal_code),
    country: strOrNull(a.country),
    province_id: strOrNull(a.province_id),
    province_name: strOrNull(a.province_name),
    district_id: strOrNull(a.district_id),
    district_name: strOrNull(a.district_name),
    neighborhood_id: strOrNull(a.neighborhood_id),
    neighborhood_name: strOrNull(a.neighborhood_name),
    street_id: strOrNull(a.street_id),
    street_name: strOrNull(a.street_name),
  }

  const rawBankAccounts = ci.bank_accounts
  const bankAccounts: OrgBankAccountPayload[] | null = Array.isArray(rawBankAccounts)
    ? (rawBankAccounts as unknown[]).reduce<OrgBankAccountPayload[]>((acc, entry) => {
        if (entry != null && typeof entry === "object" && !Array.isArray(entry)) {
          const e = entry as Record<string, unknown>
          const currency = strOrNull(e.currency)
          const iban = strOrNull(e.iban)
          if (currency && iban) {
            acc.push({ currency, iban, label: strOrNull(e.label) })
          }
        }
        return acc
      }, [])
    : null

  const companyInfo: OrgCompanyInfoPayload = {
    company_title: strOrNull(ci.company_title),
    tax_id: strOrNull(ci.tax_id),
    tax_office: strOrNull(ci.tax_office),
    mersis_no: strOrNull(ci.mersis_no),
    trade_registry_no: strOrNull(ci.trade_registry_no),
    kep_address: strOrNull(ci.kep_address),
    nace_code: strOrNull(ci.nace_code),
    bank_accounts: bankAccounts && bankAccounts.length > 0 ? bankAccounts : null,
  }

  const settings: OrgSettingsPayload = {
    fiscal_year_start_month: numOrNull(s.fiscal_year_start_month),
  }

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    logo_url: org.logo_url,
    timezone: org.timezone,
    currency: org.currency ?? "TRY",
    settings,
    contact,
    address,
    company_info: companyInfo,
  }
}
