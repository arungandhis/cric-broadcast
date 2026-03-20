const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());

// Routes
const ttsRoutes = require("./routes/tts");
const audioRoutes = require("./routes/audio");

app.use("/api/tts", ttsRoutes);
app.use("/api/audio", audioRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Node commentary backend running on port ${PORT}`);
});
