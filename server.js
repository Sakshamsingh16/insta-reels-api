const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.json({ ok: true, msg: "SSR Insta API Running ✅" }));

function cleanUrl(u) {
  return (u || "").trim();
}

function isInstagramUrl(url) {
  return url.includes("instagram.com") || url.includes("instagr.am");
}

// ✅ Extract from HTML meta tags (more stable)
async function extractFromHtml(url) {
  const r = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Mobile Safari/537.36",
      "Accept": "text/html,*/*"
    },
    timeout: 20000
  });

  const html = r.data;

  // Try og:video
  let match = html.match(/property="og:video" content="([^"]+)"/);
  if (match && match[1]) return match[1].replace(/&amp;/g, "&");

  // Try og:video:secure_url
  match = html.match(/property="og:video:secure_url" content="([^"]+)"/);
  if (match && match[1]) return match[1].replace(/&amp;/g, "&");

  // Try video_url in JSON
  match = html.match(/"video_url":"([^"]+)"/);
  if (match && match[1]) return match[1].replace(/\\u0026/g, "&").replace(/\\/g, "");

  return null;
}

app.get("/extract", async (req, res) => {
  try {
    let reelUrl = cleanUrl(req.query.url);

    if (!reelUrl) return res.status(400).json({ success: false, message: "URL required" });
    if (!reelUrl.startsWith("http")) return res.status(400).json({ success: false, message: "Invalid URL" });
    if (!isInstagramUrl(reelUrl)) return res.status(400).json({ success: false, message: "Not Instagram URL" });

    // remove trackers
    reelUrl = reelUrl.split("?")[0];

    const videoUrl = await extractFromHtml(reelUrl);

    if (!videoUrl) {
      return res.json({ success: false, message: "Extractor failed (blocked/login/private)" });
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
