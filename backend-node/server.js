const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());

// Routes
const ttsRoutes = require("./routes/tts");
app.use("/api/tts", ttsRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Node commentary backend running on port ${PORT}`);
});
