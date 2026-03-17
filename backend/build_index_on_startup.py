import zipfile
import json
import requests
from pathlib import Path

CRICSHEET = "https://cricsheet.org/downloads"

ZIPS = {
    "tests": "tests_json.zip",
    "odis": "odis_json.zip",
    "t20s": "t20s_male_json.zip"   # ALL MEN'S T20 MATCHES
}

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)

index = {}

for key, zip_name in ZIPS.items():
    print(f"[INDEX] Downloading {zip_name} ...")
    url = f"{CRICSHEET}/{zip_name}"
    r = requests.get(url)
    zpath = DATA_DIR / zip_name

    with open(zpath, "wb") as f:
        f.write(r.content)

    print(f"[INDEX] Extracting file list for {key} ...")
    with zipfile.ZipFile(zpath, "r") as z:
        files = [name for name in z.namelist() if name.endswith(".json")]

    index[key] = files

with open(DATA_DIR / "index.json", "w") as f:
    json.dump(index, f, indent=2)

print("[INDEX] index.json created successfully!")
