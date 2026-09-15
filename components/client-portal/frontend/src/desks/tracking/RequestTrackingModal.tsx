// components/client-portal/frontend/src/desks/tracking/RequestTrackingModal.tsx
import React, { useState } from 'react';
import { trackRequest } from '../../api/requestsApi.js';
import { ProgressStepper } from './ProgressStepper.js';
import { Search, X, AlertCircle } from 'lucide-react';

interface RequestTrackingModalProps {
  open: boolean;
  onClose: () => void;
}

export const RequestTrackingModal: React.FC<RequestTrackingModalProps> = ({ open, onClose }) => {
  const [requestId, setRequestId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [record, setRecord] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestId.trim()) return;

    try {
      setLoading(true);
      setError(null);
      const res = await trackRequest(requestId.trim());
      setRecord(res.request || res);
    } catch (err: any) {
      setError(err.message || 'Request not found');
      setRecord(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-white rounded-lg shadow-xl border border-borderLight p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-textOnLight">Track Intake Request Status</h3>
          <button onClick={onClose} className="text-textLightMuted hover:text-textOnLight">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-textLightMuted">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              required
              value={requestId}
              onChange={e => setRequestId(e.target.value)}
              placeholder="Enter Request ID (e.g. req_8f92a10c)..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-borderLight rounded-md focus:border-brand500 focus:outline-none font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-brand500 hover:bg-brand700 text-white font-semibold text-sm rounded-md transition"
          >
            {loading ? 'Searching...' : 'Track'}
          </button>
        </form>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-xs text-red-700 mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {record && (
          <div className="space-y-4 pt-2 border-t border-borderLight">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-textLightMuted block">Request Identifier:</span>
                <span className="font-mono font-bold text-textOnLight">{record.id}</span>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate100 text-textOnLight uppercase border border-borderLight">
                {record.status}
              </span>
            </div>

            <ProgressStepper
              status={record.status}
              isRevocation={record.request_type === 'revocation'}
            />

            <div className="bg-bgLight p-3 rounded-md text-xs space-y-1.5 border border-borderLight">
              <div className="flex justify-between">
                <span className="text-textLightMuted">Channel:</span>
                <span className="font-bold text-textOnLight uppercase">{record.submission_channel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-textLightMuted">Station:</span>
                <span className="font-semibold text-textOnLight">{record.station_id || 'COUNTER-STATION-01'}</span>
              </div>
              {record.moderator_notes && (
                <div className="flex justify-between">
                  <span className="text-textLightMuted">Moderator Note:</span>
                  <span className="font-semibold text-textOnLight">{record.moderator_notes}</span>
                </div>
              )}
              {record.execution_tx_id && (
                <div className="flex justify-between font-mono">
                  <span className="text-textLightMuted">Ledger Tx:</span>
                  <span className="text-brand700 font-bold">{record.execution_tx_id}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
