# VentureGuard

**Make smarter decisions. Protect what you're building.**

VentureGuard is a business decision intelligence platform for small businesses, startups and growing companies. It answers one question:

> *Given the current state of my business, what should I do next, and what could happen if I do it?*

Instead of only reporting what already happened, VentureGuard **simulates a decision before you commit money**, checks it against the rules that protect your business, flags early-warning risks, and uses **hybrid on-device + cloud AI** (Firebase AI Logic) to explain the results in plain language.

Built for **Google #BuildHybridAI 2026** · Category: Best Web/Chrome App · License: Apache 2.0

---

## The problem

Many business owners make expensive decisions without seeing the financial consequences. They open a branch without enough working capital, hire staff the business can't sustain, or take loans without understanding the repayment pressure. Accounting tools report the past; chatbots guess. Neither tells an owner *"this branch is affordable, but it breaks your safety net by ₦1.5M. Wait three months and it doesn't."*

## What it does

| Module | What it does |
|---|---|
| **Business DNA** | Guided onboarding of profile, financials and goals. Editable any time. |
| **Health Dashboard** | Revenue, expenses, profit, margins, reserves, runway, break-even, plus a **0–100 Health Score** across six weighted dimensions. Click any dimension to see the formula, the figures, the trend and how to improve it. |
| **Decision Lab** ⭐ | Simulates 8 decision types (branch, hiring, loan, equipment, price rise, new product, advertising, inventory) across **optimistic / expected / pessimistic** scenarios, month by month. Shows cash after investment, lowest cash point, break-even, payback and runway, and compares against *not* making the decision. Results recalculate instantly as you change assumptions. Defaults are labelled. A built-in comparison shows how much a revised plan improves things. |
| **PolicyGuard** | Owner-defined rules (minimum reserve, max debt service, min margin, spending review threshold). Every decision is checked, showing which policy failed, by how much, why it matters and a lower-risk alternative. It **warns; it never blocks**. |
| **Risk Radar** | Rule-based early warnings (expenses outpacing revenue, low reserves, margin decline, debt pressure, excess inventory, falling sales, policy breaches) with severity, evidence, consequence, action, date and history. |
| **AI Advisor** | Single-turn questions over a compact, structured snapshot of engine results. Quick insights run on-device first; detailed analyses run in the cloud. Shows the inference source, the exact payload sent, and a **figure check** that flags any number in the answer that the engine didn't calculate. Questions asked while offline can be queued. |
| **Recovery Mode** | A rule-generated 30-day plan with priorities, estimated cash impact and progress tracking, plus an optional AI walkthrough. |
| **Hybrid AI Lab** | Live proof of both inference paths: environment checks, on-device model download, and test runs in `PREFER_ON_DEVICE`, `ONLY_ON_DEVICE` and `ONLY_IN_CLOUD` modes, with the SDK-reported source logged. |

### Design principles

1. **AI never does arithmetic.** All figures come from a deterministic, unit-tested TypeScript engine (`src/engine`). The AI receives results and explains them; it cannot overwrite them.
2. **Nothing is faked.** The inference badge shows `result.response.inferenceSource` exactly as Firebase AI Logic reports it. If the SDK doesn't report a source, the UI says so.
3. **Transparent scoring.** Health scores, risk severities and policy checks use explicit formulas and thresholds that are shown in the UI.
4. **Offline-first.** Calculations, simulations and saved data work without a connection.

---

## Hybrid AI implementation

All inference goes through the **Firebase AI Logic Web SDK** (`firebase/ai`, Firebase JS SDK 13.x). See [`src/lib/ai/hybrid.ts`](src/lib/ai/hybrid.ts).

