import os
from pathlib import Path

from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BACKEND_DIR.parent
DATA_DIR = PROJECT_DIR / "data"

load_dotenv(
    BACKEND_DIR / ".env"
)

PROFILE_FILE = DATA_DIR / "game_profiles.json"
VITALITY_FILE = DATA_DIR / "game_vitality.json"
RECOMMEND_FILE = DATA_DIR / "recommendations.json"

SILICONFLOW_KEY = os.getenv(
    "SILICONFLOW_KEY",
    ""
).strip()

SILICONFLOW_URL = (
    "https://api.siliconflow.cn/v1/chat/completions"
)

MODEL = os.getenv(
    "SILICONFLOW_MODEL",
    "deepseek-ai/DeepSeek-V3"
)