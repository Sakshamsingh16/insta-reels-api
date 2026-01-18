const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

// ---------- helpers ----------
function cleanUrl(u) {
  if (!u) return "";
  return String(u).trim();
}

function normalizeInstagramUrl(url) {
  url = cleanUrl(url);

  // If user pasted shortcode
  if (!url.startsWith("http")) {
    const code = url.split("?")[0].replace(/\//g, "").trim();
    if (code) return `https://www.instagram.com/reel/${code}/`;
  }

  // remove tracking params
  return url.split("?")[0];
}

function isInstagramUrl(url) {
  return url.includes("instagram.com") || url.includes("instagr.am");
}

const AXIOS = axios.create({
  timeout: 25000,
  maxRedirects: 5,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Mobile Safari/537.36",
    "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9"
  }
});

// ---------- extractors ----------
async function extractFromHtml(url) {
  const r = await AXIOS.get(url);
  const html = r.data;

  // 1) og:video
  let m = html.match(/property="og:video" content="([^"]+)"/i);
  if (m && m[1]) return m[1].replace(/&amp;/g, "&");

  // 2) og:video:secure_url
  m = html.match(/property="og:video:secure_url" content="([^"]+)"/i);
  if (m && m[1]) return m[1].replace(/&amp;/g, "&");

  // 3) video_url in embedded json
  m = html.match(/"video_url":"([^"]+)"/i);
  if (m && m[1]) {
    return m[1]
      .replace(/\\u0026/g, "&")
      .replace(/\\\//g, "/")
      .replace(/\\/g, "");
  }

  return null;
}

async function extractFromA1(url) {
  const apiUrl = url + (url.includes("?") ? "&" : "?") + "__a=1&__d=dis";
  const r = await AXIOS.get(apiUrl, { headers: { Accept: "application/json" } });
  const data = r.data;

  const videoUrl =
    data?.items?.[0]?.video_versions?.[0]?.url ||
    data?.graphql?.shortcode_media?.video_url ||
    data?.graphql?.shortcode_media?.edge_sidecar_to_children?.edges?.[0]?.node?.video_url;

  return videoUrl || null;
}

// ---------- routes ----------
app.get("/", (req, res) => {
  res.json({ ok: true, msg: "SSR Insta API Running ✅" });
});

app.get("/extract", async (req, res) => {
  try {
    let url = normalizeInstagramUrl(req.query.url);

    if (!url) return res.status(400).json({ success: false, message: "URL required" });
    if (!isInstagramUrl(url)) return res.status(400).json({ success: false, message: "Not Instagram URL" });

    // Try HTML first (more stable)
    let videoUrl = await extractFromHtml(url);

    // If failed, try __a=1 method
    if (!videoUrl) {
      videoUrl = await extractFromA1(url);
    }

    if (!videoUrl) {
      return res.json({
        success: false,
        message: "Extractor failed (blocked/login/private)"
      });
    }

    return res.json({
      success: true,
      videoUrl,
      title: "Instagram Video"
    });

  } catch (e) {
    return res.status(500).json({
      success: false,
      message: "Extractor failed",
      error: String(e.message || e)
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("API running on port", PORT));
