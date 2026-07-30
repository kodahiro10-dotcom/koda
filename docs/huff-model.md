# ハフモデル（Huff Model）ツール

## 概要

ハフモデルは、消費者がどの店舗を利用するかを「店舗の規模（魅力度）」と
「店舗までの距離」から確率的に推定する、小売の商圏分析で広く使われる
重力モデルです（Huff, D. L. (1963) "A Probabilistic Analysis of Shopping
Center Trade Areas"）。

```
P_ij = (S_j^α / D_ij^β) / Σ_k (S_k^α / D_ik^β)
```

- `P_ij` : 需要地点 i の消費者が店舗 j を選択する確率
- `S_j`  : 店舗 j の規模・魅力度（売場面積など）
- `D_ij` : 需要地点 i から店舗 j までの距離（または移動時間）
- `α`    : 規模に対するべき指数（既定値 1。大きいほど規模の差が効く）
- `β`    : 距離抵抗係数（既定値 2。大きいほど近い店舗が有利になる）

`huff_model/` パッケージはこの計算をPythonで行い、各店舗の推定商圏人口・
推定売上（人口 × 選択確率 × 一人当たり購買力）も算出します。

## ディレクトリ構成

```
huff_model/
  model.py   # Store / DemandPoint / HuffModel 本体
  cli.py     # CSV入出力に対応したCLI
examples/
  stores.csv          # 店舗データのサンプル
  demand_points.csv   # 需要地点データのサンプル
tests/
  test_model.py        # ユニットテスト
```

## 入力データ形式

### 店舗CSV（`--stores`）

| 列   | 内容                         |
|------|------------------------------|
| name | 店舗名                       |
| x    | X座標（または経度）           |
| y    | Y座標（または緯度）           |
| size | 規模・魅力度（売場面積など）   |

### 需要地点CSV（`--demand-points`）

| 列                    | 内容                                     |
|-----------------------|------------------------------------------|
| name                  | 地点名（地区・メッシュ等）               |
| x                     | X座標（または経度）                       |
| y                     | Y座標（または緯度）                       |
| population            | 人口・世帯数（推定売上算出に使用、省略可） |
| spending_per_capita   | 一人当たり購買力（省略可）                 |

座標は「平面直角座標系やUTM座標系などの平面座標（km等）」または
「緯度経度（度）」のどちらでも利用できます。緯度経度を使う場合は
`--coordinate-system latlon` を指定してください（大円距離をkmで計算します）。

## 使い方

```bash
# ライブラリのある場所（リポジトリのルート）から実行
python3 -m huff_model.cli \
  --stores examples/stores.csv \
  --demand-points examples/demand_points.csv
```

出力例（CSV、標準出力）:

```
demand_point,StoreA,StoreB,StoreC
Area1,0.6174,0.2179,0.1646
Area2,0.0475,0.7997,0.1529
Area3,0.0131,0.0326,0.9543

store,estimated_trade_area_population,estimated_sales
StoreA,3282.04,9864105.73
StoreB,3619.05,11310857.39
StoreC,5098.91,14625036.88
```

### 主なオプション

| オプション              | 説明                                             | 既定値       |
|--------------------------|--------------------------------------------------|--------------|
| `--alpha`                | 規模（魅力度）のべき指数                          | `1.0`        |
| `--beta`                 | 距離抵抗係数                                      | `2.0`        |
| `--coordinate-system`    | `cartesian`（平面座標）または `latlon`（緯度経度）| `cartesian`  |
| `--output`               | 結果CSVの出力先ファイルパス（省略時は標準出力）   | 標準出力     |

### Pythonから直接使う場合

```python
from huff_model import DemandPoint, HuffModel, Store

stores = [
    Store("StoreA", x=0, y=0, size=1000),
    Store("StoreB", x=10, y=0, size=3000),
]
model = HuffModel(stores, alpha=1.0, beta=2.0)

point = DemandPoint("Area1", x=2, y=2, population=5000, spending_per_capita=3000)
print(model.probabilities(point))  # {'StoreA': 0.xxx, 'StoreB': 0.xxx}

sales, trade_area_population = model.estimated_sales([point])
```

## パラメータの考え方（α・β）

- `α`（規模指数）: 店舗規模の差が来店確率にどれだけ効くかを調整します。実務では
  過去の実績データ（既存店の売上・来店客数）に回帰分析でフィットさせて
  キャリブレーションすることが一般的です。
- `β`（距離抵抗係数）: 業態によって目安が異なり、最寄品（コンビニ・スーパー等）
  ほど値を大きく（近い店舗が有利）、買回品（家電量販店・アウトレット等）
  ほど値を小さくする傾向があります。既定値の `2` は一般的な出発点です。

## テストの実行

```bash
python3 -m unittest discover -v
```
