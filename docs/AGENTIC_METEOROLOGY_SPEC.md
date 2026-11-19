# Agentic Tool-Use Meteorological Schema

## Function Calling Definitions
- `get_current_weather(latitude: float, longitude: float) -> WeatherReport`
- `get_precipitation_forecast(hours: int = 24) -> PrecipitationGrid`
- `get_severe_weather_alerts(region_code: str) -> List[Alert]`

## Telemetry Invariants
All API payloads must adhere to ISO 8601 UTC timestamps and WGS 84 geographic coordinates.
