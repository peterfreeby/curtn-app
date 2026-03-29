"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "urql";
import JSZip from "jszip";
import { CSV_IMPORT_MUTATION } from "@/lib/graphql/admin";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { getStoredAccessToken, setTokens, isTokenExpired } from "@/lib/auth/token";

const REFRESH_MUTATION = `mutation RefreshToken($input: userRefreshTokenInput!) {
  userRefreshToken(input: $input) { accessToken error }
}`;

// Refresh the access token if it's expired or about to expire (within 2 minutes)
async function ensureFreshToken(): Promise<void> {
  const token = localStorage.getItem("curtn_access_token");
  if (!token) return;

  // Check if token expires within 2 minutes
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    const expiresIn = payload.exp * 1000 - Date.now();
    if (expiresIn > 2 * 60 * 1000) return; // Still fresh enough
  } catch {
    return;
  }

  const refreshToken = localStorage.getItem("curtn_refresh_token");
  if (!refreshToken) return;

  try {
    const res = await fetch("/api/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: REFRESH_MUTATION,
        variables: { input: { refreshToken } },
      }),
    });
    const json = await res.json();
    const newAccessToken = json.data?.userRefreshToken?.accessToken;
    if (newAccessToken) {
      setTokens(newAccessToken, refreshToken);
    }
  } catch {
    // Silently fail — next request will get a 401
  }
}

// All fields that can contain image filenames or URLs
const IMAGE_FIELDS = new Set([
  "showImageUrl",
  "showPosterUrl",
  "venueImageUrl",
  "runImageUrl",
  "runPosterUrl",
  "companyLogoUrl",
  "personHeadshotUrl",
  "performanceImageUrl",
]);

// Field options for column mapping, organized by entity
const CURTN_FIELDS = [
  { value: "", label: "-- Skip --", group: "" },
  // Show
  { value: "title", label: "Show Title", group: "Show" },
  { value: "showDescription", label: "Show Description", group: "Show" },
  { value: "performanceTypes", label: "Performance Types", group: "Show" },
  { value: "duration", label: "Duration (minutes)", group: "Show" },
  { value: "showUrl", label: "Show URL", group: "Show" },
  { value: "showImageUrl", label: "Show Image URL", group: "Show" },
  { value: "showPosterUrl", label: "Show Poster URL", group: "Show" },
  { value: "languages", label: "Languages", group: "Show" },
  // Venue
  { value: "venueName", label: "Venue Name", group: "Venue" },
  { value: "stageName", label: "Stage Name", group: "Venue" },
  { value: "venueDescription", label: "Venue Description", group: "Venue" },
  { value: "venueAddress", label: "Venue Address", group: "Venue" },
  { value: "venueCity", label: "Venue City", group: "Venue" },
  { value: "venueState", label: "Venue State", group: "Venue" },
  { value: "venueZipCode", label: "Venue Zip Code", group: "Venue" },
  { value: "venueCapacity", label: "Venue Capacity", group: "Venue" },
  { value: "venueType", label: "Venue Type", group: "Venue" },
  { value: "venueWebsite", label: "Venue Website", group: "Venue" },
  { value: "venuePhone", label: "Venue Phone", group: "Venue" },
  { value: "venueEmail", label: "Venue Email", group: "Venue" },
  { value: "venueImageUrl", label: "Venue Image URL", group: "Venue" },
  // Run
  { value: "runTitle", label: "Run Title", group: "Run" },
  { value: "runDescription", label: "Run Description", group: "Run" },
  { value: "runStartDate", label: "Run Start Date", group: "Run" },
  { value: "runEndDate", label: "Run End Date", group: "Run" },
  { value: "intermissions", label: "Intermissions", group: "Run" },
  { value: "runImageUrl", label: "Run Image URL", group: "Run" },
  { value: "runPosterUrl", label: "Run Poster URL", group: "Run" },
  // Performance
  { value: "date", label: "Date", group: "Performance" },
  { value: "time", label: "Time", group: "Performance" },
  { value: "startTime", label: "Start Time", group: "Performance" },
  { value: "endTime", label: "End Time", group: "Performance" },
  { value: "ticketUrl", label: "Ticket URL", group: "Performance" },
  {
    value: "performanceDescription",
    label: "Performance Description",
    group: "Performance",
  },
  { value: "soldOut", label: "Sold Out", group: "Performance" },
  {
    value: "performanceImageUrl",
    label: "Performance Image",
    group: "Performance",
  },
  // Company
  { value: "companyName", label: "Company Name", group: "Company" },
  {
    value: "companyDescription",
    label: "Company Description",
    group: "Company",
  },
  { value: "companyLogoUrl", label: "Company Logo URL", group: "Company" },
  // Person
  { value: "personHeadshotUrl", label: "Person Headshot", group: "Credit" },
  // Credits
  { value: "personName", label: "Person Name", group: "Credit" },
  { value: "personRole", label: "Person Role", group: "Credit" },
  { value: "creditType", label: "Credit Type", group: "Credit" },
  { value: "creditDepartment", label: "Credit Department", group: "Credit" },
];

