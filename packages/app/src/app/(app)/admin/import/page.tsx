"use client";

import { useState } from "react";
import { useMutation } from "urql";
import { CSV_IMPORT_MUTATION } from "@/lib/graphql/admin";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";

// Field options for column mapping
const CURTN_FIELDS = [
  { value: "", label: "-- Skip --" },
  { value: "title", label: "Show Title" },
  { value: "description", label: "Description (Show)" },
  { value: "showDescription", label: "Show Description" },
  { value: "runDescription", label: "Run Description" },
  { value: "performanceDescription", label: "Performance Description" },
  { value: "performanceTypes", label: "Performance Types" },
  { value: "duration", label: "Duration (minutes)" },
  { value: "date", label: "Date" },
  { value: "time", label: "Time" },
  { value: "startTime", label: "Start Time" },
  { value: "endTime", label: "End Time" },
  { value: "venueName", label: "Venue Name" },
  { value: "stageName", label: "Stage Name" },
  { value: "runTitle", label: "Run Title" },
  { value: "companyName", label: "Company Name" },
  { value: "ticketUrl", label: "Ticket URL" },
];

type Step = "upload" | "map" | "preview" | "results";

interface ImportResult {
  totalRows: number;
  showsCreated: number;
  showsMatched: number;
  runsCreated: number;
  runsMatched: number;
  performancesCreated: number;
  performancesMatched: number;
  errors: string[];
}

// Simple CSV parser that handles quoted fields
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i++; // skip escaped quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(current.trim());
        current = "";
      } else if (char === "\n" || (char === "\r" && next === "\n")) {
        row.push(current.trim());
        if (row.some((cell) => cell !== "")) rows.push(row);
        row = [];
        current = "";
        if (char === "\r") i++; // skip \n after \r
      } else {
        current += char;
      }
    }
  }
  // Last row
  row.push(current.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);

  return rows;
}

