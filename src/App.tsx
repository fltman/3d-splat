import { useEffect, useRef, useState } from "react";
import { CameraCapture } from "./components/CameraCapture";
import { DepthScene } from "./components/DepthScene";
import { useHeadTracking } from "./hooks/useHeadTracking";
import { createDemoPair } from "./lib/demo";
import type { PhotoSource } from "./types";

type Phase = "empty" | "review" | "processing" | "scene";
type Quality = "low" | "medium";

export function App() {
  const [phase, setPhase] = useState<Phase>("empty");
  const [source, setSource] = useState<PhotoSource | null>(null);
  const [depthUrl, setDepthUrl] = useState("");
  const [quality, setQuality] = useState<Quality>("medium");
  const [strength, setStrength] = useState(0.42);
  const [showDepth, setShowDepth] = useState(false);
  const [trackingEnabled, setTrackingEnabled] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [processStep, setProcessStep] = useState(0);
  const [showAbout, setShowAbout] = useState(false);
  const [apiReady, setApiReady] = useState<boolean | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const stage = useRef<HTMLElement>(null);
  const { position: headPosition, status: trackingStatus } = useHeadTracking(
    phase === "scene" && trackingEnabled,
  );

  useEffect(() => {
    fetch("/api/health")
      .then((response) => response.json())
      .then((data) => setApiReady(Boolean(data.apiKeyConfigured)))
      .catch(() => setApiReady(false));
  }, []);

  useEffect(() => {
    if (phase !== "processing") return;
    setProcessStep(0);
    const one = window.setTimeout(() => setProcessStep(1), 1800);
    const two = window.setTimeout(() => setProcessStep(2), 5000);
    const three = window.setTimeout(() => setProcessStep(3), 9500);
    return () => [one, two, three].forEach(window.clearTimeout);
  }, [phase]);

  const chooseFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Välj en bildfil.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("Bilden är större än 15 MB.");
      return;
    }

    setError("");
    setDepthUrl("");
    try {
      const url = URL.createObjectURL(file);
      const dimensions = await readImageDimensions(url);
      if (source?.url.startsWith("blob:")) URL.revokeObjectURL(source.url);
      setSource({ file, url, width: dimensions.width, height: dimensions.height, name: file.name });
      setPhase("review");
    } catch {
      setError("Bilden kunde inte förhandsvisas. Prova JPEG, PNG eller WebP.");
    }
  };

  const generateDepth = async () => {
    if (!source?.file) return;
    setError("");
    setPhase("processing");
    const body = new FormData();
    body.append("image", source.file);
    body.append("quality", quality);
    body.append("size", computeDepthSize(source.width, source.height));

    try {
      const response = await fetch("/api/depth", { method: "POST", body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Djupmasken kunde inte skapas.");
      setDepthUrl(result.depth);
      setPhase("scene");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Djupmasken kunde inte skapas.");
      setPhase("review");
    }
  };

  const openDemo = () => {
    const demo = createDemoPair();
    if (source?.url.startsWith("blob:")) URL.revokeObjectURL(source.url);
    setSource({
      file: null,
      url: demo.photo,
      width: demo.width,
      height: demo.height,
      name: "Exempelscen",
    });
    setDepthUrl(demo.depth);
    setError("");
    setPhase("scene");
  };

  const startOver = () => {
    if (source?.url.startsWith("blob:")) URL.revokeObjectURL(source.url);
    setSource(null);
    setDepthUrl("");
    setError("");
    setShowDepth(false);
    setPhase("empty");
  };

  const fullscreen = async () => {
    try {
      if (!document.fullscreenElement) await stage.current?.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      // Fullscreen is a progressive enhancement (not available in every embedded browser).
    }
  };

  const downloadDepth = () => {
    if (!depthUrl) return;
    const anchor = document.createElement("a");
    anchor.href = depthUrl;
    anchor.download = "shift-depth-map.png";
    anchor.click();
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="wordmark" type="button" onClick={startOver} aria-label="Shift / Depth startsida">
          <span className="mark"><i /><i /><i /></span>
          <span>SHIFT<span className="slash">/</span>DEPTH</span>
          <em>LAB 01</em>
        </button>
        <div className="header-actions">
          <span className={`api-status ${apiReady === false ? "warning" : ""}`}>
            <i />{apiReady === null ? "KOLLAR API" : apiReady ? "GPT IMAGE 2 REDO" : "API-NYCKEL SAKNAS"}
          </span>
          <button className="text-button" type="button" onClick={() => setShowAbout(true)}>SÅ FUNGERAR DET</button>
        </div>
      </header>

      <main
        className={`main-stage phase-${phase}`}
        ref={stage}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          chooseFile(event.dataTransfer.files[0]);
        }}
      >
        {phase === "empty" && (
          <section className="landing">
            <div className="ambient-grid" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
            <div className="hero-copy">
              <span className="eyebrow"><i /> ETT FOTO. ETT FÖNSTER.</span>
              <h1>Kliva in i<br /><span>dina bilder.</span></h1>
              <p>
                Vi låter GPT Image 2 tolka djupet i ditt foto och bygger en scen som svarar på hur du rör dig framför skärmen.
              </p>
              <div className="hero-actions">
                <button className="primary-button" type="button" onClick={() => fileInput.current?.click()}>
                  <UploadIcon /> LADDA UPP FOTO <ArrowIcon />
                </button>
                <button className="secondary-button" type="button" onClick={() => setCameraOpen(true)}>
                  <CameraIcon /> TA EN BILD
                </button>
              </div>
              <button className="demo-link" type="button" onClick={openDemo}>
                eller utforska exempelscenen <ArrowIcon />
              </button>
            </div>

            <div className="hero-object" aria-hidden="true">
              <div className="window-frame">
                <div className="window-sky" />
                <div className="layer mountains back" />
                <div className="layer mountains front" />
                <div className="layer orb" />
                <div className="layer ledge" />
                <div className="depth-lines"><i /><i /><i /><i /></div>
              </div>
              <span className="axis-label x">X — PARALLAX</span>
              <span className="axis-label z">Z — DEPTH</span>
            </div>

            <div className="landing-footer">
              <span>01 — FOTO</span><i /><span>02 — DJUPMASK</span><i /><span>03 — LIVE PARALLAX</span>
            </div>
          </section>
        )}

        {(phase === "review" || phase === "processing") && source && (
          <section className="review-layout">
            <div className="preview-panel">
              <img src={source.url} alt="Valt foto" />
              <div className="preview-meta">
                <span>{source.name}</span>
                <span>{source.width} × {source.height} PX</span>
              </div>
              {phase === "processing" && <div className="scan-line" />}
            </div>

            <aside className="setup-panel">
              {phase === "review" ? (
                <>
                  <div>
                    <span className="eyebrow">01 / FÖRBERED</span>
                    <h2>Skapa djup<br />från bilden.</h2>
                    <p>GPT Image 2 bygger en monokrom djupmask där vitt är nära och svart är långt bort.</p>
                  </div>

                  <div className="quality-picker">
                    <span className="field-label">MASKKVALITET</span>
                    <div className="segmented">
                      <button type="button" className={quality === "low" ? "active" : ""} onClick={() => setQuality("low")}>
                        SNABB <small>~10–20 s</small>
                      </button>
                      <button type="button" className={quality === "medium" ? "active" : ""} onClick={() => setQuality("medium")}>
                        DETALJ <small>~20–45 s</small>
                      </button>
                    </div>
                  </div>

                  {error && <div className="inline-error"><AlertIcon /> <span>{error}</span></div>}

                  <div className="setup-actions">
                    <button className="primary-button wide" type="button" onClick={generateDepth} disabled={!apiReady}>
                      GENERERA DJUPMASK <SparkIcon />
                    </button>
                    {!apiReady && <p className="key-hint">Lägg `OPENAI_API_KEY` i servermiljön och starta om.</p>}
                    <button className="text-link" type="button" onClick={() => fileInput.current?.click()}>Välj en annan bild</button>
                  </div>
                </>
              ) : (
                <div className="processing-card">
                  <span className="eyebrow">02 / ANALYSERAR</span>
                  <h2>Vi läser<br />rummet.</h2>
                  <div className="processing-orb"><span /><i /><i /></div>
                  <ol>
                    {[
                      "Läser scenens geometri",
                      "Separerar djupplan",
                      "Förfinar kanter",
                      "Renderar djupmask",
                    ].map((label, index) => (
                      <li key={label} className={index < processStep ? "done" : index === processStep ? "active" : ""}>
                        <span>{index < processStep ? "✓" : `0${index + 1}`}</span>{label}
                      </li>
                    ))}
                  </ol>
                  <p className="processing-note">Du kan lämna fliken öppen. Bilden skickas direkt till OpenAI och lagras inte av den här appen.</p>
                </div>
              )}
            </aside>
          </section>
        )}

        {phase === "scene" && source && depthUrl && (
          <section className="scene-layout">
            <DepthScene
              imageUrl={source.url}
              depthUrl={depthUrl}
              width={source.width}
              height={source.height}
              strength={strength}
              showDepth={showDepth}
              trackingEnabled={trackingEnabled}
              headPosition={headPosition}
            />

            <div className="scene-topbar">
              <button className="glass-button" type="button" onClick={startOver}><BackIcon /> NY BILD</button>
              <div className={`tracking-pill state-${trackingStatus}`}>
                <span className="tracking-dot"><i /></span>
                <div>
                  <small>HUVUDSPÅRNING</small>
                  <strong>{trackingLabel(trackingEnabled, trackingStatus)}</strong>
                </div>
                <button
                  type="button"
                  className={`switch ${trackingEnabled ? "on" : ""}`}
                  onClick={() => setTrackingEnabled((value) => !value)}
                  aria-label="Slå av eller på huvudspårning"
                ><i /></button>
              </div>
              <button className="glass-button square" type="button" onClick={fullscreen} aria-label="Helskärm"><FullscreenIcon /></button>
            </div>

            <div className="scene-hint">
              <MoveIcon />
              <span>{trackingStatus === "active" ? "RÖR HUVUDET FÖR ATT SE RUNT MOTIVET" : "RÖR PEKAREN FÖR ATT SE RUNT MOTIVET"}</span>
            </div>

            <div className="scene-controls">
              <label>
                <span><DepthIcon /> DJUPEFFEKT <output>{Math.round(strength * 100)}</output></span>
                <input
                  type="range"
                  min="0.08"
                  max="0.85"
                  step="0.01"
                  value={strength}
                  onChange={(event) => setStrength(Number(event.target.value))}
                />
              </label>
              <span className="control-divider" />
              <button type="button" className={showDepth ? "active" : ""} onClick={() => setShowDepth((value) => !value)}>
                <MaskIcon /> {showDepth ? "VISA FOTO" : "VISA MASK"}
              </button>
              <button type="button" onClick={downloadDepth}><DownloadIcon /> LADDA NER</button>
            </div>

            <div className="model-badge">DEPTH BY <strong>GPT IMAGE 2</strong></div>
          </section>
        )}

        {dragging && (
          <div className="drop-overlay"><UploadIcon /><strong>SLÄPP BILDEN HÄR</strong><span>JPEG, PNG eller WebP · max 15 MB</span></div>
        )}
      </main>

      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        hidden
        onChange={(event) => chooseFile(event.target.files?.[0])}
      />

      {cameraOpen && <CameraCapture onClose={() => setCameraOpen(false)} onCapture={(file) => { setCameraOpen(false); chooseFile(file); }} />}

      {showAbout && (
        <div className="about-backdrop" role="dialog" aria-modal="true" aria-labelledby="about-title" onMouseDown={() => setShowAbout(false)}>
          <div className="about-panel" onMouseDown={(event) => event.stopPropagation()}>
            <button className="icon-button" type="button" onClick={() => setShowAbout(false)} aria-label="Stäng"><CloseIcon /></button>
            <span className="eyebrow">BAKOM EFFEKTEN</span>
            <h2 id="about-title">Ett digitalt<br />tittskåp.</h2>
            <div className="about-steps">
              <article><span>01</span><h3>DJUP</h3><p>GPT Image 2 omvandlar fotot till en relativ djupmask med samma bildutsnitt.</p></article>
              <article><span>02</span><h3>GEOMETRI</h3><p>Maskens luminans förskjuter ett finmaskigt 3D-plan i WebGL.</p></article>
              <article><span>03</span><h3>BLICK</h3><p>MediaPipe mäter huvudets position och kameran renderar scenen ur rätt vinkel.</p></article>
            </div>
            <p className="about-footnote">Om huvudspårning inte är tillgänglig används pekare eller touch automatiskt.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function computeDepthSize(width: number, height: number) {
  const aspect = Math.max(0.5, Math.min(2, width / height));
  if (aspect >= 1) {
    const outputWidth = 1280;
    const outputHeight = Math.max(512, Math.round(outputWidth / aspect / 16) * 16);
    return `${outputWidth}x${outputHeight}`;
  }
  const outputHeight = 1280;
  const outputWidth = Math.max(512, Math.round(outputHeight * aspect / 16) * 16);
  return `${outputWidth}x${outputHeight}`;
}

function readImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = reject;
    image.src = url;
  });
}

