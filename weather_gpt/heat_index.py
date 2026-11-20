"""Biometeorology Steadman apparent temperature and heat exhaustion danger evaluator."""


class HeatIndexCalculator:
    """Calculates apparent temperature based on temperature in Celsius and relative humidity."""

    @staticmethod
    def calculate_heat_index(temp_c: float, humidity_pct: float) -> float:
        """Computes approximate Steadman formula heat index in degrees Celsius."""
        if temp_c < 27.0 or humidity_pct < 40.0:
            return temp_c

        t = (temp_c * 9.0 / 5.0) + 32.0
        r = humidity_pct
        hi_f = (
            -42.379
            + 2.04901523 * t
            + 10.14333127 * r
            - 0.22475541 * t * r
            - 0.00683783 * (t**2)
            - 0.05481717 * (r**2)
            + 0.00122874 * (t**2) * r
            + 0.00085282 * t * (r**2)
            - 0.00000199 * (t**2) * (r**2)
        )
        hi_c = (hi_f - 32.0) * 5.0 / 9.0
        return round(hi_c, 1)

    @staticmethod
    def get_danger_classification(heat_index_c: float) -> str:
        """Classifies physiological heat stress level."""
        if heat_index_c >= 54.0:
            return "EXTREME_DANGER"
        if heat_index_c >= 41.0:
            return "DANGER"
        if heat_index_c >= 32.0:
            return "EXTREME_CAUTION"
        return "NORMAL"
