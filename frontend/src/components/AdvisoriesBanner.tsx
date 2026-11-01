import React from 'react';
import { AdvisoriesReport, AdvisoryItem } from '../types/api';
import { AlertTriangle, Umbrella, Flame, Wind, Eye, AlertOctagon, ExternalLink, CheckCircle2 } from 'lucide-react';

interface AdvisoriesBannerProps {
  report: AdvisoriesReport | null;
  loading?: boolean;
}

export const AdvisoriesBanner: React.FC<AdvisoriesBannerProps> = ({ report, loading }) => {
  if (loading) {
    return (
      <div
        className="skeleton"
        style={{
          height: '110px',
          borderRadius: '16px',
          marginBottom: '24px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
        }}
      />
    );
  }

  if (!report) return null;

  const getSeverityBadgeClass = (severity: AdvisoryItem['severity']) => {
    switch (severity) {
      case 'danger':
        return 'badge-danger';
      case 'warning':
      case 'moderate':
        return 'badge-warning';
      case 'info':
      default:
        return 'badge-info';
    }
  };

  const getAdvisoryIcon = (category: string) => {
    const iconProps = { className: 'h-5 w-5', style: { width: 20, height: 20, color: 'var(--muted)', flexShrink: 0 } };
    switch (category) {
      case 'precipitation':
        return <Umbrella {...iconProps} />;
      case 'temperature':
        return <Flame {...iconProps} />;
      case 'wind':
        return <Wind {...iconProps} />;
      case 'air_quality':
        return <AlertOctagon {...iconProps} />;
      case 'uv':
        return <Eye {...iconProps} />;
      default:
        return <AlertTriangle {...iconProps} />;
    }
  };

  return (
    <section aria-labelledby="advisories-heading" style={{ marginBottom: '24px' }}>
      <div
        style={{
          borderRadius: '16px',
          border: '1px solid var(--border)',
          backgroundColor: 'var(--surface)',
          padding: '20px',
        }}
      >
        {/* Header & Subtitle note */}
        <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '14px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle className="h-5 w-5" style={{ width: 20, height: 20, color: 'var(--warning)', flexShrink: 0 }} />
            <h2 id="advisories-heading" style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
              Rule-Based Weather Advisories
            </h2>
          </div>
          <div
            style={{
              marginTop: '6px',
              fontSize: '12px',
              color: 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <span>App suggestion, not an official warning</span>
            <span style={{ opacity: 0.5 }}>•</span>
            <a
              href={report.official_alerts_link}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--primary)',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 500,
              }}
            >
              Check Official IMD Alerts <ExternalLink className="h-3 w-3" style={{ width: 12, height: 12 }} />
            </a>
          </div>
        </div>

        {/* Active Advisories Card List */}
        {report.advisories.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {report.advisories.map((adv) => (
              <article
                key={adv.rule_id}
                style={{
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg)',
                  padding: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    {getAdvisoryIcon(adv.category)}
                    <h3
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--text)',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {adv.title}
                    </h3>
                  </div>
                  <span
                    className={getSeverityBadgeClass(adv.severity)}
                    style={{
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {adv.severity}
                  </span>
                </div>

                <p style={{ fontSize: '13px', color: 'var(--text)', marginTop: '10px', marginBottom: 0, lineHeight: 1.55 }}>
                  {adv.explanation}
                </p>

                <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--muted)', fontFamily: 'monospace' }}>
                  Triggered by: {adv.triggered_by.field} = {adv.triggered_by.value} {adv.triggered_by.units} (Threshold: {adv.triggered_by.threshold ?? adv.triggered_by.values})
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', fontSize: '13px', color: 'var(--muted)' }}>
            <CheckCircle2 className="h-5 w-5" style={{ width: 20, height: 20, color: 'var(--success)' }} />
            <span>No severe weather threshold triggers active. Current conditions are within normal advisory limits.</span>
          </div>
        )}

        {/* Skipped Rules Disclosure */}
        {report.skipped_rules.length > 0 && (
          <div
            style={{
              marginTop: '16px',
              paddingTop: '12px',
              borderTop: '1px solid var(--border)',
              fontSize: '11px',
              color: 'var(--muted)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--muted)' }}>Skipped rules (missing data):</span>
            {report.skipped_rules.map((sr) => (
              <span
                key={sr.rule_id}
                style={{
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg)',
                  border: '1px solid var(--border)',
                  padding: '2px 6px',
                }}
                title={sr.reason}
              >
                {sr.title} ({sr.missing_variables.join(', ')})
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
