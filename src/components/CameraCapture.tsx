import { useEffect, useRef, useState } from "react";

type CameraCaptureProps = {
  onCapture: (file: File) => void;
  onClose: () => void;
};

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError("");

    async function startCamera() {
      stream.current?.getTracks().forEach((track) => track.stop());
      try {
        const nextStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          nextStream.getTracks().forEach((track) => track.stop());
          return;
        }
        stream.current = nextStream;
        if (video.current) {
          video.current.srcObject = nextStream;
          await video.current.play();
          setReady(true);
        }
      } catch {
        if (!cancelled) setError("Kameran kunde inte öppnas. Kontrollera webbläsarens kamerabehörighet.");
      }
    }

    startCamera();
    return () => {
      cancelled = true;
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
    };
  }, [facingMode]);

  const takePhoto = () => {
    const element = video.current;
    if (!element || !element.videoWidth || !element.videoHeight) return;
    const canvas = document.createElement("canvas");
    canvas.width = element.videoWidth;
    canvas.height = element.videoHeight;
    const context = canvas.getContext("2d")!;
    if (facingMode === "user") {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }
    context.drawImage(element, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], `shift-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.94,
    );
  };

  return (
    <div className="capture-modal" role="dialog" aria-modal="true" aria-label="Ta en bild">
      <div className="capture-topbar">
        <div>
          <span className="eyebrow">KAMERA</span>
          <p>Placera motivet innanför ramen</p>
        </div>
        <button className="icon-button light" type="button" onClick={onClose} aria-label="Stäng kameran">
          <CloseIcon />
        </button>
      </div>

      <div className="capture-view">
        <video ref={video} muted playsInline className={facingMode === "user" ? "mirrored" : ""} />
        <div className="camera-grid" aria-hidden="true"><i /><i /><i /><i /></div>
        {!ready && !error && <div className="camera-message"><span className="spinner" />Startar kameran…</div>}
        {error && <div className="camera-message error-message">{error}</div>}
      </div>

      <div className="capture-controls">
        <button
          className="camera-secondary"
          type="button"
          onClick={() => setFacingMode((mode) => (mode === "user" ? "environment" : "user"))}
          aria-label="Vänd kameran"
        >
          <FlipIcon />
        </button>
        <button className="shutter" type="button" onClick={takePhoto} disabled={!ready} aria-label="Ta foto">
          <span />
        </button>
        <div className="camera-secondary placeholder" aria-hidden="true" />
      </div>
    </div>
  );
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 5 14 14M19 5 5 19" /></svg>;
}

function FlipIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 8a8 8 0 0 0-14.4-2.8L3 8m0 0V3m0 5h5M4 16a8 8 0 0 0 14.4 2.8L21 16m0 0v5m0-5h-5" /></svg>;
}
