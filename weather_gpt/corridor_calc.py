"""Micro-climate highway travel corridor distance and atmospheric visibility evaluator."""

import math


class CorridorWaypointCalculator:
    """Calculates highway travel waypoint progression and visibility hazard alerts."""

    EARTH_RADIUS_KM = 6371.0

    @classmethod
    def calculate_haversine_distance(cls, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Computes great-circle distance between consecutive highway waypoints."""
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return round(cls.EARTH_RADIUS_KM * c, 2)

    @staticmethod
    def evaluate_visibility_safety(visibility_meters: float, precipitation_mm: float) -> str:
        """Determines highway advisory rating: OPTIMAL, CAUTION, or HAZARDOUS."""
        if visibility_meters < 500 or precipitation_mm > 25.0:
            return "HAZARDOUS"
        if visibility_meters < 2000 or precipitation_mm > 5.0:
            return "CAUTION"
        return "OPTIMAL"
