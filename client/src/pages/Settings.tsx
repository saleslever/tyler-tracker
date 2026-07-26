import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Download, RotateCcw, AlertTriangle } from "lucide-react";

/**
 * Settings page.
 *
 * MVP scope:
 *   - Download JSON backup of all data (calls GET /api/export)
 *   - Nuke everything (calls POST /api/reset). Confirms twice.
 *
 * Future: JSON restore, per-table export, sound toggles, theme picker, etc.
 */
export default function SettingsPage() {
  const [downloading, setDownloading] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState<0 | 1 | 2>(0);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function downloadBackup() {
    setDownloading(true);
    setMessage(null);
    try {
      // Determine API base the same way apiRequest does — read from queryClient default fetcher isn't exposed,
      // so just use fetch relative to current origin. deploy_website rewrites /api/... through the proxy.
      const res = await fetch("/api/export", { credentials: "include" });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tyler-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMessage({ kind: "ok", text: "Backup downloaded." });
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
    } finally {
      setDownloading(false);
    }
  }

  async function doReset() {
    setResetting(true);
    setMessage(null);
    try {
      await apiRequest("POST", "/api/reset", {});
      // Invalidate all cached queries
      queryClient.invalidateQueries();
      setConfirmingReset(0);
      setMessage({ kind: "ok", text: "Everything has been reset." });
    } catch (e) {
      setMessage({ kind: "err", text: (e as Error).message });
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="max-w-[900px] mx-auto px-6 md:px-10 py-6 md:py-8">
      <PageHeader title="Settings" subtitle="Backup, restore, and app data" />

      {message && (
        <div
          className={`mb-6 p-3 rounded-md text-sm ${
            message.kind === "ok"
              ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border border-red-500/40 bg-red-500/10 text-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <section className="card-plain p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-md bg-secondary/40 border border-border flex items-center justify-center shrink-0">
            <Download className="w-5 h-5 text-foreground/80" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="serif text-base">Download backup</div>
            <div className="text-xs text-muted-foreground mt-1">
              Exports every log, habit, quest, challenge, and journal entry as a single JSON file.
              Keep this somewhere safe.
            </div>
            <div className="mt-4">
              <Button onClick={downloadBackup} disabled={downloading} className="gap-2" data-testid="button-download-backup">
                <Download className="w-4 h-4" />
                {downloading ? "Preparing…" : "Download JSON backup"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="card-plain p-6 mb-6 border border-red-500/30">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-md bg-red-500/10 border border-red-500/40 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="serif text-base text-red-200">Reset everything</div>
            <div className="text-xs text-muted-foreground mt-1">
              Deletes all logs, challenges, quests, and history and re-seeds the built-in habits.
              This cannot be undone. Download a backup first.
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {confirmingReset === 0 && (
                <Button
                  variant="outline"
                  onClick={() => setConfirmingReset(1)}
                  className="border-red-500/50 text-red-300 hover:bg-red-500/10 gap-2"
                  data-testid="button-reset-1"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset everything…
                </Button>
              )}
              {confirmingReset === 1 && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmingReset(2)}
                    className="border-red-500/60 bg-red-500/10 text-red-200"
                    data-testid="button-reset-2"
                  >
                    Really reset — I understand
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmingReset(0)}>Cancel</Button>
                </>
              )}
              {confirmingReset === 2 && (
                <>
                  <Button
                    onClick={doReset}
                    disabled={resetting}
                    className="bg-red-600 hover:bg-red-500 text-white gap-2"
                    data-testid="button-reset-confirm"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {resetting ? "Wiping…" : "Wipe all data now"}
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmingReset(0)}>Cancel</Button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="card-plain p-6">
        <div className="serif text-sm mb-2">About</div>
        <div className="text-xs text-muted-foreground">
          Tyler's Daily Discipline · Built for the long game. All data is stored on your own Railway database
          and never leaves it.
        </div>
      </section>
    </div>
  );
}
