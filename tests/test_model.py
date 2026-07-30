import math
import unittest

from huff_model.model import DemandPoint, HuffModel, Store, euclidean_distance, haversine_distance


class DistanceTests(unittest.TestCase):
    def test_euclidean_distance(self):
        self.assertAlmostEqual(euclidean_distance(0, 0, 3, 4), 5.0)

    def test_haversine_distance_same_point_is_zero(self):
        self.assertAlmostEqual(haversine_distance(35.0, 139.0, 35.0, 139.0), 0.0)

    def test_haversine_distance_known_value(self):
        # 東京駅 (35.681, 139.767) と 新大阪駅 (34.734, 135.500) の概算距離は約400km
        d = haversine_distance(35.681, 139.767, 34.734, 135.500)
        self.assertAlmostEqual(d, 400, delta=20)


class HuffModelTests(unittest.TestCase):
    def test_requires_at_least_one_store(self):
        with self.assertRaises(ValueError):
            HuffModel([])

    def test_rejects_unknown_coordinate_system(self):
        with self.assertRaises(ValueError):
            HuffModel([Store("A", 0, 0, 100)], coordinate_system="polar")

    def test_single_store_gets_full_probability(self):
        model = HuffModel([Store("A", 0, 0, 100)])
        point = DemandPoint("P1", 5, 5)
        probs = model.probabilities(point)
        self.assertAlmostEqual(probs["A"], 1.0)

    def test_equal_size_equal_distance_splits_evenly(self):
        stores = [Store("A", -10, 0, 1000), Store("B", 10, 0, 1000)]
        model = HuffModel(stores)
        point = DemandPoint("P1", 0, 0)
        probs = model.probabilities(point)
        self.assertAlmostEqual(probs["A"], 0.5)
        self.assertAlmostEqual(probs["B"], 0.5)

    def test_larger_store_has_higher_probability_at_equal_distance(self):
        stores = [Store("Small", -10, 0, 1000), Store("Large", 10, 0, 5000)]
        model = HuffModel(stores)
        point = DemandPoint("P1", 0, 0)
        probs = model.probabilities(point)
        self.assertGreater(probs["Large"], probs["Small"])

    def test_probabilities_sum_to_one(self):
        stores = [Store("A", 0, 0, 1000), Store("B", 10, 0, 3000), Store("C", 5, 8, 1500)]
        model = HuffModel(stores)
        points = [DemandPoint("P1", 2, 2), DemandPoint("P2", 8, 3), DemandPoint("P3", 4, 9)]
        for point in points:
            total = sum(model.probabilities(point).values())
            self.assertAlmostEqual(total, 1.0)

    def test_closer_store_wins_as_beta_increases(self):
        stores = [Store("Near", 1, 0, 1000), Store("Far", 100, 0, 1000)]
        point = DemandPoint("P1", 0, 0)
        low_beta_prob = HuffModel(stores, beta=0.1).probabilities(point)["Near"]
        high_beta_prob = HuffModel(stores, beta=5).probabilities(point)["Near"]
        self.assertGreater(high_beta_prob, low_beta_prob)

    def test_estimated_sales_matches_manual_calculation(self):
        stores = [Store("A", -10, 0, 1000), Store("B", 10, 0, 1000)]
        model = HuffModel(stores)
        point = DemandPoint("P1", 0, 0, population=1000, spending_per_capita=2000)
        sales, trade_area_population = model.estimated_sales([point])

        self.assertAlmostEqual(trade_area_population["A"], 500)
        self.assertAlmostEqual(trade_area_population["B"], 500)
        self.assertAlmostEqual(sales["A"], 500 * 2000)
        self.assertAlmostEqual(sales["B"], 500 * 2000)

    def test_estimated_sales_totals_match_total_spending(self):
        stores = [Store("A", 0, 0, 1000), Store("B", 10, 0, 3000), Store("C", 5, 8, 1500)]
        model = HuffModel(stores)
        points = [
            DemandPoint("P1", 2, 2, population=5000, spending_per_capita=3000),
            DemandPoint("P2", 8, 3, population=3000, spending_per_capita=3200),
        ]
        sales, _ = model.estimated_sales(points)
        expected_total = sum(p.population * p.spending_per_capita for p in points)
        self.assertAlmostEqual(sum(sales.values()), expected_total)


if __name__ == "__main__":
    unittest.main()
