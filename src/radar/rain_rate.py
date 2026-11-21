"""
Doppler Radar Reflectivity to Rainfall Rate Converter
Applies empirical Marshall-Palmer Z = a * R^b formula to derive precipitation rates from radar dBZ.
"""
import math
from typing import Dict, Any

class RadarRainRateConverter:
    # Standard Marshall-Palmer constants for stratiform precipitation: a = 200, b = 1.6
    def __init__(self, a: float = 200.0, b: float = 1.6):
        self.a = a
        self.b = b

    def dbz_to_rain_rate_mm_hr(self, dbz: float) -> float:
        if dbz <= 0:
            return 0.0
        # Convert dBZ to linear reflectivity factor Z (mm^6 / m^3)
        z = 10.0 ** (dbz / 10.0)
        # R = (Z / a) ^ (1 / b)
        rain_rate = (z / self.a) ** (1.0 / self.b)
        return round(rain_rate, 2)

    def categorize_intensity(self, rain_rate_mm_hr: float) -> str:
        if rain_rate_mm_hr < 0.25:
            return "TRACE"
        elif rain_rate_mm_hr < 2.5:
            return "LIGHT"
        elif rain_rate_mm_hr < 7.6:
            return "MODERATE"
        elif rain_rate_mm_hr < 50.0:
            return "HEAVY"
        return "VIOLENT_TORRENTIAL"

if __name__ == "__main__":
    conv = RadarRainRateConverter()
    r = conv.dbz_to_rain_rate_mm_hr(35.0)
    assert r > 2.0
    cat = conv.categorize_intensity(r)
    assert cat in ["LIGHT", "MODERATE", "HEAVY"]
    print("Radar rain rate converter unit tests passed!")
