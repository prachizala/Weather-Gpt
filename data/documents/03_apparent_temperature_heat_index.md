---
title: "Apparent Temperature, Heat Index, and Thermal Stress"
publisher: "WeatherGPT Meteorological Knowledgebase"
source_url: "https://weathergpt.internal/knowledge/apparent-temperature-heat-index"
publication_date: "2026-01-15"
license_notes: "Project-authored educational reference; CC-BY-4.0"
---

# Apparent Temperature and the Heat Index

## Human Thermoregulation and Evaporative Cooling
The human body continuously generates metabolic heat, maintaining a core temperature near 37.0°C (98.6°F). To prevent fatal hyperthermia in warm environments, the body relies predominantly on perspiration. As sweat evaporates from the skin surface, it absorbs the latent heat of vaporization (approx. 2.43 kJ per gram of water), cooling the cutaneous capillaries. 

When relative humidity is elevated, the ambient vapor pressure gradient between the wet skin surface and the surrounding air diminishes significantly. This impedes the rate of sweat evaporation, causing sweat to accumulate as liquid rather than evaporating, thereby trapping metabolic heat within the body.

## The Steadman Heat Index Formulation
Apparent temperature measures what atmospheric conditions feel like to the human body by combining dry-bulb air temperature with relative humidity. The widely adopted National Weather Service (NWS) Heat Index is derived from biometeorological work by Robert G. Steadman (1979). It models a human walking in light shade at 1.4 m/s in calm air:

$$\text{HI} = c_1 + c_2 T + c_3 R + c_4 T R + c_5 T^2 + c_6 R^2 + c_7 T^2 R + c_8 T R^2 + c_9 T^2 R^2$$

where $T$ represents ambient temperature in degrees Fahrenheit, $R$ is relative humidity percentage, and $c_1$ through $c_9$ are empirical regression coefficients.

## NOAA / NWS Risk Categories
The Heat Index defines operational risk thresholds under shaded conditions:
1. **Caution** (HI 27°C–32°C / 80°F–90°F): Fatigue possible with prolonged physical exposure and activity.
2. **Extreme Caution** (HI 32°C–39°C / 90°F–103°F): Heat cramps and heat exhaustion possible with sustained physical exertion.
3. **Danger** (HI 39°C–51°C / 103°F–124°F): Heat exhaustion likely; heat stroke imminent with prolonged outdoor activity.
4. **Extreme Danger** (HI $\ge$ 51°C / 125°F+): Heat stroke highly probable with continued exposure; critical threat to life.

*Direct exposure to strong sunlight can augment Heat Index values by up to 8°C (15°F).*
