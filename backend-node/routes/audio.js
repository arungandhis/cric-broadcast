const express = require("express");
const path = require("path");
const router = express.Router();

const { generateOverScript } = require("../commentary/scriptGenerator");

const { synthesizeOverSegmentsWithCoqui } = require("../tts/coquiOverTts");

const { stitchOverAudio } = require("../audio/stitcher");

// POST /api/audio/generate-over
router.post("/generate-over", async (req, res) => {
  try {
    const { overData, context } = req.body;

    if (!overData || !overData.over_number || !overData.balls) {
      return res.status(400).json({ ok: false, error: "Invalid overData" });
    }

    const script = generateOverScript(overData, context || {});
    const segmentAudio = await synthesizeOverSegmentsWithCoqui(
      script,
      path.join(__dirname, "../output/audio")
    );

    const finalFile = await stitchOverAudio(
      segmentAudio,
      path.join(__dirname, "../output/audio"),
      overData.over_number
    );

    res.json({
      ok: true,
      script,
      segments: segmentAudio,
      finalFile
    });
  } catch (err) {
    console.error("[Audio Route] Error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
