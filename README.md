# Shift / Depth

En webbprototyp som omvandlar ett foto till ett interaktivt 2.5D-fönster:

1. Användaren laddar upp ett foto eller tar en bild med kameran.
2. Servern skickar bilden till OpenAI Image Edits med `gpt-image-2` och ber om en linjerad djupmask.
3. Djupmasken förskjuter ett finmaskigt WebGL-plan.
4. MediaPipe följer huvudets position och flyttar den virtuella kameran. Pekare/touch används automatiskt som fallback.

## Kör lokalt

Kräver Node.js 20+ och ett OpenAI-projekt med åtkomst till GPT Image 2.

```bash
npm install
cp .env.example .env
# Lägg din riktiga OPENAI_API_KEY i .env
npm run dev
```

Öppna sedan adressen som Vite visar, normalt `http://localhost:5173`.

## Produktion

```bash
npm run build
npm start
```

Servern levererar då både API:t och den byggda klienten på port `8787` (eller `PORT`).

## Säkerhet och integritet

- API-nyckeln används endast på Node-servern och skickas aldrig till webbläsaren.
- `.env` är git-ignorerad.
- Bilder hålls i minnet under anropet och skrivs inte till projektets filsystem.
- Den externa MediaPipe-modellen hämtas från Googles officiella modellstorage när huvudspårning startas.

## Viktiga filer

- `server/index.js` – uppladdning och GPT Image 2-anrop.
- `src/components/DepthScene.tsx` – WebGL-mesh och off-axis-kamera.
- `src/hooks/useHeadTracking.ts` – MediaPipe Face Landmarker.
- `src/components/CameraCapture.tsx` – mobil/desktop-kamera.
- `src/App.tsx` – hela produktflödet.
