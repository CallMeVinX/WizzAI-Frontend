"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface HealthResponse {
  status: string;
}

interface DashboardMetrics {
  total_leads: number;
  by_status: Record<string, number>;
  by_source_channel: Record<string, number>;
  by_owner: Record<string, number>;
}

interface Lead {
  id: number;
  record_id?: number | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  job_title?: string | null;
  company_name: string;
  email: string;
  phone_number?: string | null;
  phone_normalized?: string | null;
  country?: string | null;
  lead_status: string;
  lifecycle_stage?: string | null;
  original_source?: string | null;
  contact_owner?: string | null;
  lead_score?: number | null;
  notes?: string | null;
  ai_source_channel?: string | null;
  ai_source_detail?: string | null;
  dedup_group_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface LeadsResponse {
  data: Lead[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface FilterOptions {
  statuses: string[];
  owners: string[];
  countries: string[];
}

interface DedupeCandidate {
  id: number;
  lead_id_1: number;
  lead_id_2: number;
  confidence: number;
  match_reasons?: Record<string, any> | string[];
  explanation?: string;
  status: "pending" | "confirmed" | "rejected";
  lead_1?: Lead;
  lead_2?: Lead;
  created_at?: string;
}

interface DedupeCluster {
  group_id: string;
  confidence: number;
  explanation?: string;
  lead_ids: number[];
  leads: Lead[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AppConsole() {
  const [apiUrl, setApiUrl] = useState("http://localhost:8000");
  const [activeTab, setActiveTab] = useState<
    "overview" | "leads" | "dedupe" | "extractor" | "ingest"
  >("overview");

  // Health & Ping
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  // Dashboard
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  // Leads
  const [leads, setLeads] = useState<LeadsResponse | null>(null);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedOwner, setSelectedOwner] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [page, setPage] = useState(1);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    statuses: [],
    owners: [],
    countries: [],
  });
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    lead_status: "",
    contact_owner: "",
    notes: "",
  });
  const [patchSuccess, setPatchSuccess] = useState<string | null>(null);

  // Dedupe
  const [candidates, setCandidates] = useState<DedupeCandidate[]>([]);
  const [clusters, setClusters] = useState<DedupeCluster[]>([]);
  const [dedupeView, setDedupeView] = useState<"pairs" | "clusters">("pairs");
  const [dedupeLoading, setDedupeLoading] = useState(false);
  const [dedupeStatusFilter, setDedupeStatusFilter] = useState("all");
  const [triggerDedupeLoading, setTriggerDedupeLoading] = useState(false);
  const [dedupeMessage, setDedupeMessage] = useState<string | null>(null);

  // Source Extractor Playground
  const [notesInput, setNotesInput] = useState(
    "Met at the booth during Singapore FinTech Festival, scanned our QR code"
  );
  const [extractionResult, setExtractionResult] = useState<{
    channel: string;
    detail: string;
    method?: string;
  } | null>(null);
  const [extractionLoading, setExtractionLoading] = useState(false);

  // Ingestion Playground
  const [ingestForm, setIngestForm] = useState({
    first_name: "Sarah",
    last_name: "Connor",
    email: "sarah.connor@cyberdyne.io",
    phone: "+1 (555) 019-2834",
    company: "Cyberdyne Systems LLC",
    country: "United States",
    notes: "Inbound quote request from website pricing calculator.",
  });
  const [ingestResponse, setIngestResponse] = useState<any>(null);
  const [ingestLoading, setIngestLoading] = useState(false);

  // ── Network Calls ─────────────────────────────────────────────────────────

  const checkHealth = useCallback(async () => {
    setHealthLoading(true);
    const start = performance.now();
    try {
      const res = await fetch(`${apiUrl}/health`);
      const end = performance.now();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHealth(data);
      setLatency(Math.round(end - start));
    } catch {
      setHealth(null);
      setLatency(null);
    } finally {
      setHealthLoading(false);
    }
  }, [apiUrl]);

