import zipfile
import json
import requests
from pathlib import Path

CRICSHEET = "https://cricsheet.org/downloads"
FORMATS = {
    "t20s": "t20s_json.zip",
    "odis": "odis_json.zip",
    "tests": "tests_json.zip",
    "ipl": "ipl_json.zip"
}

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)

index = {}

for key, zip_name in FORMATS.items():
    print("Downloading", zip_name)
    url = f"{CRICSHEET}/{zip_name}"
    r = requests.get(url)
    zpath = DATA_DIR / zip_name

    with open(zpath, "wb") as f:
        f.write(r.content)

    print("Extracting file list...")
    with zipfile.ZipFile(zpath, "r") as z:
        files = [name for name in z.namelist() if name.endswith(".json")]

    index[key] = files

with open(DATA_DIR / "index.json", "w") as f:
    json.dump(index, f, indent=2)

print("index.json created successfully!")
