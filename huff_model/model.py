"""Huff Model (ハフモデル) の計算ロジック。

Huff, D. L. (1963) "A Probabilistic Analysis of Shopping Center Trade
Areas" で提案された、消費者がある店舗を選択する確率を
「店舗の規模（魅力度）」と「店舗までの距離」から推定する重力モデル。

    P_ij = (S_j^alpha / D_ij^beta) / sum_k (S_k^alpha / D_ik^beta)

    P_ij   : 需要地点 i の消費者が店舗 j を選択する確率
    S_j    : 店舗 j の規模（売場面積など、魅力度の代理指標）
    D_ij   : 需要地点 i から店舗 j までの距離（または時間）
    alpha  : 規模（魅力度）に対するべき指数（既定値 1）
    beta   : 距離抵抗係数（既定値 2、値が大きいほど近い店が有利になる）
"""
from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass
class Store:
    """店舗（供給地点）。"""

    name: str
    x: float  # 経度 または 平面座標のX
    y: float  # 緯度 または 平面座標のY
    size: float  # 規模・魅力度（売場面積など）


@dataclass
class DemandPoint:
    """需要地点（居住地区・メッシュなど）。"""

    name: str
    x: float
    y: float
    population: float = 0.0
    spending_per_capita: float = 0.0  # 一人当たりの購買力（推定売上算出用）


def euclidean_distance(x1: float, y1: float, x2: float, y2: float) -> float:
    """平面座標間のユークリッド距離。"""
    return math.hypot(x2 - x1, y2 - y1)


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """緯度経度（度）から大円距離（km）を求める。"""
    earth_radius_km = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * earth_radius_km * math.asin(math.sqrt(a))


_DISTANCE_FUNCS = {
    "cartesian": lambda px, py, sx, sy: euclidean_distance(px, py, sx, sy),
    "latlon": lambda px, py, sx, sy: haversine_distance(px, py, sx, sy),
}


class HuffModel:
    """ハフモデルによる来店確率・商圏推定。"""

    def __init__(
        self,
        stores: list[Store],
        alpha: float = 1.0,
        beta: float = 2.0,
        coordinate_system: str = "cartesian",
        min_distance: float = 0.01,
    ) -> None:
        if not stores:
            raise ValueError("stores must contain at least one Store")
        if coordinate_system not in _DISTANCE_FUNCS:
            raise ValueError(
                f"unknown coordinate_system: {coordinate_system!r} "
                f"(expected one of {sorted(_DISTANCE_FUNCS)})"
            )
        self.stores = list(stores)
        self.alpha = alpha
        self.beta = beta
        self.coordinate_system = coordinate_system
        # 需要地点と店舗が同一座標になり距離が0になるとゼロ除算になるため下限を設ける
        self.min_distance = min_distance
        self._distance_fn = _DISTANCE_FUNCS[coordinate_system]

    def distance(self, point: DemandPoint, store: Store) -> float:
        raw = self._distance_fn(point.x, point.y, store.x, store.y)
        return max(raw, self.min_distance)

    def probabilities(self, point: DemandPoint) -> dict[str, float]:
        """需要地点1つについて、各店舗を選択する確率を返す。"""
        scores = {
            store.name: (store.size**self.alpha) / (self.distance(point, store) ** self.beta)
            for store in self.stores
        }
        total = sum(scores.values())
        if total == 0:
            n = len(scores)
            return {name: 1.0 / n for name in scores}
        return {name: score / total for name, score in scores.items()}

    def probability_table(self, demand_points: list[DemandPoint]) -> dict[str, dict[str, float]]:
        """需要地点ごとの選択確率をまとめて返す。"""
        return {point.name: self.probabilities(point) for point in demand_points}

    def estimated_sales(
        self, demand_points: list[DemandPoint]
    ) -> tuple[dict[str, float], dict[str, float]]:
        """各店舗の推定商圏人口と推定売上を返す。

        Returns:
            (estimated_sales, trade_area_population) のタプル。
            それぞれ店舗名をキーとする辞書。
        """
        sales = {store.name: 0.0 for store in self.stores}
        trade_area_population = {store.name: 0.0 for store in self.stores}
        for point in demand_points:
            for store_name, probability in self.probabilities(point).items():
                customers = probability * point.population
                trade_area_population[store_name] += customers
                sales[store_name] += customers * point.spending_per_capita
        return sales, trade_area_population
