import { useState } from "react";
import { ArrowUpDown } from "lucide-react";

interface CountryRevenueRow {
  country: string;
  amountCents: number;
  purchases: number;
}

interface CountryRevenueTableProps {
  data: CountryRevenueRow[];
}

// ISO 3166-1 alpha-2 → human-readable name
const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  GB: "United Kingdom",
  CA: "Canada",
  AU: "Australia",
  DE: "Germany",
  FR: "France",
  IN: "India",
  BR: "Brazil",
  MX: "Mexico",
  JP: "Japan",
  KR: "South Korea",
  NL: "Netherlands",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  CH: "Switzerland",
  AT: "Austria",
  ES: "Spain",
  IT: "Italy",
  PT: "Portugal",
  PL: "Poland",
  RU: "Russia",
  TR: "Turkey",
  ZA: "South Africa",
  NG: "Nigeria",
  EG: "Egypt",
  SG: "Singapore",
  HK: "Hong Kong",
  TW: "Taiwan",
  ID: "Indonesia",
  PH: "Philippines",
  TH: "Thailand",
  VN: "Vietnam",
  MY: "Malaysia",
  PK: "Pakistan",
  BD: "Bangladesh",
  NZ: "New Zealand",
  AR: "Argentina",
  CL: "Chile",
  CO: "Colombia",
  PE: "Peru",
  Unknown: "Unknown",
};

function countryName(code: string) {
  return COUNTRY_NAMES[code] ?? code;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

type SortKey = "country" | "amountCents" | "purchases";

export function CountryRevenueTable({ data }: CountryRevenueTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("amountCents");
  const [sortAsc, setSortAsc] = useState(false);

  if (data.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">No purchases yet</p>
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "country") cmp = countryName(a.country).localeCompare(countryName(b.country));
    else if (sortKey === "amountCents") cmp = a.amountCents - b.amountCents;
    else cmp = a.purchases - b.purchases;
    return sortAsc ? cmp : -cmp;
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(false); }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 pr-4 font-medium">
              <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("country")}>
                Country <ArrowUpDown className="size-3" />
              </button>
            </th>
            <th className="pb-2 pr-4 font-medium text-right">
              <button type="button" className="flex items-center justify-end gap-1 w-full hover:text-foreground" onClick={() => toggleSort("amountCents")}>
                Revenue <ArrowUpDown className="size-3" />
              </button>
            </th>
            <th className="pb-2 font-medium text-right">
              <button type="button" className="flex items-center justify-end gap-1 w-full hover:text-foreground" onClick={() => toggleSort("purchases")}>
                Purchases <ArrowUpDown className="size-3" />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.country} className="border-b last:border-0">
              <td className="py-2 pr-4">{countryName(row.country)}</td>
              <td className="py-2 pr-4 text-right tabular-nums">{formatCurrency(row.amountCents)}</td>
              <td className="py-2 text-right tabular-nums">{row.purchases}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
