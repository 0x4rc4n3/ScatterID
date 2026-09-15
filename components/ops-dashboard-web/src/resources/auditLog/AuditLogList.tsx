// components/ops-dashboard-web/src/resources/auditLog/AuditLogList.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
} from '@mui/material';
import { RefreshCw, ExternalLink } from 'lucide-react';
import { httpClient } from '../../dataProvider/httpClient.js';
import { ENDPOINTS } from '../../dataProvider/endpoints.js';
import { AuditLogFilters } from './AuditLogFilters.js';
import { ExportButton } from './ExportButton.js';
import { AuditLogDetailModal } from './AuditLogDetailModal.js';
import { tokens } from '@scatterid/design-tokens';

export const AuditLogList: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await httpClient(`${ENDPOINTS.requests.auditLog}?limit=200`);
      setLogs(Array.isArray(res) ? res : res.logs || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return logs;
    return logs.filter(
      l =>
        l.action?.toLowerCase().includes(term) ||
        l.username?.toLowerCase().includes(term) ||
        l.request_id?.toLowerCase().includes(term) ||
        l.status?.toLowerCase().includes(term)
    );
  }, [logs, search]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: tokens.color.textMain }}>
            Immutable Security Audit Trail
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.color.textDim }}>
            Cryptographically attributed event trail for compliance, access governance, and forensic analysis (Click row to inspect)
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <ExportButton data={filteredLogs} />
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
            onClick={fetchLogs}
            disabled={loading}
            sx={{ borderColor: tokens.color.borderSubtle, color: tokens.color.textMain }}
          >
            {loading ? 'Refreshing...' : 'Refresh Logs'}
          </Button>
        </Box>
      </Box>

      <AuditLogFilters search={search} onSearchChange={setSearch} />

      <TableContainer component={Paper} variant="outlined" sx={{ borderColor: tokens.color.borderSubtle }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Timestamp</TableCell>
              <TableCell>Action Code</TableCell>
              <TableCell>Actor</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>IP Address</TableCell>
              <TableCell>Audit Notes & Context</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: tokens.color.textDim }}>
                  {loading ? 'Loading audit records...' : 'No audit records match the current filter'}
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((item, idx) => {
                const isSuccess = item.status === 'SUCCESS';
                const isAlert = item.status === 'ALERT' || item.status === 'DENIED';

                return (
                  <TableRow
                    key={item.id || idx}
                    hover
                    onClick={() => setSelectedLog(item)}
                    sx={{
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: tokens.color.bgCardHover },
                    }}
                  >
                    <TableCell sx={{ color: tokens.color.textDim, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {new Date(item.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell sx={{ color: tokens.color.textMain, fontWeight: 700, fontSize: '0.8rem' }}>
                      {item.action}
                    </TableCell>
                    <TableCell sx={{ color: tokens.color.brand700, fontWeight: 700 }}>
                      {item.username || 'System'}
                    </TableCell>
                    <TableCell sx={{ textTransform: 'uppercase', fontSize: '0.75rem', color: tokens.color.textDim }}>
                      {item.role || 'system'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={item.status}
                        sx={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          backgroundColor: isSuccess
                            ? tokens.color.approve
                            : isAlert
                            ? tokens.color.reject
                            : tokens.color.brand500,
                          color: '#ffffff',
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontFamily: tokens.font.mono, fontSize: '0.75rem', color: tokens.color.textMuted }}>
                      {item.client_ip || '127.0.0.1'}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.75rem', color: tokens.color.textDim }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                        <span>{typeof item.details === 'string' ? item.details : JSON.stringify(item.details || {})}</span>
                        <ExternalLink size={12} color={tokens.color.textDim} style={{ flexShrink: 0 }} />
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pop up event detail dialog */}
      <AuditLogDetailModal
        open={Boolean(selectedLog)}
        log={selectedLog}
        onClose={() => setSelectedLog(null)}
      />
    </Box>
  );
};
