"use client";

import { useState } from "react";
import { useMutation } from "urql";
import {
  WIKIDATA_SEARCH_MUTATION,
  WIKIDATA_IMPORT_MUTATION,
} from "@/lib/graphql/admin";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";

type Step = "search" | "select" | "results";
type SearchType = "SHOWS" | "SHOWS_BY_REGION" | "VENUES" | "COMPANY";

interface ShowResult {
  wikidataId: string;
  title: string;
  description?: string;
  performanceType?: string;
  premiereDate?: string;
  venueLabel?: string;
  directorLabel?: string;
  composerLabel?: string;
  duration?: string;
  existsInCurtn: boolean;
}

interface VenueResult {
  wikidataId: string;
  name: string;
  capacity?: string;
  coordinates?: string;
  website?: string;
  architectLabel?: string;
  ownerLabel?: string;
  openedDate?: string;
  existsInCurtn: boolean;
}

interface ImportResult {
  totalProcessed: number;
  showsCreated: number;
  showsEnriched: number;
  showsSkipped: number;
  venuesCreated: number;
  venuesEnriched: number;
  venuesSkipped: number;
  companiesCreated: number;
  personsCreated: number;
  creditsCreated: number;
  errors: string[];
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function parseCoordDisplay(point?: string): string {
  if (!point) return "";
  const match = point.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/);
  if (!match) return "";
  return `${parseFloat(match[2]).toFixed(4)}, ${parseFloat(match[1]).toFixed(4)}`;
}

