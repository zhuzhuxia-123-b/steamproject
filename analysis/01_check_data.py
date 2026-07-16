import pandas as pd
import os


# =========================
# 1. 读取数据
# =========================

file_path = r"D:\python\project\data\steam.csv"

df = pd.read_csv(file_path)


# =========================
# 2. 基础信息
# =========================

print("=" * 50)
print("数据规模")
print("=" * 50)

print("游戏数量:", df.shape[0])
print("字段数量:", df.shape[1])


print("\n字段列表:")
for col in df.columns:
    print(col)


# =========================
# 3. 数据类型
# =========================

print("\n数据类型:")
print(df.info())


# =========================
# 4. 缺失值统计
# =========================

print("\n缺失值:")
missing = df.isnull().sum()

print(
    missing[missing > 0]
    .sort_values(ascending=False)
)


# =========================
# 5. 查看前5条数据
# =========================

print("\n前5条数据:")
print(df.head())


# =========================
# 6. 核心字段检查
# =========================

important_columns = [
    "Name",
    "Release date",
    "Price",
    "Estimated owners",
    "Peak CCU",
    "Positive",
    "Negative",
    "Average playtime forever",
    "Developers",
    "Genres",
    "Tags"
]


print("\n核心字段检查:")

for col in important_columns:

    if col in df.columns:
        print(
            "✓",
            col,
            "存在"
        )
    else:
        print(
            "✗",
            col,
            "缺失"
        )