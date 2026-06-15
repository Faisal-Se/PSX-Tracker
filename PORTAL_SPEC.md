# PSX Tracker — Portal Design Specification

A complete reference of every screen, its data, and its actions — for designing the UI in Claude Design.

---

## 1. What the app is

**PSX Tracker** is a Pakistan Stock Exchange portfolio tracker + virtual trading app.

- **Auth:** Google Sign-in only. Each user's data is stored privately in **their own Google Drive** (app data folder) — the app never stores it server-side.
- **Live data:** Scrapes `dps.psx.com.pk` for the KSE-100 index, full market watch (500+ stocks), and per-stock price history.
- **Currency:** PKR (Pakistani Rupee), tabular figures throughout.
- **Two portfolio types:**
  - **Personal portfolios** — virtual cash + holdings, manual BUY/SELL trades.
  - **Model portfolios** — target % allocations with rebalance, SIP, and bulk-trade tooling (the flagship feature).

---

## 2. Navigation & app shell

- **Top navbar** (desktop): logo · primary links · search · notifications · account menu. Mobile collapses to a menu.
- **Primary nav order:** Dashboard · **Models** · Portfolio · Market · Performance · Analytics
- **"More" dropdown:** Watchlist · Transactions · What-If · Import · About
- **Public pages (no login):** `/home` (landing + Google sign-in), `/login`, `/`
- Logged-in users opening `/` go straight to Dashboard; visitors see the landing page.

### Design system (current target — "Robinhood light" direction)
- **Theme:** light (soft grey canvas `#f6f7f9`, white cards) — dark variant also supported.
- **Accent:** emerald green for gains, red/rose for losses. Green/red used ONLY for P&L / price-change values, never decoration.
- **Surfaces:** rounded-2xl cards, hairline borders, soft shadows, generous spacing.
- **Numbers:** tabular, semibold, large hero figures.
- **Motion:** count-up on hero value, chart draw-in, live pulse on KSE-100, smooth hover.
- **Charts:** Recharts — area (value over time), donut (allocation), horizontal bars (P&L), sparklines (per row).

---

## 3. Screens

### 3.1 Landing / Login — `/home`
**Public front door + sign-in.**
- Top navbar with "Sign in" (Google).
- Hero: big headline, subtext, **"Continue with Google"** button, product preview mock (faux dashboard in a browser frame).
- Sections: feature grid (6 features), stats band, Model Portfolios highlight, CTA, footer.

### 3.2 Dashboard — `/dashboard`
**Portfolio overview + market summary.** (This is the screen being redesigned to the dense Robinhood-light layout.)
- **Hero:** giant Portfolio Value (PKR) + today's change (abs + %), compact area chart, range pills (1D/1W/1M/3M/1Y/ALL).
- **Allocation donut** (beside hero): by value, top holdings + Cash, % legend.
- **Stat strip:** Invested · Cash · Today's P&L · Total Return.
- **KSE-100 strip:** live pulse dot, index value + % (place near top).
- **Model Portfolios:** prominent section — each model: name, value, P&L%, sparkline. (Make BIGGER.)
- **Holdings:** list/table — ticker avatar, symbol, company, sparkline, value, P&L%.
- **Top Gainers / Top Losers:** two ranked lists with % badges.
- **Widgets:** user can show/hide and reorder each section; balance hide/reveal toggle (blurs money figures).
- Actions: Hide balances, Widgets settings, Refresh.

### 3.3 Models (list) — `/models`
**All model portfolios.**
- Grid of model cards: name, total value, P&L, allocation bar (indigo/neutral), stock count, cash.
- "New Model Portfolio" creator: name, description, starting cash, pick stocks + set allocations (percent or shares mode), live preview.

