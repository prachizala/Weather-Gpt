export interface Coordinates {
  latitude: number;
  longitude: number;
  elevation?: number;
}

export interface Location {
  name: string;
  country?: string;
  country_code?: string;
  admin1?: string;
  coordinates: Coordinates;
  timezone?: string;
  provider: string;
  retrieved_at: string;
  units: Record<string, string>;
}

export interface WeatherSnapshot {
  temperature: number;
  apparent_temperature?: number;
  relative_humidity?: number;
  precipitation?: number;
  weather_code?: number;
  cloud_cover?: number;
  surface_pressure?: number;
  wind_speed?: number;
  wind_direction?: number;
  is_day?: number;
  coordinates: Coordinates;
  timestamp: string;
  provider: string;
  retrieved_at: string;
  timezone: string;
  units: Record<string, string>;
}

export interface DailyForecast {
  date: string;
  temperature_max: number;
  temperature_min: number;
  apparent_temperature_max?: number;
  apparent_temperature_min?: number;
  precipitation_sum?: number;
  precipitation_probability_max?: number;
  weather_code?: number;
  wind_speed_max?: number;
  sunrise?: string;
  sunset?: string;
  units: Record<string, string>;
  provider: string;
  retrieved_at: string;
  coordinates: Coordinates;
  timezone: string;
}

export interface ForecastPoint {
  timestamp: string;
  temperature: number;
  apparent_temperature?: number;
  precipitation_probability?: number;
  precipitation?: number;
  weather_code?: number;
  wind_speed?: number;
  wind_direction?: number;
  coordinates: Coordinates;
  provider: string;
  retrieved_at: string;
  timezone: string;
  units: Record<string, string>;
}

export interface ForecastData {
  daily: DailyForecast[];
  hourly: ForecastPoint[];
}

export interface AirQuality {
  timestamp: string;
  aqi?: number;
  us_aqi?: number;
  pm2_5?: number;
  pm10?: number;
  ozone?: number;
  nitrogen_dioxide?: number;
  sulphur_dioxide?: number;
  carbon_monoxide?: number;
  uv_index?: number;
  coordinates: Coordinates;
  provider: string;
  retrieved_at: string;
  timezone: string;
  units: Record<string, string>;
}

export interface SourceRef {
  title: string;
  uri?: string;
  summary?: string;
  attribution?: string;
  provider: string;
}

export interface ChatResponse {
  answer: string;
  intent: string;
  location?: Location;
  valid_period?: Record<string, any>;
  weather_data?: any;
  sources: SourceRef[];
  knowledge_citations: SourceRef[];
  limitations: string[];
  conversation_id?: string;
  language: string;
  retrieved_at: string;
  latency_stages?: Record<string, number>;
}

export interface AdvisoryItem {
  rule_id: string;
  title: string;
  severity: "info" | "moderate" | "warning" | "danger";
  category: string;
  triggered_by: Record<string, any>;
  explanation: string;
}

export interface SkippedRule {
  rule_id: string;
  title: string;
  reason: string;
  missing_variables: string[];
}

export interface AdvisoriesReport {
  advisories: AdvisoryItem[];
  skipped_rules: SkippedRule[];
  disclaimer: string;
  official_alerts_link: string;
  evaluated_at: string;
  location?: Location;
}

export interface YearComparisonRow {
  year: number;
  period_start: string;
  period_end: string;
  total_precipitation: number;
  mean_daily_precipitation: number;
  max_daily_precipitation: number;
  rainy_days: number;
  mean_temperature?: number;
  expected_days: number;
  actual_days: number;
  missing_days: number;
  coverage_pct: number;
  dataset_type: "observation" | "reanalysis" | "forecast";
  gaps: string[];
}

export interface ComparisonChartPoint {
  year: number;
  label: string;
  total_precipitation: number;
  mean_daily_precipitation: number;
  baseline_mean_total: number;
  anomaly: number;
  coverage_pct: number;
}

export interface HistoricalComparisonResult {
  location: Location;
  target_period_description: string;
  variable: string;
  units: Record<string, string>;
  years_compared: number;
  baseline_years: number[];
  baseline_mean_total: number;
  table: YearComparisonRow[];
  chart_data: ComparisonChartPoint[];
  method_text: string;
  limitations: string[];
  dataset_disclosures: string[];
  retrieved_at: string;
}
