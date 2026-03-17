from fastapi import FastAPI, HTTPException
import requests
import zipfile
import io

app = FastAPI()

CRICSHEET_BASE = "https://cricsheet.org/downloads/"

FORMATS = {
    "t20s": "t20s_male_json.zip",
    "odis": "odis_male_json.zip",
    "tests": "tests_male_json.zip",
}

# Cache ZIPs in memory (RAM)
zip_cache = {}

def get_zip(format_key: str):
    """Fetch ZIP from Cricsheet.org and keep in memory."""
    if format_key in zip_cache:
        return zip_cache[format_key]

    zip_name = FORMATS.get(format_key)
    if not zip_name:
        raise HTTPException(404, "Invalid format")

    url = CRICSHEET_BASE + zip_name
    r = requests.get(url)

    if r.status_code != 200:
        raise HTTPException(500, f"Failed to download {zip_name}")

    zip_cache[format_key] = zipfile.ZipFile(io.BytesIO(r.content))
    return zip_cache[format_key]


@app.get("/cricsheet/index.json")
def cricsheet_index():
    """Return full list of match files directly from Cricsheet ZIPs."""
    index = {}

    for fmt, zip_name in FORMATS.items():
        z = get_zip(fmt)
        files = [f"{fmt}/{name}" for name in z.namelist() if name.endswith(".json")]
        index[fmt] = files

    return index


@app.get("/cricsheet/{format}/{filename}")
def cricsheet_match(format: str, filename: str):
    """Return the actual match JSON directly from Cricsheet ZIP."""
    if format not in FORMATS:
        raise HTTPException(404, "Invalid format")

    z = get_zip(format)

    try:
        with z.open(filename) as f:
            return f.read().decode("utf-8")
    except KeyError:
        raise HTTPException(404, "Match not found")
