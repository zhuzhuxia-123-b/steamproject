"""
Steam Game Galaxy
Dashboard Data Builder

生成:
data/dashboard.json

用途:
Galaxy Observatory 页面

数据来源:

steam_clean.json
game_profiles.json
game_vitality.json

"""

import os
import json
from collections import Counter

BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

DATA_DIR = os.path.join(
    BASE_DIR,
    "data"
)

STEAM_FILE = os.path.join(
    DATA_DIR,
    "steam_clean.json"
)

PROFILE_FILE = os.path.join(
    DATA_DIR,
    "game_profiles.json"
)

VITALITY_FILE = os.path.join(
    DATA_DIR,
    "game_vitality.json"
)

OUTPUT_FILE = os.path.join(
    DATA_DIR,
    "dashboard.json"
)


def load_json(path):
    with open(
        path,
        "r",
        encoding="utf-8"
    ) as f:
        return json.load(f)


def split_values(value):
    if not value:
        return []
    return [
        x.strip()
        for x in str(value).split(",")
        if x.strip()
    ]


def normalize(value):
    return min(
        max(
            value,
            0
        ),
        100
    )


def build():
    print(
        "Loading data..."
    )

    steam = load_json(
        STEAM_FILE
    )
    profiles = load_json(
        PROFILE_FILE
    )
    vitality = load_json(
        VITALITY_FILE
    )

    games = profiles["games"]

    vitality_games = {
        g["name"]: g
        for g in vitality["games"]
    }

    print(
        "Profile games:",
        len(games)
    )

    # ==============================
    # Overview
    # ==============================

    total_games = len(
        steam
    )

    analyzed_games = len(
        games
    )

    scores = []
    vitality_values = []
    years = Counter()

    genre_counter = Counter()
    developer_counter = Counter()
    tag_counter = Counter()

    for game in games:
        score = game.get(
            "score",
            0
        )
        if score:
            scores.append(
                score
            )

        year = game.get(
            "release_year"
        )
        if year:
            years[year] += 1

        for genre in split_values(
            game.get("genres")
        ):
            genre_counter[
                genre
            ] += 1

        developer = game.get(
            "developer"
        )
        if developer:
            developer_counter[
                developer
            ] += 1

        for tag in split_values(
            game.get("tags")
        )[:20]:
            tag_counter[
                tag
            ] += 1

        name = game.get(
            "name"
        )
        if name in vitality_games:
            vitality_values.append(
                vitality_games[name]
                .get(
                    "vitality",
                    0
                )
            )

    avg_score = (
        sum(scores) /
        len(scores)
    ) if scores else 0

    avg_vitality = (
        sum(vitality_values) /
        len(vitality_values)
    ) if vitality_values else 0

    active_year = (
        years.most_common(1)[0][0]
        if years
        else None
    )

    # ==============================
    # Galaxy Health
    # ==============================

    quality_score = (
        avg_score * 100
    )

    vitality_score = avg_vitality

    diversity_score = min(
        len(genre_counter) * 5,
        100
    )

    developer_score = min(
        len(developer_counter) /
        100,
        100
    )

    health = (
        quality_score * 0.35
        +
        vitality_score * 0.35
        +
        diversity_score * 0.2
        +
        developer_score * 0.1
    )

    health = round(
        normalize(health),
        1
    )

    output = {
        "description":
        "Steam Galaxy Observatory Dashboard",

        "overview": {
            "total_games":
            total_games,
            "analyzed_games":
            analyzed_games,
            "avg_score":
            round(
                avg_score,
                3
            ),
            "avg_vitality":
            round(
                avg_vitality,
                2
            ),
            "active_year":
            active_year
        },

        "health": {
            "score":
            health,
            "quality":
            round(
                quality_score,
                1
            ),
            "vitality":
            round(
                vitality_score,
                1
            ),
            "diversity":
            round(
                diversity_score,
                1
            )
        },

        "genres": [
            {
                "name": k,
                "value": v
            }
            for k, v
            in genre_counter
            .most_common(15)
        ],

        "developers": [
            {
                "name": k,
                "value": v
            }
            for k, v
            in developer_counter
            .most_common(12)
        ],

        "tags": [
            {
                "name": k,
                "value": v
            }
            for k, v
            in tag_counter
            .most_common(40)
        ]
    }

    with open(
        OUTPUT_FILE,
        "w",
        encoding="utf-8"
    ) as f:
        json.dump(
            output,
            f,
            ensure_ascii=False,
            indent=2
        )

    print(
        "Dashboard data saved:"
    )
    print(
        OUTPUT_FILE
    )


if __name__ == "__main__":
    build()