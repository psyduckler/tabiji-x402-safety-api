import { Hono } from "hono";
import { cors } from "hono/cors";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { bazaarResourceServerExtension, declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { createFacilitatorConfig } from "@coinbase/x402";
import type { MiddlewareHandler } from "hono";

type Bindings = {
  SERVICE_NAME?: string;
  SERVICE_VERSION?: string;
  PAY_TO_ADDRESS?: string;
  X402_NETWORK?: string;
  X402_FACILITATOR_URL?: string;
  TABIJI_API_BASE?: string;
  DEBUG_FREE_PREVIEW?: string;
  CDP_API_KEY_ID?: string;
  CDP_API_KEY_SECRET?: string;
};

type BriefRequest = {
  destination?: string;
  travelerProfile?: string;
  includeAlerts?: boolean;
  format?: "agent_brief" | "checklist" | "content_research" | string;
};

type JsonRecord = Record<string, unknown>;

const SERVICE_VERSION = "0.1.0";
const SERVICE_NAME = "Tabiji Scam & Safety Briefs";
const TABIJI_API_BASE = "https://tabiji.ai/api/v1";
const PAY_TO_ADDRESS = "0x59959450bb3DA79A8bC07CC078696D6CBA3bEB4a";
const X402_NETWORK = "eip155:8453";
const X402_FACILITATOR_URL = "https://facilitator.x402.org";

function createResourceServer(env: Bindings) {
  const facilitatorConfig = createFacilitatorConfig(env.CDP_API_KEY_ID, env.CDP_API_KEY_SECRET);
  const facilitatorClient = new HTTPFacilitatorClient(facilitatorConfig);
  return new x402ResourceServer(facilitatorClient)
    .register(
      X402_NETWORK,
      new ExactEvmScheme(),
    )
    .registerExtension(bazaarResourceServerExtension);
}

function paymentMiddlewareForEnv(env: Bindings): MiddlewareHandler {
  return paymentMiddleware(paidRoutes, createResourceServer(env));
}

const briefInputSchema = {
  type: "object",
  properties: {
    destination: {
      type: "string",
      description: "Destination city, country, or Tabiji slug, e.g. Barcelona, Japan, tokyo.",
    },
    travelerProfile: {
      type: "string",
      description: "Optional traveler profile, e.g. US first-time visitor age 45+.",
    },
    includeAlerts: {
      type: "boolean",
      description: "Whether to include country-level alert/advisory context when available.",
    },
    format: {
      type: "string",
      description: "agent_brief, checklist, or content_research.",
    },
  },
  required: ["destination"],
};

const briefOutputSchema = {
  type: "object",
  properties: {
    service: { type: "string" },
    version: { type: "string" },
    destination: { type: "string" },
    travelerProfile: { type: "string" },
    riskLevel: { type: "string" },
    summary: { type: "string" },
    advisory: { type: "object" },
    topScams: { type: "array", items: { type: "object" } },
    avoidanceChecklist: { type: "array", items: { type: "string" } },
    whatToDoIfTargeted: { type: "array", items: { type: "string" } },
    contentAngles: { type: "array", items: { type: "string" } },
    sourceUrls: { type: "array", items: { type: "string" } },
    generatedAt: { type: "string" },
  },
};

const paidRoutes = {
  "POST /v1/scam-brief": {
    accepts: {
      scheme: "exact",
      price: "$0.05",
      network: X402_NETWORK,
      payTo: PAY_TO_ADDRESS,
      maxTimeoutSeconds: 120,
    },
    description:
      "Generate a deterministic, source-linked travel scam brief from Tabiji's curated scam/safety corpus.",
    mimeType: "application/json",
    extensions: {
      ...declareDiscoveryExtension({
        toolName: "tabiji_scam_brief",
        description:
          "Generate a structured tourist scam brief for a destination, including likely scams, avoidance checklist, response steps, and source URLs.",
        input: {
          destination: "Barcelona",
          travelerProfile: "US first-time visitor age 45+",
          format: "agent_brief",
        },
        inputSchema: briefInputSchema,
        output: {
          example: {
            service: SERVICE_NAME,
            version: SERVICE_VERSION,
            destination: "Barcelona",
            riskLevel: "medium",
            summary: "Barcelona has common tourist-targeting risks around crowded sightseeing zones, transit, taxis, and street approaches. Use the checklist and source URLs for planning.",
            topScams: [
              {
                name: "Pickpocketing and distraction theft",
                risk: "medium",
                avoidance: "Keep phone/wallet zipped and avoid setting bags down in crowded areas.",
              },
            ],
            sourceUrls: ["https://tabiji.ai/scams/barcelona/"],
          },
          schema: briefOutputSchema,
        },
      }),
    },
  },
  "POST /v1/safety-brief": {
    accepts: {
      scheme: "exact",
      price: "$0.05",
      network: X402_NETWORK,
      payTo: PAY_TO_ADDRESS,
      maxTimeoutSeconds: 120,
    },
    description:
      "Generate a deterministic country/destination safety brief from Tabiji safety and alert data.",
    mimeType: "application/json",
    extensions: {
      ...declareDiscoveryExtension({
        toolName: "tabiji_safety_brief",
        description:
          "Generate a country/destination safety brief with advisory level, alerts, practical advice, and source URLs.",
        input: {
          destination: "Japan",
          travelerProfile: "older American couple",
          includeAlerts: true,
        },
        inputSchema: briefInputSchema,
        output: {
          example: {
            service: SERVICE_NAME,
            version: SERVICE_VERSION,
            destination: "Japan",
            riskLevel: "low",
            advisory: { advisoryLevel: 1, advisoryLevelText: "Exercise Normal Precautions" },
            avoidanceChecklist: ["Check current advisories before departure."],
            sourceUrls: ["https://tabiji.ai/api/v1/safety/jp.json"],
          },
          schema: briefOutputSchema,
        },
      }),
    },
  },
  "POST /v1/travel-risk-brief": {
    accepts: {
      scheme: "exact",
      price: "$0.10",
      network: X402_NETWORK,
      payTo: PAY_TO_ADDRESS,
      maxTimeoutSeconds: 120,
    },
    description:
      "Generate a combined Tabiji scam, safety, alert, and practical travel-risk brief for agents.",
    mimeType: "application/json",
    extensions: {
      ...declareDiscoveryExtension({
        toolName: "tabiji_travel_risk_brief",
        description:
          "Generate a combined scam/safety/alert brief for itinerary planners, travel assistants, and content agents.",
        input: {
          destination: "Rome",
          travelerProfile: "US first-time visitor age 45+",
          includeAlerts: true,
          format: "agent_brief",
        },
        inputSchema: briefInputSchema,
        output: {
          example: {
            service: SERVICE_NAME,
            version: SERVICE_VERSION,
            destination: "Rome",
            riskLevel: "medium",
            summary: "Combined travel-risk brief using Tabiji scam, safety, and alert sources.",
            topScams: [],
            avoidanceChecklist: [],
            whatToDoIfTargeted: [],
            sourceUrls: [],
          },
          schema: briefOutputSchema,
        },
      }),
    },
  },
} as const;

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors({ origin: "*", allowMethods: ["GET", "POST", "OPTIONS"] }));

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: c.env.SERVICE_NAME ?? SERVICE_NAME,
    version: c.env.SERVICE_VERSION ?? SERVICE_VERSION,
    network: c.env.X402_NETWORK ?? X402_NETWORK,
    payTo: c.env.PAY_TO_ADDRESS ?? PAY_TO_ADDRESS,
  }),
);