### 3.4 Model Detail — `/models/[id]`  ⭐ flagship
**Manage one model portfolio.**
- **Hero:** Total Value + P&L badge. **Metric strip:** Cash · Invested · Market Value.
- **Holdings table:** Stock · Alloc % · Shares · Avg Price · Current · Value · P&L (each row has an edit pencil).
- **Allocation Breakdown:** bar + legend.
- **Charts:** P&L by Stock (horizontal bar) + Portfolio Composition (donut).
- **Stock Returns** list + **Transaction History** list.
- **Action buttons:** Add Cash · Withdraw · Bulk Trade · SIP · Rebalance.
- **7 dialogs:**
  1. **Add Cash** — amount input, shows current balance.
  2. **Withdraw Cash** — amount (max = balance), validation.
  3. **Edit Info** — name + description.
  4. **Edit Holding** — correct avg price / shares for a stock (doesn't touch tx history).
  5. **Rebalance** (2 steps) — set target allocations (% or exact shares, must total 100%) → confirm/enter trade prices per BUY/SELL.
  6. **Bulk Trade** — quick-sell holdings + add stocks to buy, multi-row BUY/SELL with quantities, cash check.
  7. **SIP** (2 steps) — enter amount, auto-distribute by current weights or target allocation → confirm buy prices → executes add-cash + buys.

### 3.5 Portfolio — `/portfolio`
**Personal portfolios.**
- Portfolio selector tabs + settings gear.
- Hero: Total Value + P&L badge. Allocation donut + legend.
- Metric strip: Cash · Invested · Market Value · Total P&L.
- Quick Trade (stock search). Holdings table (sortable): symbol, company, qty, avg, current, value, P&L; Trade per row.
- Dialogs: **Create Portfolio** (name, type: Personal/Trading/Family/Business, starting cash), **Edit Portfolio** (rename, type, add/remove cash, delete).

### 3.6 Market — `/market`
**Browse all PSX stocks.**
- Quick stat cards: Top Gainer, 2nd Gainer, Highest Volume.
- Toolbar: search · sector filter · sort (symbol / change / volume).
- Dense sortable table: Symbol · Sector · Price · Change · High/Low · Volume · Actions (watchlist + trade).

### 3.7 Stock Detail — `/stock/[symbol]`
**One stock deep-dive.**
- Hero: current price + change badge. Watch + Trade buttons.
- Stat cards: Open · Prev Close (LDCP) · High · Low · Volume.
- Price history **area chart** with period selector (1M/3M/6M/1Y/ALL).

### 3.8 Watchlist — `/watchlist`
**Tracked stocks (not owned).**
- Add-to-watchlist search.
- Table: Symbol · Price · Change · Volume · Actions (trade, remove).

### 3.9 Transactions — `/transactions`
**Trade history.**
- Portfolio filter dropdown.
- Table: Date · Type (BUY/SELL badge) · Stock · Portfolio · Qty · Price · Total.

### 3.10 Performance — `/performance`
**Returns & P&L trends.**
- Scope toggle: **All / Personal / Models**. Refresh.
- Summary strip: Total P&L (featured) · Net Worth · Invested · Cash.
- Investment Timeline **area chart** with period selector.
- P&L by Stock **horizontal bar chart** + Stock Returns list.

### 3.11 Analytics — `/analytics`
**Allocations, sectors, exports.**
- Scope toggle: All / Personal / Models. Export buttons (Holdings/Models/Transactions CSV).
- Summary strip: Total Portfolio · Invested · Total P&L · Holdings count.
- Asset Allocation **donut** (Stocks vs Cash) + Sector Allocation **donut**.
- P&L per Stock **bar chart**. Holdings Breakdown table with weight bars.

### 3.12 What-If — `/what-if`
**Investment simulator.**
- Budget input + stock search.
- Simulation table: Stock · Current Price · Invest Amount · Shares (calc) · Target Price · P&L. Editable, removable rows.
- Summary: Total Invested · Target Value · Simulated P&L · Portfolio Impact.

### 3.13 Import — `/import`
**Bulk import trades.**
- Step 1: target portfolio. Step 2: paste CSV → Parse → preview table → Import. Step 3: manual entry rows (Type/Symbol/Company/Qty/Price).

### 3.14 About — `/about`
**App info.** Description, features grid (6), developer card (Faisal Qayyum + Instagram), tech-stack badges.

---

## 4. Data model (entities)

- **Portfolio:** id, name, type, cashBalance, holdings[], transactions[].
- **Holding:** symbol, companyName, quantity, avgPrice (+ derived: currentPrice, value, P&L).
- **Transaction:** type (BUY/SELL), symbol, companyName, quantity, price, total, createdAt.
- **ModelPortfolio:** id, name, description, cashBalance, allocations[], transactions[].
- **ModelAllocation:** symbol, companyName, percentage (target %), shares, avgPrice. A pseudo-row `symbol:"CASH"` represents cash %.
- **ModelTransaction:** type (BUY/SELL/CASH_IN/CASH_OUT), symbol, quantity, price, total, createdAt.
- **WatchlistItem:** symbol, companyName.
- **Market data (live):** symbol, company, sector, open, high, low, current, change, changePercent, volume, ldcp. KSE-100: current, change, changePercent, high, low.

---

## 5. Key UX notes for the redesign
- Remove empty space — use a **dense multi-column grid**, fill the screen.
- **Center cards bigger**, hero chart compact (~half tall).
- **KSE-100 near the top.**
- **Model Portfolios bigger / more prominent** (flagship).
- Page should scroll naturally with rich content; everything visible without feeling sparse.

---

## 6. Design tokens (exact values)

### Colors — Light theme (primary)
| Token | Hex | Use |
|---|---|---|
| Canvas / background | `#F6F7F9` | page background |
| Card surface | `#FFFFFF` | cards, panels |
| Muted surface | `#F1F5F9` | row hover, chips, ticker avatars |
| Border (hairline) | `#E2E8F0` | card borders, dividers |
| Text primary | `#0F172A` | headings, values |
| Text secondary | `#475569` | labels |
| Text muted | `#94A3B8` | captions, ticks |
| **Gain (up)** | `#059669` | positive P&L / price ↑ |
| Gain bg | `#D1FAE5` (or `#05966915`) | gain badge background |
| **Loss (down)** | `#E11D48` | negative P&L / price ↓ |
| Loss bg | `#FFE4E6` (or `#E11D4815`) | loss badge background |
| Brand accent | `#059669` (emerald) | logo, active states, CTAs |

### Colors — Dark theme (alt)
| Token | Hex |
|---|---|
| Canvas | `#0A0B0D` |
| Card surface | `rgba(255,255,255,0.03)` over canvas |
| Border | `rgba(255,255,255,0.07)` |
| Text primary | `#FFFFFF` |
| Text muted | `rgba(255,255,255,0.45)` |
| Gain | `#10B981` · Gain bg `rgba(16,185,129,0.15)` |
| Loss | `#F43F5E` · Loss bg `rgba(244,63,94,0.15)` |

### Allocation / chart palette (multi-series, NOT for P&L)
`#10B981` · `#22D3EE` · `#A78BFA` · `#FBBF24` · `#475569 (cash)`

### Typography
- **Sans / body & headings:** Inter.
- **Numbers / tabular:** JetBrains Mono with `font-variant-numeric: tabular-nums`.
- **Scale:** hero value 48–60px semibold · section title 18px semibold · card value 20–24px semibold · label 11–12px uppercase tracking-wide muted · body 14px.

### Shape & spacing
- Radius: cards `16px` (rounded-2xl), pills/badges full, inputs `10px`.
- Card padding: 20–24px. Section gap: 20px. Page max-width: 1280–1600px, centered.
- Shadow (light): `0 1px 2px rgba(0,0,0,.04), 0 8px 24px -12px rgba(0,0,0,.10)`.

### Motion
- Count-up hero value (~900ms ease-out cubic). Chart draw-in (~1100ms). Section rise-in stagger (40ms each). KSE-100 live ping. Hover: `transition-colors 150–200ms`. Honor `prefers-reduced-motion`.

---

## 7. Dashboard wireframe (target dense layout)

Desktop ≥1024px — fill the width, KSE-100 up top, models prominent:

```
┌─────────────────────────────────────────────────────────────┐
│ [logo] Dashboard  Models  Portfolio  Market …     ⌕ 🔔 (avatar)│  ← top navbar
├─────────────────────────────────────────────────────────────┤
│ ● KSE-100   177,040   +2.69%        [Hide][Widgets][Refresh] │  ← KSE strip near top
├──────────────────────────────────────┬──────────────────────┤
│  Portfolio value                      │  Allocation          │
│  PKR 163,395   ▲ +9,478 (6.16%)       │   ◐ donut            │
│  ╱╲╱╲╱ compact area chart ╱╲          │   DGKC 30% FABL 22%  │
│  1D 1W [1M] 3M 1Y ALL                 │   GHNI 18% …  Cash   │
├──────────┬──────────┬─────────┬───────┴──────────────────────┤
│ Invested │ Cash     │ Today P&L│ Total Return                 │  ← stat strip
│ 153,018  │ 14,209   │ +3,829  │ +6.16%                        │
├─────────────────────────────────────────────────────────────┤
│ MODEL PORTFOLIOS  (BIG, flagship)                  View all → │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐        │
│ │ AKD Growth    │ │ Dividend Core │ │ + New model   │        │
│ │ PKR 163,395   │ │ PKR 88,210    │ │               │        │
│ │ +6.16% ╱╲ spk │ │ −1.2%  ╲╱ spk │ │               │        │
│ └───────────────┘ └───────────────┘ └───────────────┘        │
├──────────────────────────────────────┬──────────────────────┤
│ Holdings                    View all →│ Top Gainers          │
│ DG  DGKC   ╱╲   PKR 19,762  +0.46%    │  GCWLR  +30%         │
│ FA  FABL   ╱╲   PKR 18,222  +0.11%    │  STPL   +11.85%      │
│ GH  GHNI   ╲╱   PKR 17,070  −6.66%    │ ─────────────────    │
│ MT  MTL    ╲╱   PKR 15,804  −0.93%    │ Top Losers           │
│ NR  NRL    ╱    PKR 11,097  +17.88%   │  GCWL  −18.24%       │
└──────────────────────────────────────┴──────────────────────┘
```

## 8. Model Detail wireframe

```
┌─────────────────────────────────────────────────────────────┐
│ ← Back   AKD Growth ✎     [Add][Withdraw][Bulk][SIP][Rebalance]│
├──────────────────────────┬──────────────────────────────────┤
│ Total value PKR 163,395  │ Cash 14,209 · Invested 153,018 ·  │
│ ▲ +6.16%                 │ Market 149,186                    │
├─────────────────────────────────────────────────────────────┤
│ Holdings (table)  Stock·Alloc%·Shares·Avg·Current·Value·P&L ✎│
├──────────────────────────┬──────────────────────────────────┤
│ P&L by stock (bars)      │ Composition (donut)               │
├─────────────────────────────────────────────────────────────┤
│ Stock returns      │      Transaction history                │
└─────────────────────────────────────────────────────────────┘
```

## 9. Live preview routes (for reference while designing)
- Landing/login: `/home`
- Dense dashboard mock (LIGHT — preferred): `/mock/light`
- Dense dashboard mock (DARK): `/mock/dark`
- Original Robinhood single-column mock: `/mock/1`

> These mock routes are dummy-data visual references only; the real screens live at the routes in §3.
