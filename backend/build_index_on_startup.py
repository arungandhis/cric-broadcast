import os
import json
import zipfile
import requests

CRICSHEET_BASE = "https://cricsheet.org/downloads/"
DATA_DIR = "backend/data"
INDEX_FILE = f"{DATA_DIR}/index.json"

FORMATS = {
    "tests": "tests_male_json.zip",
    "odis": "odis_male_json.zip",
    "t20s": "t20s_male_json.zip",
}

def ensure_data_dir():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

def download_and_extract(format_key, zip_name):
    zip_path = f"{DATA_DIR}/{zip_name}"

    # Download if missing
    if not os.path.exists(zip_path):
        print(f"Downloading {zip_name}...")
        url = CRICSHEET_BASE + zip_name
        r = requests.get(url)
        r.raise_for_status()
        with open(zip_path, "wb") as f:
            f.write(r.content)

    # Extract
    extract_dir = f"{DATA_DIR}/{format_key}"
    if not os.path.exists(extract_dir):
        os.makedirs(extract_dir)

    with zipfile.ZipFile(zip_path, "r") as z:
        z.extractall(extract_dir)

    return extract_dir

def build_index():
    index = {}

    for format_key, zip_name in FORMATS.items():
        extract_dir = download_and_extract(format_key, zip_name)

        for file in os.listdir(extract_dir):
            if not file.endswith(".json"):
                continue

            # Example filename: 1234567-2024-India-vs-Australia.json
            parts = file.split("-")
            if len(parts) < 2:
                continue

            year = parts[1]

            # Ensure structure exists
            if year not in index:
                index[year] = {"tests": [], "odis": [], "t20s": []}

            index[year][format_key].append(file)

    # Sort years descending (2024 → 2023 → 2022)
    sorted_index = dict(sorted(index.items(), reverse=True))

    with open(INDEX_FILE, "w") as f:
        json.dump(sorted_index, f, indent=2)

    print("Index built successfully.")

if __name__ == "__main__":
    ensure_data_dir()
    build_index()