```ts
const ai = getAI(app, { backend: new GoogleAIBackend() }); // or AgentPlatformBackend
const model = getGenerativeModel(ai, {
  mode: InferenceMode.PREFER_ON_DEVICE,
  inCloudParams: { model: "gemini-3.5-flash-lite" },
});
await model.initializeDeviceModel(onProgress);   // after a user click
const result = await model.generateContent(prompt);
result.response.inferenceSource;                  // "on_device" | "in_cloud"
```

| Route | Inference mode | Used for |
|---|---|---|
| Quick insight | `PREFER_ON_DEVICE` | Metric explanations, risk explanations, quick advisor answers, quick decision takes |
| Detailed analysis | `ONLY_IN_CLOUD` | Long decision analyses, recovery-plan walkthroughs |
| Diagnostics | `ONLY_ON_DEVICE` / `ONLY_IN_CLOUD` | Hybrid AI Lab: proving each path independently |

**Why hybrid?** Financial data is sensitive. When Chrome's built-in Gemini Nano is available, quick insights never leave the owner's computer and keep working offline. When it isn't (an unsupported device, or before the model has downloaded), the SDK falls back to Gemini in the cloud, and the app shows that it did.

**Prompt design for a small local model:** prompts are single-turn, with a compact JSON snapshot of aggregate, engine-calculated figures (no names, emails or transactions) and a fixed response structure: answer, evidence, why it matters, next step, assumptions. See [`src/lib/ai/prompts.ts`](src/lib/ai/prompts.ts).

**Output validation:** `validateFigures()` extracts money-sized figures from the response (`₦1.5M`, `1,500,000`, `850k`…) and checks each against the engine figures and their differences (±2%). Unmatched figures are flagged as unverified in the UI.

---

## Architecture

```text
              Next.js 16 / React 19 (client-rendered)
                           │
        ┌──────────────────┴──────────────────┐
        ▼                                     ▼
  BUSINESS ENGINE (src/engine)          HYBRID AI SERVICE (src/lib/ai)
  pure TypeScript, unit-tested          Firebase AI Logic
  • calculations  • healthScore               │
  • decisions     • scenarios         ┌───────┴────────┐
  • policies      • risks             ▼                ▼
  • recovery                      ON_DEVICE         IN_CLOUD
        │                         Gemini Nano       Gemini
        │                         (Chrome Prompt API)
        └──────────────┬──────────────────┘
                       ▼
     Workspace store (src/lib/store)
     Firestore + persistent IndexedDB cache (signed in)
     or localStorage (demo mode, no account)
```

- **Firebase Authentication:** email/password, plus password reset.
- **Cloud Firestore:** `businesses/{uid}` (profile, history, policies) and subcollections `simulations`, `insights`. Uses `persistentLocalCache` for offline reads and queued writes. The header shows sync status from snapshot metadata.
- **Firebase App Check:** reCAPTCHA Enterprise (or v3) in production, debug provider locally. See [`src/lib/firebase/client.ts`](src/lib/firebase/client.ts).
- **Security rules:** owner-only access with field validation ([`firestore.rules`](firestore.rules)).

```text
src/
  engine/        deterministic financial engine (no React, no Firebase)
  lib/firebase/  Firebase app, Auth, Firestore, App Check
  lib/ai/        hybrid model, prompts, output validation, useAi hook
  lib/store/     workspace provider (Firestore or local) + useAnalysis
  components/    UI kit, charts, forms
  app/           routes: landing, login, onboarding, /app/*
tests/           Vitest engine tests
```

---

## Running locally

**Requirements:** Node 20.19+ or 22.13+, and desktop **Chrome 139+** for on-device inference.

```bash
npm install
npm test          # engine unit tests
npm run dev       # http://localhost:3000
```

The app runs **without any Firebase configuration** in demo mode. Click **Try the live demo** for the fictional Nova Retail workspace. All calculations, simulations, PolicyGuard and Risk Radar work. AI and accounts need Firebase.