export default function CsvImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [columnMap, setColumnMap] = useState<Record<number, string>>({});
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const [{ fetching: importing }, executeCsvImport] = useMutation(CSV_IMPORT_MUTATION);

  function handleFileUpload(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCsv(text);
      if (parsed.length < 2) {
        setImportError("CSV must have a header row and at least one data row.");
        return;
      }

      const csvHeaders = parsed[0];
      const csvRows = parsed.slice(1);
      setHeaders(csvHeaders);
      setRows(csvRows);

      // Auto-map columns by header name
      const autoMap: Record<number, string> = {};
      csvHeaders.forEach((header, idx) => {
        const normalized = header.toLowerCase().replace(/[^a-z]/g, "");
        const match = CURTN_FIELDS.find(
          (f) => f.value && f.value.toLowerCase() === normalized
        );
        if (match) autoMap[idx] = match.value;
        // Common aliases
        if (normalized === "name" || normalized === "showtitle" || normalized === "show")
          autoMap[idx] = "title";
        if (normalized === "venue" || normalized === "location")
          autoMap[idx] = "venueName";
        if (
          normalized === "company" ||
          normalized === "producer" ||
          normalized === "productioncompany"
        )
          autoMap[idx] = "companyName";
        if (
          normalized === "type" ||
          normalized === "genre" ||
          normalized === "category"
        )
          autoMap[idx] = "performanceTypes";
        if (
          normalized === "ticketurl" ||
          normalized === "tickets" ||
          normalized === "url" ||
          normalized === "link"
        )
          autoMap[idx] = "ticketUrl";
        if (normalized === "starttime" || normalized === "start" || normalized === "doortime")
          autoMap[idx] = "startTime";
        if (normalized === "endtime" || normalized === "end")
          autoMap[idx] = "endTime";
        if (normalized === "stage" || normalized === "stagename" || normalized === "room" || normalized === "theater" || normalized === "hall")
          autoMap[idx] = "stageName";
        if (normalized === "runtitle" || normalized === "productiontitle" || normalized === "productionname")
          autoMap[idx] = "runTitle";
        if (normalized === "showdescription")
          autoMap[idx] = "showDescription";
        if (normalized === "rundescription" || normalized === "productiondescription")
          autoMap[idx] = "runDescription";
        if (normalized === "performancedescription" || normalized === "showingdescription" || normalized === "eventnotes")
          autoMap[idx] = "performanceDescription";
      });
      setColumnMap(autoMap);
      setImportError(null);
      setStep("map");
    };
    reader.readAsText(file);
  }

  function getMappedRows(): Record<string, string>[] {
    return rows
      .map((row) => {
        const mapped: Record<string, string> = {};
        Object.entries(columnMap).forEach(([colIdx, field]) => {
          if (field) {
            mapped[field] = row[parseInt(colIdx)] || "";
          }
        });
        return mapped;
      })
      .filter((row) => row.title?.trim()); // Skip rows without a title
  }

  async function handleImport(dryRun: boolean) {
    setImportError(null);
    const mappedRows = getMappedRows();

    if (mappedRows.length === 0) {
      setImportError("No valid rows to import. Make sure 'title' is mapped.");
      return;
    }

    const result = await executeCsvImport({
      input: {
        rows: mappedRows,
        dryRun,
      },
    });

    if (result.error) {
      setImportError(result.error.message);
    } else if (result.data?.csvImport?.error) {
      setImportError(result.data.csvImport.error);
    } else if (result.data?.csvImport?.result) {
      setImportResult(result.data.csvImport.result);
      if (!dryRun) setStep("results");
    }
  }

  function handleReset() {
    setStep("upload");
    setHeaders([]);
    setRows([]);
    setColumnMap({});
    setImportResult(null);
    setImportError(null);
  }

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-curtn-cream">CSV Import</h1>
        <p className="mt-1 text-sm text-curtn-muted">
          Upload a CSV file to bulk import shows, runs, and performances.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex gap-2 text-xs text-curtn-muted">
        {(["upload", "map", "preview", "results"] as Step[]).map((s, i) => (
          <span
            key={s}
            className={step === s ? "text-curtn-coral font-medium" : ""}
          >
            {i > 0 && <span className="mr-2">&rarr;</span>}
            {s === "upload"
              ? "Upload"
              : s === "map"
                ? "Map Columns"
                : s === "preview"
                  ? "Preview"
                  : "Results"}
          </span>
        ))}
      </div>

      {importError && (
        <div className="rounded-lg border border-curtn-red/30 bg-curtn-red/10 px-4 py-3 text-sm text-curtn-red">
          {importError}
        </div>
      )}

      {/* STEP: Upload */}
      {step === "upload" && (
        <Card>
          <div
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-curtn-dark py-16 transition-colors hover:border-curtn-muted/50"
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const file = e.dataTransfer.files[0];
              if (file && file.name.endsWith(".csv")) handleFileUpload(file);
              else setImportError("Please upload a .csv file");
            }}
          >
            <p className="text-sm text-curtn-muted">
              Drag and drop a CSV file here, or
            </p>
            <label className="mt-3 cursor-pointer rounded-lg bg-curtn-coral px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-curtn-red">
              Browse Files
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
            </label>
          </div>
        </Card>
      )}

      {/* STEP: Map Columns */}
      {step === "map" && (
        <>
          <Card>
            <h2 className="mb-4 text-sm font-medium text-curtn-cream">
              Map CSV columns to Curtn fields
            </h2>
            <div className="space-y-3">
              {headers.map((header, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <span
                    className="w-40 truncate text-sm text-curtn-muted"
                    title={header}
                  >
                    {header}
                  </span>
                  <span className="text-curtn-muted/40">&rarr;</span>
                  <select
                    value={columnMap[idx] || ""}
                    onChange={(e) =>
                      setColumnMap((prev) => ({
                        ...prev,
                        [idx]: e.target.value,
                      }))
                    }
                    className="flex-1 rounded-lg border border-curtn-dark bg-curtn-deep px-3 py-2 text-sm text-curtn-cream focus:border-curtn-coral focus:outline-none"
                  >
                    {CURTN_FIELDS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </Card>

          {/* Preview first 3 rows */}
          <Card>
            <h2 className="mb-3 text-sm font-medium text-curtn-cream">
              Preview (first 3 rows)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-curtn-dark">
                    {Object.entries(columnMap)
                      .filter(([, field]) => field)
                      .map(([colIdx, field]) => (
                        <th
                          key={colIdx}
                          className="px-3 py-2 text-left text-curtn-muted font-normal"
                        >
                          {CURTN_FIELDS.find((f) => f.value === field)?.label ||
                            field}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 3).map((row, rowIdx) => (
                    <tr
                      key={rowIdx}
                      className="border-b border-curtn-dark/50"
                    >
                      {Object.entries(columnMap)
                        .filter(([, field]) => field)
                        .map(([colIdx]) => (
                          <td
                            key={colIdx}
                            className="px-3 py-2 text-curtn-cream/80 max-w-[200px] truncate"
                          >
                            {row[parseInt(colIdx)] || "\u2014"}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep("upload")}>
              Back
            </Button>
            <Button
              variant="primary"
              onClick={() => setStep("preview")}
              disabled={!Object.values(columnMap).includes("title")}
            >
              Continue
            </Button>
          </div>
        </>
      )}

      {/* STEP: Preview & Import */}
      {step === "preview" && (
        <>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-curtn-cream">
                Ready to import {getMappedRows().length} rows
              </h2>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => handleImport(true)}
                  disabled={importing}
                >
                  {importing ? "Checking..." : "Dry Run"}
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleImport(false)}
                  disabled={importing}
                >
                  {importing ? "Importing..." : "Import"}
                </Button>
              </div>
            </div>

            {/* Dry run results */}
            {importResult && step === "preview" && (
              <div className="mb-4 rounded-lg border border-curtn-dark bg-curtn-deep p-4 space-y-2">
                <p className="text-xs font-medium text-curtn-muted uppercase tracking-wider">
                  Dry Run Results
                </p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-curtn-muted">Shows: </span>
                    <span className="text-curtn-cream">
                      {importResult.showsCreated} new,{" "}
                      {importResult.showsMatched} matched
                    </span>
                  </div>
                  <div>
                    <span className="text-curtn-muted">Runs: </span>
                    <span className="text-curtn-cream">
                      {importResult.runsCreated} new,{" "}
                      {importResult.runsMatched} matched
                    </span>
                  </div>
                  <div>
                    <span className="text-curtn-muted">Performances: </span>
                    <span className="text-curtn-cream">
                      {importResult.performancesCreated} new
                      {importResult.performancesMatched > 0 &&
                        `, ${importResult.performancesMatched} matched`}
                    </span>
                  </div>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-curtn-red">
                      {importResult.errors.length} errors:
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {importResult.errors.slice(0, 10).map((err, i) => (
                        <li key={i} className="text-xs text-curtn-red/80">
                          &bull; {err}
                        </li>
                      ))}
                      {importResult.errors.length > 10 && (
                        <li className="text-xs text-curtn-muted">
                          ...and {importResult.errors.length - 10} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Full row table */}
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-curtn-surface">
                  <tr className="border-b border-curtn-dark">
                    <th className="px-3 py-2 text-left text-curtn-muted font-normal">
                      #
                    </th>
                    {Object.entries(columnMap)
                      .filter(([, field]) => field)
                      .map(([colIdx, field]) => (
                        <th
                          key={colIdx}
                          className="px-3 py-2 text-left text-curtn-muted font-normal"
                        >
                          {CURTN_FIELDS.find((f) => f.value === field)?.label ||
                            field}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {getMappedRows().map((row, rowIdx) => (
                    <tr
                      key={rowIdx}
                      className="border-b border-curtn-dark/30"
                    >
                      <td className="px-3 py-1.5 text-curtn-muted/50">
                        {rowIdx + 1}
                      </td>
                      {Object.entries(columnMap)
                        .filter(([, field]) => field)
                        .map(([, field]) => (
                          <td
                            key={field}
                            className="px-3 py-1.5 text-curtn-cream/80 max-w-[200px] truncate"
                          >
                            {row[field] || "\u2014"}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={() => {
                setStep("map");
                setImportResult(null);
              }}
            >
              Back
            </Button>
          </div>
        </>
      )}

      {/* STEP: Results */}
      {step === "results" && importResult && (
        <>
          <Card className="space-y-4">
            <h2 className="text-sm font-medium text-curtn-cream">
              Import Complete
            </h2>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-curtn-deep p-4 text-center">
                <p className="text-2xl font-bold text-curtn-cream">
                  {importResult.showsCreated}
                </p>
                <p className="text-xs text-curtn-muted">Shows Created</p>
              </div>
              <div className="rounded-lg bg-curtn-deep p-4 text-center">
                <p className="text-2xl font-bold text-curtn-cream">
                  {importResult.showsMatched}
                </p>
                <p className="text-xs text-curtn-muted">Shows Matched</p>
              </div>
              <div className="rounded-lg bg-curtn-deep p-4 text-center">
                <p className="text-2xl font-bold text-curtn-cream">
                  {importResult.runsCreated}
                </p>
                <p className="text-xs text-curtn-muted">Runs Created</p>
              </div>
              <div className="rounded-lg bg-curtn-deep p-4 text-center">
                <p className="text-2xl font-bold text-curtn-cream">
                  {importResult.runsMatched}
                </p>
                <p className="text-xs text-curtn-muted">Runs Matched</p>
              </div>
              <div className="rounded-lg bg-curtn-deep p-4 text-center">
                <p className="text-2xl font-bold text-curtn-cream">
                  {importResult.performancesCreated}
                </p>
                <p className="text-xs text-curtn-muted">
                  Performances Created
                </p>
              </div>
              <div className="rounded-lg bg-curtn-deep p-4 text-center">
                <p className="text-2xl font-bold text-curtn-cream">
                  {importResult.performancesMatched}
                </p>
                <p className="text-xs text-curtn-muted">
                  Performances Matched
                </p>
              </div>
              <div className="rounded-lg bg-curtn-deep p-4 text-center">
                <p className="text-2xl font-bold text-curtn-cream">
                  {importResult.totalRows}
                </p>
                <p className="text-xs text-curtn-muted">Total Rows</p>
              </div>
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
              Import Another File
            </Button>
            <Button
              variant="ghost"
              onClick={() => (window.location.href = "/performances")}
            >
              Browse Performances
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
