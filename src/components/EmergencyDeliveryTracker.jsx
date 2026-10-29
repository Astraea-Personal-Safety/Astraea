import React from 'react';
import { useApp } from '../state/useApp';
import './EmergencyDeliveryTracker.css';

export default function EmergencyDeliveryTracker() {
  const {
    deliveryRecords,
    trustedCircle,
    mode,
    webhookUrl,
    triggerTestAlert
  } = useApp();

  const STAGE_ORDER = ['ACCEPTED', 'QUEUED', 'SENT', 'DELIVERED', 'ACKNOWLEDGED'];

  const getStageIndex = (stage) => STAGE_ORDER.indexOf(stage);

  return (
    <div className="delivery-tracker-shell" id="delivery-status-tracker">
      <div className="delivery-header-card">
        <div className="delivery-title-wrap">
          <span className="delivery-icon">📡</span>
          <div>
            <h3>Emergency Dispatch Delivery Pipeline</h3>
            <p>End-to-end telecom tracking: Carrier gateway & recipient acknowledgment</p>
          </div>
        </div>

        <button
          type="button"
          className="btn-test-dispatch"
          onClick={triggerTestAlert}
          title="Send a non-emergency test notification across the pipeline"
        >
          ⚡ Test Dispatch Pipeline
        </button>
      </div>

      {mode === 'Solo' && (
        <div className="solo-delivery-notice">
          <span>ℹ️ <strong>Solo Mode Active:</strong> External broadcasts are held on-device. Switch to Connected Mode to dispatch to real contacts.</span>
        </div>
      )}

      {/* Per-Contact Delivery Board */}
      <div className="delivery-cards-grid">
        {trustedCircle.filter(c => c.name.trim()).length > 0 ? (
          trustedCircle.filter(c => c.name.trim()).map((contact, idx) => {
            const record = deliveryRecords.find(r => r.contactName === contact.name) || {
              stage: 'STANDBY',
              statusText: 'Standing by for live emergency broadcast',
              updatedAt: null
            };

            const currentIdx = getStageIndex(record.stage);

            return (
              <div key={contact.id || idx} className="contact-delivery-card">
                <div className="contact-card-top">
                  <div className="contact-avatar-pill">
                    {contact.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="contact-info">
                    <h4>{contact.name}</h4>
                    <span className="contact-sub">
                      {contact.phone || 'Emergency Contact'} {contact.relationship ? `• ${contact.relationship}` : ''}
                    </span>
                  </div>
                  <span className={`stage-badge stage-${record.stage.toLowerCase()}`}>
                    {record.stage}
                  </span>
                </div>

                {/* 5-Stage Visual Progress Bar */}
                <div className="pipeline-stepper">
                  {STAGE_ORDER.map((stageName, sIdx) => {
                    const isCompleted = sIdx <= currentIdx;
                    const isCurrent = sIdx === currentIdx;

                    return (
                      <div
                        key={stageName}
                        className={`step-item ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
                      >
                        <span className="step-dot" />
                        <span className="step-label">{stageName}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="contact-card-footer">
                  <span className="delivery-status-note">{record.statusText}</span>
                  {record.updatedAt && (
                    <span className="delivery-time-tag">
                      {new Date(record.updatedAt).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="delivery-empty-state">
            <p>No circle contacts configured. Add contacts in Circle Management to track live emergency delivery receipts.</p>
          </div>
        )}
      </div>

      {/* Webhook Gateway Status */}
      <div className="webhook-status-card">
        <div className="webhook-title-row">
          <span className="webhook-icon">🔌</span>
          <div>
            <h5>External Webhook Gateway (Twilio / Zapier / Slack API)</h5>
            <span className="webhook-url-display">
              {webhookUrl ? webhookUrl : 'No custom webhook configured (Local carrier simulation active)'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
