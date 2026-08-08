import "dotenv/config";
import express from "express";
import multer from "multer";
import OpenAI, { toFile } from "openai";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number(process.env.PORT || 8787);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    callback(null, /^image\/(png|jpe?g|webp|heic|heif)$/i.test(file.mimetype));
  },
});

const DEPTH_PROMPT = `Create a strict grayscale relative depth map for the attached photograph.
Preserve the exact framing, crop, perspective, silhouettes, object positions, and occlusion edges of the input. The result must align pixel-for-pixel with the input composition.
Encode closest visible surfaces as pure white and the farthest visible surfaces as pure black, with smooth monotonic gray gradients between them. Use crisp depth discontinuities at object boundaries and smooth gradients across curved surfaces.
Output only the depth map: grayscale, texture-free, no color, no lighting, no shadows, no reflections, no outlines, no text, and no labels. Do not add, remove, move, resize, restyle, or crop anything.`;

function isValidSize(value) {
  if (!/^\d{3,4}x\d{3,4}$/.test(value)) return false;
  const [width, height] = value.split("x").map(Number);
  const long = Math.max(width, height);
  const short = Math.min(width, height);
  const pixels = width * height;
  return (
    width % 16 === 0 &&
    height % 16 === 0 &&
    long <= 3840 &&
    long / short <= 3 &&
    pixels >= 655_360 &&
    pixels <= 8_294_400
  );
}

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
    model: "gpt-image-2",
  });
});

app.post("/api/depth", upload.single("image"), async (request, response) => {
  if (!process.env.OPENAI_API_KEY) {
    return response.status(503).json({ error: "OPENAI_API_KEY saknas på servern." });
  }

  if (!request.file) {
    return response.status(400).json({ error: "Välj en PNG-, JPEG-, WebP- eller HEIC-bild." });
  }

  const requestedSize = String(request.body.size || "1024x1024");
  const size = isValidSize(requestedSize) ? requestedSize : "1024x1024";
  const quality = ["low", "medium", "high"].includes(request.body.quality)
    ? request.body.quality
    : "medium";

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const image = await toFile(request.file.buffer, request.file.originalname || "photo.jpg", {
      type: request.file.mimetype,
    });

    const result = await openai.images.edit({
      model: "gpt-image-2",
      image,
      prompt: DEPTH_PROMPT,
      size,
      quality,
    });

    const base64 = result.data?.[0]?.b64_json;
    if (!base64) throw new Error("OpenAI returnerade ingen bilddata.");

    return response.json({
      depth: `data:image/png;base64,${base64}`,
      model: "gpt-image-2",
      size,
      quality,
    });
  } catch (error) {
    const status = Number(error?.status || 500);
    const upstream = error?.error?.message || error?.message;
    console.error("Depth generation failed:", status, upstream);

    const friendly =
      status === 401
        ? "OpenAI API-nyckeln är ogiltig eller saknar behörighet."
        : status === 403
          ? "Projektet saknar åtkomst till GPT Image 2. Kontrollera organisationsverifieringen."
          : status === 429
            ? "Gränsen för GPT Image 2 är nådd. Vänta en stund och försök igen."
            : upstream || "Djupmasken kunde inte skapas.";

    return response.status(status >= 400 && status < 600 ? status : 500).json({ error: friendly });
  }
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(root, "dist")));
  app.get("/{*path}", (_request, response) => response.sendFile(path.join(root, "dist", "index.html")));
}

app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return response.status(413).json({ error: "Bilden är större än 15 MB." });
  }
  console.error(error);
  return response.status(400).json({ error: "Bilden kunde inte läsas." });
});

app.listen(port, () => {
  console.log(`Shift / Depth API listening on http://localhost:${port}`);
});