### Firebase setup

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com) and add a **Web app**.
2. **AI Logic:** Build → AI Logic → Get started. Choose the *Gemini Developer API* (or Agent Platform and set `NEXT_PUBLIC_AI_BACKEND=agent_platform`).
3. **Authentication:** enable the *Email/Password* provider.
4. **Firestore:** create a database, then deploy the rules: `npx firebase-tools deploy --only firestore:rules`.
5. **App Check:** register the web app with reCAPTCHA Enterprise and put the site key in `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`. Enforce App Check for Firebase AI Logic.
   *Local development:* set `NEXT_PUBLIC_APPCHECK_DEBUG=true`, load the app, copy the debug token from the browser console, and add it under App Check → Apps → Manage debug tokens. **Never commit debug tokens.**
6. `cp .env.example .env.local` and fill in the values from Project settings.

### Enabling on-device inference in Chrome

1. Update desktop Chrome to 139 or later.
2. Check that your device meets Chrome's built-in AI hardware requirements (free disk space and GPU/RAM). Open `chrome://on-device-internals` to see the model status.
3. If your Chrome version requires it, enable `chrome://flags/#prompt-api-for-gemini-nano` and restart.
4. In VentureGuard, open **Hybrid AI Lab** → **Prepare on-device model** (this downloads Gemini Nano), then run **Force on-device**. The log should show `ON_DEVICE`.

### Deploying (Netlify)

The repo includes `netlify.toml`. Netlify detects Next.js and applies its Next.js runtime automatically.

1. In Netlify, choose **Add new site → Import an existing project** and pick this GitHub repo.
2. Under **Site configuration → Environment variables**, add the same `NEXT_PUBLIC_*` values as `.env.local`. Leave `NEXT_PUBLIC_APPCHECK_DEBUG` unset in production.
3. Deploy. Then add the Netlify domain to **Firebase Auth → Settings → Authorized domains** and to your reCAPTCHA key's allowed domains.

---

## Demo walkthrough (Nova Retail)

Fictional data: revenue ₦3.5M/month, expenses ₦2.8M (₦1.05M essential), surplus ₦700k, cash ₦5M, policy: keep 3 months of essential expenses.

1. **Dashboard:** health score, ₦700k surplus, 4.8 months of reserves, an *expenses outpacing revenue* warning.
2. **Decision Lab → Open another branch:** ₦2M investment, ₦1.2M expected revenue, ₦450k fixed costs.
   - Expected: +₦150k/month, cash after investment ₦3.0M.
   - Pessimistic (60% of the revenue estimate): **−₦90k/month**, needs +₦180k/month more revenue to break even.
3. **PolicyGuard:** the branch adds ₦450k of essential costs, so the reserve requirement rises to **₦4.5M**. Cash at its lowest point is ₦3.0M: **₦1.5M short**.
4. **Risk Radar:** the consequences of a thinner safety net.
5. **AI Advisor:** *"Why could opening another branch put my existing business at risk?"*
6. **Hybrid AI Lab:** a forced on-device run shows `ON_DEVICE`; a forced cloud run shows `IN_CLOUD`.
7. **Better decision:** set *When to start* to **+3m**. Cash after investment becomes ₦5.1M and the reserve policy passes. The comparison bar shows the improvement.

> *VentureGuard helps business owners understand the consequences of a decision before committing to it.*

---

## Testing

`npm test` runs the Vitest suite in `tests/engine.test.ts`. It covers margins, zero-revenue handling, runway, break-even, loan amortization, payback, health score bounds, policy evaluation, scenario projections, and the exact Nova Retail demo figures.

## Limitations & honesty notes

- Variable costs are used as an approximation of cost of goods sold. This is labelled where it matters.
- Scenario factors and the ramp-up curve are labelled default assumptions and can be edited.
- Conflict resolution on sync is Firestore's last-write-wins per document.
- Risk history and recovery-task progress are stored per device.
- Not financial advice. All demo data is fictional.

## License

[Apache License 2.0](LICENSE)
