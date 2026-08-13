import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload as UploadIcon, Sparkles, Check, Trash2, Image as ImageIcon } from "lucide-react";

interface Upload {
  id: number;
  imageUrl: string;
  kind: string;
  aiExtracted: any;
  status: string;
  notes?: string | null;
  createdAt: string;
}

const KIND_OPTIONS = [
  { value: "macros", label: "MacroFactor / Macros" },
  { value: "scan", label: "Body Scan" },
  { value: "whoop", label: "Whoop" },
  { value: "weight", label: "Weight Only" },
  { value: "workout", label: "Workout Log" },
];

export function Uploads() {
  const qc = useQueryClient();
  const [kind, setKind] = useState("macros");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadsQuery = useQuery<Upload[]>({
    queryKey: ["/api/fitness/uploads/pending"],
    refetchInterval: 15000,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { imageUrl: string; kind: string; notes: string }) => {
      const res = await apiRequest("POST", "/api/fitness/uploads", payload);
      return res.json();
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["/api/fitness/uploads/pending"] });
      // auto-extract
      extractMutation.mutate(row.id);
      setPreviewUrl(null);
      setNotes("");
      if (fileRef.current) fileRef.current.value = "";
    },
  });

  const extractMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/fitness/uploads/${id}/extract`, {});
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/fitness/uploads/pending"] }),
  });

  const discardMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/fitness/uploads/${id}/discard`, {});
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/fitness/uploads/pending"] }),
  });

  const confirmMutation = useMutation({
    mutationFn: async ({ upload }: { upload: Upload }) => {
      // Save the extracted data into the appropriate target table
      const data = upload.aiExtracted ?? {};
      if (upload.kind === "macros") {
        await apiRequest("POST", "/api/fitness/macros", {
          date: new Date().toISOString().slice(0, 10),
          calories: data.calories ?? null,
          proteinG: data.proteinG ?? null,
          fatG: data.fatG ?? null,
          carbsG: data.carbsG ?? null,
          netCarbsG: data.netCarbsG ?? null,
          source: "screenshot",
          notes: data.notes ?? null,
        });
      } else if (upload.kind === "scan") {
        await apiRequest("POST", "/api/fitness/scans", {
          date: new Date().toISOString().slice(0, 10),
          weight: data.weight ?? null,
          weightUnit: data.weightUnit ?? "lb",
          bodyFatPct: data.bodyFatPct ?? null,
          muscleMass: data.muscleMass ?? null,
          dailyCalorieTarget: data.dailyCalorieTarget ?? null,
          source: data.source ?? "screenshot",
          notes: data.notes ?? null,
        });
        // If the scan has a dailyCalorieTarget, also update the nutrition target
        if (data.dailyCalorieTarget) {
          await apiRequest("POST", "/api/fitness/target", {
            effectiveFrom: new Date().toISOString().slice(0, 10),
            calories: data.dailyCalorieTarget,
            source: "body_scan",
          });
        }
      } else if (upload.kind === "whoop") {
        await apiRequest("POST", "/api/fitness/recovery", {
          date: new Date().toISOString().slice(0, 10),
          sleepHours: data.sleepHours ?? null,
          whoopRecoveryPct: data.whoopRecoveryPct ?? null,
          hrvMs: data.hrvMs ?? null,
          restingHr: data.restingHr ?? null,
          strain: data.strain ?? null,
          source: "screenshot",
        });
      }
      await apiRequest("POST", `/api/fitness/uploads/${upload.id}/confirm`, {
        relatedTable: upload.kind,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/fitness/uploads/pending"] });
      qc.invalidateQueries({ queryKey: ["/api/coach/context"] });
    },
  });

  const handleFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreviewUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    if (!previewUrl) return;
    createMutation.mutate({ imageUrl: previewUrl, kind, notes });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6" data-testid="page-uploads">
      <header>
        <div className="serif gold mb-1">Screenshot Intake</div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Uploads</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Drop a screenshot, let the coach extract, review the JSON, save it. Nothing goes into your log without your confirmation.
        </p>
      </header>

      {/* Uploader */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New Upload</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground block mb-1.5">Kind</label>
            <div className="flex gap-2 flex-wrap">
              {KIND_OPTIONS.map(k => (
                <button
                  key={k.value}
                  onClick={() => setKind(k.value)}
                  className={`text-sm px-3 py-1.5 rounded-md border ${
                    kind === k.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                  data-testid={`btn-kind-${k.value}`}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground block mb-1.5">Screenshot</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border file:border-border file:bg-background file:text-foreground file:hover:bg-secondary"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
              data-testid="input-file"
            />
          </div>

          {previewUrl && (
            <div className="border border-border rounded-md p-3 space-y-2">
              <img src={previewUrl} alt="preview" className="max-h-64 rounded-md" />
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground block mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Sunday cheat day, ignore protein"
                  className="w-full text-sm px-3 py-2 rounded-md border border-border bg-background"
                  data-testid="input-notes"
                />
              </div>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending}
                data-testid="btn-upload"
              >
                {createMutation.isPending ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Uploading & Extracting…</> : <><Sparkles className="w-4 h-4 mr-1" /> Upload & Extract</>}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending list */}
      <div>
        <h2 className="font-display text-xl font-bold mb-3">Pending Review</h2>
        {uploadsQuery.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {uploadsQuery.data && uploadsQuery.data.length === 0 && (
          <div className="text-sm text-muted-foreground border border-dashed border-border rounded-md p-6 text-center">
            <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
            Nothing pending. Upload a screenshot to get started.
          </div>
        )}
        <div className="grid md:grid-cols-2 gap-4">
          {(uploadsQuery.data ?? []).map(row => (
            <Card key={row.id} data-testid={`card-upload-${row.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge>{row.kind}</Badge>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    #{row.id}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <img src={row.imageUrl} alt="screenshot" className="max-h-40 rounded-md border border-border" />
                {row.aiExtracted ? (
                  <div className="text-xs border border-primary/30 bg-primary/5 rounded-md p-2 font-mono whitespace-pre-wrap break-words">
                    {JSON.stringify(row.aiExtracted, null, 2)}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground italic">
                    No extraction yet. Click Extract.
                  </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  {!row.aiExtracted && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => extractMutation.mutate(row.id)}
                      disabled={extractMutation.isPending}
                      data-testid={`btn-extract-${row.id}`}
                    >
                      {extractMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                      Extract
                    </Button>
                  )}
                  {row.aiExtracted && !row.aiExtracted.error && (
                    <Button
                      size="sm"
                      onClick={() => confirmMutation.mutate({ upload: row })}
                      disabled={confirmMutation.isPending}
                      data-testid={`btn-confirm-${row.id}`}
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Save to log
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => discardMutation.mutate(row.id)}
                    disabled={discardMutation.isPending}
                    data-testid={`btn-discard-${row.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Discard
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Uploads;
