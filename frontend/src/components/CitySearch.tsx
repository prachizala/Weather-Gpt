import React, { useState, useEffect, useRef } from 'react';
import { Location } from '../types/api';
import { api } from '../services/api';

interface CitySearchProps {
  onSelectLocation: (loc: Location) => void;
  selectedLocation: Location | null;
}

export const CitySearch: React.FC<CitySearchProps> = ({ onSelectLocation, selectedLocation }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search effect
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
    const handler = setTimeout(async () => {
      try {
        const locations = await api.searchLocations(query, 6);
        if (!isCancelled && !isDismissed) {
          setResults(locations);
          setIsOpen(true);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Search error:', err);
          setResults([]);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }, 300);

    return () => {
      isCancelled = true;
      clearTimeout(handler);
    };
  }, [query, isDismissed]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%', maxWidth: '480px', zIndex: 1000 }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsDismissed(false);
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--primary)';
            if (results.length > 0 && !isDismissed) setIsOpen(true);
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
          }}
          placeholder="Search city (e.g. Ahmedabad, London, Tokyo, दिल्ली)..."
          aria-label="Search city or geographical location"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsOpen(false);
              setIsDismissed(true);
              setResults([]);
            } else if (e.key === 'ArrowDown' && results.length > 0) {
              e.preventDefault();
              const firstItem = dropdownRef.current?.querySelector('li');
              (firstItem as HTMLElement)?.focus();
            }
          }}
          style={{
            width: '100%',
            padding: '10px 14px',
            paddingRight: '38px',
            backgroundColor: 'var(--bg)',
            color: 'var(--text)',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            fontSize: '14px',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
        />
        {isLoading && (
          <div
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--muted)',
              fontSize: '12px',
            }}
          >
            Searching...
          </div>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <ul
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            backgroundColor: '#111B2E', // 100% opaque solid background to prevent see-through overlap
            border: '1px solid var(--border)',
            borderRadius: '10px',
            listStyle: 'none',
            zIndex: 1000,
            maxHeight: '280px',
            overflowY: 'auto',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.85), 0 0 0 1px var(--border)',
            padding: '4px 0',
            margin: 0,
          }}
        >
          {results.map((loc, idx) => (
            <li
              key={`${loc.name}-${loc.coordinates.latitude}-${idx}`}
              role="option"
              aria-selected={selectedLocation?.name === loc.name}
              tabIndex={0}
              onClick={() => {
                onSelectLocation(loc);
                setIsOpen(false);
                setQuery(loc.name);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onSelectLocation(loc);
                  setIsOpen(false);
                  setQuery(loc.name);
                }
              }}
              style={{
                padding: '12px 16px',
                borderBottom: idx < results.length - 1 ? '1px solid var(--border)' : 'none',
                backgroundColor: '#111B2E', // Solid opaque row background
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#16223B')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#111B2E')}
            >
              <div>
                <strong style={{ color: 'var(--text)', display: 'block', fontSize: '14px' }}>{loc.name}</strong>
                <span style={{ color: 'var(--muted)', fontSize: '12px' }}>
                  {[loc.admin1, loc.country].filter(Boolean).join(', ')}
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--primary)', fontFamily: 'monospace' }}>
                {loc.timezone || 'UTC'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
