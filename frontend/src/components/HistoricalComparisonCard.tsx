import React, { useState, useEffect } from 'react';
import { HistoricalComparisonResult, Location } from '../types/api';
import { WeatherApiClient } from '../services/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { History, Calendar, AlertCircle, Info, RefreshCw, Database } from 'lucide-react';

interface HistoricalComparisonCardProps {
  location: Location | null;
  units: 'celsius' | 'fahrenheit';
  apiClient: WeatherApiClient;
}

export const HistoricalComparisonCard: React.FC<HistoricalComparisonCardProps> = ({
  location,
  units,
  apiClient,
}) => {
  const [data, setData] = useState<HistoricalComparisonResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Default comparison window: October 1 to October 18, 5 years back
  const [startDate, setStartDate] = useState<string>('2026-10-01');
  const [endDate, setEndDate] = useState<string>('2026-10-18');
  const [yearsBack, setYearsBack] = useState<number>(5);

  const fetchComparison = async () => {
    if (!location) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getWeatherComparison(
        location.coordinates.latitude,
        location.coordinates.longitude,
        startDate,
        endDate,
        yearsBack,
        'precipitation_sum',
        units,
        location.name
      );
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to calculate historical comparison.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (location) {
      fetchComparison();
    }
  }, [location, units]);

  if (!location) return null;

  return (
    <section aria-labelledby="history-comparison-heading" style={{ marginBottom: '32px' }}>
      <div
        style={{
          borderRadius: '16px',
          border: '1px solid var(--border)',
          backgroundColor: 'var(--surface)',
          padding: '24px',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            borderBottom: isExpanded ? '1px solid var(--border)' : 'none',
            paddingBottom: isExpanded ? '16px' : '0',
            marginBottom: isExpanded ? '20px' : '0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <History className="h-5 w-5" style={{ width: 20, height: 20, color: 'var(--primary)', flexShrink: 0 }} />
            <div>
              <h2 id="history-comparison-heading" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                Multi-Year Historical Comparison
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px', margin: 0 }}>
                Equivalent calendar window benchmark against historical ERA5 reanalysis baseline
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg)',
              border: '1px solid var(--border)',
              color: isExpanded ? 'var(--primary)' : 'var(--text)',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {isExpanded ? '▲ Hide Analysis' : '▼ Show Analysis & Run Comparison'}
          </button>
        </div>

        {/* Collapsible Content */}
        {isExpanded && (
        <div>
          {/* Controls */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', marginBottom: '16px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'var(--bg)',
                borderRadius: '8px',
                padding: '6px 12px',
                border: '1px solid var(--border)',
                fontSize: '12px',
              }}
            >
              <Calendar className="h-3.5 w-3.5" style={{ width: 14, height: 14, color: 'var(--muted)' }} />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ backgroundColor: 'transparent', color: 'var(--text)', outline: 'none', cursor: 'pointer' }}
                aria-label="Comparison start date"
              />
              <span style={{ color: 'var(--muted)' }}>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ backgroundColor: 'transparent', color: 'var(--text)', outline: 'none', cursor: 'pointer' }}
                aria-label="Comparison end date"
              />
            </div>

            <button
              onClick={fetchComparison}
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '8px',
                backgroundColor: 'var(--primary)',
                color: '#0B1220',
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: 600,
                opacity: loading ? 0.6 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" style={{ width: 14, height: 14, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              Run Comparison
            </button>
          </div>

        {error && (
          <div
            style={{
              marginBottom: '16px',
              borderRadius: '8px',
              border: '1px solid var(--danger)',
              backgroundColor: 'rgba(248, 113, 113, 0.1)',
              padding: '12px',
              fontSize: '12px',
              color: 'var(--danger)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle className="h-4 w-4" style={{ width: 16, height: 16, flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="skeleton" style={{ height: '240px', width: '100%', borderRadius: '12px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} />
            <div className="skeleton" style={{ height: '120px', width: '100%', borderRadius: '12px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} />
          </div>
        ) : data ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Chart Section */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                  fontSize: '12px',
                  color: 'var(--muted)',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <span>Total Rainfall Comparison ({data.target_period_description})</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'var(--primary)', display: 'inline-block' }} /> Target Year
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: 'var(--muted)', display: 'inline-block' }} /> Baseline Years
                  </span>
                  <span style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>
                    -- Baseline Mean: {data.baseline_mean_total} {data.units.precipitation || 'mm'}
                  </span>
                </span>
              </div>

              <div style={{ height: '240px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.chart_data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E2A44" />
                    <XAxis dataKey="year" stroke="#8FA3BF" tick={{ fontSize: 11 }} />
                    <YAxis
                      stroke="#8FA3BF"
                      tick={{ fontSize: 11 }}
                      unit={` ${data.units.precipitation || 'mm'}`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          return (
                            <div
                              style={{
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                backgroundColor: 'var(--surface)',
                                padding: '12px',
                                color: 'var(--text)',
                                fontSize: '12px',
                              }}
                            >
                              <p style={{ fontWeight: 600, marginBottom: '4px' }}>{item.label}</p>
                              <p style={{ color: 'var(--primary)', margin: '2px 0' }}>
                                Total: {item.total_precipitation} {data.units.precipitation || 'mm'}
                              </p>
                              <p style={{ color: 'var(--muted)', margin: '2px 0' }}>
                                Daily Mean: {item.mean_daily_precipitation} {data.units.precipitation || 'mm'}/day
                              </p>
                              <p style={{ color: item.anomaly >= 0 ? 'var(--success)' : 'var(--warning)', margin: '2px 0' }}>
                                Anomaly: {item.anomaly >= 0 ? `+${item.anomaly}` : item.anomaly} {data.units.precipitation || 'mm'}
                              </p>
                              <p style={{ color: 'var(--muted)', fontSize: '10px', marginTop: '4px', margin: 0 }}>
                                Coverage: {item.coverage_pct}%
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine
                      y={data.baseline_mean_total}
                      stroke="#FBBF24"
                      strokeDasharray="4 4"
                      label={{
                        value: `Mean (${data.baseline_mean_total})`,
                        fill: '#FBBF24',
                        fontSize: 10,
                        position: 'insideTopRight',
                      }}
                    />
                    <Bar dataKey="total_precipitation" radius={[4, 4, 0, 0]}>
                      {data.chart_data.map((entry) => (
                        <Cell
                          key={`cell-${entry.year}`}
                          fill={entry.year === data.table[data.table.length - 1]?.year ? '#38BDF8' : '#8FA3BF'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Table Section */}
            <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <table style={{ width: '100%', textAlign: 'left', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: 'var(--bg)', color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                  <tr>
                    <th style={{ padding: '10px 14px' }}>Year</th>
                    <th style={{ padding: '10px 14px' }}>Period Window</th>
                    <th style={{ padding: '10px 14px' }}>Total Rainfall</th>
                    <th style={{ padding: '10px 14px' }}>Daily Mean</th>
                    <th style={{ padding: '10px 14px' }}>Max Single Day</th>
                    <th style={{ padding: '10px 14px' }}>Rainy Days</th>
                    <th style={{ padding: '10px 14px' }}>Coverage</th>
                    <th style={{ padding: '10px 14px' }}>Dataset</th>
                  </tr>
                </thead>
                <tbody style={{ fontFamily: 'monospace' }}>
                  {data.table.map((row) => {
                    const isTarget = row.year === data.table[data.table.length - 1].year;
                    return (
                      <tr
                        key={row.year}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          backgroundColor: isTarget ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                          color: isTarget ? 'var(--text)' : 'var(--text)',
                          fontWeight: isTarget ? 600 : 400,
                        }}
                      >
                        <td style={{ padding: '8px 14px' }}>
                          {row.year} {isTarget && <span style={{ fontSize: '10px', color: 'var(--primary)', fontFamily: 'sans-serif' }}>(Target)</span>}
                        </td>
                        <td style={{ padding: '8px 14px', color: 'var(--muted)', fontFamily: 'sans-serif' }}>
                          {row.period_start} to {row.period_end}
                        </td>
                        <td style={{ padding: '8px 14px', color: isTarget ? 'var(--primary)' : 'var(--text)', fontWeight: 'bold' }}>
                          {row.total_precipitation} {data.units.precipitation || 'mm'}
                        </td>
                        <td style={{ padding: '8px 14px' }}>
                          {row.mean_daily_precipitation} {data.units.precipitation || 'mm'}
                        </td>
                        <td style={{ padding: '8px 14px' }}>
                          {row.max_daily_precipitation} {data.units.precipitation || 'mm'}
                        </td>
                        <td style={{ padding: '8px 14px' }}>
                          {row.rainy_days} / {row.expected_days}
                        </td>
                        <td style={{ padding: '8px 14px' }}>
                          <span style={{ color: row.coverage_pct >= 95 ? 'var(--success)' : 'var(--warning)' }}>
                            {row.coverage_pct}%
                          </span>
                          {row.missing_days > 0 && (
                            <span style={{ fontSize: '10px', color: 'var(--warning)', display: 'block' }}>
                              ({row.missing_days} missing)
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '8px 14px', color: 'var(--muted)', textTransform: 'uppercase', fontSize: '10px' }}>
                          {row.dataset_type}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Method & Scientific Limitations Panel */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div style={{ borderRadius: '10px', border: '1px solid var(--border)', backgroundColor: 'var(--bg)', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>
                  <Info className="h-4 w-4" style={{ width: 16, height: 16, color: 'var(--primary)' }} />
                  Calculation Methodology
                </div>
                <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
                  {data.method_text}
                </p>
                <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--muted)', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Database className="h-3.5 w-3.5" style={{ width: 14, height: 14, color: 'var(--muted)' }} />
                  {data.dataset_disclosures.join(' • ')}
                </div>
              </div>

              <div style={{ borderRadius: '10px', border: '1px solid var(--border)', backgroundColor: 'var(--bg)', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--warning)' }}>
                  <AlertCircle className="h-4 w-4" style={{ width: 16, height: 16, color: 'var(--warning)' }} />
                  Statistical Limitations & Scientific Disclosure
                </div>
                <ul style={{ paddingLeft: '18px', margin: 0, fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6 }}>
                  {data.limitations.map((lim, idx) => (
                    <li key={idx} style={{ color: idx === 0 ? 'var(--text)' : 'var(--muted)', marginBottom: '4px' }}>
                      {lim}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}
        </div>
        )}
      </div>
    </section>
  );
};
