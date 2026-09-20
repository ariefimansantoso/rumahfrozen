"use client";

import * as React from "react";
import { Camera, Loader2, ScanLine, TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type BarcodeDetectorResult = { rawValue?: string };
type BarcodeDetectorInstance = {
  detect: (source: HTMLVideoElement) => Promise<BarcodeDetectorResult[]>;
};
type BarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorInstance;

type BarcodeCameraDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (code: string, source: "camera") => void;
  isResolving?: boolean;
};

const BARCODE_FORMATS = [
  "aztec",
  "code_128",
  "code_39",
  "code_93",
  "codabar",
  "data_matrix",
  "ean_13",
  "ean_8",
  "itf",
  "pdf417",
  "qr_code",
  "upc_a",
  "upc_e",
];

function getBarcodeDetector() {
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor })
    .BarcodeDetector;
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function BarcodeCameraDialog({
  open,
  onOpenChange,
  onScan,
  isResolving,
}: BarcodeCameraDialogProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const lastScanRef = React.useRef<{ code: string; at: number } | null>(null);
  const [mode, setMode] = React.useState<"native" | "zxing" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const emitScan = React.useCallback(
    (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;

      const now = Date.now();
      const last = lastScanRef.current;
      if (last && last.code === trimmed && now - last.at < 900) return;

      lastScanRef.current = { code: trimmed, at: now };
      onScan(trimmed, "camera");
    },
    [onScan],
  );

  React.useEffect(() => {
    if (!open) return;

    let stopped = false;
    let stream: MediaStream | null = null;
    let frameId = 0;
    let zxingControls: { stop: () => void } | null = null;

    async function startNativeScanner(Detector: BarcodeDetectorConstructor) {
      const video = videoRef.current;
      if (!video) return;

      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();

      const detector = new Detector({ formats: BARCODE_FORMATS });
      setMode("native");

      const scanFrame = async () => {
        if (stopped || !videoRef.current) return;
        try {
          const results = await detector.detect(videoRef.current);
          const code = results.find((result) => result.rawValue)?.rawValue;
          if (code) emitScan(code);
        } catch {
          // Keep the camera loop alive; individual frames can fail on motion.
        }
        frameId = window.requestAnimationFrame(scanFrame);
      };

      frameId = window.requestAnimationFrame(scanFrame);
    }

    async function startZxingScanner() {
      const video = videoRef.current;
      if (!video) return;

      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      setMode("zxing");

      zxingControls = await reader.decodeFromVideoDevice(
        undefined,
        video,
        (result) => {
          const code = result?.getText();
          if (code) emitScan(code);
        },
      );
    }

    async function start() {
      setError(null);
      setMode(null);

      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera access is not available in this browser.");
        return;
      }

      try {
        const Detector = getBarcodeDetector();
        if (Detector) {
          await startNativeScanner(Detector);
        } else {
          await startZxingScanner();
        }
      } catch {
        if (stopped) return;
        stopStream(stream);
        stream = null;

        try {
          await startZxingScanner();
        } catch {
          if (!stopped) {
            setError("Unable to start the camera scanner.");
          }
        }
      }
    }

    void start();

    return () => {
      stopped = true;
      if (frameId) window.cancelAnimationFrame(frameId);
      zxingControls?.stop();
      stopStream(stream);
    };
  }, [emitScan, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5" />
            Camera scanner
          </DialogTitle>
          <DialogDescription>
            {mode === "native"
              ? "Using browser barcode detection."
              : mode === "zxing"
                ? "Using ZXing camera detection."
                : "Starting camera scanner..."}
          </DialogDescription>
        </DialogHeader>

        <div className="relative overflow-hidden rounded-md border bg-black aspect-[4/3]">
          <video
            ref={videoRef}
            muted
            playsInline
            className="h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="h-36 w-56 rounded-md border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.28)]" />
          </div>
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground">
            {isResolving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
            {isResolving ? "Resolving scan" : "Ready to scan"}
          </div>
        </div>

        {error ? (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <TriangleAlert className="h-4 w-4" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
