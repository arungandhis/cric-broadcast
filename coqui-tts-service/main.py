from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.responses import FileResponse
from TTS.api import TTS
import uvicorn
import uuid
import os

app = FastAPI()

MODEL_NAME = "tts_models/en/ljspeech/tacotron2-DDC"
tts = TTS(MODEL_NAME, progress_bar=False, gpu=False)

OUTPUT_DIR = "output_audio"
os.makedirs(OUTPUT_DIR, exist_ok=True)

class TtsRequest(BaseModel):
    text: str
    file_name: str | None = None

@app.post("/synthesize")
def synthesize(req: TtsRequest):
    file_name = req.file_name or f"{uuid.uuid4()}.wav"
    out_path = os.path.join(OUTPUT_DIR, file_name)

    tts.tts_to_file(text=req.text, file_path=out_path)

    return {"ok": True, "file": out_path}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
