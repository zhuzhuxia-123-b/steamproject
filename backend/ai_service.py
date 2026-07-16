"""SiliconFlow AI service for Steam Game Galaxy.

This module keeps the API key on the Flask side and returns a concise,
structured Chinese analysis for the Game Duel page.
"""

from __future__ import annotations

from typing import Any

import requests

from config import MODEL, SILICONFLOW_KEY, SILICONFLOW_URL


DIMENSION_LABELS = {
    "exploration": "探索性",
    "challenge": "挑战性",
    "social": "社交性",
    "story": "叙事性",
    "action": "动作性",
    "depth": "游戏深度",
}


class AIService:
    """Small wrapper around SiliconFlow's OpenAI-compatible endpoint."""

    def __init__(self, timeout: int = 75) -> None:
        self.timeout = timeout

    def is_configured(self) -> bool:
        return bool(SILICONFLOW_KEY and MODEL and SILICONFLOW_URL)

    @staticmethod
    def _number(value: Any, default: float = 0.0) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _tags(game: dict[str, Any], limit: int = 12) -> str:
        raw = game.get("tags", "")
        if isinstance(raw, list):
            tags = [str(item).strip() for item in raw]
        else:
            tags = [item.strip() for item in str(raw).split(",")]
        tags = [item for item in tags if item]
        return "、".join(tags[:limit]) or "暂无标签"

    def _game_block(self, label: str, game: dict[str, Any]) -> str:
        vitality = game.get("vitality") or {}
        dimensions = "\n".join(
            f"- {cn}: {self._number(game.get(key)):.1f}/100"
            for key, cn in DIMENSION_LABELS.items()
        )

        return f"""
{label}：{game.get('name', '未知游戏')}
- 类型：{game.get('genres') or '未知'}
- 开发商：{game.get('developer') or '未知'}
- 发行年份：{game.get('release_year') or '未知'}
- 价格：{self._number(game.get('price')):.2f}
- 好评率：{self._number(game.get('score')) * 100:.1f}%
- 玩家规模估计：{self._number(game.get('owners')):,.0f}
- 标签：{self._tags(game)}
- 生命力指数 GVI：{self._number(vitality.get('vitality')):.1f}
- 玩家规模指数：{self._number(vitality.get('player')):.1f}
- 社区活跃指数：{self._number(vitality.get('community')):.1f}
- 评价质量指数：{self._number(vitality.get('positive_rate')):.1f}
- 持续运营指数：{self._number(vitality.get('operation')):.1f}
- 年龄韧性指数：{self._number(vitality.get('age_factor')):.1f}
六维画像：
{dimensions}
""".strip()

    def build_prompt(self, comparison: dict[str, Any]) -> str:
        game_a = comparison.get("gameA") or {}
        game_b = comparison.get("gameB") or {}
        similarity = self._number(comparison.get("similarity")) * 100
        tag_analysis = comparison.get("tag_analysis") or {}
        common = tag_analysis.get("common") or []
        common_text = "、".join(map(str, common[:8])) or "无明显共同标签"

        return f"""
你是 Steam Game Galaxy 可视分析系统中的“游戏生态分析专家”。
请根据下面的结构化数据，对两款游戏进行严谨、易读、适合网页展示的中文分析。
不要虚构未提供的销量、奖项、剧情事件或实时在线人数。

{self._game_block('游戏 A', game_a)}

{self._game_block('游戏 B', game_b)}

系统计算：
- 六维画像相似度：{similarity:.1f}%
- 共同标签：{common_text}

输出要求：
1. 输出 4 个小节，标题依次为“生态定位”“核心差异”“共同基因”“迁移建议”。
2. 总字数控制在 320—520 个中文字符。
3. 明确指出哪款游戏在哪些维度更突出，并结合 GVI 拆解解释。
4. 对共同标签和差异标签做解释，但不要堆砌标签。
5. 最后给出适合哪类玩家从 A 迁移到 B、或从 B 迁移到 A。
6. 使用纯文本，不要使用 Markdown 表格，不要输出 JSON。
""".strip()

    def analyze_compare(self, comparison: dict[str, Any]) -> str:
        if not self.is_configured():
            raise RuntimeError("未配置 SILICONFLOW_KEY、MODEL 或 SILICONFLOW_URL")

        payload = {
            "model": MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "你是一名数据可视化系统中的 Steam 游戏生态分析专家。"
                        "只基于用户提供的数据推断，避免事实幻觉。"
                    ),
                },
                {
                    "role": "user",
                    "content": self.build_prompt(comparison),
                },
            ],
            "temperature": 0.55,
            "max_tokens": 1000,
            "stream": False,
        }

        response = requests.post(
            SILICONFLOW_URL,
            headers={
                "Authorization": f"Bearer {SILICONFLOW_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=self.timeout,
        )

        try:
            response.raise_for_status()
        except requests.HTTPError as exc:
            detail = response.text[:500]
            raise RuntimeError(
                f"SiliconFlow 请求失败：HTTP {response.status_code}，{detail}"
            ) from exc

        result = response.json()
        choices = result.get("choices") or []
        if not choices:
            raise RuntimeError(f"SiliconFlow 返回内容异常：{result}")

        content = (
            choices[0]
            .get("message", {})
            .get("content", "")
            .strip()
        )
        if not content:
            raise RuntimeError("SiliconFlow 返回了空分析文本")

        return content
