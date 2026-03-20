const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const fs = require("fs-extra");
const path = require("path");

ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Concatenate segment WAVs into a single over-level WAV.
 * Optionally mix ambience / crowd later.
 *
 * @param {Array<{file:string, event?:string}>} segments
 * @param {string} outputDir
 * @param {number} overNumber
 * @returns {Promise<string>} path to final wav
 */
async function stitchOverAudio(segments, outputDir, overNumber) {
  if (!segments || !segments.length) {
    throw new Error("No segments provided for stitching");
  }

  await fs.ensureDir(outputDir);

  const overTag = String(overNumber).padStart(2, "0");
  const outputFile = path.join(outputDir, `over_${overTag}_final.wav`);

  return new Promise((resolve, reject) => {
    const command = ffmpeg();

    segments.forEach(seg => {
      command.input(seg.file);
    });

    command
      .on("start", cmd => {
        console.log("[Stitcher] ffmpeg start:", cmd);
      })
      .on("error", err => {
        console.error("[Stitcher] ffmpeg error:", err);
        reject(err);
      })
      .on("end", () => {
        console.log("[Stitcher] ffmpeg finished:", outputFile);
        resolve(outputFile);
      })
      .mergeToFile(outputFile, path.join(outputDir, "tmp"));
  });
}

module.exports = {
  stitchOverAudio
};
