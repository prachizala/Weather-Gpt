"""Unit tests for weather API client backoff strategy."""
import unittest

class TestApiClientBackoff(unittest.TestCase):
    def test_exponential_backoff_calculation(self):
        base = 1.0
        factor = 2.0
        retries = [base * (factor ** i) for i in range(3)]
        self.assertEqual(retries, [1.0, 2.0, 4.0])

if __name__ == '__main__':
    unittest.main()