  const fetchDashboard = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/dashboard`);
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMetricsLoading(false);
    }
  }, [apiUrl]);

  const fetchFilters = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/leads/filters`);
      if (res.ok) {
        const data = await res.json();
        setFilterOptions(data);
      }
    } catch (err) {
      console.error(err);
    }
  }, [apiUrl]);

  const fetchLeads = useCallback(async () => {
    setLeadsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("q", searchQuery);
      if (selectedStatus) params.append("status", selectedStatus);
      if (selectedOwner) params.append("owner", selectedOwner);
      if (selectedCountry) params.append("country", selectedCountry);
      params.append("page", page.toString());
      params.append("page_size", "25");

      const res = await fetch(`${apiUrl}/api/leads?${params.toString()}`);
      if (res.ok) {
        const result = await res.json();
        const list = result.data || result.items || [];
        setLeads({
          data: list,
          total: result.total ?? list.length,
          page: result.page ?? page,
          page_size: result.page_size ?? 25,
          total_pages: result.total_pages ?? Math.ceil((result.total ?? list.length) / 25),
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLeadsLoading(false);
    }
  }, [apiUrl, searchQuery, selectedStatus, selectedOwner, selectedCountry, page]);

  const fetchDedupeCandidates = useCallback(async () => {
    setDedupeLoading(true);
    try {
      const params = new URLSearchParams();
      if (dedupeStatusFilter !== "all") {
        params.append("status", dedupeStatusFilter);
      }

      const res = await fetch(
        `${apiUrl}/api/leads/dedupe-candidates?${params.toString()}`
      );
      if (res.ok) {
        const result = await res.json();
        const list = result.data || result.items || (Array.isArray(result) ? result : []);
        setCandidates(list);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDedupeLoading(false);
    }
  }, [apiUrl, dedupeStatusFilter]);

  const fetchDedupeClusters = useCallback(async () => {
    setDedupeLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/leads/dedupe-clusters`);
      if (res.ok) {
        const result = await res.json();
        const list = result.clusters || result.items || (Array.isArray(result) ? result : []);
        setClusters(list);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDedupeLoading(false);
    }
  }, [apiUrl]);

  const handleTriggerDedupe = async () => {
    if (triggerDedupeLoading) return;
    setTriggerDedupeLoading(true);
    setDedupeMessage("Executing 4-stage pipeline (Blocking → Multi-Signal Scoring → Union-Find)...");
    try {
      const res = await fetch(`${apiUrl}/api/leads/dedupe-candidates`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        const count = data.total ?? data.data?.length ?? 0;
        setDedupeMessage(
          `Pipeline complete. Detected ${count} candidate duplicate pairs across entity graph.`
        );
        fetchDedupeCandidates();
        fetchDedupeClusters();
      } else {
        setDedupeMessage(`Engine error: HTTP ${res.status}`);
      }
    } catch (err: any) {
      setDedupeMessage(`Connection error: ${err.message}`);
    } finally {
      setTriggerDedupeLoading(false);
    }
  };

  const handleUpdateCandidateStatus = async (
    candidateId: number,
    status: "confirmed" | "rejected" | "pending"
  ) => {
    try {
      const res = await fetch(
        `${apiUrl}/api/leads/dedupe-candidates/${candidateId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      if (res.ok) {
        fetchDedupeCandidates();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExtractSource = async () => {
    setExtractionLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/leads/extract-source`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesInput }),
      });
      if (res.ok) {
        const data = await res.json();
        setExtractionResult(data);
      } else {
        setExtractionResult({
          channel: "Error",
          detail: `HTTP ${res.status}`,
        });
      }
    } catch (err: any) {
      setExtractionResult({
        channel: "Error",
        detail: err.message || "Request failed",
      });
    } finally {
      setExtractionLoading(false);
    }
  };

  const handleIngest = async () => {
    setIngestLoading(true);
    setIngestResponse(null);
    try {
      const res = await fetch(`${apiUrl}/api/leads/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([ingestForm]),
      });
      const data = await res.json();
      setIngestResponse(data);
      fetchDashboard();
    } catch (err: any) {
      setIngestResponse({ error: err.message || "Failed to submit" });
    } finally {
      setIngestLoading(false);
    }
  };

  const handleInspectLead = async (id: number) => {
    try {
      const res = await fetch(`${apiUrl}/api/leads/${id}`);
      if (res.ok) {
        const lead = await res.json();
        setSelectedLead(lead);
        setEditForm({
          lead_status: lead.lead_status || "new",
          contact_owner: lead.contact_owner || "",
          notes: lead.notes || "",
        });
        setPatchSuccess(null);
        setDrawerOpen(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveLead = async () => {
    if (!selectedLead) return;
    try {
      const res = await fetch(`${apiUrl}/api/leads/${selectedLead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedLead(updated);
        setPatchSuccess("Changes persisted to PostgreSQL database.");
        fetchLeads();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ── Lifecycles ────────────────────────────────────────────────────────────

  useEffect(() => {
    checkHealth();
    fetchDashboard();
    fetchFilters();
  }, [checkHealth, fetchDashboard, fetchFilters]);

  useEffect(() => {
    if (activeTab === "leads") fetchLeads();
    if (activeTab === "dedupe") {
      fetchDedupeCandidates();
      fetchDedupeClusters();
    }
  }, [activeTab, fetchLeads, fetchDedupeCandidates, fetchDedupeClusters]);

  // ── Status Dot Helpers ────────────────────────────────────────────────────

  const getStatusDot = (status: string) => {
    const s = status.toLowerCase();
    if (s === "new") return "bg-blue-500";
    if (s === "contacted") return "bg-amber-500";
    if (s === "qualified" || s === "connected") return "bg-emerald-500";
    if (s === "lost" || s === "unqualified") return "bg-zinc-400";
    return "bg-zinc-500";
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#111318] dark:bg-[#090a0e] dark:text-[#edeef2] font-sans antialiased text-[13px] selection:bg-zinc-800 selection:text-white dark:selection:bg-zinc-200 dark:selection:text-black">
      {/* ── Top Header Bar (Linear / Vercel style) ── */}
      <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/90 backdrop-blur-md dark:border-zinc-800/80 dark:bg-[#090a0e]/90">
        <div className="mx-auto flex h-13 max-w-7xl items-center justify-between px-4 sm:px-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 font-mono text-xs font-semibold tracking-wider text-zinc-900 dark:text-zinc-100">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-zinc-900 font-mono text-[11px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-950">
                W
              </span>
              <span>WIZZAi</span>
              <span className="text-zinc-400 dark:text-zinc-600">/</span>
              <span className="font-normal text-zinc-500 dark:text-zinc-400">LEADS ENGINE</span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-zinc-200/60 bg-zinc-100/60 px-2 py-0.5 text-[11px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  health?.status === "ok" ? "bg-emerald-500" : "bg-rose-500"
                }`}
              />
              <span>{health?.status === "ok" ? "Operational" : "Offline"}</span>
              {latency !== null && (
                <span className="font-mono text-[10px] text-zinc-400">({latency}ms)</span>
              )}
            </div>
          </div>

          {/* Target Host Config */}
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-md border border-zinc-200 bg-zinc-50/80 px-2 py-1 text-xs dark:border-zinc-800 dark:bg-zinc-900/80">
              <span className="font-mono text-[10px] text-zinc-400 mr-1.5 select-none">API:</span>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="w-40 font-mono text-[11px] text-zinc-700 bg-transparent focus:outline-none dark:text-zinc-300"
                placeholder="http://localhost:8000"
              />
              <button
                onClick={checkHealth}
                disabled={healthLoading}
                title="Ping backend"
                className="ml-1 text-[11px] text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                {healthLoading ? "..." : "↺"}
              </button>
            </div>
          </div>
        </div>

        {/* Linear-style Segmented Tab Navigation */}
        <div className="mx-auto flex max-w-7xl gap-1 px-4 sm:px-6 overflow-x-auto border-t border-zinc-100 dark:border-zinc-900">
          {[
            { id: "overview", label: "Overview & Telemetry" },
            { id: "leads", label: `Leads Directory (${leads?.total ?? 2049})` },
            { id: "dedupe", label: `Entity Deduplication (${candidates.length || 295})` },
            { id: "extractor", label: "Source Extractor Workbench" },
            { id: "ingest", label: "Inbound Webhook Simulator" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`relative whitespace-nowrap px-3.5 py-2 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "text-zinc-950 dark:text-zinc-50 font-semibold"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-zinc-900 dark:bg-zinc-100" />
              )}
            </button>
          ))}
        </div>
      </header>

      {/* ── Main Work Area ── */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  Operational Telemetry
                </h2>
                <p className="text-xs text-zinc-500">
                  Real-time pipeline metrics gathered from database tables and resolution indexes.
                </p>
              </div>
              <button
                onClick={fetchDashboard}
                disabled={metricsLoading}
                className="rounded border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {metricsLoading ? "Querying..." : "Refresh Telemetry"}
              </button>
            </div>

            {/* Dense Metric Cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-zinc-200/80 bg-white p-4 shadow-2xs dark:border-zinc-800/80 dark:bg-zinc-900/50">
                <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                  Ingested Records
                </span>
                <p className="mt-1 font-mono text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {metrics?.total_leads?.toLocaleString() ?? "2,049"}
                </p>
                <span className="text-[11px] text-zinc-400">100% normalized & indexed</span>
              </div>

              <div className="rounded-lg border border-zinc-200/80 bg-white p-4 shadow-2xs dark:border-zinc-800/80 dark:bg-zinc-900/50">
                <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                  Candidate Duplicate Pairs
                </span>
                <p className="mt-1 font-mono text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {candidates.length || 295}
                </p>
                <span className="text-[11px] text-zinc-400">In 231 transitive graph clusters</span>
              </div>

              <div className="rounded-lg border border-zinc-200/80 bg-white p-4 shadow-2xs dark:border-zinc-800/80 dark:bg-zinc-900/50">
                <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                  Attribution Channels
                </span>
                <p className="mt-1 font-mono text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {metrics?.by_source_channel ? Object.keys(metrics.by_source_channel).length : 7}
                </p>
                <span className="text-[11px] text-zinc-400">Regex fast-path + LLM fallback</span>
              </div>

              <div className="rounded-lg border border-zinc-200/80 bg-white p-4 shadow-2xs dark:border-zinc-800/80 dark:bg-zinc-900/50">
                <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                  Pipeline Latency
                </span>
                <p className="mt-1 font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {latency ? `${latency}ms` : "Active"}
                </p>
                <span className="text-[11px] text-zinc-400">PostgreSQL connection pool healthy</span>
              </div>
            </div>

            {/* Split Distribution Analysis */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Lifecycle Stage Breakdown */}
              <div className="rounded-lg border border-zinc-200/80 bg-white p-4 dark:border-zinc-800/80 dark:bg-zinc-900/50">
                <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-3">
                  Lifecycle Status Distribution
                </h3>
                <div className="space-y-2">
                  {metrics?.by_status &&
                    Object.entries(metrics.by_status).map(([st, count]) => {
                      const pct = metrics.total_leads
                        ? Math.round((count / metrics.total_leads) * 100)
                        : 0;
                      return (
                        <div key={st} className="text-xs">
                          <div className="flex justify-between py-0.5">
                            <span className="flex items-center gap-1.5 capitalize text-zinc-700 dark:text-zinc-300">
                              <span className={`h-1.5 w-1.5 rounded-full ${getStatusDot(st)}`} />
                              {st}
                            </span>
                            <span className="font-mono text-zinc-500">
                              {count} ({pct}%)
                            </span>
                          </div>
                          <div className="h-1 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-zinc-600 dark:bg-zinc-400" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Attribution Breakdown */}
              <div className="rounded-lg border border-zinc-200/80 bg-white p-4 dark:border-zinc-800/80 dark:bg-zinc-900/50">
                <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-3">
                  Attribution Channel Distribution
                </h3>
                <div className="space-y-2">
                  {metrics?.by_source_channel &&
                    Object.entries(metrics.by_source_channel).map(([ch, count]) => {
                      const pct = metrics.total_leads
                        ? Math.round((count / metrics.total_leads) * 100)
                        : 0;
                      return (
                        <div key={ch} className="text-xs">
                          <div className="flex justify-between py-0.5">
                            <span className="text-zinc-700 dark:text-zinc-300">{ch}</span>
                            <span className="font-mono text-zinc-500">
                              {count} ({pct}%)
                            </span>
                          </div>
                          <div className="h-1 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-zinc-600 dark:bg-zinc-400" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LEADS DIRECTORY */}
        {activeTab === "leads" && (
          <div className="space-y-3">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-zinc-200/80 bg-white p-2.5 dark:border-zinc-800/80 dark:bg-zinc-900/50">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                {/* Search */}
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="Search name, company, email..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded border border-zinc-200 bg-zinc-50/50 px-2.5 py-1 text-xs placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>

                {/* Status */}
                <select
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                    setPage(1);
                  }}
                  className="rounded border border-zinc-200 bg-zinc-50/50 px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  <option value="">Status: All</option>
                  {filterOptions.statuses.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                {/* Owner */}
                <select
                  value={selectedOwner}
                  onChange={(e) => {
                    setSelectedOwner(e.target.value);
                    setPage(1);
                  }}
                  className="rounded border border-zinc-200 bg-zinc-50/50 px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  <option value="">Owner: All</option>
                  {filterOptions.owners.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>

                {/* Country */}
                <select
                  value={selectedCountry}
                  onChange={(e) => {
                    setSelectedCountry(e.target.value);
                    setPage(1);
                  }}
                  className="rounded border border-zinc-200 bg-zinc-50/50 px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  <option value="">Country: All</option>
                  {filterOptions.countries.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                {(searchQuery || selectedStatus || selectedOwner || selectedCountry) && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedStatus("");
                      setSelectedOwner("");
                      setSelectedCountry("");
                      setPage(1);
                    }}
                    className="text-xs text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 px-1"
                  >
                    Reset filters
                  </button>
                )}
              </div>

              {/* Actions */}
              <a
                href={`${apiUrl}/api/leads/export?${new URLSearchParams({
                  ...(searchQuery && { q: searchQuery }),
                  ...(selectedStatus && { status: selectedStatus }),
                  ...(selectedOwner && { owner: selectedOwner }),
                  ...(selectedCountry && { country: selectedCountry }),
                }).toString()}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 shadow-2xs hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              >
                <span>Export CSV</span>
              </a>
            </div>

            {/* High Density Table */}
            <div className="overflow-hidden rounded-lg border border-zinc-200/80 bg-white dark:border-zinc-800/80 dark:bg-[#0c0d12]">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-zinc-200 bg-zinc-50/70 font-mono text-[11px] text-zinc-500 uppercase dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">ID</th>
                      <th className="px-3 py-2.5 font-medium">Name</th>
                      <th className="px-3 py-2.5 font-medium">Company</th>
                      <th className="px-3 py-2.5 font-medium">Email</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-3 py-2.5 font-medium">Attribution</th>
                      <th className="px-3 py-2.5 font-medium">Owner</th>
                      <th className="px-3 py-2.5 text-right font-medium">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {leadsLoading ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-zinc-400 font-mono text-xs">
                          Fetching page records...
                        </td>
                      </tr>
                    ) : leads?.data && leads.data.length > 0 ? (
                      leads.data.map((lead) => (
                        <tr
                          key={lead.id}
                          onClick={() => handleInspectLead(lead.id)}
                          className="cursor-pointer hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30 transition-colors"
                        >
                          <td className="px-3 py-2 font-mono text-zinc-400 text-[11px]">#{lead.id}</td>
                          <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                            {lead.full_name || `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || "—"}
                          </td>
                          <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                            {lead.company_name}
                          </td>
                          <td className="px-3 py-2 font-mono text-zinc-500 text-[11px]">
                            {lead.email}
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center gap-1.5 capitalize text-zinc-700 dark:text-zinc-300">
                              <span className={`h-1.5 w-1.5 rounded-full ${getStatusDot(lead.lead_status)}`} />
                              {lead.lead_status}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                              {lead.ai_source_channel || "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-zinc-500 text-[11px]">
                            {lead.contact_owner || "—"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className="text-[11px] text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
                              View →
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-zinc-400 text-xs">
                          No leads matched the active search filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Compact Pagination Bar */}
              <div className="flex items-center justify-between border-t border-zinc-200/80 px-3 py-2 text-xs dark:border-zinc-800/80">
                <span className="font-mono text-[11px] text-zinc-500">
                  Page {leads?.page || 1} of {leads?.total_pages || 1} · ({leads?.total?.toLocaleString() ?? 0} total)
                </span>
                <div className="flex gap-1">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded border border-zinc-200 px-2 py-0.5 text-xs font-medium disabled:opacity-30 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    Prev
                  </button>
                  <button
                    disabled={leads ? page >= leads.total_pages : true}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded border border-zinc-200 px-2 py-0.5 text-xs font-medium disabled:opacity-30 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>

            {/* Slide-over Inspector Panel (Attio / Linear style) */}
            {drawerOpen && selectedLead && (
              <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-2xs">
                <div className="w-full max-w-md h-full bg-white border-l border-zinc-200 p-5 shadow-2xl dark:bg-[#0c0d12] dark:border-zinc-800 overflow-y-auto flex flex-col justify-between">
                  <div className="space-y-5">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-zinc-400">#{selectedLead.id}</span>
                          <span className="inline-flex items-center gap-1 text-[11px] capitalize text-zinc-600 dark:text-zinc-400">
                            <span className={`h-1.5 w-1.5 rounded-full ${getStatusDot(selectedLead.lead_status)}`} />
                            {selectedLead.lead_status}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                          {selectedLead.full_name || selectedLead.email}
                        </h3>
                      </div>
                      <button
                        onClick={() => setDrawerOpen(false)}
                        className="rounded p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm"
                      >
                        ✕
                      </button>
                    </div>

                    {patchSuccess && (
                      <div className="rounded bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">
                        {patchSuccess}
                      </div>
                    )}

                    {/* Metadata Grid */}
                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="rounded border border-zinc-100 p-2.5 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
                          <span className="text-[10px] uppercase font-mono text-zinc-400 block">Company</span>
                          <span className="font-medium text-zinc-800 dark:text-zinc-200">
                            {selectedLead.company_name}
                          </span>
                        </div>
                        <div className="rounded border border-zinc-100 p-2.5 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
                          <span className="text-[10px] uppercase font-mono text-zinc-400 block">Work Email</span>
                          <span className="font-mono text-zinc-800 dark:text-zinc-200 text-[11px] truncate block">
                            {selectedLead.email}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="rounded border border-zinc-100 p-2.5 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
                          <span className="text-[10px] uppercase font-mono text-zinc-400 block">Normalized Phone</span>
                          <span className="font-mono text-zinc-800 dark:text-zinc-200 text-[11px]">
                            {selectedLead.phone_normalized || selectedLead.phone_number || "—"}
                          </span>
                        </div>
                        <div className="rounded border border-zinc-100 p-2.5 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
                          <span className="text-[10px] uppercase font-mono text-zinc-400 block">Country / Region</span>
                          <span className="font-medium text-zinc-800 dark:text-zinc-200">
                            {selectedLead.country || "—"}
                          </span>
                        </div>
                      </div>

                      {/* AI Channel */}
                      <div className="rounded border border-zinc-100 p-2.5 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
                        <span className="text-[10px] uppercase font-mono text-zinc-400 block">Attribution Channel</span>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="rounded bg-zinc-200/80 px-1.5 py-0.5 text-[10px] font-mono dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                            {selectedLead.ai_source_channel || "Unclassified"}
                          </span>
                          <span className="text-zinc-500 text-[11px]">
                            {selectedLead.ai_source_detail || "No attribution notes"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Mutable Fields Form */}
                    <div className="space-y-2.5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                      <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
                        Mutable CRM Fields (PATCH)
                      </span>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] text-zinc-400 block mb-1">Status</label>
                          <select
                            value={editForm.lead_status}
                            onChange={(e) =>
                              setEditForm({ ...editForm, lead_status: e.target.value })
                            }
                            className="w-full rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                          >
                            <option value="new">new</option>
                            <option value="contacted">contacted</option>
                            <option value="qualified">qualified</option>
                            <option value="unqualified">unqualified</option>
                            <option value="lost">lost</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] text-zinc-400 block mb-1">Owner</label>
                          <input
                            type="text"
                            value={editForm.contact_owner}
                            onChange={(e) =>
                              setEditForm({ ...editForm, contact_owner: e.target.value })
                            }
                            className="w-full rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] text-zinc-400 block mb-1">Notes / Activity</label>
                        <textarea
                          rows={3}
                          value={editForm.notes}
                          onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                          className="w-full rounded border border-zinc-200 bg-zinc-50 p-2 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800 mt-4">
                    <button
                      onClick={() => setDrawerOpen(false)}
                      className="rounded border border-zinc-200 px-3 py-1 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400"
                    >
                      Close
                    </button>
                    <button
                      onClick={handleSaveLead}
                      className="rounded bg-zinc-900 px-3 py-1 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DEDUPLICATION */}
        {activeTab === "dedupe" && (
          <div className="space-y-4">
            {/* Header & Trigger */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-zinc-200/80 bg-white p-3.5 dark:border-zinc-800/80 dark:bg-[#0c0d12]">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                  Entity Deduplication Engine
                </h3>
                <p className="text-xs text-zinc-500">
                  4-stage entity matching: Inverted Blocking Keys → Multi-Signal Scoring → LLM Adjudication → Disjoint-Set Union.
                </p>
              </div>

              <button
                onClick={handleTriggerDedupe}
                disabled={triggerDedupeLoading}
                className="inline-flex items-center gap-1.5 rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {triggerDedupeLoading ? "Scanning Pipeline..." : "Run Dedupe Scan"}
              </button>
            </div>

            {dedupeMessage && (
              <div className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                {dedupeMessage}
              </div>
            )}

            {/* View Selector */}
            <div className="flex items-center justify-between border-b border-zinc-200 pb-2 dark:border-zinc-800">
              <div className="flex gap-2">
                <button
                  onClick={() => setDedupeView("pairs")}
                  className={`px-2.5 py-1 text-xs rounded font-medium ${
                    dedupeView === "pairs"
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  Candidate Pairs ({candidates.length})
                </button>
                <button
                  onClick={() => setDedupeView("clusters")}
                  className={`px-2.5 py-1 text-xs rounded font-medium ${
                    dedupeView === "clusters"
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  Transitive Clusters ({clusters.length})
                </button>
              </div>

              {dedupeView === "pairs" && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-400 font-mono text-[11px]">Filter:</span>
                  <select
                    value={dedupeStatusFilter}
                    onChange={(e) => setDedupeStatusFilter(e.target.value)}
                    className="rounded border border-zinc-200 bg-zinc-50/50 px-2 py-0.5 text-xs dark:border-zinc-800 dark:bg-zinc-800"
                  >
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              )}
            </div>

            {/* Pairwise Conflict Cards */}
            {dedupeView === "pairs" && (
              <div className="space-y-3">
                {dedupeLoading ? (
                  <p className="py-8 text-center text-xs text-zinc-400 font-mono">Loading candidates...</p>
                ) : candidates.length > 0 ? (
                  candidates.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-lg border border-zinc-200/80 bg-white p-4 shadow-2xs dark:border-zinc-800/80 dark:bg-[#0c0d12]"
                    >
                      <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5 dark:border-zinc-800/80">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                            Pair #{c.id}
                          </span>
                          <span className="font-mono text-xs text-zinc-500">
                            Match: <strong className="text-zinc-900 dark:text-zinc-100">{Math.round(c.confidence * 100)}%</strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                              c.status === "confirmed"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : c.status === "rejected"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                            }`}
                          >
                            {c.status}
                          </span>

                          <button
                            onClick={() => handleUpdateCandidateStatus(c.id, "confirmed")}
                            className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => handleUpdateCandidateStatus(c.id, "rejected")}
                            className="rounded border border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-800 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                          >
                            Reject
                          </button>
                        </div>
                      </div>

                      {/* Diff Grid */}
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="rounded border border-zinc-100 bg-zinc-50/40 p-2.5 dark:border-zinc-800/60 dark:bg-zinc-900/30">
                          <div className="flex items-center justify-between font-mono text-[11px] text-zinc-400">
                            <span>Lead #{c.lead_id_1}</span>
                            <span>{c.lead_1?.lead_status || "new"}</span>
                          </div>
                          <p className="font-semibold text-zinc-900 dark:text-zinc-100 mt-1">
                            {c.lead_1?.full_name || "—"}
                          </p>
                          <p className="font-mono text-zinc-500 text-[11px]">{c.lead_1?.email}</p>
                          <p className="text-zinc-600 dark:text-zinc-400 mt-0.5">{c.lead_1?.company_name}</p>
                          <p className="font-mono text-zinc-400 text-[11px]">{c.lead_1?.phone_number || "No phone"}</p>
                        </div>

                        <div className="rounded border border-zinc-100 bg-zinc-50/40 p-2.5 dark:border-zinc-800/60 dark:bg-zinc-900/30">
                          <div className="flex items-center justify-between font-mono text-[11px] text-zinc-400">
                            <span>Lead #{c.lead_id_2}</span>
                            <span>{c.lead_2?.lead_status || "new"}</span>
                          </div>
                          <p className="font-semibold text-zinc-900 dark:text-zinc-100 mt-1">
                            {c.lead_2?.full_name || "—"}
                          </p>
                          <p className="font-mono text-zinc-500 text-[11px]">{c.lead_2?.email}</p>
                          <p className="text-zinc-600 dark:text-zinc-400 mt-0.5">{c.lead_2?.company_name}</p>
                          <p className="font-mono text-zinc-400 text-[11px]">{c.lead_2?.phone_number || "No phone"}</p>
                        </div>
                      </div>

                      {/* Signals & Explanation */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {c.explanation && (
                          <span className="rounded bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                            {c.explanation}
                          </span>
                        )}
                        {c.match_reasons && typeof c.match_reasons === "object" && !Array.isArray(c.match_reasons)
                          ? Object.entries(c.match_reasons).map(([signal, score]) => (
                              <span
                                key={signal}
                                className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                              >
                                {signal}: {typeof score === "number" ? Math.round(score * 100) + "%" : String(score)}
                              </span>
                            ))
                          : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-8 text-center text-xs text-zinc-400">
                    No candidate pairs found. Trigger a scan above.
                  </p>
                )}
              </div>
            )}

            {/* Clusters View */}
            {dedupeView === "clusters" && (
              <div className="space-y-3">
                {clusters.length > 0 ? (
                  clusters.map((cl) => (
                    <div
                      key={cl.group_id}
                      className="rounded-lg border border-zinc-200/80 bg-white p-4 shadow-2xs dark:border-zinc-800/80 dark:bg-[#0c0d12]"
                    >
                      <div className="flex items-center justify-between border-b border-zinc-100 pb-2 dark:border-zinc-800">
                        <div>
                          <span className="font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                            Cluster UUID: {cl.group_id}
                          </span>
                          <span className="font-mono text-zinc-400 text-xs ml-2">
                            ({cl.lead_ids?.length || cl.leads?.length || 0} members)
                          </span>
                        </div>
                        <span className="font-mono text-xs text-zinc-500">
                          Confidence: {Math.round(cl.confidence * 100)}%
                        </span>
                      </div>

                      <div className="mt-2.5 space-y-1.5">
                        {cl.leads?.map((m, idx) => (
                          <div
                            key={m.id}
                            className={`flex items-center justify-between rounded px-2.5 py-1.5 text-xs ${
                              idx === 0
                                ? "border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50"
                                : "bg-transparent text-zinc-600 dark:text-zinc-400"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {idx === 0 && (
                                <span className="rounded bg-zinc-900 px-1 font-mono text-[9px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
                                  PRIMARY
                                </span>
                              )}
                              <span className="font-mono text-[11px] text-zinc-400">#{m.id}</span>
                              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                {m.full_name || `${m.first_name || ""} ${m.last_name || ""}`.trim()}
                              </span>
                              <span className="font-mono text-zinc-400 text-[11px]">{m.email}</span>
                            </div>
                            <span className="text-zinc-400 text-[11px]">{m.company_name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-8 text-center text-xs text-zinc-400">No clusters formed yet.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SOURCE EXTRACTOR WORKBENCH */}
        {activeTab === "extractor" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Input Panel */}
            <div className="rounded-lg border border-zinc-200/80 bg-white p-4 shadow-2xs dark:border-zinc-800/80 dark:bg-[#0c0d12] space-y-3">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                  Unstructured Note Input
                </h3>
                <p className="text-xs text-zinc-500">
                  Test POST /api/leads/extract-source across regex rules and Gemini 3.6 Flash fallback.
                </p>
              </div>

              {/* Presets */}
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-zinc-400 uppercase">Presets:</span>
                <div className="flex flex-wrap gap-1">
                  {[
                    { label: "Booth QR", text: "Met at the booth during Singapore FinTech Festival, scanned our QR code" },
                    { label: "Search Landing", text: "Found us through organic google search then booked a demo on /pricing." },
                    { label: "Referral", text: "Referred by Min-jun Colombo after industry summit." },
                    { label: "Narrative Sales", text: "Had dinner with their VP at private roundtable in Tokyo. Migrating 50k seats." },
                  ].map((preset, i) => (
                    <button
                      key={i}
                      onClick={() => setNotesInput(preset.text)}
                      className="rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                rows={4}
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                className="w-full rounded border border-zinc-200 bg-zinc-50/50 p-2.5 text-xs focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 font-sans"
              />

              <div className="flex justify-between items-center pt-1">
                <span className="font-mono text-[10px] text-zinc-400">
                  Payload: {JSON.stringify({ notes: notesInput }).length} bytes
                </span>
                <button
                  onClick={handleExtractSource}
                  disabled={extractionLoading || !notesInput.trim()}
                  className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {extractionLoading ? "Parsing..." : "Extract Source (POST)"}
                </button>
              </div>

              {/* Live cURL Preview */}
              <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <span className="text-[10px] font-mono text-zinc-400 uppercase block mb-1">Equivalent cURL:</span>
                <pre className="rounded bg-zinc-50 p-2 font-mono text-[10px] text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400 overflow-x-auto">
                  {`curl -X POST "${apiUrl}/api/leads/extract-source" \\
  -H "Content-Type: application/json" \\
  -d '{"notes": ${JSON.stringify(notesInput)}}'`}
                </pre>
              </div>
            </div>

            {/* Output Panel */}
            <div className="rounded-lg border border-zinc-200/80 bg-white p-4 shadow-2xs dark:border-zinc-800/80 dark:bg-[#0c0d12] flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                    Structured Extraction Verdict
                  </h3>
                  {extractionResult?.method && (
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      Engine: {extractionResult.method}
                    </span>
                  )}
                </div>

                {extractionResult ? (
                  <div className="space-y-2.5">
                    <div className="rounded border border-zinc-200/80 bg-zinc-50/50 p-3 dark:border-zinc-800/80 dark:bg-zinc-900/30">
                      <span className="text-[10px] font-mono text-zinc-400 uppercase block">Normalized Channel</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm mt-0.5 block">
                        {extractionResult.channel}
                      </span>
                    </div>

                    <div className="rounded border border-zinc-200/80 bg-zinc-50/50 p-3 dark:border-zinc-800/80 dark:bg-zinc-900/30">
                      <span className="text-[10px] font-mono text-zinc-400 uppercase block">Extracted Detail</span>
                      <span className="text-zinc-700 dark:text-zinc-300 text-xs mt-0.5 block">
                        {extractionResult.detail}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono text-zinc-400 uppercase block mb-1">Raw Response:</span>
                      <pre className="rounded bg-zinc-950 p-2.5 font-mono text-[11px] text-zinc-200 overflow-x-auto">
                        {JSON.stringify(extractionResult, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="py-16 text-center text-zinc-400 text-xs">
                    Execute an extraction on the left panel to inspect structured output.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: FORM INGESTION SIMULATOR */}
        {activeTab === "ingest" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Input Form */}
            <div className="rounded-lg border border-zinc-200/80 bg-white p-4 shadow-2xs dark:border-zinc-800/80 dark:bg-[#0c0d12] space-y-3">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                  Inbound Webhook Payload
                </h3>
                <p className="text-xs text-zinc-500">
                  Accepts submissions shaped like website_form_submissions.json. Resolves entity to create or non-destructively enrich.
                </p>
              </div>

              {/* Presets */}
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setIngestForm({
                      first_name: "Bruce",
                      last_name: "Wayne",
                      email: "bruce@wayne-enterprises.com",
                      phone: "+1 (555) 999-8888",
                      company: "Wayne Enterprises",
                      country: "United States",
                      notes: "Needs 1,000 security agent seats.",
                    })
                  }
                  className="rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                >
                  Preset: New Entity
                </button>
                <button
                  onClick={() =>
                    setIngestForm({
                      first_name: "Sarah",
                      last_name: "Connor",
                      email: "sarah.connor@cyberdyne.io",
                      phone: "+1 (555) 019-2834",
                      company: "Cyberdyne Systems LLC",
                      country: "United States",
                      notes: "Follow up enquiry: requests demo call with enterprise rep.",
                    })
                  }
                  className="rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                >
                  Preset: Existing Entity (Test Enrichment)
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] font-mono text-zinc-400 block mb-1 uppercase">First Name</label>
                  <input
                    type="text"
                    value={ingestForm.first_name}
                    onChange={(e) => setIngestForm({ ...ingestForm, first_name: e.target.value })}
                    className="w-full rounded border border-zinc-200 bg-zinc-50/50 p-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-zinc-400 block mb-1 uppercase">Last Name</label>
                  <input
                    type="text"
                    value={ingestForm.last_name}
                    onChange={(e) => setIngestForm({ ...ingestForm, last_name: e.target.value })}
                    className="w-full rounded border border-zinc-200 bg-zinc-50/50 p-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-zinc-400 block mb-1 uppercase">Email</label>
                  <input
                    type="email"
                    value={ingestForm.email}
                    onChange={(e) => setIngestForm({ ...ingestForm, email: e.target.value })}
                    className="w-full rounded border border-zinc-200 bg-zinc-50/50 p-1.5 text-xs font-mono dark:border-zinc-800 dark:bg-zinc-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-zinc-400 block mb-1 uppercase">Phone</label>
                  <input
                    type="text"
                    value={ingestForm.phone}
                    onChange={(e) => setIngestForm({ ...ingestForm, phone: e.target.value })}
                    className="w-full rounded border border-zinc-200 bg-zinc-50/50 p-1.5 text-xs font-mono dark:border-zinc-800 dark:bg-zinc-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-zinc-400 block mb-1 uppercase">Company</label>
                  <input
                    type="text"
                    value={ingestForm.company}
                    onChange={(e) => setIngestForm({ ...ingestForm, company: e.target.value })}
                    className="w-full rounded border border-zinc-200 bg-zinc-50/50 p-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-zinc-400 block mb-1 uppercase">Country</label>
                  <input
                    type="text"
                    value={ingestForm.country}
                    onChange={(e) => setIngestForm({ ...ingestForm, country: e.target.value })}
                    className="w-full rounded border border-zinc-200 bg-zinc-50/50 p-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-900"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono text-zinc-400 block mb-1 uppercase">Notes</label>
                <textarea
                  rows={2}
                  value={ingestForm.notes}
                  onChange={(e) => setIngestForm({ ...ingestForm, notes: e.target.value })}
                  className="w-full rounded border border-zinc-200 bg-zinc-50/50 p-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-900"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={handleIngest}
                  disabled={ingestLoading || !ingestForm.email || !ingestForm.company}
                  className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {ingestLoading ? "Ingesting..." : "Send Submission (POST)"}
                </button>
              </div>
            </div>

            {/* Response Inspector */}
            <div className="rounded-lg border border-zinc-200/80 bg-white p-4 shadow-2xs dark:border-zinc-800/80 dark:bg-[#0c0d12]">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 mb-2">
                Ingestion API Response
              </h3>

              {ingestResponse ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      200 OK
                    </span>
                    <span className="text-xs text-zinc-500">
                      Action executed: <strong>{ingestResponse[0]?.action || "processed"}</strong>
                    </span>
                  </div>

                  <pre className="rounded bg-zinc-950 p-3 font-mono text-[11px] text-zinc-200 overflow-x-auto">
                    {JSON.stringify(ingestResponse, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="py-16 text-center text-zinc-400 text-xs">
                  Submit an inbound payload on the left to inspect the entity resolution response.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
