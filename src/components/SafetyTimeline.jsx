import React, { useState } from 'react';
import { useApp } from '../state/useApp';
import './SafetyTimeline.css';

export default function SafetyTimeline() {
  const {
    timelineEvents,
    clearTimeline
  } = useApp();

  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'THREAT' | 'CHECKIN' | 'SOS' | 'SYSTEM'

  const filteredEvents = timelineEvents.filter(ev => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'THREAT') return ev.category === 'THREAT';
    if (activeFilter === 'CHECKIN') return ev.category === 'CHECKIN';
    if (activeFilter === 'SOS') return ev.category === 'SOS';
    if (activeFilter === 'SYSTEM') return ev.category === 'SYSTEM';
    return true;
  });

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(timelineEvents, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `astraea-safety-audit-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getEventBadge = (category) => {
    switch (category) {
      case 'SOS':
        return <span className="timeline-badge badge-sos">🚨 EMERGENCY</span>;
      case 'THREAT':
        return <span className="timeline-badge badge-threat">⚠️ THREAT SHIFT</span>;
      case 'CHECKIN':
        return <span className="timeline-badge badge-checkin">🛡️ CHECK-IN</span>;
      case 'SYSTEM':
      default:
        return <span className="timeline-badge badge-system">📡 SENSOR LOG</span>;
    }
  };

  return (
    <div className="safety-timeline-container" id="safety-timeline">
      <div className="timeline-header-card">
        <div className="timeline-title-wrap">
          <span className="timeline-icon">📜</span>
          <div>
            <h3>Safety Event Timeline & Audit Log</h3>
            <p>Chronological immutable record of risk shifts, check-ins, and emergency alerts</p>
          </div>
        </div>

        <div className="timeline-actions">
          <button
            type="button"
            className="btn-timeline-action btn-export"
            onClick={handleExportJson}
            disabled={timelineEvents.length === 0}
            title="Download complete audit log as JSON"
          >
            📥 Export JSON
          </button>
          <button
            type="button"
            className="btn-timeline-action btn-clear"
            onClick={clearTimeline}
            disabled={timelineEvents.length === 0}
            title="Clear stored timeline events"
          >
            🗑️ Clear
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="timeline-filters-row">
        {[
          { id: 'ALL', label: `All (${timelineEvents.length})` },
          { id: 'THREAT', label: 'Threat Shifts' },
          { id: 'CHECKIN', label: 'Check-Ins' },
          { id: 'SOS', label: 'SOS Alerts' },
          { id: 'SYSTEM', label: 'Sensors' }
        ].map(filter => (
          <button
            key={filter.id}
            type="button"
            className={`timeline-filter-btn ${activeFilter === filter.id ? 'active' : ''}`}
            onClick={() => setActiveFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Timeline Stream */}
      {filteredEvents.length > 0 ? (
        <div className="timeline-stream-list">
          {filteredEvents.slice().reverse().map((ev, index) => {
            const timeStr = new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            return (
              <div key={ev.id || index} className={`timeline-entry-card cat-${ev.category.toLowerCase()}`}>
                <div className="entry-rail">
                  <span className="rail-node" />
                  <span className="rail-line" />
                </div>

                <div className="entry-content">
                  <div className="entry-meta-row">
                    {getEventBadge(ev.category)}
                    <span className="entry-timestamp">{timeStr}</span>
                  </div>

                  <h4 className="entry-title">{ev.title}</h4>
                  <p className="entry-description">{ev.description}</p>

                  {ev.details && (
                    <div className="entry-details-box">
                      {typeof ev.details === 'string' ? (
                        <span>{ev.details}</span>
                      ) : (
                        <div className="details-tags-wrap">
                          {Object.entries(ev.details).map(([k, v]) => (
                            <span key={k} className="detail-tag">
                              <strong>{k}:</strong> {String(v)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="timeline-empty-card">
          <span className="empty-icon">🛡️</span>
          <h4>No Events Recorded Yet</h4>
          <p>
            When risk scores fluctuate, check-in prompts appear, or sensor anomalies occur, they will automatically be recorded here.
          </p>
        </div>
      )}
    </div>
  );
}
