const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.json({ ok: true, msg: "SSR Insta API Running ✅" }));

app.get("/extract", async (req, res) => {
  try {
    const reelUrl = req.query.url;

    if (!reelUrl || (!reelUrl.includes("instagram.com") && !reelUrl.includes("instagr.am"))) {
      return res.status(400).json({ success: false, message: "Invalid Instagram URL" });
    }

    const url = reelUrl.split("?")[0];
    const apiUrl = url + (url.includes("?") ? "&" : "?") + "__a=1&__d=dis";

    const r = await axios.get(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
        "Accept": "application/json,text/plain,*/*"
      },
      timeout: 20000
    });

    const data = r.data;

    const videoUrl =
      data?.items?.[0]?.video_versions?.[0]?.url ||
      data?.graphql?.shortcode_media?.video_url ||
      data?.graphql?.shortcode_media?.edge_sidecar_to_children?.edges?.[0]?.node?.video_url;

    if (!videoUrl) {
      return res.json({ success: false, message: "Video URL not found (login/blocked)" });
    }

    return res.json({
      success: true,
      videoUrl: videoUrl,
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