function trackingLabel(enabled: boolean, status: string) {
  if (!enabled) return "Av — pekare aktiv";
  if (status === "loading") return "Startar kamera…";
  if (status === "active") return "Ansikte hittat";
  if (status === "fallback") return "Söker ansikte…";
  if (status === "error") return "Pekare aktiv";
  return "Av";
}

type IconProps = { className?: string };
function Icon({ children, className = "" }: IconProps & { children: React.ReactNode }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">{children}</svg>;
}
function UploadIcon() { return <Icon><path d="M12 16V4m0 0L7 9m5-5 5 5M5 14v5h14v-5" /></Icon>; }
function CameraIcon() { return <Icon><path d="M4 7h3l1.4-2h7.2L17 7h3v12H4V7Z" /><circle cx="12" cy="13" r="3.5" /></Icon>; }
function ArrowIcon() { return <Icon><path d="M5 12h14m-5-5 5 5-5 5" /></Icon>; }
function SparkIcon() { return <Icon><path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Zm6 14 .7 2.3L21 19l-2.3.7L18 22l-.7-2.3L15 19l2.3-.7L18 16Z" /></Icon>; }
function AlertIcon() { return <Icon><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v5m0 3h.01" /></Icon>; }
function BackIcon() { return <Icon><path d="m14.5 5-7 7 7 7" /></Icon>; }
function FullscreenIcon() { return <Icon><path d="M9 4H4v5m11-5h5v5M9 20H4v-5m11 5h5v-5" /></Icon>; }
function MoveIcon() { return <Icon><path d="M12 3v18m0-18-3 3m3-3 3 3m-3 15-3-3m3 3 3-3M3 12h18M3 12l3-3m-3 3 3 3m15-3-3-3m3 3-3 3" /></Icon>; }
function DepthIcon() { return <Icon><path d="m4 8 8-4 8 4-8 4-8-4Zm0 4 8 4 8-4M4 16l8 4 8-4" /></Icon>; }
function MaskIcon() { return <Icon><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 4v16m8-16v16" /></Icon>; }
function DownloadIcon() { return <Icon><path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14" /></Icon>; }
function CloseIcon() { return <Icon><path d="m5 5 14 14M19 5 5 19" /></Icon>; }
