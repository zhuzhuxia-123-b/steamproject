import pandas as pd
import json
import os
from collections import Counter

# =========================
# 1. 路径配置
# =========================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
input_file = os.path.join(BASE_DIR, "data", "steam_clean.json")
output_file = os.path.join(BASE_DIR, "data", "knowledge_graph.json")

# =========================
# 2. 读取数据
# =========================
df = pd.read_json(input_file)
print(f"加载数据: {len(df)} 款游戏")

# =========================
# 3. 筛选有效数据
# =========================
df_valid = df[
    (df['Tags'] != '') &
    (df['Developers'] != 'Unknown') &
    (df['Genres'] != 'Unknown') &
    (df['Name'].notna())
].copy()
print(f"知识图谱有效数据: {len(df_valid)} 款游戏")

# =========================
# 4. 热度导向采样
# =========================
TOP_CANDIDATES = 1000
SAMPLE_SIZE = 350

df_top = df_valid.nlargest(TOP_CANDIDATES, 'Owners')
print(f"从热度 Top {TOP_CANDIDATES} 款游戏中抽取...")

if len(df_top) > SAMPLE_SIZE:
    df_sample = df_top.sample(n=SAMPLE_SIZE, random_state=42)
else:
    df_sample = df_top

print(f"最终抽样游戏数: {len(df_sample)} 款")
print(f"抽取游戏的平均玩家数: {df_sample['Owners'].mean():.0f}")

# =========================
# 5. 构建四类节点
# =========================
nodes = []
node_ids = set()
node_id_map = {}

def add_node(node_id, node_name, node_type, group):
    if node_id not in node_ids:
        node_ids.add(node_id)
        node_id_map[node_id] = len(nodes)
        nodes.append({
            'id': node_id,
            'name': node_name,
            'type': node_type,
            'group': group,
            'size': 1
        })
        return True
    return False

# 5.1 游戏 (group=0)
for idx, row in df_sample.iterrows():
    add_node(f"game_{row['AppID']}", row['Name'], 'game', 0)

# 5.2 类型 (group=1) - 新增
all_genres = []
for g in df_sample['Genres']:
    if g and g != 'Unknown':
        all_genres.extend([x.strip() for x in g.split(',') if x.strip()])
genre_counter = Counter(all_genres)
for genre, count in genre_counter.items():
    if count >= 2:
        add_node(f"genre_{genre}", genre, 'genre', 1)

# 5.3 标签 (group=2)
all_tags = []
for t in df_sample['Tags']:
    if t:
        all_tags.extend([x.strip() for x in t.split(',') if x.strip()])
tag_counter = Counter(all_tags)
for tag, count in tag_counter.items():
    if count >= 3:
        add_node(f"tag_{tag}", tag, 'tag', 2)

# 5.4 开发商 (group=3)
all_devs = []
for d in df_sample['Developers']:
    if d and d != 'Unknown':
        all_devs.extend([x.strip() for x in d.split(',') if x.strip()])
dev_counter = Counter(all_devs)
for dev, count in dev_counter.items():
    if count >= 2:
        add_node(f"dev_{dev}", dev, 'developer', 3)

print(f"\n节点总数: {len(nodes)}")
print(f"  - 游戏: {len(df_sample)}")
print(f"  - 类型: {len(genre_counter)}")
print(f"  - 标签: {len(tag_counter)}")
print(f"  - 开发商: {len(dev_counter)}")

# =========================
# 6. 构建三类边
# =========================
links = []
link_set = set()

def add_link(source, target, relation):
    key = f"{source}_{target}"
    if key not in link_set:
        link_set.add(key)
        links.append({'source': source, 'target': target, 'relation': relation})

for idx, row in df_sample.iterrows():
    game_id = f"game_{row['AppID']}"
    if game_id not in node_id_map:
        continue

    # 游戏 → 类型
    if row['Genres'] and row['Genres'] != 'Unknown':
        for genre in [x.strip() for x in row['Genres'].split(',') if x.strip()]:
            gid = f"genre_{genre}"
            if gid in node_id_map:
                add_link(game_id, gid, 'belongs_to')

    # 游戏 → 标签
    if row['Tags']:
        for tag in [x.strip() for x in row['Tags'].split(',') if x.strip()]:
            tid = f"tag_{tag}"
            if tid in node_id_map:
                add_link(game_id, tid, 'has_tag')

    # 游戏 → 开发商
    if row['Developers'] and row['Developers'] != 'Unknown':
        for dev in [x.strip() for x in row['Developers'].split(',') if x.strip()]:
            did = f"dev_{dev}"
            if did in node_id_map:
                add_link(game_id, did, 'developed_by')

print(f"边总数: {len(links)}")

# =========================
# 7. 计算节点度
# =========================
degree_map = {}
for link in links:
    degree_map[link['source']] = degree_map.get(link['source'], 0) + 1
    degree_map[link['target']] = degree_map.get(link['target'], 0) + 1

for node in nodes:
    node['degree'] = degree_map.get(node['id'], 0)
    base = {'game': 5, 'genre': 8, 'tag': 6, 'developer': 10}.get(node['type'], 5)
    node['size'] = base + node['degree'] * 0.4

# =========================
# 8. 保存
# =========================
output = {
    'stats': {
        'total_nodes': len(nodes),
        'total_links': len(links),
        'game_count': len(df_sample),
        'genre_count': len(genre_counter),
        'tag_count': len(tag_counter),
        'developer_count': len(dev_counter),
    },
    'nodes': nodes,
    'links': links
}

with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"\n✓ 四层知识图谱构建完成")
print(f"  - 节点: {len(nodes)}")
print(f"  - 边: {len(links)}")
print(f"✓ 保存至: {output_file}")