// Group labels for optgroup rendering
const FIELD_GROUPS = [
  "Show",
  "Venue",
  "Run",
  "Performance",
  "Company",
  "Credit",
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
  venuesCreated: number;
  venuesMatched: number;
  companiesCreated: number;
  companiesMatched: number;
  personsCreated: number;
  personsMatched: number;
  creditsCreated: number;
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

// Check if a value looks like a filename (not a URL)
function isImageFilename(value: string): boolean {
  if (!value || value.startsWith("http://") || value.startsWith("https://")) {
    return false;
  }
  return /\.(jpe?g|png|webp|gif)$/i.test(value);
}

// Upload a single image file to R2 via /api/upload
async function uploadImage(
  file: Blob,
  filename: string,
  batchId: string
): Promise<string> {
  const formData = new FormData();
  // Infer MIME type from extension
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };
  const mimeType = mimeMap[ext] || "image/jpeg";
  const fileObj = new File([file], filename, { type: mimeType });

  formData.append("file", fileObj);
  formData.append("entityType", "import");
  formData.append("entityId", batchId);

  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(err.error || `Upload failed (${res.status})`);
  }
  const data = await res.json();
  return data.url;
}

export default function CsvImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [columnMap, setColumnMap] = useState<Record<number, string>>({});
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  // Unified progress state: progress bar + scrolling log
  const [activity, setActivity] = useState<{
    active: boolean;
    progress: number; // 0-100
    label: string;
    log: string[];
  } | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll log to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activity?.log.length]);

  function startActivity(label: string) {
    setActivity({ active: true, progress: 0, label, log: [] });
  }
  function updateActivity(label: string, progress: number, logLine?: string) {
    setActivity((prev) => {
      if (!prev) return { active: true, progress, label, log: logLine ? [logLine] : [] };
      return {
        ...prev,
        label,
        progress,
        log: logLine ? [...prev.log, logLine] : prev.log,
      };
    });
  }
  function logActivity(line: string) {
    setActivity((prev) => {
      if (!prev) return null;
      return { ...prev, log: [...prev.log, line] };
    });
  }
  function endActivity() {
    setActivity(null);
  }

  // Image files extracted from zip: filename (lowercase) → Blob
  const imageFilesRef = useRef<Map<string, Blob>>(new Map());

  const [{ fetching: importing }, executeCsvImport] =
    useMutation(CSV_IMPORT_MUTATION);

  function processCsvText(text: string) {
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
    const aliasMap: Record<string, string> = {
      // Show
      name: "title",
      showtitle: "title",
      show: "title",
      title: "title",
      showdescription: "showDescription",
      description: "showDescription",
      type: "performanceTypes",
      genre: "performanceTypes",
      category: "performanceTypes",
      performancetypes: "performanceTypes",
      duration: "duration",
      durationminutes: "duration",
      runtime: "duration",
      showurl: "showUrl",
      showimageurl: "showImageUrl",
      showimage: "showImageUrl",
      showposterurl: "showPosterUrl",
      showposter: "showPosterUrl",
      poster: "showPosterUrl",
      languages: "languages",
      language: "languages",
      // Venue
      venue: "venueName",
      location: "venueName",
      venuename: "venueName",
      stage: "stageName",
      stagename: "stageName",
      room: "stageName",
      theater: "stageName",
      hall: "stageName",
      venuedescription: "venueDescription",
      venueaddress: "venueAddress",
      address: "venueAddress",
      venuecity: "venueCity",
      city: "venueCity",
      venuestate: "venueState",
      state: "venueState",
      venuezipcode: "venueZipCode",
      zipcode: "venueZipCode",
      zip: "venueZipCode",
      venuecapacity: "venueCapacity",
      capacity: "venueCapacity",
      seats: "venueCapacity",
      venuetype: "venueType",
      venuewebsite: "venueWebsite",
      venuephone: "venuePhone",
      venueemail: "venueEmail",
      venueimageurl: "venueImageUrl",
      venueimage: "venueImageUrl",
      // Run
      runtitle: "runTitle",
      productiontitle: "runTitle",
      productionname: "runTitle",
      rundescription: "runDescription",
      productiondescription: "runDescription",
      runstartdate: "runStartDate",
      openingnight: "runStartDate",
      runenddate: "runEndDate",
      closingnight: "runEndDate",
      intermissions: "intermissions",
      intermission: "intermissions",
      runimageurl: "runImageUrl",
      runimage: "runImageUrl",
      runposterurl: "runPosterUrl",
      runposter: "runPosterUrl",
      // Performance
      date: "date",
      time: "time",
      starttime: "startTime",
      start: "startTime",
      doortime: "startTime",
      endtime: "endTime",
      end: "endTime",
      ticketurl: "ticketUrl",
      tickets: "ticketUrl",
      url: "ticketUrl",
      link: "ticketUrl",
      performancedescription: "performanceDescription",
      showingdescription: "performanceDescription",
      eventnotes: "performanceDescription",
      soldout: "soldOut",
      performanceimageurl: "performanceImageUrl",
      performanceimage: "performanceImageUrl",
      // Company
      company: "companyName",
      producer: "companyName",
      productioncompany: "companyName",
      companyname: "companyName",
      companydescription: "companyDescription",
      companylogourl: "companyLogoUrl",
      companylogo: "companyLogoUrl",
      // Credits
      personname: "personName",
      person: "personName",
      performer: "personName",
      actor: "personName",
      artist: "personName",
      castmember: "personName",
      personrole: "personRole",
      role: "personRole",
      character: "personRole",
      credittype: "creditType",
      creditdepartment: "creditDepartment",
      department: "creditDepartment",
      personheadshoturl: "personHeadshotUrl",
      headshot: "personHeadshotUrl",
      personheadshot: "personHeadshotUrl",
    };

    csvHeaders.forEach((header, idx) => {
      const normalized = header.toLowerCase().replace(/[^a-z]/g, "");
      const match = aliasMap[normalized];
      if (match) autoMap[idx] = match;
    });
    setColumnMap(autoMap);
    setImportError(null);
    setStep("map");
  }

  function handleFileUpload(file: File) {
    if (file.name.endsWith(".zip")) {
      handleZipUpload(file);
    } else {
      imageFilesRef.current = new Map();
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        processCsvText(text);
      };
      reader.readAsText(file);
    }
  }

  async function handleZipUpload(file: File) {
    setImportError(null);
    startActivity("Extracting ZIP...");

    try {
      const zip = await JSZip.loadAsync(file);
      const imageMap = new Map<string, Blob>();

      // Find the CSV file (import.csv, or any .csv at root or one level deep)
      let csvText: string | null = null;
      const csvCandidates = Object.keys(zip.files).filter(
        (name) =>
          !zip.files[name].dir &&
          name.toLowerCase().endsWith(".csv") &&
          !name.startsWith("__MACOSX")
      );

      // Prefer import.csv, then first .csv found
      const importCsv = csvCandidates.find((name) => {
        const basename = name.split("/").pop()?.toLowerCase();
        return basename === "import.csv";
      });
      const csvPath = importCsv || csvCandidates[0];

      if (!csvPath) {
        setImportError("No CSV file found in ZIP. Include an import.csv file.");
        endActivity();
        return;
      }

      logActivity(`Found ${csvPath.split("/").pop()}`);
      csvText = await zip.files[csvPath].async("string");

      // Extract all image files
      const imageExtensions = /\.(jpe?g|png|webp|gif)$/i;
      const imageEntries = Object.entries(zip.files).filter(
        ([path, entry]) => !entry.dir && !path.startsWith("__MACOSX") && imageExtensions.test(path)
      );

      for (let i = 0; i < imageEntries.length; i++) {
        const [path, entry] = imageEntries[i];
        const blob = await entry.async("blob");
        const basename = path.split("/").pop()!.toLowerCase();
        imageMap.set(basename, blob);
        imageMap.set(path.toLowerCase(), blob);
        updateActivity(
          `Extracting images... ${i + 1}/${imageEntries.length}`,
          ((i + 1) / imageEntries.length) * 100,
          basename
        );
      }

      imageFilesRef.current = imageMap;
      endActivity();
      processCsvText(csvText);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setImportError(`Failed to read ZIP: ${msg}`);
      endActivity();
    }
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

  // Count how many image filenames in the mapped rows reference files from the zip
  function getImageFileCount(): number {
    if (imageFilesRef.current.size === 0) return 0;
    const mappedRows = getMappedRows();
    const seen = new Set<string>();
    for (const row of mappedRows) {
      for (const [field, value] of Object.entries(row)) {
        if (IMAGE_FIELDS.has(field) && isImageFilename(value)) {
          seen.add(value.toLowerCase());
        }
      }
    }
    return seen.size;
  }

  // Estimate total upload size for images that will be uploaded
  function getImageUploadEstimate(): { count: number; bytes: number; cost: number } {
    if (imageFilesRef.current.size === 0) return { count: 0, bytes: 0, cost: 0 };
    const mappedRows = getMappedRows();
    const seen = new Map<string, Blob>();
    for (const row of mappedRows) {
      for (const [field, value] of Object.entries(row)) {
        if (IMAGE_FIELDS.has(field) && isImageFilename(value)) {
          const key = value.toLowerCase();
          const basename = key.split("/").pop()!;
          const blob = imageFilesRef.current.get(basename) || imageFilesRef.current.get(key);
          if (blob && !seen.has(key)) {
            seen.set(key, blob);
          }
        }
      }
    }
    let totalBytes = 0;
    for (const blob of seen.values()) {
      totalBytes += blob.size;
    }
    // R2 cost: $0.015/GB storage, Class A ops are free under 1M/month
    const gbStored = totalBytes / (1024 * 1024 * 1024);
    const freeTierGB = 10;
    const cost = Math.max(0, gbStored - freeTierGB) * 0.015;
    return { count: seen.size, bytes: totalBytes, cost };
  }

  // Upload all referenced images and return rows with filenames replaced by URLs
  async function uploadImagesAndResolveRows(
    mappedRows: Record<string, string>[]
  ): Promise<Record<string, string>[]> {
    if (imageFilesRef.current.size === 0) return mappedRows;

    // Collect unique filenames that need uploading
    const toUpload = new Map<string, Blob>();
    for (const row of mappedRows) {
      for (const [field, value] of Object.entries(row)) {
        if (IMAGE_FIELDS.has(field) && isImageFilename(value)) {
          const key = value.toLowerCase();
          // Try basename match, then full path match
          const basename = key.split("/").pop()!;
          const blob =
            imageFilesRef.current.get(basename) ||
            imageFilesRef.current.get(key);
          if (blob && !toUpload.has(key)) {
            toUpload.set(key, blob);
          }
        }
      }
    }

    if (toUpload.size === 0) return mappedRows;

    // Upload all images with concurrency limit
    const batchId = Date.now().toString();
    const urlMap = new Map<string, string>();
    const entries = Array.from(toUpload.entries());
    const CONCURRENCY = 10;
    let uploaded = 0;

    for (let i = 0; i < entries.length; i += CONCURRENCY) {
      const batch = entries.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async ([key, blob]) => {
          const filename = key.split("/").pop()!;
          const url = await uploadImage(blob, filename, batchId);
          return { key, url };
        })
      );
      for (const result of results) {
        if (result.status === "fulfilled") {
          urlMap.set(result.value.key, result.value.url);
          uploaded++;
          const filename = result.value.key.split("/").pop()!;
          updateActivity(
            `Uploading images... ${uploaded}/${toUpload.size}`,
            (uploaded / toUpload.size) * 50, // images are first half of progress
            `Uploaded ${filename}`
          );
        } else {
          uploaded++;
          logActivity(`Failed to upload: ${batch[results.indexOf(result)]?.[0] || "unknown"}`);
        }
      }
    }

    // Replace filenames with URLs in rows
    return mappedRows.map((row) => {
      const resolved = { ...row };
      for (const [field, value] of Object.entries(resolved)) {
        if (IMAGE_FIELDS.has(field) && isImageFilename(value)) {
          const key = value.toLowerCase();
          const basename = key.split("/").pop()!;
          const url = urlMap.get(key) || urlMap.get(basename);
          if (url) {
            resolved[field] = url;
          }
        }
      }
      return resolved;
    });
  }

  const BATCH_SIZE = 50;

  function mergeResults(base: ImportResult, chunk: ImportResult): ImportResult {
    return {
      totalRows: base.totalRows + chunk.totalRows,
      showsCreated: base.showsCreated + chunk.showsCreated,
      showsMatched: base.showsMatched + chunk.showsMatched,
      runsCreated: base.runsCreated + chunk.runsCreated,
      runsMatched: base.runsMatched + chunk.runsMatched,
      performancesCreated: base.performancesCreated + chunk.performancesCreated,
      performancesMatched: base.performancesMatched + chunk.performancesMatched,
      venuesCreated: base.venuesCreated + chunk.venuesCreated,
      venuesMatched: base.venuesMatched + chunk.venuesMatched,
      companiesCreated: base.companiesCreated + chunk.companiesCreated,
      companiesMatched: base.companiesMatched + chunk.companiesMatched,
      personsCreated: base.personsCreated + chunk.personsCreated,
      personsMatched: base.personsMatched + chunk.personsMatched,
      creditsCreated: base.creditsCreated + chunk.creditsCreated,
      errors: [...base.errors, ...chunk.errors],
    };
  }

  const emptyResult: ImportResult = {
    totalRows: 0, showsCreated: 0, showsMatched: 0, runsCreated: 0, runsMatched: 0,
    performancesCreated: 0, performancesMatched: 0, venuesCreated: 0, venuesMatched: 0,
    companiesCreated: 0, companiesMatched: 0, personsCreated: 0, personsMatched: 0,
    creditsCreated: 0, errors: [],
  };

  // Summarize a batch result into a log line
  function batchSummary(r: ImportResult): string {
    const parts: string[] = [];
    if (r.showsCreated) parts.push(`${r.showsCreated} show${r.showsCreated > 1 ? "s" : ""} created`);
    if (r.showsMatched) parts.push(`${r.showsMatched} show${r.showsMatched > 1 ? "s" : ""} matched`);
    if (r.venuesCreated) parts.push(`${r.venuesCreated} venue${r.venuesCreated > 1 ? "s" : ""} created`);
    if (r.runsCreated) parts.push(`${r.runsCreated} run${r.runsCreated > 1 ? "s" : ""} created`);
    if (r.performancesCreated) parts.push(`${r.performancesCreated} perf${r.performancesCreated > 1 ? "s" : ""} created`);
    if (r.creditsCreated) parts.push(`${r.creditsCreated} credit${r.creditsCreated > 1 ? "s" : ""} created`);
    if (r.errors.length) parts.push(`${r.errors.length} error${r.errors.length > 1 ? "s" : ""}`);
    return parts.join(", ") || "no changes";
  }

  async function handleImport(dryRun: boolean) {
    setImportError(null);
    const mappedRows = getMappedRows();

    if (mappedRows.length === 0) {
      setImportError("No valid rows to import. Make sure 'title' is mapped.");
      return;
    }

    const hasImages = !dryRun && imageFilesRef.current.size > 0;
    startActivity(hasImages ? "Uploading images..." : dryRun ? "Running dry check..." : "Importing...");

    // For real imports (not dry run), upload images first
    let finalRows = mappedRows;
    if (hasImages) {
      try {
        await ensureFreshToken();
        finalRows = await uploadImagesAndResolveRows(mappedRows);
        logActivity("All images uploaded");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setImportError(`Image upload failed: ${msg}`);
        endActivity();
        return;
      }
    }

    // Small imports or dry runs: send all at once
    if (dryRun || finalRows.length <= BATCH_SIZE) {
      updateActivity(
        dryRun ? "Running dry check..." : `Importing ${finalRows.length} rows...`,
        hasImages ? 55 : 10,
        dryRun ? "Sending to server for validation..." : `Sending ${finalRows.length} rows to server...`
      );

      const result = await executeCsvImport({ input: { rows: finalRows, dryRun } });
      endActivity();

      if (result.error) {
        setImportError(result.error.message);
      } else if (result.data?.csvImport?.error) {
        setImportError(result.data.csvImport.error);
      } else if (result.data?.csvImport?.result) {
        setImportResult(result.data.csvImport.result);
        if (!dryRun) setStep("results");
      }
      return;
    }

    // Large imports: batch into chunks to avoid timeouts
    let accumulated = { ...emptyResult };
    const totalRows = finalRows.length;
    const totalBatches = Math.ceil(totalRows / BATCH_SIZE);
    // Images took 0-50%, import takes 50-100%
    const progressBase = hasImages ? 50 : 0;
    const progressRange = hasImages ? 50 : 100;

    for (let i = 0; i < totalBatches; i++) {
      // Refresh auth token if needed before each batch
      await ensureFreshToken();

      const batchStart = i * BATCH_SIZE + 1;
      const batchEnd = Math.min((i + 1) * BATCH_SIZE, totalRows);
      const batch = finalRows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);

      updateActivity(
        `Importing rows ${batchStart}\u2013${batchEnd} of ${totalRows}...`,
        progressBase + (i / totalBatches) * progressRange,
        `Batch ${i + 1}/${totalBatches}: rows ${batchStart}\u2013${batchEnd}`
      );

      const result = await executeCsvImport({ input: { rows: batch, dryRun: false } });

      if (result.error) {
        logActivity(`Batch ${i + 1} failed: ${result.error.message}`);
        endActivity();
        setImportError(`Batch ${i + 1}/${totalBatches} failed: ${result.error.message}`);
        if (accumulated.totalRows > 0) {
          setImportResult(accumulated);
          setStep("results");
        }
        return;
      } else if (result.data?.csvImport?.error) {
        logActivity(`Batch ${i + 1} error: ${result.data.csvImport.error}`);
        endActivity();
        setImportError(`Batch ${i + 1}/${totalBatches}: ${result.data.csvImport.error}`);
        if (accumulated.totalRows > 0) {
          setImportResult(accumulated);
          setStep("results");
        }
        return;
      } else if (result.data?.csvImport?.result) {
        const chunkResult = result.data.csvImport.result;
        logActivity(`Batch ${i + 1} done: ${batchSummary(chunkResult)}`);
        accumulated = mergeResults(accumulated, chunkResult);
      }
    }

    endActivity();
    setImportResult(accumulated);
    setStep("results");
  }

  function handleReset() {
    setStep("upload");
    setHeaders([]);
    setRows([]);
    setColumnMap({});
    setImportResult(null);
    setImportError(null);
    endActivity();
    imageFilesRef.current = new Map();
  }

  const imageFileCount = step === "preview" ? getImageFileCount() : 0;
  const imageEstimate = step === "preview" ? getImageUploadEstimate() : { count: 0, bytes: 0, cost: 0 };

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-curtn-cream">CSV Import</h1>
        <p className="mt-1 text-sm text-curtn-muted">
          Upload a CSV or ZIP file to bulk import shows, runs, and performances.
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

      {activity && (
        <Card>
          <div className="space-y-3">
            {/* Current operation label */}
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-curtn-coral animate-pulse shrink-0" />
              <p className="text-sm font-medium text-curtn-cream">{activity.label}</p>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-curtn-dark rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-curtn-coral h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(2, activity.progress)}%` }}
              />
            </div>

            {/* Scrolling activity log */}
            {activity.log.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded bg-curtn-deep border border-curtn-dark px-3 py-2 font-mono text-xs space-y-0.5">
                {activity.log.map((line, i) => (
                  <p key={i} className="text-curtn-muted">
                    <span className="text-curtn-muted/40 mr-2 select-none">{String(i + 1).padStart(3, "\u2007")}</span>
                    {line}
                  </p>
                ))}
                <div ref={logEndRef} />
              </div>
            )}
          </div>
        </Card>
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
              if (
                file &&
                (file.name.endsWith(".csv") || file.name.endsWith(".zip"))
              ) {
                handleFileUpload(file);
              } else {
                setImportError("Please upload a .csv or .zip file");
              }
            }}
          >
            <p className="text-sm text-curtn-muted">
              Drag and drop a CSV or ZIP file here, or
            </p>
            <label className="mt-3 cursor-pointer rounded-lg bg-curtn-coral px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-curtn-red">
              Browse Files
              <input
                type="file"
                accept=".csv,.zip"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
            </label>
            <p className="mt-4 text-xs text-curtn-muted/60 max-w-md text-center">
              ZIP files should contain an <code>import.csv</code> and image
              files. Image columns in the CSV can reference filenames from the
              ZIP (e.g. <code>hamlet-poster.jpg</code>).
            </p>
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
            {imageFilesRef.current.size > 0 && (
              <p className="mb-3 text-xs text-curtn-coral">
                {imageFilesRef.current.size} image
                {imageFilesRef.current.size === 1 ? "" : "s"} available from ZIP
                &mdash; map image columns to resolve filenames automatically
              </p>
            )}
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
                    <option value="">-- Skip --</option>
                    {FIELD_GROUPS.map((group) => (
                      <optgroup key={group} label={group}>
                        {CURTN_FIELDS.filter((f) => f.group === group).map(
                          (f) => (
                            <option key={f.value} value={f.value}>
                              {f.label}
                            </option>
                          )
                        )}
                      </optgroup>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </Card>

          {/* Credit inference rules (show when credit fields are mapped) */}
          {Object.values(columnMap).some((v) =>
            [
              "personName",
              "personRole",
              "creditType",
              "creditDepartment",
            ].includes(v)
          ) && (
            <Card>
              <h2 className="mb-2 text-sm font-medium text-curtn-cream">
                Credit Level Inference
              </h2>
              <p className="text-xs text-curtn-muted mb-3">
                Credits are automatically assigned to the right level based on
                what other columns are in the row:
              </p>
              <div className="space-y-2 text-xs">
                <div className="flex gap-3 items-start">
                  <span className="shrink-0 rounded bg-curtn-coral/20 px-2 py-0.5 text-curtn-coral font-medium">
                    Show
                  </span>
                  <span className="text-curtn-cream/70">
                    Credit Type is &quot;creator&quot; or &quot;creative&quot;,
                    OR the row has no venue/run/performance data. Use for
                    playwrights, composers, lyricists.
                  </span>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="shrink-0 rounded bg-curtn-coral/20 px-2 py-0.5 text-curtn-coral font-medium">
                    Run
                  </span>
                  <span className="text-curtn-cream/70">
                    Row has venue, run title, or company data but no date/time.
                    Use for this production&apos;s cast and crew.
                  </span>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="shrink-0 rounded bg-curtn-coral/20 px-2 py-0.5 text-curtn-coral font-medium">
                    Performance
                  </span>
                  <span className="text-curtn-cream/70">
                    Row has a date (and a performance is created). Use for
                    understudies or one-night-only performers.
                  </span>
                </div>
              </div>
            </Card>
          )}

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
                        .map(([colIdx, field]) => {
                          const value = row[parseInt(colIdx)] || "";
                          const isZipImage =
                            IMAGE_FIELDS.has(field) &&
                            isImageFilename(value) &&
                            imageFilesRef.current.has(
                              (value.split("/").pop() || "").toLowerCase()
                            );
                          return (
                            <td
                              key={colIdx}
                              className={`px-3 py-2 max-w-[200px] truncate ${isZipImage ? "text-curtn-coral" : "text-curtn-cream/80"}`}
                              title={
                                isZipImage
                                  ? `Will upload from ZIP: ${value}`
                                  : value
                              }
                            >
                              {value || "\u2014"}
                            </td>
                          );
                        })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex gap-3">
            <Button variant="tertiary" onClick={() => setStep("upload")}>
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
              <div>
                <h2 className="text-sm font-medium text-curtn-cream">
                  Ready to import {getMappedRows().length} rows
                </h2>
                {imageFileCount > 0 && (
                  <div className="mt-1 space-y-0.5">
                    <p className="text-xs text-curtn-coral">
                      {imageFileCount} image
                      {imageFileCount === 1 ? "" : "s"} will be uploaded from ZIP
                      {" · "}
                      {imageEstimate.bytes < 1024 * 1024
                        ? `${(imageEstimate.bytes / 1024).toFixed(0)} KB`
                        : `${(imageEstimate.bytes / (1024 * 1024)).toFixed(1)} MB`}
                    </p>
                    <p className="text-[10px] text-curtn-muted/60">
                      Estimated storage cost: {imageEstimate.cost < 0.01
                        ? "< $0.01/mo (within free tier)"
                        : `~$${imageEstimate.cost.toFixed(2)}/mo`}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="tertiary"
                  onClick={() => handleImport(true)}
                  disabled={!!activity}
                >
                  Dry Run
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleImport(false)}
                  disabled={!!activity}
                >
                  Import
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
                    <span className="text-curtn-muted">Venues: </span>
                    <span className="text-curtn-cream">
                      {importResult.venuesCreated} new,{" "}
                      {importResult.venuesMatched} matched
                    </span>
                  </div>
                  <div>
                    <span className="text-curtn-muted">Companies: </span>
                    <span className="text-curtn-cream">
                      {importResult.companiesCreated} new,{" "}
                      {importResult.companiesMatched} matched
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
                  <div>
                    <span className="text-curtn-muted">Credits: </span>
                    <span className="text-curtn-cream">
                      {importResult.creditsCreated} new,{" "}
                      {importResult.personsCreated} new people,{" "}
                      {importResult.personsMatched} matched
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
                        .map(([, field]) => {
                          const value = row[field] || "";
                          const isZipImage =
                            IMAGE_FIELDS.has(field) && isImageFilename(value);
                          return (
                            <td
                              key={field}
                              className={`px-3 py-1.5 max-w-[200px] truncate ${isZipImage ? "text-curtn-coral" : "text-curtn-cream/80"}`}
                            >
                              {value || "\u2014"}
                            </td>
                          );
                        })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex gap-3">
            <Button
              variant="tertiary"
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

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Total Rows", value: importResult.totalRows },
                { label: "Shows Created", value: importResult.showsCreated },
                { label: "Shows Matched", value: importResult.showsMatched },
                { label: "Venues Created", value: importResult.venuesCreated },
                { label: "Venues Matched", value: importResult.venuesMatched },
                {
                  label: "Companies Created",
                  value: importResult.companiesCreated,
                },
                {
                  label: "Companies Matched",
                  value: importResult.companiesMatched,
                },
                { label: "Runs Created", value: importResult.runsCreated },
                { label: "Runs Matched", value: importResult.runsMatched },
                {
                  label: "Performances Created",
                  value: importResult.performancesCreated,
                },
                {
                  label: "Performances Matched",
                  value: importResult.performancesMatched,
                },
                { label: "Credits Created", value: importResult.creditsCreated },
                { label: "People Created", value: importResult.personsCreated },
                { label: "People Matched", value: importResult.personsMatched },
              ]
                .filter((item) => item.value > 0)
                .map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg bg-curtn-deep p-4 text-center"
                  >
                    <p className="text-2xl font-bold text-curtn-cream">
                      {item.value}
                    </p>
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
              Import Another File
            </Button>
            <Button
              variant="tertiary"
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
