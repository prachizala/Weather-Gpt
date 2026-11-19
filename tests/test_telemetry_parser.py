"""Unit tests for meteorological data parsing."""
import unittest

class TestMeteorologicalParser(unittest.TestCase):
    def test_celsius_to_fahrenheit(self):
        celsius = 25.0
        fahrenheit = (celsius * 9/5) + 32
        self.assertEqual(fahrenheit, 77.0)

    def test_wind_speed_knots_to_kmh(self):
        knots = 10.0
        kmh = knots * 1.852
        self.assertEqual(kmh, 18.52)

if __name__ == '__main__':
    unittest.main()
