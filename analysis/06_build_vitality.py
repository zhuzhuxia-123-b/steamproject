import pandas as pd
import numpy as np
import json
import os
from sklearn.preprocessing import MinMaxScaler

# =========================
# 1. 路径配置
# =========================

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

input_file = os.path.join(BASE_DIR, "data", "steam_clean.json")
output_file = os.path.join(BASE_DIR, "data", "game_vitality.json")


# =========================
# 2. 读取数据
# =========================

df = pd.read_json(input_file)
print(f"加载游戏数量: {len(df)}")


# =========================
# 3. 数据筛选
# =========================

df = df[
    (df["Name"].notna()) &
    (df["Positive"] + df["Negative"] > 0) &
    (df["Owners"] > 0)
].copy()

print(f"有效游戏数量: {len(df)}")


# =========================
# 4. 计算各项指标
# =========================

# 4.1 玩家规模指数
owners_log = np.log1p(df["Owners"])
df["player_score"] = (owners_log - owners_log.min()) / (owners_log.max() - owners_log.min())

# 4.2 社区活跃指数
ccu_log = np.log1p(df["Peak CCU"])
df["community_score"] = (ccu_log - ccu_log.min()) / (ccu_log.max() - ccu_log.min())

# 4.3 用户好评率
review_total = df["Positive"] + df["Negative"]
df["positive_rate"] = df["Positive"] / (review_total + 1)

# 4.4 游戏深度
playtime = 0.6 * df["Average playtime forever"] + 0.4 * df["Median playtime forever"]
playtime_log = np.log1p(playtime)
df["depth_score"] = (playtime_log - playtime_log.min()) / (playtime_log.max() - playtime_log.min())

# 4.5 运营能力（DLC数量 + Recommendations，权重各半）
# ★★★ 修复：先创建列，再使用 ★★★
df["dlc_log"] = np.log1p(df["DLC count"])
df["rec_log"] = np.log1p(df["Recommendations"])

scaler = MinMaxScaler()
df[["dlc_norm", "rec_norm"]] = scaler.fit_transform(
    df[["dlc_log", "rec_log"]].values
)
df["operation_score"] = 0.5 * df["dlc_norm"] + 0.5 * df["rec_norm"]

# 4.6 生命周期衰减因子
CURRENT_YEAR = 2026
df["game_age"] = CURRENT_YEAR - df["Release year"]
df["age_factor"] = np.exp(-0.05 * df["game_age"])


# =========================
# 5. 生命力指数 GVI
# =========================

df["vitality"] = (
    0.25 * df["player_score"] +
    0.25 * df["community_score"] +
    0.20 * df["positive_rate"] +
    0.15 * df["operation_score"] +
    0.15 * df["age_factor"]
)

df["vitality"] = (df["vitality"] * 100).round(1)


# =========================
# 6. 构建输出 JSON
# =========================

result = []
for _, row in df.iterrows():
    result.append({
        "appid": int(row["AppID"]),
        "name": row["Name"],
        "vitality": float(row["vitality"]),
        "player": round(float(row["player_score"] * 100), 1),
        "community": round(float(row["community_score"] * 100), 1),
        "positive_rate": round(float(row["positive_rate"] * 100), 1),
        "operation": round(float(row["operation_score"] * 100), 1),
        "age_factor": round(float(row["age_factor"] * 100), 1),
        "game_age": int(row["game_age"]),
        "genres": row["Genres"],
        "developer": row["Developers"],
        "release_year": int(row["Release year"])
    })

with open(output_file, "w", encoding="utf-8") as f:
    json.dump({
        "description": "Steam Game Vitality Index (GVI) - 游戏生命力指数",
        "weights": {
            "player_scale": 0.25,
            "community_active": 0.25,
            "positive_rate": 0.20,
            "operation": 0.15,
            "age_factor": 0.15
        },
        "games": result
    }, f, ensure_ascii=False, indent=2)


print("\n" + "=" * 50)
print("✓ 游戏生命力指数 (GVI) 生成完成")
print("=" * 50)
print(f"游戏数量: {len(result)}")
print(f"保存位置: {output_file}")


# =========================
# 7. Top 10 展示
# =========================

print("\n=== Top 10 生命力游戏 (GVI) ===")
top10 = sorted(result, key=lambda x: x["vitality"], reverse=True)[:10]

for i, g in enumerate(top10, 1):
    print(f"{i:2}. {g['name'][:30]:30} GVI: {g['vitality']:6.1f}  年龄: {g['game_age']:2}年  {g['genres'][:20]}")