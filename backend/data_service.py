from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

from config import (
    PROFILE_FILE,
    VITALITY_FILE,
    RECOMMEND_FILE
)


DIMENSION_KEYS = [
    "exploration",
    "challenge",
    "social",
    "story",
    "action",
    "depth"
]

DIMENSION_NAMES = {
    "exploration": "探索性",
    "challenge": "挑战性",
    "social": "社交性",
    "story": "叙事性",
    "action": "动作性",
    "depth": "游戏深度"
}


class SteamDataService:
    def __init__(self):
        self.games: dict[str, dict[str, Any]] = {}
        self.vitality: dict[str, dict[str, Any]] = {}
        self.recommendations: dict[str, list[dict[str, Any]]] = {}

        self.load()

    @staticmethod
    def read_json(path_value: str | Path) -> dict[str, Any]:
        path = Path(path_value)

        if not path.exists():
            raise FileNotFoundError(
                f"数据文件不存在：{path}"
            )

        with path.open(
            "r",
            encoding="utf-8"
        ) as file:
            return json.load(file)

    def load(self):
        profile_data = self.read_json(
            PROFILE_FILE
        )

        vitality_data = self.read_json(
            VITALITY_FILE
        )

        recommendation_data = self.read_json(
            RECOMMEND_FILE
        )

        profile_games = profile_data.get(
            "games",
            []
        )

        vitality_games = vitality_data.get(
            "games",
            []
        )

        recommendations = recommendation_data.get(
            "recommendations",
            {}
        )

        self.games = {
            game["name"]: game
            for game in profile_games
            if game.get("name")
        }

        self.vitality = {
            game["name"]: game
            for game in vitality_games
            if game.get("name")
        }

        self.recommendations = recommendations

        print(
            f"游戏画像：{len(self.games)} 条"
        )
        print(
            f"生命力数据：{len(self.vitality)} 条"
        )
        print(
            f"推荐数据：{len(self.recommendations)} 条"
        )

    def get_game(
        self,
        name: str
    ) -> dict[str, Any] | None:
        game = self.games.get(name)

        if game is None:
            return None

        result = dict(game)

        result["vitality"] = dict(
            self.vitality.get(
                name,
                {}
            )
        )

        return result

    def get_recommend(
        self,
        name: str
    ) -> list[dict[str, Any]]:
        value = self.recommendations.get(
            name,
            []
        )

        return value if isinstance(value, list) else []

    def compare(
        self,
        game_a: str,
        game_b: str
    ) -> dict[str, Any] | None:
        item_a = self.get_game(game_a)
        item_b = self.get_game(game_b)

        if item_a is None or item_b is None:
            return None

        return {
            "gameA": item_a,
            "gameB": item_b
        }

    @staticmethod
    def parse_tags(
        game: dict[str, Any]
    ) -> list[str]:
        raw_tags = game.get(
            "tags",
            ""
        )

        if isinstance(raw_tags, list):
            values = raw_tags
        else:
            values = str(raw_tags).split(",")

        return [
            value.strip()
            for value in values
            if value and value.strip()
        ]

    def compare_tags(
        self,
        game_a: dict[str, Any],
        game_b: dict[str, Any]
    ) -> dict[str, Any]:
        tags_a = self.parse_tags(game_a)
        tags_b = self.parse_tags(game_b)

        lower_b = {
            tag.lower(): tag
            for tag in tags_b
        }

        common = [
            tag
            for tag in tags_a
            if tag.lower() in lower_b
        ]

        common_lower = {
            tag.lower()
            for tag in common
        }

        unique_a = [
            tag
            for tag in tags_a
            if tag.lower() not in common_lower
        ]

        unique_b = [
            tag
            for tag in tags_b
            if tag.lower() not in common_lower
        ]

        union_size = len({
            tag.lower()
            for tag in tags_a + tags_b
        })

        overlap = (
            len(common) / union_size
            if union_size > 0
            else 0
        )

        return {
            "common": common,
            "uniqueA": unique_a,
            "uniqueB": unique_b,
            "overlap": round(overlap, 4)
        }

    @staticmethod
    def calculate_similarity(
        game_a: dict[str, Any],
        game_b: dict[str, Any]
    ) -> float:
        vector_a = [
            float(game_a.get(key, 0) or 0)
            for key in DIMENSION_KEYS
        ]

        vector_b = [
            float(game_b.get(key, 0) or 0)
            for key in DIMENSION_KEYS
        ]

        dot = sum(
            a * b
            for a, b in zip(
                vector_a,
                vector_b
            )
        )

        magnitude_a = math.sqrt(
            sum(value * value for value in vector_a)
        )

        magnitude_b = math.sqrt(
            sum(value * value for value in vector_b)
        )

        if magnitude_a == 0 or magnitude_b == 0:
            return 0.0

        similarity = dot / (
            magnitude_a * magnitude_b
        )

        return round(
            max(0.0, min(1.0, similarity)),
            4
        )

    @staticmethod
    def strongest_dimension(
        game: dict[str, Any]
    ) -> tuple[str, float]:
        key = max(
            DIMENSION_KEYS,
            key=lambda item: float(
                game.get(item, 0) or 0
            )
        )

        return (
            DIMENSION_NAMES[key],
            float(game.get(key, 0) or 0)
        )

    def generate_rule_analysis(
        self,
        game_a: dict[str, Any],
        game_b: dict[str, Any],
        similarity: float,
        tag_analysis: dict[str, Any]
    ) -> str:
        strongest_a, value_a = self.strongest_dimension(
            game_a
        )

        strongest_b, value_b = self.strongest_dimension(
            game_b
        )

        vitality_a = game_a.get(
            "vitality",
            {}
        ).get(
            "vitality",
            0
        ) or 0

        vitality_b = game_b.get(
            "vitality",
            {}
        ).get(
            "vitality",
            0
        ) or 0

        common = tag_analysis.get(
            "common",
            []
        )[:5]

        common_text = (
            "、".join(common)
            if common
            else "暂未发现明显的共同核心标签"
        )

        if vitality_a > vitality_b:
            vitality_text = (
                f"{game_a['name']} 的生命力指数更高，"
                "在当前玩家生态和持续运营方面表现更强。"
            )
        elif vitality_b > vitality_a:
            vitality_text = (
                f"{game_b['name']} 的生命力指数更高，"
                "在当前玩家生态和持续运营方面表现更强。"
            )
        else:
            vitality_text = (
                "两款游戏的生命力指数接近，"
                "当前生态稳定程度没有明显差距。"
            )

        return (
            f"{game_a['name']} 的突出画像维度是"
            f"{strongest_a}（{value_a:.0f}），"
            f"而 {game_b['name']} 的突出维度是"
            f"{strongest_b}（{value_b:.0f}）。\n\n"
            f"两款游戏的六维画像相似度为"
            f"{similarity * 100:.1f}%。"
            f"共同游戏基因包括：{common_text}。\n\n"
            f"{vitality_text}\n\n"
            "从玩家迁移角度看，若玩家重视两款游戏的共同标签，"
            "迁移成本相对较低；若更关注各自最强画像维度，"
            "则两款游戏会提供明显不同的体验路径。"
        )