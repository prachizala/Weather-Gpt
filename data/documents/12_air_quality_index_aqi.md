---
title: "The Air Quality Index (AQI): Principles and Health Categories"
publisher: "WeatherGPT Meteorological Knowledgebase"
source_url: "https://weathergpt.internal/knowledge/air-quality-index-aqi"
publication_date: "2026-01-15"
license_notes: "Project-authored educational reference; CC-BY-4.0"
---

# The Air Quality Index (AQI)

## Purpose and Mathematical Calculation
The Air Quality Index (AQI) is a standardized numerical scale designed by environmental protection agencies to communicate ambient air pollution levels and associated public health risks.

Ambient concentrations of individual criteria air pollutants—predominantly Fine Particulate Matter ($\text{PM}_{2.5}$), Coarse Particulate Matter ($\text{PM}_{10}$), Ground-Level Ozone ($\text{O}_3$), Nitrogen Dioxide ($\text{NO}_2$), Sulfur Dioxide ($\text{SO}_2$), and Carbon Monoxide ($\text{CO}$)—are converted into sub-indices using piecewise linear interpolation across calibrated concentration breakpoints:

$$I_p = \frac{I_{\text{high}} - I_{\text{low}}}{C_{\text{high}} - C_{\text{low}}} (C_p - C_{\text{low}}) + I_{\text{low}}$$

where $I_p$ is the sub-index for pollutant $p$, $C_p$ is the measured concentration, $[C_{\text{low}}, C_{\text{high}}]$ are the concentration breakpoints containing $C_p$, and $[I_{\text{low}}, I_{\text{high}}]$ are the corresponding index breakpoints. The overall reported composite AQI reflects the highest sub-index value among all evaluated pollutants (termed the "critical pollutant"):
$$\text{AQI} = \max(I_{\text{PM2.5}}, I_{\text{PM10}}, I_{\text{O3}}, I_{\text{NO2}}, I_{\text{SO2}}, I_{\text{CO}})$$

## Comparison: US EPA AQI vs. Indian National AQI (CPCB)
Different jurisdictions employ distinct breakpoints based on epidemiological assessments:

### 1. United States EPA AQI Scale (0–500)
- **Good (0–50)**: Air quality considered satisfactory; air pollution poses little or no risk.
- **Moderate (51–100)**: Acceptable quality; slight concern for very sensitive individuals.
- **Unhealthy for Sensitive Groups (101–150)**: General public not likely affected; individuals with respiratory or cardiovascular disease, older adults, and children at greater risk.
- **Unhealthy (151–200)**: Some members of the general public may experience health effects; sensitive groups may experience more serious health effects.
- **Very Unhealthy (201–300)**: Health alert; risk of health effects increased for everyone.
- **Hazardous (301–500)**: Health warnings of emergency conditions; entire population likely affected.

### 2. India National Air Quality Index (CPCB NAQI: 0–500)
Operated by the Central Pollution Control Board (CPCB), the Indian NAQI evaluates 8 pollutants ($\text{PM}_{2.5}, \text{PM}_{10}, \text{NO}_2, \text{SO}_2, \text{CO}, \text{O}_3, \text{NH}_3, \text{Pb}$):
- **Good (0–50)**: Minimal health impact.
- **Satisfactory (51–100)**: Minor breathing discomfort to sensitive people.
- **Moderate (101–200)**: Breathing discomfort to people with lungs, asthma, and heart diseases.
- **Poor (201–300)**: Breathing discomfort to most people on prolonged exposure.
- **Very Poor (301–400)**: Respiratory illness on prolonged exposure.
- **Severe (401–500)**: Affects healthy people and seriously impacts those with existing diseases.
