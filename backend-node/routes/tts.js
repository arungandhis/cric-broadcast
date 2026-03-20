const express = require("express");
const path = require("path");
const router = express.Router();

const { generateOverScript } = require("../commentary/scriptGenerator");
const { synthesizeOverSegments } = require("../tts/azureTts");

// POST /api/tts/generate-over-audio
router.post("/generate-over-audio", async (req, res) => {
  try {
    const { overData, context } = req.body;

    if (!overData || !overData.over_number || !overData.balls) {
      return res.status(400).json({ ok: false, error: "Invalid overData" });
    }

    const script = generateOverScript(overData, context || {});
    const audioSegments = await synthesizeOverSegments(
      script,
      path.join(__dirname, "../output/audio")
    );

    res.json({
      ok: true,
      script,
      audioSegments
    });
  } catch (err) {
    console.error("[TTS Route] Error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