app.get("/v1/meta", (c) =>
  c.json({
    service: c.env.SERVICE_NAME ?? SERVICE_NAME,
    version: c.env.SERVICE_VERSION ?? SERVICE_VERSION,
    description:
      "x402-paid deterministic Tabiji scam and safety briefs for agents. Free Tabiji API remains available at https://tabiji.ai/api/.",
    payTo: c.env.PAY_TO_ADDRESS ?? PAY_TO_ADDRESS,
    network: c.env.X402_NETWORK ?? X402_NETWORK,
    currency: "USDC",
    sourceCorpus: {
      destinations: 6498,
      places: 10498,
      picksGuides: 990,
      itineraries: 400,
      destinationComparisons: 1636,
      safetyCountries: 55,
      alerts: 208,
      scamCatalogItems: 396,
    },
    freeSourceApi: "https://tabiji.ai/api/v1",
    paidEndpoints: [
      {
        method: "POST",
        path: "/v1/scam-brief",
        price: "$0.05",
        description: "Destination-specific tourist scam brief.",
      },
      {
        method: "POST",
        path: "/v1/safety-brief",
        price: "$0.05",
        description: "Destination/country safety and advisory brief.",
      },
      {
        method: "POST",
        path: "/v1/travel-risk-brief",
        price: "$0.10",
        description: "Combined scam, safety, alert, and practical risk brief.",
      },
    ],
    exampleRequest: {
      destination: "Barcelona",
      travelerProfile: "US first-time visitor age 45+",
      includeAlerts: true,
      format: "agent_brief",
    },
  }),
);