export default function WikidataImportPage() {
  const [step, setStep] = useState<Step>("search");
  const [searchType, setSearchType] = useState<SearchType>("VENUES");
  const [query, setQuery] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Search results
  const [showResults, setShowResults] = useState<ShowResult[]>([]);
  const [venueResults, setVenueResults] = useState<VenueResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Import results
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [{ fetching: searching }, executeSearch] = useMutation(WIKIDATA_SEARCH_MUTATION);
  const [{ fetching: importing }, executeImport] = useMutation(WIKIDATA_IMPORT_MUTATION);

  async function handleSearch() {
    if (!query.trim()) return;
    setError(null);
    setShowResults([]);
    setVenueResults([]);
    setSelected(new Set());

    const input: any = { searchType, query: query.trim() };
    if (searchType === "SHOWS_BY_REGION") {
      if (yearFrom) input.yearFrom = parseInt(yearFrom, 10);
      if (yearTo) input.yearTo = parseInt(yearTo, 10);
    }
    const result = await executeSearch({ input });

    if (result.error) {
      setError(result.error.message);
      return;
    }
    if (result.data?.wikidataSearch?.error) {
      setError(result.data.wikidataSearch.error);
      return;
    }

    const data = result.data.wikidataSearch;
    // Deduplicate — SPARQL can return duplicate rows for entities with multiple optional values
    if (data.shows?.length > 0) {
      const seen = new Set<string>();
      setShowResults(data.shows.filter((s: ShowResult) => {
        if (seen.has(s.wikidataId)) return false;
        seen.add(s.wikidataId);
        return true;
      }));
    }
    if (data.venues?.length > 0) {
      const seen = new Set<string>();
      setVenueResults(data.venues.filter((v: VenueResult) => {
        if (seen.has(v.wikidataId)) return false;
        seen.add(v.wikidataId);
        return true;
      }));
    }

    if ((data.shows?.length || 0) === 0 && (data.venues?.length || 0) === 0) {
      setError("No results found. Try a different search term.");
    } else {
      setStep("select");
    }
  }

  function toggleSelect(wikidataId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(wikidataId)) next.delete(wikidataId);
      else next.add(wikidataId);
      return next;
    });
  }

  function toggleSelectAll() {
    const allIds = searchType === "VENUES"
      ? venueResults.map((v) => v.wikidataId)
      : showResults.map((s) => s.wikidataId);

    if (selected.size === allIds.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  }

  async function handleImport(dryRun: boolean) {
    if (selected.size === 0) return;
    setError(null);

    const entityType = searchType === "VENUES" ? "VENUES" : "SHOWS";
    const result = await executeImport({
      input: {
        wikidataIds: Array.from(selected),
        entityType,
        city: (searchType === "VENUES" || searchType === "SHOWS_BY_REGION") ? query.trim() : undefined,
        fetchDescriptions: true,
        dryRun,
      },
    });

    if (result.error) {
      setError(result.error.message);
      return;
    }
    if (result.data?.wikidataImport?.error) {
      setError(result.data.wikidataImport.error);
      return;
    }
    if (result.data?.wikidataImport?.result) {
      setImportResult(result.data.wikidataImport.result);
      if (!dryRun) setStep("results");
    }
  }

  function handleReset() {
    setStep("search");
    setQuery("");
    setShowResults([]);
    setVenueResults([]);
    setSelected(new Set());
    setImportResult(null);
    setError(null);
  }

  const newCount = searchType === "VENUES"
    ? venueResults.filter((v) => !v.existsInCurtn && selected.has(v.wikidataId)).length
    : showResults.filter((s) => !s.existsInCurtn && selected.has(s.wikidataId)).length;
  const enrichCount = searchType === "VENUES"
    ? venueResults.filter((v) => v.existsInCurtn && selected.has(v.wikidataId)).length
    : showResults.filter((s) => s.existsInCurtn && selected.has(s.wikidataId)).length;

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-curtn-cream">Wikipedia Import</h1>
        <p className="mt-1 text-sm text-curtn-muted">
          Search Wikidata for shows and venues, then import or enrich existing records.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex gap-2 text-xs text-curtn-muted">
        {(["search", "select", "results"] as Step[]).map((s, i) => (
          <span key={s} className={step === s ? "text-curtn-coral font-medium" : ""}>
            {i > 0 && <span className="mr-2">&rarr;</span>}
            {s === "search" ? "Search" : s === "select" ? "Select & Import" : "Results"}
          </span>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-curtn-red/30 bg-curtn-red/10 px-4 py-3 text-sm text-curtn-red">
          {error}
        </div>
      )}

      {/* STEP: Search */}
      {step === "search" && (
        <Card className="space-y-5">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-curtn-cream">
              What are you looking for?
            </label>
            <div className="flex gap-2 flex-wrap">
              {([
                { value: "VENUES" as SearchType, label: "Venues" },
                { value: "SHOWS_BY_REGION" as SearchType, label: "Shows by Region" },
                { value: "SHOWS" as SearchType, label: "Shows by Title" },
                { value: "COMPANY" as SearchType, label: "By Company" },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSearchType(opt.value)}
                  className={`rounded-lg px-4 py-2 text-sm transition-colors ${
                    searchType === opt.value
                      ? "bg-curtn-coral text-white"
                      : "bg-curtn-deep text-curtn-muted hover:text-curtn-cream"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-curtn-cream">
              {searchType === "VENUES" || searchType === "SHOWS_BY_REGION"
                ? "City"
                : searchType === "COMPANY"
                  ? "Company name"
                  : "Show title"}
            </label>
            {searchType === "VENUES" || searchType === "SHOWS_BY_REGION" ? (
              <div className="flex gap-2">
                {["NYC", "Manhattan", "Brooklyn", "Minneapolis", "LA"].map((city) => (
                  <button
                    key={city}
                    onClick={() => setQuery(city)}
                    className={`rounded-lg px-4 py-2 text-sm transition-colors ${
                      query === city
                        ? "bg-curtn-coral text-white"
                        : "bg-curtn-deep text-curtn-muted hover:text-curtn-cream"
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </div>
            ) : (
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder={
                  searchType === "COMPANY"
                    ? 'e.g. "Roundabout Theatre"'
                    : 'e.g. "Hamilton"'
                }
                className="w-full bg-transparent border-b border-curtn-dark text-curtn-cream placeholder:text-curtn-dark py-2 text-sm outline-none focus:border-curtn-coral transition-colors duration-200"
              />
            )}
          </div>

          {searchType === "SHOWS_BY_REGION" && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-curtn-cream">
                Year range (optional)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={yearFrom}
                  onChange={(e) => setYearFrom(e.target.value)}
                  placeholder="From (e.g. 2020)"
                  min="1800"
                  max="2030"
                  className="w-32 bg-transparent border-b border-curtn-dark text-curtn-cream placeholder:text-curtn-dark py-2 text-sm outline-none focus:border-curtn-coral transition-colors duration-200"
                />
                <span className="text-curtn-muted text-sm">to</span>
                <input
                  type="number"
                  value={yearTo}
                  onChange={(e) => setYearTo(e.target.value)}
                  placeholder="To (e.g. 2026)"
                  min="1800"
                  max="2030"
                  className="w-32 bg-transparent border-b border-curtn-dark text-curtn-cream placeholder:text-curtn-dark py-2 text-sm outline-none focus:border-curtn-coral transition-colors duration-200"
                />
              </div>
              <p className="text-xs text-curtn-muted/60">
                Leave blank to get all years. Searches shows that premiered at a venue in the selected city.
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              onClick={handleSearch}
              disabled={!query.trim() || searching}
            >
              {searching ? "Searching Wikidata..." : "Search"}
            </Button>
            {searching && (
              <span className="text-xs text-curtn-muted">
                Querying SPARQL endpoint...
              </span>
            )}
          </div>

          <p className="text-xs text-curtn-muted/60">
            Searches the Wikidata knowledge base via SPARQL. Results include theaters,
            concert halls, performing arts centers, musicals, plays, and operas.
          </p>
        </Card>
      )}

      {/* STEP: Select & Import */}
      {step === "select" && (
        <>
          {/* Venue results */}
          {venueResults.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-curtn-cream">
                  {venueResults.length} venues found
                </h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleSelectAll}
                    className="text-xs text-curtn-muted hover:text-curtn-cream transition-colors"
                  >
                    {selected.size === venueResults.length ? "Deselect all" : "Select all"}
                  </button>
                  <span className="text-xs text-curtn-muted">
                    {selected.size} selected
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[28rem]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-curtn-surface">
                    <tr className="border-b border-curtn-dark">
                      <th className="px-3 py-2 text-left text-curtn-muted font-normal w-8"></th>
                      <th className="px-3 py-2 text-left text-curtn-muted font-normal">Name</th>
                      <th className="px-3 py-2 text-left text-curtn-muted font-normal">Capacity</th>
                      <th className="px-3 py-2 text-left text-curtn-muted font-normal">Architect</th>
                      <th className="px-3 py-2 text-left text-curtn-muted font-normal">Owner</th>
                      <th className="px-3 py-2 text-left text-curtn-muted font-normal">Opened</th>
                      <th className="px-3 py-2 text-left text-curtn-muted font-normal">Coords</th>
                      <th className="px-3 py-2 text-left text-curtn-muted font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {venueResults.map((venue) => (
                      <tr
                        key={venue.wikidataId}
                        onClick={() => toggleSelect(venue.wikidataId)}
                        className={`border-b border-curtn-dark/30 cursor-pointer transition-colors ${
                          selected.has(venue.wikidataId)
                            ? "bg-curtn-coral/10"
                            : "hover:bg-curtn-deep/50"
                        }`}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selected.has(venue.wikidataId)}
                            onChange={() => toggleSelect(venue.wikidataId)}
                            className="accent-curtn-coral"
                          />
                        </td>
                        <td className="px-3 py-2 text-curtn-cream font-medium">
                          {venue.name}
                        </td>
                        <td className="px-3 py-2 text-curtn-cream/80">
                          {venue.capacity || "\u2014"}
                        </td>
                        <td className="px-3 py-2 text-curtn-cream/80">
                          {venue.architectLabel || "\u2014"}
                        </td>
                        <td className="px-3 py-2 text-curtn-cream/80 max-w-[150px] truncate">
                          {venue.ownerLabel || "\u2014"}
                        </td>
                        <td className="px-3 py-2 text-curtn-cream/80">
                          {formatDate(venue.openedDate)}
                        </td>
                        <td className="px-3 py-2 text-curtn-muted text-[10px]">
                          {parseCoordDisplay(venue.coordinates)}
                        </td>
                        <td className="px-3 py-2">
                          {venue.existsInCurtn ? (
                            <span className="rounded bg-curtn-dark/50 px-2 py-0.5 text-curtn-muted text-[10px]">
                              exists
                            </span>
                          ) : (
                            <span className="rounded bg-curtn-coral/20 px-2 py-0.5 text-curtn-coral text-[10px]">
                              new
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Show results */}
          {showResults.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-curtn-cream">
                  {showResults.length} shows found
                </h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleSelectAll}
                    className="text-xs text-curtn-muted hover:text-curtn-cream transition-colors"
                  >
                    {selected.size === showResults.length ? "Deselect all" : "Select all"}
                  </button>
                  <span className="text-xs text-curtn-muted">
                    {selected.size} selected
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[28rem]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-curtn-surface">
                    <tr className="border-b border-curtn-dark">
                      <th className="px-3 py-2 text-left text-curtn-muted font-normal w-8"></th>
                      <th className="px-3 py-2 text-left text-curtn-muted font-normal">Title</th>
                      <th className="px-3 py-2 text-left text-curtn-muted font-normal">Type</th>
                      <th className="px-3 py-2 text-left text-curtn-muted font-normal">Premiere</th>
                      <th className="px-3 py-2 text-left text-curtn-muted font-normal">Venue</th>
                      <th className="px-3 py-2 text-left text-curtn-muted font-normal">Director</th>
                      <th className="px-3 py-2 text-left text-curtn-muted font-normal">Composer</th>
                      <th className="px-3 py-2 text-left text-curtn-muted font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {showResults.map((show) => (
                      <tr
                        key={show.wikidataId}
                        onClick={() => toggleSelect(show.wikidataId)}
                        className={`border-b border-curtn-dark/30 cursor-pointer transition-colors ${
                          selected.has(show.wikidataId)
                            ? "bg-curtn-coral/10"
                            : "hover:bg-curtn-deep/50"
                        }`}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selected.has(show.wikidataId)}
                            onChange={() => toggleSelect(show.wikidataId)}
                            className="accent-curtn-coral"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="text-curtn-cream font-medium">{show.title}</div>
                          {show.description && (
                            <div className="text-curtn-muted/60 mt-0.5 max-w-[250px] truncate">
                              {show.description}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-curtn-cream/80">
                          {show.performanceType || "\u2014"}
                        </td>
                        <td className="px-3 py-2 text-curtn-cream/80">
                          {formatDate(show.premiereDate)}
                        </td>
                        <td className="px-3 py-2 text-curtn-cream/80 max-w-[150px] truncate">
                          {show.venueLabel || "\u2014"}
                        </td>
                        <td className="px-3 py-2 text-curtn-cream/80">
                          {show.directorLabel || "\u2014"}
                        </td>
                        <td className="px-3 py-2 text-curtn-cream/80">
                          {show.composerLabel || "\u2014"}
                        </td>
                        <td className="px-3 py-2">
                          {show.existsInCurtn ? (
                            <span className="rounded bg-curtn-dark/50 px-2 py-0.5 text-curtn-muted text-[10px]">
                              exists
                            </span>
                          ) : (
                            <span className="rounded bg-curtn-coral/20 px-2 py-0.5 text-curtn-coral text-[10px]">
                              new
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Dry run results */}
          {importResult && step === "select" && (
            <Card>
              <p className="text-xs font-medium text-curtn-muted uppercase tracking-wider mb-3">
                Dry Run Preview
              </p>
              <div className="grid grid-cols-3 gap-3 text-sm">
                {importResult.showsCreated > 0 && (
                  <div>
                    <span className="text-curtn-muted">Shows: </span>
                    <span className="text-curtn-cream">
                      {importResult.showsCreated} new, {importResult.showsEnriched} enriched
                    </span>
                  </div>
                )}
                {importResult.venuesCreated > 0 && (
                  <div>
                    <span className="text-curtn-muted">Venues: </span>
                    <span className="text-curtn-cream">
                      {importResult.venuesCreated} new, {importResult.venuesEnriched} enriched
                    </span>
                  </div>
                )}
                {importResult.personsCreated > 0 && (
                  <div>
                    <span className="text-curtn-muted">People: </span>
                    <span className="text-curtn-cream">
                      {importResult.personsCreated} new
                    </span>
                  </div>
                )}
                {importResult.creditsCreated > 0 && (
                  <div>
                    <span className="text-curtn-muted">Credits: </span>
                    <span className="text-curtn-cream">
                      {importResult.creditsCreated} new
                    </span>
                  </div>
                )}
              </div>
              {importResult.errors.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-curtn-red">
                    {importResult.errors.length} errors:
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {importResult.errors.slice(0, 10).map((err, i) => (
                      <li key={i} className="text-xs text-curtn-red/80">
                        &bull; {err}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          {/* Action bar */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => {
                setStep("search");
                setImportResult(null);
              }}
            >
              Back
            </Button>
            <Button
              variant="ghost"
              onClick={() => handleImport(true)}
              disabled={selected.size === 0 || importing}
            >
              {importing ? "Checking..." : "Dry Run"}
            </Button>
            <Button
              variant="primary"
              onClick={() => handleImport(false)}
              disabled={selected.size === 0 || importing}
            >
              {importing
                ? "Importing..."
                : `Import ${selected.size} ${selected.size === 1 ? "entity" : "entities"}`}
            </Button>
            {selected.size > 0 && (
              <span className="text-xs text-curtn-muted ml-2">
                Fetches Wikipedia descriptions at ~1/sec. May take {selected.size * 2}s.
              </span>
            )}
          </div>

          <p className="text-xs text-curtn-muted/50">
            Entities marked &quot;exists&quot; will be enriched (fill missing fields only, never overwrite).
            New entities will be created. Wikipedia intro paragraphs are fetched as descriptions.
          </p>
        </>
      )}

      {/* STEP: Results */}
      {step === "results" && importResult && (
        <>
          <Card className="space-y-4">
            <h2 className="text-sm font-medium text-curtn-cream">Import Complete</h2>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Processed", value: importResult.totalProcessed },
                { label: "Shows Created", value: importResult.showsCreated },
                { label: "Shows Enriched", value: importResult.showsEnriched },
                { label: "Shows Skipped", value: importResult.showsSkipped },
                { label: "Venues Created", value: importResult.venuesCreated },
                { label: "Venues Enriched", value: importResult.venuesEnriched },
                { label: "Venues Skipped", value: importResult.venuesSkipped },
                { label: "People Created", value: importResult.personsCreated },
                { label: "Credits Created", value: importResult.creditsCreated },
              ]
                .filter((item) => item.value > 0)
                .map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg bg-curtn-deep p-4 text-center"
                  >
                    <p className="text-2xl font-bold text-curtn-cream">{item.value}</p>
                    <p className="text-xs text-curtn-muted">{item.label}</p>
                  </div>
                ))}
            </div>

            {importResult.errors.length > 0 && (
              <div>
                <p className="text-xs font-medium text-curtn-red mb-2">
                  {importResult.errors.length}{" "}
                  {importResult.errors.length === 1 ? "error" : "errors"}
                </p>
                <div className="rounded-lg bg-curtn-deep p-3 max-h-48 overflow-y-auto">
                  {importResult.errors.map((err, i) => (
                    <p key={i} className="text-xs text-curtn-red/80 py-0.5">
                      &bull; {err}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleReset}>
              Search Again
            </Button>
            <Button
              variant="ghost"
              onClick={() => (window.location.href = "/admin/editor")}
            >
              Browse Data
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
