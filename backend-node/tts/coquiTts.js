const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const COQUI_URL = process.env.COQUI_TTS_URL;

async function synthesizeWithCoqui(text, fileName) {
  const resp = await axios.post(COQUI_URL + "/synthesize", {
    text,
    file_name: fileName
  });

  if (!resp.data.ok) throw new Error("Coqui TTS failed");

  const coquiPath = resp.data.file;
  const baseName = path.basename(coquiPath);

  const localDir = path.join(__dirname, "../output/audio/raw");
  await fs.ensureDir(localDir);

  const localPath = path.join(localDir, baseName);

  // Render services do NOT share file systems.
  // So we download the file from the Python service.
  const audioResp = await axios.get(
    COQUI_URL + "/" + coquiPath,
    { responseType: "arraybuffer" }
  );

  await fs.writeFile(localPath, audioResp.data);

  return localPath;
}

module.exports = { synthesizeWithCoqui };
