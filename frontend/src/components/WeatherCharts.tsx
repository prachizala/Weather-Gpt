import React from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend
} from 'recharts';
import { ForecastData } from '../types/api';

interface WeatherChartsProps {
  forecast: ForecastData | null;
  units: 'celsius' | 'fahrenheit';
  isLoading: boolean;
}

export const WeatherCharts: React.FC<WeatherChartsProps> = ({ forecast, units, isLoading }) => {
  if (isLoading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginBottom: '24px' }}>
        <div className="skeleton" style={{ height: '240px', borderRadius: '16px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} />
        <div className="skeleton" style={{ height: '240px', borderRadius: '16px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} />
      </div>
    );
  }

  if (!forecast || !forecast.hourly || forecast.hourly.length === 0) {
    return null;
  }

  const tempSymbol = units === 'celsius' ? '°C' : '°F';

  // Prepare hourly data (next 24 hours)
  const hourlyData = forecast.hourly.slice(0, 24).map((pt) => {
    const timeStr = pt.timestamp.includes('T') ? pt.timestamp.split('T')[1].substring(0, 5) : pt.timestamp;
    return {
      time: timeStr,
      temp: parseFloat(pt.temperature.toFixed(1)),
      apparent: pt.apparent_temperature !== undefined ? parseFloat(pt.apparent_temperature.toFixed(1)) : undefined,
      precipProb: pt.precipitation_probability ?? 0,
      precip: pt.precipitation ?? 0
    };
  });

  // Prepare daily high/low data
  const dailyData = forecast.daily.slice(0, 7).map((d) => {
    const dayLabel = d.date.substring(5); // MM-DD
    return {
      day: dayLabel,
      max: parseFloat(d.temperature_max.toFixed(1)),
      min: parseFloat(d.temperature_min.toFixed(1)),
      precip: d.precipitation_sum ?? 0
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
      {/* 24-Hour Temperature & Apparent Temperature Chart */}
      <div
        style={{
          padding: '20px',
          backgroundColor: 'var(--surface)',
          borderRadius: '16px',
          border: '1px solid var(--border)',
        }}
      >
        <h4 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px', color: 'var(--text)' }}>
          24-Hour Hourly Temperature Curve ({tempSymbol})
        </h4>
        <div style={{ height: '240px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.6}/>
                  <stop offset="95%" stopColor="#38BDF8" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2A44" />
              <XAxis dataKey="time" stroke="#8FA3BF" fontSize={11} />
              <YAxis stroke="#8FA3BF" fontSize={11} domain={['dataMin - 2', 'dataMax + 2']} />
              <Tooltip
                contentStyle={{ backgroundColor: '#111B2E', borderColor: '#1E2A44', borderRadius: '8px', color: '#E5EDF7' }}
                formatter={(val: any) => [`${val}${tempSymbol}`]}
              />
              <Legend verticalAlign="top" height={36} />
              <Area type="monotone" dataKey="temp" name="Temperature" stroke="#38BDF8" fillOpacity={1} fill="url(#tempGradient)" strokeWidth={2} />
              <Area type="monotone" dataKey="apparent" name="Feels Like" stroke="#8FA3BF" fillOpacity={0} strokeWidth={1.5} strokeDasharray="3 3" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 7-Day High / Low & Precipitation Bar Chart */}
      <div
        style={{
          padding: '20px',
          backgroundColor: 'var(--surface)',
          borderRadius: '16px',
          border: '1px solid var(--border)',
        }}
      >
        <h4 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px', color: 'var(--text)' }}>
          7-Day Temperature Range & Precipitation (mm)
        </h4>
        <div style={{ height: '240px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2A44" />
              <XAxis dataKey="day" stroke="#8FA3BF" fontSize={11} />
              <YAxis stroke="#8FA3BF" fontSize={11} />
              <Tooltip
                contentStyle={{ backgroundColor: '#111B2E', borderColor: '#1E2A44', borderRadius: '8px', color: '#E5EDF7' }}
              />
              <Legend verticalAlign="top" height={36} />
              <Bar dataKey="max" name={`Max (${tempSymbol})`} fill="#38BDF8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="min" name={`Min (${tempSymbol})`} fill="#8FA3BF" radius={[4, 4, 0, 0]} />
              <Bar dataKey="precip" name="Rain (mm)" fill="#34D399" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