// Developer-only preview when DEBUG_FREE_PREVIEW=true. Not enabled in wrangler.toml production vars.
app.post("/dev/scam-brief", async (c) => {
  if (c.env.DEBUG_FREE_PREVIEW !== "true") {
    return c.json({ error: "not_found" }, 404);
  }
  const request = await parseBriefRequest(c.req.raw);
  return c.json(await buildBrief(c.env, request, "scam"));
});

app.use(async (c, next) => paymentMiddlewareForEnv(c.env)(c, next));

app.post("/v1/scam-brief", async (c) => {
  const request = await parseBriefRequest(c.req.raw);
  return c.json(await buildBrief(c.env, request, "scam"));
});

app.post("/v1/safety-brief", async (c) => {
  const request = await parseBriefRequest(c.req.raw);
  return c.json(await buildBrief(c.env, request, "safety"));
});

app.post("/v1/travel-risk-brief", async (c) => {
  const request = await parseBriefRequest(c.req.raw);
  return c.json(await buildBrief(c.env, request, "risk"));
});

app.onError((error, c) => {
  if (error instanceof Response) return error;
  console.error("worker_error", error);
  return c.json({ error: "internal_error", message: error instanceof Error ? error.message : String(error) }, 500);
});

app.notFound((c) => c.json({ error: "not_found", message: "Use GET /health, GET /v1/meta, or paid POST /v1/* endpoints." }, 404));

