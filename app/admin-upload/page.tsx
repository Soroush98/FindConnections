"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { validateImageFile } from "@/helpers/fileValidation";
import { isValidFullName } from "@/helpers/nameValidation";

type TabId = "upload" | "ingest" | "delete-connection" | "delete-node";

type Status = "idle" | "loading" | "success" | "error";

interface FlashMessage {
  status: Exclude<Status, "idle" | "loading">;
  text: string;
}

interface IngestAttempt {
  url: string;
  source?: string;
  status: "accepted" | "skipped";
  reason?: string;
  detected?: string[];
}

interface IngestResult {
  added: boolean;
  existing?: string;
  imageUrl?: string;
  attempts: IngestAttempt[];
}

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "upload", label: "Upload", icon: "↑" },
  { id: "ingest", label: "Ingest Pipeline", icon: "⚙" },
  { id: "delete-connection", label: "Delete Connection", icon: "✕" },
  { id: "delete-node", label: "Delete Node", icon: "🗑" },
];

function classNames(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

function NameInput({
  id,
  label,
  value,
  onChange,
  placeholder = "Firstname Lastname",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Sanitize instead of rejecting: pasted text from the web often has
    // non-breaking spaces, tabs, or punctuation — strip those rather than
    // dropping the whole paste.
    const sanitized = e.target.value
      .replace(/[\s ]+/g, " ")
      .replace(/[^a-zA-Z ]/g, "");
    onChange(sanitized);
  };
  const valid = value.length === 0 || isValidFullName(value);
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-white/70 mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={classNames(
          "w-full px-3 py-2.5 rounded-lg bg-white/5 border text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:border-transparent transition",
          valid
            ? "border-white/15 focus:ring-purple-400"
            : "border-amber-400/60 focus:ring-amber-400"
        )}
      />
      {!valid && (
        <p className="text-xs text-amber-300 mt-1">Use the “Firstname Lastname” format.</p>
      )}
    </div>
  );
}

function FlashBanner({ flash }: { flash: FlashMessage | null }) {
  if (!flash) return null;
  const styles =
    flash.status === "success"
      ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-100"
      : "bg-red-500/15 border-red-400/30 text-red-100";
  return (
    <div className={`mt-4 rounded-lg border px-3 py-2 text-sm ${styles}`} role="status">
      {flash.text}
    </div>
  );
}

function StatusBadge({ status }: { status: IngestAttempt["status"] }) {
  return status === "accepted" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 text-[10px] font-semibold px-2 py-0.5 uppercase tracking-wide">
      ✓ Accepted
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/20 text-white/70 text-[10px] font-semibold px-2 py-0.5 uppercase tracking-wide">
      Skipped
    </span>
  );
}

