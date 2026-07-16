import pandas as pd
import numpy as np
import json
import os
import warnings
from scipy.sparse import csr_matrix, hstack
from sklearn.preprocessing import StandardScaler
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.decomposition import PCA

warnings.filterwarnings('ignore')

# =========================
# 1. 路径配置
# =========================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
input_file = os.path.join(BASE_DIR, "data", "steam_clean.json")
output_file = os.path.join(BASE_DIR, "data", "galaxy_coords.json")

# =========================
# 2. 读取数据
# =========================
df = pd.read_json(input_file)
print(f"加载数据: {len(df)} 款游戏")

# =========================
# 3. 筛选有效数据 + 控制样本量
# =========================
print("\n筛选有效游戏...")
df_valid = df[
    (df['Tags'] != '') &
    (df['Owners'] > 0) &
    (df['Review score'] > 0) &
    (df['Price'] >= 0)
].copy()

print(f"有效游戏: {len(df_valid)} 款")

SAMPLE_SIZE = 15000
df_sample = df_valid.nlargest(SAMPLE_SIZE, 'Owners')
print(f"取热度 Top {SAMPLE_SIZE} 款游戏（占有效数据的 {SAMPLE_SIZE/len(df_valid)*100:.1f}%）")

# =========================
# 4. 构造标签特征
# =========================
print("\n构造标签特征矩阵...")
vectorizer = CountVectorizer(
    token_pattern=r'[^,]+',
    max_features=500,
    min_df=5,
    lowercase=False,
    strip_accents='unicode'
)

tag_matrix = vectorizer.fit_transform(df_sample['Tags'])
top_tags = vectorizer.get_feature_names_out().tolist()
print(f"标签特征维度: {tag_matrix.shape[1]} 个（已过滤低频标签）")
print(f"Top 10 标签: {top_tags[:10]}")

# =========================
# 5. 构造数值特征
# =========================
print("\n构造数值特征...")
df_sample['log_owners'] = np.log1p(df_sample['Owners'])
df_sample['log_ccu'] = np.log1p(df_sample['Peak CCU'])
df_sample['log_playtime'] = np.log1p(df_sample['Average playtime forever'])
df_sample['log_price'] = np.log1p(df_sample['Price'] + 1)

numeric_cols = ['log_owners', 'log_ccu', 'Review score', 'log_playtime', 'log_price']
numeric_features = df_sample[numeric_cols].values

scaler = StandardScaler()
numeric_scaled = scaler.fit_transform(numeric_features)
print(f"数值特征维度: {numeric_scaled.shape[1]} 个")

# =========================
# 6. 合并特征矩阵
# =========================
print("\n合并特征矩阵...")
numeric_sparse = csr_matrix(numeric_scaled)
X_combined = hstack([tag_matrix, numeric_sparse])
print(f"总特征维度: {X_combined.shape[1]}")

# =========================
# 7. 降维
# =========================
print("\n开始降维...")
method = ""

try:
    import umap
    print("使用 UMAP 降维 (n_neighbors=30, min_dist=0.3)...")
    reducer = umap.UMAP(
        n_components=2,
        n_neighbors=30,
        min_dist=0.3,
        metric='cosine',
        random_state=42,
        verbose=True
    )
    coords = reducer.fit_transform(X_combined)
    method = "UMAP"
    print("\nUMAP 降维完成")

except ImportError:
    print("UMAP 未安装，回退到 PCA 降维...")
    reducer = PCA(n_components=2, svd_solver='auto')
    coords = reducer.fit_transform(X_combined.toarray())
    method = "PCA"
    print(f"PCA 降维完成，解释方差比: {reducer.explained_variance_ratio_}")

except Exception as e:
    print(f"UMAP 运行失败 ({e})，回退到 PCA 降维...")
    reducer = PCA(n_components=2, svd_solver='auto')
    coords = reducer.fit_transform(X_combined.toarray())
    method = "PCA"
    print(f"PCA 降维完成，解释方差比: {reducer.explained_variance_ratio_}")

# =========================
# 8. 构建输出数据（修复索引越界问题）
# =========================
print("\n构建输出数据...")

gvi_col = 'GVI_score' if 'GVI_score' in df_sample.columns else 'GVI'
if gvi_col not in df_sample.columns:
    df_sample['GVI_score'] = 50.0

result = []

# ★★★ 核心修复：使用 enumerate 获取位置序号 i，而不是原始索引 idx ★★★
for i, (idx, row) in enumerate(df_sample.iterrows()):
    result.append({
        'appid': int(row['AppID']),
        'name': row['Name'],
        'x': float(coords[i][0]),   # 使用 i 访问坐标数组
        'y': float(coords[i][1]),   # 使用 i 访问坐标数组
        'price': float(row['Price']),
        'score': float(row['Review score']),
        'owners': float(row['Owners']),
        'gvi': float(row['GVI_score']),
        'genres': row['Genres'],
        'tags': row['Tags'],
        'developer': row['Developers'],
        'release_year': int(row['Release year']),
        'positive': int(row['Positive']),
        'negative': int(row['Negative']),
        'playtime': int(row['Average playtime forever'])
    })

# =========================
# 9. 保存
# =========================
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump({
        'method': method,
        'total_games': len(result),
        'sample_size': SAMPLE_SIZE,
        'top_tags': top_tags[:20],
        'games': result
    }, f, ensure_ascii=False, indent=2)

print(f"\n✓ 游戏银河数据构建完成")
print(f"  - 降维方法: {method}")
print(f"  - 游戏数量: {len(result)}")
print(f"  - 标签维度: {len(top_tags)}")
print(f"✓ 保存至: {output_file}")