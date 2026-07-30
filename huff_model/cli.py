"""ハフモデルCLI。

使い方:
    python -m huff_model.cli --stores examples/stores.csv \
        --demand-points examples/demand_points.csv
"""
from __future__ import annotations

import argparse
import csv
import sys
from typing import IO

from .model import DemandPoint, HuffModel, Store


def read_stores(path: str) -> list[Store]:
    with open(path, newline="", encoding="utf-8") as f:
        return [
            Store(row["name"], float(row["x"]), float(row["y"]), float(row["size"]))
            for row in csv.DictReader(f)
        ]


def read_demand_points(path: str) -> list[DemandPoint]:
    with open(path, newline="", encoding="utf-8") as f:
        return [
            DemandPoint(
                row["name"],
                float(row["x"]),
                float(row["y"]),
                float(row.get("population") or 0),
                float(row.get("spending_per_capita") or 0),
            )
            for row in csv.DictReader(f)
        ]


def write_report(
    out: IO[str],
    model: HuffModel,
    demand_points: list[DemandPoint],
) -> None:
    prob_table = model.probability_table(demand_points)
    sales, trade_area_population = model.estimated_sales(demand_points)

    writer = csv.writer(out)
    writer.writerow(["demand_point"] + [store.name for store in model.stores])
    for point in demand_points:
        probs = prob_table[point.name]
        writer.writerow([point.name] + [f"{probs[store.name]:.4f}" for store in model.stores])

    writer.writerow([])
    writer.writerow(["store", "estimated_trade_area_population", "estimated_sales"])
    for store in model.stores:
        writer.writerow(
            [store.name, f"{trade_area_population[store.name]:.2f}", f"{sales[store.name]:.2f}"]
        )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="ハフモデルによる来店確率・商圏推定")
    parser.add_argument("--stores", required=True, help="店舗CSV (列: name,x,y,size)")
    parser.add_argument(
        "--demand-points",
        required=True,
        help="需要地点CSV (列: name,x,y,population,spending_per_capita)",
    )
    parser.add_argument("--alpha", type=float, default=1.0, help="規模のべき指数（既定値: 1.0）")
    parser.add_argument("--beta", type=float, default=2.0, help="距離抵抗係数（既定値: 2.0）")
    parser.add_argument(
        "--coordinate-system",
        choices=["cartesian", "latlon"],
        default="cartesian",
        help="cartesian: 平面座標(km等) / latlon: 緯度経度(度)",
    )
    parser.add_argument("--output", help="結果CSVの出力先（省略時は標準出力）")
    return parser


def main(argv: list[str] | None = None) -> None:
    args = build_parser().parse_args(argv)

    stores = read_stores(args.stores)
    demand_points = read_demand_points(args.demand_points)
    model = HuffModel(
        stores,
        alpha=args.alpha,
        beta=args.beta,
        coordinate_system=args.coordinate_system,
    )

    if args.output:
        with open(args.output, "w", newline="", encoding="utf-8") as out:
            write_report(out, model, demand_points)
    else:
        write_report(sys.stdout, model, demand_points)


if __name__ == "__main__":
    main()