export default function AdminUploadPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("upload");

  const getAdminLoginPath = () => {
    const first = window.location.pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
    return "/" + first.replace(/-upload$/, "");
  };

  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        setIsLoading(true);
        const res = await fetch("/api/admin/verify-session", { method: "GET" });
        if (!res.ok) {
          router.push(getAdminLoginPath());
          return;
        }
      } catch {
        router.push(getAdminLoginPath());
      } finally {
        setIsLoading(false);
      }
    };
    loadUserInfo();
  }, [router]);

  const handleLogout = async () => {
    const backToLogin = getAdminLoginPath();
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch (error) {
      console.error("Error logging out:", error);
    } finally {
      router.push(backToLogin);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900">
        <div className="flex items-center gap-3 text-white/80">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span className="text-sm font-medium">Verifying session…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-black/20 backdrop-blur-md border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white text-sm font-bold">
              FC
            </div>
            <div>
              <h1 className="text-white text-sm sm:text-base font-semibold leading-tight">Admin Console</h1>
              <p className="text-white/50 text-[10px] sm:text-xs leading-tight">Manage the connections graph</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/")}
              className="text-xs sm:text-sm px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15 text-white transition"
            >
              Home
            </button>
            <button
              onClick={handleLogout}
              className="text-xs sm:text-sm px-3 py-1.5 rounded-md bg-red-500/80 hover:bg-red-500 text-white transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 sm:gap-2 mb-6 overflow-x-auto pb-1 -mx-1 px-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={classNames(
                "shrink-0 inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium border transition",
                activeTab === t.id
                  ? "bg-white text-purple-900 border-white shadow-lg"
                  : "bg-white/5 text-white/80 border-white/10 hover:bg-white/10"
              )}
            >
              <span className="text-sm" aria-hidden>
                {t.icon}
              </span>
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === "upload" && <UploadPanel />}
        {activeTab === "ingest" && <IngestPanel />}
        {activeTab === "delete-connection" && <DeleteConnectionPanel />}
        {activeTab === "delete-node" && <DeleteNodePanel />}
      </main>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl">
      <div className="mb-5">
        <h2 className="text-white text-lg font-semibold">{title}</h2>
        {subtitle && <p className="text-white/60 text-sm mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

/* ─────────────────────────────────────────────── Upload ────── */

function UploadPanel() {
  const [firstPerson, setFirstPerson] = useState("");
  const [secondPerson, setSecondPerson] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [flash, setFlash] = useState<FlashMessage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    const validationResult = await validateImageFile(file);
    if (!validationResult.isValid) {
      setFlash({ status: "error", text: validationResult.message ?? "Invalid file." });
      return;
    }
    setSelectedFile(file);
    setFlash(null);
  };

  const handleUpload = async () => {
    setFlash(null);
    if (!selectedFile) {
      setFlash({ status: "error", text: "Please select a file to upload." });
      return;
    }
    if (!isValidFullName(firstPerson) || !isValidFullName(secondPerson)) {
      setFlash({ status: "error", text: "Both names must be in '{first} {last}' format." });
      return;
    }
    setStatus("loading");
    try {
      const formData = new FormData();
      formData.append("firstPersonFullName", firstPerson);
      formData.append("secondPersonFullName", secondPerson);
      formData.append("file", selectedFile);
      const res = await fetch("/api/admin/admin-upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setFlash({ status: "success", text: "Connection uploaded successfully." });
        setSelectedFile(null);
        setFirstPerson("");
        setSecondPerson("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        setStatus("success");
      } else {
        setFlash({ status: "error", text: data.message || "Upload failed. Please try again." });
        setStatus("error");
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      setFlash({ status: "error", text: "Upload failed. Please try again." });
      setStatus("error");
    }
  };

  return (
    <Card title="Upload Connection" subtitle="Add a new manually-verified connection with a photo.">
      <ul className="text-xs text-white/60 mb-5 space-y-1 list-disc list-inside">
        <li>PNG, JPG or JPEG only — up to 5 MB.</li>
        <li>Use canonical spelling. One spelling per person.</li>
      </ul>

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <NameInput id="upload-a" label="First Person" value={firstPerson} onChange={setFirstPerson} />
        <NameInput id="upload-b" label="Second Person" value={secondPerson} onChange={setSecondPerson} />
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files?.[0] ?? null);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={classNames(
          "cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition mb-5",
          dragOver
            ? "border-purple-300 bg-purple-500/10"
            : "border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png, image/jpeg, image/jpg"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          className="hidden"
        />
        {previewUrl ? (
          <div className="flex flex-col items-center gap-3">
            <Image
              src={previewUrl}
              alt="Selected preview"
              width={160}
              height={160}
              className="rounded-lg object-cover max-h-40 w-auto"
              unoptimized
            />
            <p className="text-sm text-white truncate max-w-full">{selectedFile?.name}</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="text-xs text-white/70 hover:text-white underline"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="text-white/70">
            <p className="text-sm font-medium">Click to upload, or drag and drop</p>
            <p className="text-xs text-white/50 mt-1">PNG, JPG up to 5MB</p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleUpload}
        disabled={status === "loading"}
        className="w-full bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 disabled:opacity-60 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2"
      >
        {status === "loading" && <Spinner />} Upload Connection
      </button>

      <FlashBanner flash={flash} />
    </Card>
  );
}

/* ─────────────────────────────────────────── Ingest Pair ───── */

function IngestPanel() {
  const [personA, setPersonA] = useState("");
  const [personB, setPersonB] = useState("");
  const [maxCandidates, setMaxCandidates] = useState(15);
  const [status, setStatus] = useState<Status>("idle");
  const [flash, setFlash] = useState<FlashMessage | null>(null);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Tick a "running" timer while loading so the user has a sense of progress.
  useEffect(() => {
    if (status !== "loading") return;
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    const id = setInterval(() => {
      if (startedAtRef.current) setElapsedMs(Date.now() - startedAtRef.current);
    }, 100);
    return () => clearInterval(id);
  }, [status]);

  // After result arrives, scroll log into view.
  useEffect(() => {
    if (result && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [result]);

  const sameName = useMemo(
    () => personA.trim().length > 0 && personA.trim().toLowerCase() === personB.trim().toLowerCase(),
    [personA, personB]
  );

  const canSubmit =
    status !== "loading" &&
    isValidFullName(personA) &&
    isValidFullName(personB) &&
    !sameName;

  const handleRun = async () => {
    setFlash(null);
    setResult(null);
    if (!canSubmit) {
      setFlash({ status: "error", text: "Provide two distinct names in '{first} {last}' format." });
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/admin/ingest-pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ personA, personB, maxCandidates }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFlash({ status: "error", text: data.message || `Request failed (${res.status}).` });
        setStatus("error");
        return;
      }
      const ingestResult = data as IngestResult;
      setResult(ingestResult);
      if (ingestResult.added) {
        setFlash({ status: "success", text: "New connection added to the graph." });
      } else if (ingestResult.existing) {
        setFlash({ status: "success", text: "Pair already connected — no changes made." });
      } else {
        setFlash({
          status: "error",
          text: `No matching image found across ${ingestResult.attempts.length} candidates.`,
        });
      }
      setStatus("success");
    } catch (error) {
      console.error("Ingest pipeline error:", error);
      setFlash({ status: "error", text: "Network error running the pipeline." });
      setStatus("error");
    }
  };

  const acceptedCount = result?.attempts.filter((a) => a.status === "accepted").length ?? 0;
  const skippedCount = result?.attempts.filter((a) => a.status === "skipped").length ?? 0;

  return (
    <Card
      title="Ingest Pipeline"
      subtitle="Search the web, run face recognition, and auto-create a verified connection."
    >
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <NameInput id="ingest-a" label="Person A" value={personA} onChange={setPersonA} />
        <NameInput id="ingest-b" label="Person B" value={personB} onChange={setPersonB} />
      </div>
      {sameName && (
        <p className="text-xs text-amber-300 -mt-2 mb-3">Person A and Person B must be different.</p>
      )}

      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="ingest-max" className="text-xs font-medium text-white/70 uppercase tracking-wide">
            Max candidates
          </label>
          <span className="text-xs font-mono text-white">{maxCandidates}</span>
        </div>
        <input
          id="ingest-max"
          type="range"
          min={1}
          max={30}
          value={maxCandidates}
          onChange={(e) => setMaxCandidates(Number(e.target.value))}
          className="w-full accent-purple-400"
        />
        <p className="text-[11px] text-white/50 mt-1">
          The pipeline stops at the first accepted image. Lower values are faster, higher values cast a wider net.
        </p>
      </div>

      <button
        type="button"
        onClick={handleRun}
        disabled={!canSubmit}
        className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2"
      >
        {status === "loading" ? (
          <>
            <Spinner /> Running pipeline… {(elapsedMs / 1000).toFixed(1)}s
          </>
        ) : (
          <>▶ Run ingest pipeline</>
        )}
      </button>

      <FlashBanner flash={flash} />

      {/* Log panel */}
      {(status === "loading" || result) && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-white">Pipeline log</h3>
            <div className="flex items-center gap-2 text-[11px]">
              {result && (
                <>
                  <span className="text-emerald-300">{acceptedCount} accepted</span>
                  <span className="text-white/40">·</span>
                  <span className="text-white/60">{skippedCount} skipped</span>
                  <span className="text-white/40">·</span>
                  <span className="text-white/60">{result.attempts.length} total</span>
                </>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/40 max-h-96 overflow-y-auto">
            {status === "loading" && !result && (
              <div className="flex items-center gap-2 text-sm text-white/70 px-4 py-6">
                <Spinner />
                <span>Querying images, downloading candidates, running Rekognition…</span>
              </div>
            )}

            {result && result.attempts.length === 0 && (
              <div className="px-4 py-6 text-sm text-white/60">
                {result.existing
                  ? "Pair was already connected — no candidates were processed."
                  : "No candidates returned for this query."}
              </div>
            )}

            {result && result.attempts.length > 0 && (
              <ol className="divide-y divide-white/5">
                {result.attempts.map((a, i) => (
                  <li key={`${a.url}-${i}`} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-mono text-white/40 w-6 shrink-0">
                          #{String(i + 1).padStart(2, "0")}
                        </span>
                        <StatusBadge status={a.status} />
                        {a.source && (
                          <span className="text-[11px] text-white/50 truncate max-w-[180px] sm:max-w-[280px]">
                            {a.source}
                          </span>
                        )}
                      </div>
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-[11px] text-purple-300 hover:text-purple-200 underline truncate max-w-full"
                      >
                        {a.url}
                      </a>
                    </div>
                    {(a.reason || (a.detected && a.detected.length > 0)) && (
                      <div className="mt-2 ml-8 text-xs space-y-1">
                        {a.reason && (
                          <p className="text-white/70">
                            <span className="text-white/40">reason:</span> {a.reason}
                          </p>
                        )}
                        {a.detected && a.detected.length > 0 && (
                          <p className="text-white/70">
                            <span className="text-white/40">detected:</span>{" "}
                            {a.detected.map((d, idx) => (
                              <span
                                key={`${d}-${idx}`}
                                className="inline-block mr-1 mb-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/80"
                              >
                                {d}
                              </span>
                            ))}
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
            <div ref={logEndRef} />
          </div>

          {result?.imageUrl && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3">
              <Image
                src={result.imageUrl}
                alt="Saved connection"
                width={64}
                height={64}
                className="rounded-md object-cover h-16 w-16"
                unoptimized
              />
              <div className="min-w-0">
                <p className="text-sm text-emerald-100 font-medium">Saved to graph</p>
                <a
                  href={result.imageUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-xs text-emerald-200/80 hover:text-emerald-100 underline truncate block"
                >
                  {result.imageUrl}
                </a>
              </div>
            </div>
          )}

          {result?.existing && !result.added && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
              <Image
                src={result.existing}
                alt="Existing connection"
                width={64}
                height={64}
                className="rounded-md object-cover h-16 w-16"
                unoptimized
              />
              <div className="min-w-0">
                <p className="text-sm text-white/80 font-medium">Existing connection</p>
                <a
                  href={result.existing}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-xs text-white/60 hover:text-white/90 underline truncate block"
                >
                  {result.existing}
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/* ─────────────────────────────────── Delete Connection ────── */

function DeleteConnectionPanel() {
  const [firstPerson, setFirstPerson] = useState("");
  const [secondPerson, setSecondPerson] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [flash, setFlash] = useState<FlashMessage | null>(null);
  const [confirming, setConfirming] = useState(false);

  const handleDelete = async () => {
    setFlash(null);
    if (!isValidFullName(firstPerson) || !isValidFullName(secondPerson)) {
      setFlash({ status: "error", text: "Both names must be in '{first} {last}' format." });
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/admin/delete-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          firstPersonFullName: firstPerson,
          secondPersonFullName: secondPerson,
        }),
      });
      if (res.ok) {
        setFlash({ status: "success", text: "Connection deleted successfully." });
        setFirstPerson("");
        setSecondPerson("");
        setStatus("success");
      } else {
        const data = await res.json().catch(() => ({}));
        setFlash({ status: "error", text: data.message || "Failed to delete connection." });
        setStatus("error");
      }
    } catch (error) {
      console.error("Error deleting connection:", error);
      setFlash({ status: "error", text: "Failed to delete connection. Please try again." });
      setStatus("error");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Card
      title="Delete Connection"
      subtitle="Remove a single edge between two people. The nodes remain in the graph."
    >
      <div className="grid sm:grid-cols-2 gap-4 mb-5">
        <NameInput id="delconn-a" label="First Person" value={firstPerson} onChange={setFirstPerson} />
        <NameInput id="delconn-b" label="Second Person" value={secondPerson} onChange={setSecondPerson} />
      </div>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="w-full bg-red-500/90 hover:bg-red-500 text-white py-2.5 rounded-lg font-medium transition"
        >
          Delete Connection
        </button>
      ) : (
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 space-y-3">
          <p className="text-sm text-red-100">
            Delete the edge between <strong>{firstPerson || "?"}</strong> and{" "}
            <strong>{secondPerson || "?"}</strong>? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg text-sm transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={status === "loading"}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
            >
              {status === "loading" && <Spinner />} Confirm delete
            </button>
          </div>
        </div>
      )}

      <FlashBanner flash={flash} />
    </Card>
  );
}

/* ────────────────────────────────────── Delete Node ────────── */

function DeleteNodePanel() {
  const [fullName, setFullName] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [flash, setFlash] = useState<FlashMessage | null>(null);
  const [confirming, setConfirming] = useState(false);

  const handleDeleteNode = async () => {
    setFlash(null);
    if (!isValidFullName(fullName)) {
      setFlash({ status: "error", text: "Name must be in '{first} {last}' format." });
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/admin/delete-node", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fullName }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const removed = data.deletedImages ?? 0;
        setFlash({
          status: "success",
          text: `Node deleted along with ${removed} associated image${removed === 1 ? "" : "s"}.`,
        });
        setFullName("");
        setStatus("success");
      } else {
        setFlash({ status: "error", text: data.message || "Failed to delete node." });
        setStatus("error");
      }
    } catch (error) {
      console.error("Error deleting node:", error);
      setFlash({ status: "error", text: "Failed to delete node. Please try again." });
      setStatus("error");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Card
      title="Delete Node"
      subtitle="Permanently remove a person and every connection (and image) they're part of."
    >
      <div className="mb-5">
        <NameInput id="delnode-name" label="Full Name" value={fullName} onChange={setFullName} />
      </div>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="w-full bg-red-500/90 hover:bg-red-500 text-white py-2.5 rounded-lg font-medium transition"
        >
          Delete Node
        </button>
      ) : (
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 space-y-3">
          <p className="text-sm text-red-100">
            This will delete <strong>{fullName || "?"}</strong> and every connection involving them.
            This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg text-sm transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteNode}
              disabled={status === "loading"}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
            >
              {status === "loading" && <Spinner />} Confirm delete
            </button>
          </div>
        </div>
      )}

      <FlashBanner flash={flash} />
    </Card>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
