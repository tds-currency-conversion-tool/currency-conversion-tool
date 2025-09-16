# Currency Conversion Tool

A fast, type-safe Currency Converter built with **React, Vite, TypeScript**, styled with **Tailwind CSS**, and visualized with **Recharts**.  
It fetches live rates from **CurrencyBeacon**, includes a debounced converter, and shows **7D, 1M, 3M** historical trends.
Currency Conversion Tool, similar to that which can be found on Google.

> Repo: `tds-currency-conversion-tool/currency-conversion-tool`  
> App code lives in app/ (monorepo-style root to keep CI and meta files tidy)

---

## Features

- **Live conversion** (convert endpoint), with graceful **fallback via USD cross-rates** when needed
- **Historical chart** (tries `timeseries`, falls back to per-day `historical`)
- **Robust currency list parsing** human-readable currency names via Intl.DisplayNames (browser)
- **Local caching** of currency metadata (24h TTL) to minimize API calls
- **TypeScript everywhere** (strict), **Vite**, **Tailwind** for styling

---

## Getting started

### Prerequisites

- **Node.js** (Node 22 recommended)
- **npm** (comes with Node)

### Install

```bash
# from repo root
cd app

npm ci
(npm ci step reads package.json and package-lock.json and installs react, react-dom, vite, @vitejs/plugin-react, typescript, recharts, tailwindcss, @tailwindcss/postcss)

npm run dev
(then open http://localhost:5173)

Create app/.env

and paste
VITE_CURRENCYBEACON_API_KEY=your_api_key_here
VITE_CURRENCYBEACON_BASE=https://api.currencybeacon.com/v1

Replace your_api_key_here with API_KEY from https://currencybeacon.com/register
Your API_KEY can be found on the main dashboard once you log in under API Token Information
