from __future__ import annotations

import logging
from typing import Any

from flask import Flask, jsonify, request
from flask_cors import CORS

from ai_service import AIService
from data_service import SteamDataService


app = Flask(__name__)

app.config["JSON_AS_ASCII"] = False
app.config["JSON_SORT_KEYS"] = False

CORS(
    app,
    resources={
        r"/api/*": {
            "origins": "*"
        }
    }
)

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s: %(message)s"
)

steam = SteamDataService()
ai_service = AIService()


def success(data: Any = None, **extra: Any):
    payload = {
        "success": True
    }

    if data is not None:
        payload["data"] = data

    payload.update(extra)

    return jsonify(payload)


def failure(message: str, status_code: int = 400, **extra: Any):
    payload = {
        "success": False,
        "error": message
    }

    payload.update(extra)

    return jsonify(payload), status_code


@app.get("/")
def index():
    return jsonify({
        "status": "Steam Galaxy Backend Running",
        "version": "1.0.0",
        "games": len(steam.games),
        "endpoints": [
            "/api/health",
            "/api/game-list",
            "/api/game/<name>",
            "/api/recommend/<name>",
            "/api/compare",
            "/api/ai/analyze"
        ]
    })


@app.get("/api/health")
def health():
    return jsonify({
        "success": True,
        "status": "ok",
        "service": "Steam Game Galaxy Backend",
        "games": len(steam.games),
        "vitality_records": len(steam.vitality),
        "recommendation_records": len(steam.recommendations),
        "ai_configured": ai_service.is_configured()
    })


@app.get("/api/game-list")
def game_list():
    query = request.args.get("q", "").strip().lower()

    names = sorted(
        steam.games.keys(),
        key=str.lower
    )

    if query:
        names = [
            name
            for name in names
            if query in name.lower()
        ]

    return jsonify({
        "success": True,
        "total": len(names),
        "games": names
    })


@app.get("/api/game/<path:name>")
def get_game(name: str):
    game = steam.get_game(name)

    if game is None:
        return failure(
            f"未找到游戏：{name}",
            404
        )

    return jsonify({
        "success": True,
        "game": game
    })


@app.get("/api/recommend/<path:name>")
def get_recommendations(name: str):
    if steam.get_game(name) is None:
        return failure(
            f"未找到游戏：{name}",
            404
        )

    limit_text = request.args.get("limit", "10")

    try:
        limit = max(1, min(int(limit_text), 30))
    except ValueError:
        limit = 10

    recommendations = steam.get_recommend(name)[:limit]

    return jsonify({
        "success": True,
        "game": name,
        "total": len(recommendations),
        "recommendations": recommendations
    })


@app.post("/api/compare")
def compare_games():
    body = request.get_json(silent=True) or {}

    game_a = str(body.get("gameA", "")).strip()
    game_b = str(body.get("gameB", "")).strip()

    if not game_a or not game_b:
        return failure(
            "请求中必须包含 gameA 和 gameB",
            400
        )

    if game_a == game_b:
        return failure(
            "请选择两款不同的游戏",
            400
        )

    comparison = steam.compare(
        game_a,
        game_b
    )

    if comparison is None:
        missing = []

        if steam.get_game(game_a) is None:
            missing.append(game_a)

        if steam.get_game(game_b) is None:
            missing.append(game_b)

        return failure(
            "未找到游戏：" + "、".join(missing),
            404
        )

    comparison["similarity"] = steam.calculate_similarity(
        comparison["gameA"],
        comparison["gameB"]
    )

    comparison["tag_analysis"] = steam.compare_tags(
        comparison["gameA"],
        comparison["gameB"]
    )

    comparison["recommendationsA"] = steam.get_recommend(game_a)[:6]
    comparison["recommendationsB"] = steam.get_recommend(game_b)[:6]

    return jsonify({
        "success": True,
        **comparison
    })


@app.post("/api/ai/analyze")
def analyze_games():
    body = request.get_json(silent=True) or {}

    game_a = str(body.get("gameA", "")).strip()
    game_b = str(body.get("gameB", "")).strip()

    if not game_a or not game_b:
        return failure(
            "请求中必须包含 gameA 和 gameB",
            400
        )

    comparison = steam.compare(
        game_a,
        game_b
    )

    if comparison is None:
        return failure(
            "无法获得两款游戏的比较数据",
            404
        )

    comparison["similarity"] = steam.calculate_similarity(
        comparison["gameA"],
        comparison["gameB"]
    )

    comparison["tag_analysis"] = steam.compare_tags(
        comparison["gameA"],
        comparison["gameB"]
    )

    try:
        analysis = ai_service.analyze_compare(
            comparison
        )

        return jsonify({
            "success": True,
            "analysis": analysis,
            "provider": "SiliconFlow"
        })

    except Exception as exc:
        app.logger.exception(
            "SiliconFlow 分析失败"
        )

        fallback = steam.generate_rule_analysis(
            comparison["gameA"],
            comparison["gameB"],
            comparison["similarity"],
            comparison["tag_analysis"]
        )

        return jsonify({
            "success": True,
            "analysis": fallback,
            "provider": "Local Rule Engine",
            "warning": str(exc)
        })


@app.errorhandler(404)
def handle_404(_error):
    return failure(
        "请求的接口不存在",
        404
    )


@app.errorhandler(500)
def handle_500(error):
    app.logger.exception(
        "服务器内部错误：%s",
        error
    )

    return failure(
        "服务器内部错误，请查看 Flask 终端日志",
        500
    )


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True,
        use_reloader=True
    )