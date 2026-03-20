const sdk = require("microsoft-cognitiveservices-speech-sdk");
const fs = require("fs-extra");
const path = require("path");

const speechKey = process.env.AZURE_SPEECH_KEY;
const speechRegion = process.env.AZURE_SPEECH_REGION;

if (!speechKey || !speechRegion) {
  console.warn(
    "[AzureTTS] Missing AZURE_SPEECH_KEY or AZURE_SPEECH_REGION in environment."
  );
}

const VOICE_MAP = {
  Harsha: "en-IN-NeerjaNeural",
  Ravi: "en-IN-PrabhatNeural",
  Gavaskar: "en-IN-KarthikNeural",
  Ponting: "en-AU-WilliamNeural"
};

function createSpeechConfig() {
  const speechConfig = sdk.SpeechConfig.fromSubscription(
    speechKey,
    speechRegion
  );
  speechConfig.speechSynthesisOutputFormat =
    sdk.SpeechSynthesisOutputFormat.Riff16Khz16BitMonoPcm;
  return speechConfig;
}

function synthesizeSegmentToFile(text, voiceName, outputFilePath) {
  return new Promise((resolve, reject) => {
    const speechConfig = createSpeechConfig();
    speechConfig.speechSynthesisVoiceName = voiceName;

    const audioConfig = sdk.AudioConfig.fromAudioFileOutput(outputFilePath);
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

    synthesizer.speakTextAsync(
      text,
      result => {
        synthesizer.close();
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          resolve(outputFilePath);
        } else {
          reject(
            new Error(
              `TTS failed: ${result.errorDetails || "Unknown error"}`
            )
          );
        }
      },
      err => {
        synthesizer.close();
        reject(err);
      }
    );
  });
}

async function synthesizeOverSegments(overScript, baseOutputDir) {
  const overNumber = overScript.over;
  const segments = overScript.segments || [];

  const overDir = path.join(
    baseOutputDir,
    `over_${String(overNumber).padStart(2, "0")}`
  );
  await fs.ensureDir(overDir);

  const results = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const commentator = seg.commentator;
    const voiceName = VOICE_MAP[commentator];

    if (!voiceName) {
      console.warn(
        `[AzureTTS] No voice mapped for commentator "${commentator}", skipping segment ${i}.`
      );
      continue;
    }

    const safeCue = (seg.cue || `seg_${i}`).replace(/[^\w\-]/g, "_");
    const fileName = `over${overNumber}_seg${String(i + 1).padStart(
      2,
      "0"
    )}_${commentator}_${safeCue}.wav`;
    const outputPath = path.join(overDir, fileName);

    console.log(
      `[AzureTTS] Synthesizing over ${overNumber}, segment ${
        i + 1
      }/${segments.length} (${commentator}, cue=${seg.cue})`
    );

    await synthesizeSegmentToFile(seg.text, voiceName, outputPath);

    results.push({
      segmentIndex: i,
      file: outputPath,
      commentator,
      cue: seg.cue,
      event: seg.event
    });
  }

  return results;
}

module.exports = {
  synthesizeOverSegments
};
