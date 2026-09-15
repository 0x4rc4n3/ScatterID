// components/ops-dashboard-web/src/resources/auditLog/AuditLogDetailModal.tsx
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Grid,
  Paper,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Shield,
  Copy,
  Check,
  Clock,
  User,
  Globe,
  FileText,
  Key,
} from 'lucide-react';
import { tokens } from '@scatterid/design-tokens';

interface AuditLogDetailModalProps {
  open: boolean;
  log: any | null;
  onClose: () => void;
}

export const AuditLogDetailModal: React.FC<AuditLogDetailModalProps> = ({
  open,
  log,
  onClose,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  if (!log) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isSuccess = log.status === 'SUCCESS';
  const isAlert = log.status === 'ALERT' || log.status === 'DENIED';

  const detailsObj = typeof log.details === 'string'
    ? (() => { try { return JSON.parse(log.details); } catch { return { message: log.details }; } })()
    : log.details || {};

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Shield size={20} color={tokens.color.brand500} />
          <Typography variant="h6" sx={{ fontWeight: 800, color: tokens.color.textMain }}>
            Audit Event Details
          </Typography>
        </Box>
        <Chip
          size="small"
          label={log.status || 'INFO'}
          sx={{
            fontWeight: 800,
            fontSize: '0.75rem',
            backgroundColor: isSuccess ? tokens.color.approve : isAlert ? tokens.color.reject : tokens.color.brand500,
            color: '#ffffff',
          }}
        />
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {/* Event Header Banner */}
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            mb: 2.5,
            backgroundColor: tokens.color.bgCard,
            borderColor: tokens.color.borderSubtle,
            borderRadius: 1.5,
          }}
        >
          <Typography variant="caption" sx={{ color: tokens.color.textDim, fontWeight: 600 }}>
            SECURITY ACTION CODE
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: tokens.color.textMain, fontFamily: tokens.font.mono }}>
            {log.action}
          </Typography>
          {log.action_description && (
            <Typography variant="body2" sx={{ color: tokens.color.textDim, mt: 0.5 }}>
              {log.action_description}
            </Typography>
          )}
        </Paper>

        {/* Metadata Grid */}
        <Grid container spacing={2} sx={{ mb: 2.5 }}>
          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Clock size={16} color={tokens.color.textDim} />
              <Box>
                <Typography variant="caption" sx={{ color: tokens.color.textDim, display: 'block' }}>
                  Timestamp
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: tokens.color.textMain }}>
                  {new Date(log.created_at).toLocaleString()}
                </Typography>
              </Box>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <User size={16} color={tokens.color.textDim} />
              <Box>
                <Typography variant="caption" sx={{ color: tokens.color.textDim, display: 'block' }}>
                  Actor / Initiator
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: tokens.color.brand700 }}>
                  {log.username || 'System Daemon'} ({log.role ? log.role.toUpperCase() : 'SYSTEM'})
                </Typography>
              </Box>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Globe size={16} color={tokens.color.textDim} />
              <Box>
                <Typography variant="caption" sx={{ color: tokens.color.textDim, display: 'block' }}>
                  Client IP Address
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: tokens.font.mono, color: tokens.color.textMain }}>
                  {log.client_ip || '127.0.0.1'}
                </Typography>
              </Box>
            </Box>
          </Grid>

          {log.request_id && (
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FileText size={16} color={tokens.color.textDim} />
                <Box>
                  <Typography variant="caption" sx={{ color: tokens.color.textDim, display: 'block' }}>
                    Associated Request ID
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: tokens.font.mono, color: tokens.color.brand300 }}>
                    {log.request_id}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          )}

          {log.credential_id && (
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Key size={16} color={tokens.color.textDim} />
                <Box>
                  <Typography variant="caption" sx={{ color: tokens.color.textDim, display: 'block' }}>
                    Target Credential ID
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: tokens.font.mono, color: tokens.color.brand300 }}>
                    {log.credential_id}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          )}
        </Grid>

        <Divider sx={{ my: 2, borderColor: tokens.color.borderSubtle }} />

        {/* Structured Context & Details JSON */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: tokens.color.textMain }}>
            Operational Context & Audit Payload
          </Typography>
          <Tooltip title={copied ? 'Copied to clipboard' : 'Copy JSON'}>
            <IconButton size="small" onClick={handleCopy} sx={{ color: tokens.color.textDim }}>
              {copied ? <Check size={16} color={tokens.color.approve} /> : <Copy size={16} />}
            </IconButton>
          </Tooltip>
        </Box>

        <Paper
          variant="outlined"
          sx={{
            p: 2,
            backgroundColor: '#0f172a',
            borderColor: tokens.color.borderSubtle,
            borderRadius: 1.5,
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          <Box
            component="pre"
            sx={{
              margin: 0,
              fontFamily: tokens.font.mono,
              fontSize: '0.78rem',
              color: '#38bdf8',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {JSON.stringify(detailsObj, null, 2)}
          </Box>
        </Paper>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button
          onClick={onClose}
          variant="contained"
          sx={{
            backgroundColor: tokens.color.brand500,
            color: '#ffffff',
            fontWeight: 700,
            '&:hover': { backgroundColor: tokens.color.brand700 },
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
