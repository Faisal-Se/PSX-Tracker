/**
 * PSX sector-code → display-name map.
 * Codes come from dps.psx.com.pk market watch (the `sector` field is a numeric
 * PSX classification code, not a name). Verified against known tickers
 * (e.g. 0807→banks via MEBL/UBL/HBL, 0820→oil&gas via OGDC/PPL/MARI).
 * Unmapped codes fall back to the raw code via sectorName().
 */
export const SECTOR_NAMES: Record<string, string> = {
  "0801": "Auto Assembler",
  "0802": "Auto Parts",
  "0804": "Cement",
  "0805": "Chemical",
  "0807": "Banking",
  "0808": "Engineering",
  "0809": "Fertilizer",
  "0810": "Food & Personal Care",
  "0812": "Textile",
  "0813": "Investment Banks",
  "0818": "Pharma",
  "0819": "Paper & Board",
  "0820": "Energy",
  "0821": "Oil Marketing",
  "0822": "Power",
  "0823": "Refinery",
  "0824": "Power",
  "0826": "Sugar",
  "0828": "Tech",
  "0829": "Textile Composite",
  "0830": "Textile Spinning",
  "0837": "Misc",
};

/** Short labels for the dashboard KSE strip (kept compact). */
const SHORT: Record<string, string> = {
  Banking: "Banking",
  Energy: "Energy",
  Cement: "Cement",
  Tech: "Tech",
  Fertilizer: "Fertilizer",
};

export function sectorName(code: string | undefined): string {
  if (!code) return "Other";
  return SECTOR_NAMES[code] || code;
}

/** Preferred sectors (and order) for the KSE-100 strip movers row. */
export const STRIP_SECTORS = ["0807", "0820", "0804", "0828", "0809"] as const;

export function stripSectorLabel(code: string): string {
  const name = sectorName(code);
  return SHORT[name] || name;
}