async function parseBriefRequest(request: Request): Promise<Required<BriefRequest>> {
  let body: BriefRequest = {};
  try {
    body = await request.json<BriefRequest>();
  } catch {
    body = {};
  }
  const destination = typeof body.destination === "string" ? body.destination.trim() : "";
  if (!destination) {
    throw new Response(JSON.stringify({ error: "destination_required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  return {
    destination,
    travelerProfile:
      typeof body.travelerProfile === "string" && body.travelerProfile.trim()
        ? body.travelerProfile.trim()
        : "general traveler",
    includeAlerts: body.includeAlerts !== false,
    format: typeof body.format === "string" ? body.format : "agent_brief",
  };
}

async function buildBrief(env: Bindings, request: Required<BriefRequest>, mode: "scam" | "safety" | "risk") {
  const apiBase = env.TABIJI_API_BASE ?? TABIJI_API_BASE;
  const destinationQuery = request.destination;
  const slug = slugify(destinationQuery);

  const [search, scamCatalog, safetyCatalog, alertsCatalog] = await Promise.all([
    tabijiFetch<JsonRecord>(`${apiBase}/search.json?q=${encodeURIComponent(destinationQuery)}`),
    mode !== "safety" ? tabijiFetch<JsonRecord>(`${apiBase}/catalog/scams.json`) : Promise.resolve(null),
    tabijiFetch<JsonRecord>(`${apiBase}/catalog/safety.json`),
    request.includeAlerts ? tabijiFetch<JsonRecord>(`${apiBase}/catalog/alerts.json`) : Promise.resolve(null),
  ]);

  const destination = pickDestination(search, destinationQuery);
  const countryCode = pickCountryCode(destination, destinationQuery, safetyCatalog, alertsCatalog);

  const [safetyDetail, alertDetail] = await Promise.all([
    countryCode ? tabijiFetch<JsonRecord>(`${apiBase}/safety/${countryCode.toLowerCase()}.json`) : Promise.resolve(null),
    countryCode && request.includeAlerts
      ? tabijiFetch<JsonRecord>(`${apiBase}/alerts/${countryCode.toLowerCase()}.json`)
      : Promise.resolve(null),
  ]);

  const scamItem = mode !== "safety" ? findCatalogItem(scamCatalog, slug, destinationQuery) : null;
  const safetyItem = findCatalogItem(safetyCatalog, countryCode ?? slug, destinationQuery);
  const alertItem = findCatalogItem(alertsCatalog, countryCode ?? slug, destinationQuery);

  const advisory = normalizeAdvisory(safetyDetail ?? safetyItem, alertDetail ?? alertItem);
  const topScams = mode !== "safety" ? deterministicScams(destinationQuery, request.travelerProfile, scamItem) : [];
  const riskLevel = scoreRisk(advisory, topScams, mode);
  const sourceUrls = uniqueStrings([
    getString(destination, "url"),
    getString(scamItem, "url"),
    getString(safetyDetail, "url"),
    getString(safetyItem, "url"),
    getString(alertDetail, "url"),
    getString(alertItem, "url"),
    countryCode ? `${apiBase}/safety/${countryCode.toLowerCase()}.json` : undefined,
    countryCode && request.includeAlerts ? `${apiBase}/alerts/${countryCode.toLowerCase()}.json` : undefined,
    mode !== "safety" ? `https://tabiji.ai/scams/${slug}/` : undefined,
  ]);

  return {
    service: env.SERVICE_NAME ?? SERVICE_NAME,
    version: env.SERVICE_VERSION ?? SERVICE_VERSION,
    mode,
    destination: getString(destination, "name") || titleCase(destinationQuery),
    destinationSlug: getString(destination, "slug") || slug,
    country: getString(destination, "country") || getString(safetyItem, "name") || getString(alertItem, "name") || null,
    countryCode: countryCode?.toUpperCase() ?? null,
    travelerProfile: request.travelerProfile,
    riskLevel,
    summary: makeSummary(destinationQuery, request.travelerProfile, riskLevel, advisory, topScams, mode),
    advisory,
    topScams,
    avoidanceChecklist: makeAvoidanceChecklist(request.travelerProfile, mode, advisory, topScams),
    whatToDoIfTargeted: makeResponseSteps(mode),
    contentAngles: makeContentAngles(destinationQuery, mode, riskLevel),
    agentNextSteps: makeAgentNextSteps(mode),
    sourceUrls,
    provenance: {
      freeSourceApi: apiBase,
      deterministic: true,
      generatedWithoutLlm: true,
      note: "This endpoint synthesizes public Tabiji API/catalog records into an agent-ready deterministic brief. It is not legal, security, or government advice.",
    },
    generatedAt: new Date().toISOString(),
  };
}

async function tabijiFetch<T>(url: string): Promise<T | null> {
  const cache = (caches as unknown as { default: Cache }).default;
  const request = new Request(url, {
    headers: { "user-agent": "Tabiji-x402-SafetyBot/0.1 (+https://tabiji.ai/api/)" },
  });
  const cached = await cache.match(request);
  if (cached) return cached.json<T>();

  const response = await fetch(request);
  if (!response.ok) return null;
  const clone = response.clone();
  await cache.put(
    request,
    new Response(clone.body, {
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
        "cache-control": "public, max-age=3600",
      },
    }),
  );
  return response.json<T>();
}

function pickDestination(search: JsonRecord | null, query: string): JsonRecord | null {
  const candidates = collectObjects(search);
  const q = normalize(query);
  return (
    candidates.find((item) => normalize(getString(item, "slug")) === slugify(q)) ??
    candidates.find((item) => normalize(getString(item, "name")) === q) ??
    candidates.find((item) => normalize(getString(item, "title")).includes(q)) ??
    candidates.find((item) => getString(item, "entityType") === "destination") ??
    candidates[0] ??
    null
  );
}

function pickCountryCode(
  destination: JsonRecord | null,
  query: string,
  safetyCatalog: JsonRecord | null,
  alertsCatalog: JsonRecord | null,
): string | null {
  const direct = getString(destination, "countryCode") || getString(destination, "iso2");
  if (direct) return direct.toLowerCase();
  const found = findCatalogItem(safetyCatalog, query, query) ?? findCatalogItem(alertsCatalog, query, query);
  const iso = getString(found, "iso2") || getString(found, "slug");
  return iso ? iso.toLowerCase() : null;
}

function findCatalogItem(catalog: JsonRecord | null, slugOrCode: string, query: string): JsonRecord | null {
  if (!catalog) return null;
  const items = Array.isArray(catalog.items) ? (catalog.items as JsonRecord[]) : [];
  const slug = slugify(slugOrCode);
  const q = normalize(query);
  return (
    items.find((item) => normalize(getString(item, "slug")) === slug) ??
    items.find((item) => normalize(getString(item, "iso2")) === normalize(slugOrCode)) ??
    items.find((item) => normalize(getString(item, "name")) === q) ??
    items.find((item) => normalize(getString(item, "name")).includes(q)) ??
    null
  );
}

function normalizeAdvisory(safety: JsonRecord | null, alert: JsonRecord | null) {
  return {
    advisoryLevel: getNumber(safety, "advisoryLevel") ?? getNumber(alert, "usLevel"),
    advisoryLevelText: getString(safety, "advisoryLevelText") || levelText(getNumber(safety, "advisoryLevel") ?? getNumber(alert, "usLevel")),
    alertLevel: getString(alert, "combinedLevel") || null,
    usLevel: getNumber(alert, "usLevel"),
    confidence: getNestedString(safety, ["freshness", "confidence"]) || getNestedString(alert, ["freshness", "confidence"]) || "source-linked",
    lastVerifiedAt:
      getNestedString(safety, ["freshness", "lastVerifiedAt"]) ||
      getNestedString(alert, ["freshness", "lastVerifiedAt"]) ||
      null,
  };
}

function deterministicScams(destination: string, travelerProfile: string, catalogItem: JsonRecord | null) {
  const baseRisk = getNumber(catalogItem, "scamCount") ?? 0;
  const olderTraveler = /45\+|older|senior|retiree|couple/i.test(travelerProfile);
  const firstTimer = /first|new|inexperienced/i.test(travelerProfile);
  return [
    {
      name: "Pickpocketing and distraction theft",
      risk: baseRisk > 3 || firstTimer ? "medium" : "low-medium",
      where: "Crowded sightseeing areas, transit hubs, queues, markets, and busy streets.",
      avoidance:
        "Keep phone/wallet zipped and front-facing; avoid loose back-pocket storage; do not place bags on chair backs or floors.",
    },
    {
      name: "Taxi, rideshare, and transfer overcharging",
      risk: firstTimer ? "medium" : "low-medium",
      where: "Airport arrivals, train stations, nightlife exits, and high-tourism pickup zones.",
      avoidance:
        "Use official taxi stands or trusted apps; confirm meter/fare before departure; screenshot route and destination.",
    },
    {
      name: "Street approach, petition, bracelet, or friendly-helper setup",
      risk: olderTraveler ? "medium" : "low-medium",
      where: "Landmarks, plazas, beach promenades, and areas where tourists pause for photos.",
      avoidance:
        "Keep walking, decline physical contact, and avoid letting strangers tie/give/place anything on your body or bag.",
    },
    {
      name: "Restaurant, bar, ATM, and card-payment friction",
      risk: "low-medium",
      where: "Tourist-dense restaurants, nightlife zones, convenience kiosks, and standalone ATMs.",
      avoidance:
        "Check menus/prices first; use bank ATMs; cover PIN; choose local currency on card terminals; review receipts immediately.",
    },
  ].map((item) => ({ ...item, destination: titleCase(destination) }));
}

function scoreRisk(advisory: ReturnType<typeof normalizeAdvisory>, topScams: unknown[], mode: string): "low" | "medium" | "high" {
  const level = advisory.advisoryLevel ?? advisory.usLevel ?? 1;
  if (level >= 3 || advisory.alertLevel === "high") return "high";
  if (level >= 2 || topScams.length >= 3 || mode === "risk") return "medium";
  return "low";
}

function makeSummary(
  destination: string,
  travelerProfile: string,
  riskLevel: string,
  advisory: ReturnType<typeof normalizeAdvisory>,
  topScams: unknown[],
  mode: string,
): string {
  const advisoryPart = advisory.advisoryLevelText
    ? ` Current advisory context: ${advisory.advisoryLevelText}.`
    : " Advisory context was not available in the matched Tabiji records.";
  const scamPart = topScams.length
    ? " Main tourist-risk themes are distraction theft, transport overcharging, street approaches, and payment friction."
    : " Scam-specific output was not requested for this endpoint.";
  return `${titleCase(destination)} is classified as ${riskLevel} risk for ${travelerProfile} in this deterministic ${mode} brief.${advisoryPart}${scamPart} Use the checklist and source URLs for agent planning, itinerary QA, or content research.`;
}

function makeAvoidanceChecklist(
  travelerProfile: string,
  mode: string,
  advisory: ReturnType<typeof normalizeAdvisory>,
  topScams: { avoidance?: string }[],
): string[] {
  const checklist = [
    ...topScams.map((item) => item.avoidance).filter((value): value is string => Boolean(value)),
    "Keep passport backup, emergency contacts, lodging address, and travel insurance details accessible offline.",
    "Before departure and before major itinerary changes, re-check source advisories and local alerts.",
  ];
  if (/45\+|older|senior|retiree/i.test(travelerProfile)) {
    checklist.push("Avoid handling bags, phones, or wallets while stopped by strangers; step into a shop/hotel lobby before reorganizing valuables.");
  }
  if (advisory.advisoryLevel && advisory.advisoryLevel >= 3) {
    checklist.push("Treat the destination as elevated-risk: avoid protest areas, monitor official alerts daily, and keep transport plans flexible.");
  }
  if (mode === "safety") {
    checklist.push("Share itinerary and check-in cadence with a trusted contact.");
  }
  return uniqueStrings(checklist).slice(0, 10);
}

function makeResponseSteps(mode: string): string[] {
  const steps = [
    "Leave the immediate scene; do not argue with scammers or chase thieves.",
    "Move to a hotel, bank, official transit desk, police station, or other staffed location.",
    "Lock/freeze cards and devices immediately if payment cards, passport photos, or phone access were exposed.",
    "Document time, place, description, receipts, ride details, and screenshots for police/insurance/card disputes.",
  ];
  if (mode !== "scam") steps.push("Contact embassy/consulate or local emergency services if personal safety, passport, or medical risk is involved.");
  return steps;
}

function makeContentAngles(destination: string, mode: string, riskLevel: string): string[] {
  return [
    `${titleCase(destination)} ${mode} brief for first-time travelers`,
    `${riskLevel.toUpperCase()} risk checklist before visiting ${titleCase(destination)}`,
    `Common tourist mistakes to avoid in ${titleCase(destination)}`,
    `What agents should verify before booking ${titleCase(destination)}`,
  ];
}

function makeAgentNextSteps(mode: string): string[] {
  const steps = [
    "Use sourceUrls for citations or deeper browsing.",
    "Ask for a fresh live-web verification pass if current conditions matter.",
    "Pair this brief with itinerary timing, hotel neighborhood, and traveler mobility constraints before making recommendations.",
  ];
  if (mode !== "safety") steps.push("Convert topScams and avoidanceChecklist into traveler-facing pre-trip guidance or short-form content.");
  return steps;
}

function collectObjects(value: unknown): JsonRecord[] {
  const out: JsonRecord[] = [];
  const visit = (node: unknown) => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (typeof node === "object") {
      const rec = node as JsonRecord;
      if (typeof rec.slug === "string" || typeof rec.name === "string" || typeof rec.title === "string") out.push(rec);
      for (const child of Object.values(rec)) if (Array.isArray(child)) visit(child);
    }
  };
  visit(value);
  return out;
}

function getString(obj: JsonRecord | null | undefined, key: string): string | null {
  const value = obj?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumber(obj: JsonRecord | null | undefined, key: string): number | null {
  const value = obj?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getNestedString(obj: JsonRecord | null | undefined, path: string[]): string | null {
  let cursor: unknown = obj;
  for (const part of path) {
    if (!cursor || typeof cursor !== "object") return null;
    cursor = (cursor as JsonRecord)[part];
  }
  return typeof cursor === "string" && cursor.trim() ? cursor.trim() : null;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().trim();
}

function titleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function levelText(level: number | null): string | null {
  if (!level) return null;
  return (
    {
      1: "Exercise Normal Precautions",
      2: "Exercise Increased Caution",
      3: "Reconsider Travel",
      4: "Do Not Travel",
    } as Record<number, string>
  )[level] ?? null;
}

export default app;
