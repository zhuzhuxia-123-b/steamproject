import pandas as pd
import os
import json
from sklearn.preprocessing import MinMaxScaler
import numpy as np

# =========================
# 路径配置
# =========================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

input_file = os.path.join(BASE_DIR, "data", "steam.csv")
output_csv = os.path.join(BASE_DIR, "data", "steam_clean.csv")
output_json = os.path.join(BASE_DIR, "data", "steam_clean.json")
output_galaxy = os.path.join(BASE_DIR, "data", "steam_galaxy.json")
output_gvi = os.path.join(BASE_DIR, "data", "gvi_rankings.json")

# =========================
# 读取
# =========================
df = pd.read_csv(input_file)
print(f"原始数据: {df.shape[0]} 行, {df.shape[1]} 列")

# =========================
# 1. 删除没有名字的游戏
# =========================
df = df.dropna(subset=["Name"])
print(f"删除无名游戏后: {df.shape[0]} 行")

# =========================
# 2. 日期处理
# =========================
df["Release date"] = pd.to_datetime(df["Release date"], errors="coerce")
df["Release year"] = df["Release date"].dt.year
df = df.dropna(subset=["Release year"])
df["Release year"] = df["Release year"].astype(int)
print(f"删除无效日期后: {df.shape[0]} 行")

# =========================
# 3. 修复：正确解析 Estimated owners（支持 1,000,000+ 格式）
# =========================
def convert_owner(x):
    if pd.isna(x):
        return 0

    x = str(x).strip()
    # 去掉逗号
    x = x.replace(",", "")

    try:
        # 处理 "1,000,000+" 格式
        if "+" in x:
            return float(x.replace("+", ""))

        # 处理 "100,000 - 200,000" 格式
        if "-" in x:
            nums = x.split("-")
            if len(nums) == 2:
                return (float(nums[0].strip()) + float(nums[1].strip())) / 2

        # 纯数字
        return float(x)

    except:
        return 0

df["Owners"] = df["Estimated owners"].apply(convert_owner)
print(f"Owners 解析完成，最大值: {df['Owners'].max():.0f}")

# =========================
# 4. Steam 好评率
# =========================
df["Review score"] = df["Positive"] / (df["Positive"] + df["Negative"] + 1)

# =========================
# 5. 缺失值填充（Tags 特殊处理）
# =========================
text_columns = ["Developers", "Publishers", "Genres", "Categories"]
for col in text_columns:
    df[col] = df[col].fillna("Unknown")

df["Tags"] = df["Tags"].fillna("")

# =========================
# 6. 计算 GVI（游戏生命力指数）- 你的核心创新点
# =========================
print("\n计算游戏生命力指数 (GVI)...")

# 准备特征矩阵
gvi_features = df[["Owners", "Peak CCU", "Review score", "Average playtime forever"]].copy()

# 处理异常值：对 Owners 和 Peak CCU 取对数，使分布更平滑
gvi_features["log_owners"] = np.log1p(gvi_features["Owners"])
gvi_features["log_ccu"] = np.log1p(gvi_features["Peak CCU"])
gvi_features["log_playtime"] = np.log1p(gvi_features["Average playtime forever"])

# 选取用于 GVI 的字段
gvi_matrix = gvi_features[["log_owners", "log_ccu", "Review score", "log_playtime"]].values

# 标准化到 0-1
scaler = MinMaxScaler()
gvi_normalized = scaler.fit_transform(gvi_matrix)

# 计算 GVI：加权平均
# 30% 玩家规模 + 30% 活跃度 + 20% 口碑 + 20% 游戏深度
df["GVI"] = (
    0.3 * gvi_normalized[:, 0] +  # log_owners
    0.3 * gvi_normalized[:, 1] +  # log_ccu
    0.2 * gvi_normalized[:, 2] +  # Review score
    0.2 * gvi_normalized[:, 3]    # log_playtime
)

# 将 GVI 映射到 0-100 区间，便于前端展示
df["GVI_score"] = (df["GVI"] * 100).round(2)

print(f"GVI 范围: {df['GVI_score'].min():.2f} - {df['GVI_score'].max():.2f}")
print(f"GVI 均值: {df['GVI_score'].mean():.2f}")

# =========================
# 7. 保存主数据
# =========================
df.to_csv(output_csv, index=False, encoding="utf-8-sig")
df.to_json(output_json, orient="records", force_ascii=False)

print(f"\n清洗完成: {df.shape[0]} 行, {df.shape[1]} 列")
print(f"CSV: {output_csv}")
print(f"JSON: {output_json}")

# =========================
# 8. 数据质量检查
# =========================
print("\n=== 数据质量检查 ===")
print(f"价格范围: ¥{df['Price'].min():.2f} - ¥{df['Price'].max():.2f}")
print(f"年份范围: {df['Release year'].min()} - {df['Release year'].max()}")
print(f"评分范围: {df['Review score'].min():.3f} - {df['Review score'].max():.3f}")
print(f"有 Tags 的游戏: {(df['Tags'] != '').sum()} / {len(df)} ({((df['Tags'] != '').sum() / len(df)) * 100:.1f}%)")
print(f"唯一开发商数: {df['Developers'].nunique()}")

# =========================
# 9. GVI Top 10 展示
# =========================
print("\n=== GVI Top 10 游戏 ===")
top_gvi = df.nlargest(10, "GVI")[["Name", "GVI_score", "Owners", "Review score"]]
for _, row in top_gvi.iterrows():
    print(f"  {row['Name'][:30]:30} GVI: {row['GVI_score']:6.2f}  玩家: {row['Owners']:>12.0f}  好评率: {row['Review score']:.1%}")

# =========================
# 10. 保存 GVI 排行榜（前端直接用）
# =========================
gvi_ranking = []
for _, row in df.nlargest(100, "GVI").iterrows():
    gvi_ranking.append({
        "name": row["Name"],
        "gvi": float(row["GVI_score"]),
        "owners": float(row["Owners"]),
        "score": float(row["Review score"]),
        "price": float(row["Price"]),
        "developer": row["Developers"],
        "appid": int(row["AppID"])
    })

with open(output_gvi, "w", encoding="utf-8") as f:
    json.dump({
        "total": len(df),
        "top100": gvi_ranking
    }, f, ensure_ascii=False, indent=2)

print(f"\nGVI Top100 已保存: {output_gvi}")

# =========================
# 11. 保存 Game Galaxy 专用数据（过滤热门游戏，控制前端性能）
# =========================
# 保留有 Tags、有热度、有评分，且 Owners > 50000 的热门游戏
df_galaxy = df[
    (df["Tags"] != "") &
    (df["Owners"] > 50000) &
    (df["Review score"] > 0) &
    (df["Price"] >= 0)
].copy()

df_galaxy.to_json(output_galaxy, orient="records", force_ascii=False)
print(f"Game Galaxy 可用数据: {len(df_galaxy)} 款游戏 (热门游戏)")