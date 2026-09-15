// components/ops-dashboard-web/src/resources/moderationQueue/QueueMasterDetailLayout.tsx
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Clock,
  ShieldAlert,
  User,
  Radio,
  FileCheck,
  AlertOctagon,
} from 'lucide-react';
import { IntakeRequest } from '../../types/request.js';
import { ChannelBadge } from './pendingRequests/ChannelBadge.js';
import { tokens } from '@scatterid/design-tokens';

interface QueueMasterDetailLayoutProps {
  title: string;
  countLabel?: string;
  requests: IntakeRequest[];
  selectedRequest: IntakeRequest | null;
  onSelectRequest: (req: IntakeRequest) => void;
  loading: boolean;
  onRefresh: () => void;
  accentColor?: string;
  emptyText?: string;
  children: React.ReactNode;
}

export const QueueMasterDetailLayout: React.FC<QueueMasterDetailLayoutProps> = ({
  title,
  countLabel,
  requests,
  selectedRequest,
  onSelectRequest,
  loading,
  onRefresh,
  accentColor = tokens.color.brand500,
  emptyText = 'No requests in this queue',
  children,
}) => {
  const [collapsed, setCollapsed] = useState<boolean>(false);

  const formatShortId = (id: string) => {
    if (!id) return '';
    return id.length > 10 ? `…${id.slice(-6)}` : id;
  };

  const getClaimantName = (req: IntakeRequest) => {
    try {
      const data = typeof req.claimant_data === 'string'
        ? JSON.parse(req.claimant_data || '{}')
        : req.claimant_data || {};
      return data.fullName || data.name || req.credential_id || 'Identity Subject';
    } catch {
      return req.credential_id || 'Identity Subject';
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        height: '100%',
        minHeight: 0,
        maxHeight: '100%',
        overflow: 'hidden',
        gap: 2,
      }}
    >
      {/* LEFT MASTER COLUMN (approx 28-30% or collapsed) */}
      <Box
        sx={{
          flex: collapsed ? '0 0 52px' : { xs: '0 0 280px', sm: '0 0 320px', md: '0 0 340px' },
          transition: 'all 0.2s ease-in-out',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: tokens.color.bgSurface,
          border: 1,
          borderColor: tokens.color.borderSubtle,
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        {/* Header toolbar */}
        <Box
          sx={{
            p: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: 1,
            borderColor: tokens.color.borderSubtle,
            backgroundColor: tokens.color.bgCard,
          }}
        >
          {!collapsed ? (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
                <Typography
                  variant="subtitle2"
                  noWrap
                  sx={{ fontWeight: 700, color: tokens.color.textMain, fontSize: '0.85rem' }}
                >
                  {title}
                </Typography>
                <Chip
                  size="small"
                  label={requests.length}
                  sx={{
                    height: 20,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    backgroundColor: accentColor,
                    color: tokens.color.white,
                  }}
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Tooltip title="Refresh queue">
                  <IconButton
                    size="small"
                    onClick={onRefresh}
                    disabled={loading}
                    sx={{ color: tokens.color.textDim }}
                  >
                    <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Collapse sidebar">
                  <IconButton
                    size="small"
                    onClick={() => setCollapsed(true)}
                    sx={{ color: tokens.color.textDim }}
                  >
                    <ChevronLeft size={16} />
                  </IconButton>
                </Tooltip>
              </Box>
            </>
          ) : (
            <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <Tooltip title="Expand sidebar" placement="right">
                <IconButton
                  size="small"
                  onClick={() => setCollapsed(false)}
                  sx={{ color: accentColor }}
                >
                  <ChevronRight size={18} />
                </IconButton>
              </Tooltip>
              <Chip
                size="small"
                label={requests.length}
                sx={{
                  height: 20,
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  backgroundColor: accentColor,
                  color: tokens.color.white,
                }}
              />
            </Box>
          )}
        </Box>

        {/* Scrollable list items */}
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            p: collapsed ? 0.5 : 1.2,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          {requests.length === 0 ? (
            <Box sx={{ py: 6, px: 2, textAlign: 'center', color: tokens.color.textDim }}>
              {!collapsed && (
                <Typography variant="caption" sx={{ display: 'block', fontWeight: 500 }}>
                  {loading ? 'Refreshing queue...' : emptyText}
                </Typography>
              )}
            </Box>
          ) : (
            requests.map(req => {
              const isSelected = selectedRequest?.id === req.id;
              const claimantName = getClaimantName(req);
              const isRevocation = req.type === 'revoke' || (req as any).request_type === 'revocation';

              if (collapsed) {
                return (
                  <Tooltip key={req.id} title={`${req.id} — ${claimantName}`} placement="right">
                    <Box
                      onClick={() => onSelectRequest(req)}
                      sx={{
                        p: 1,
                        borderRadius: 1,
                        cursor: 'pointer',
                        textAlign: 'center',
                        backgroundColor: isSelected ? accentColor : 'transparent',
                        color: isSelected ? tokens.color.white : tokens.color.textDim,
                        '&:hover': {
                          backgroundColor: isSelected ? accentColor : tokens.color.bgCardHover,
                        },
                      }}
                    >
                      {req.status === 'FLAGGED' ? (
                        <AlertOctagon size={16} color={isSelected ? '#fff' : tokens.color.flag} />
                      ) : isRevocation ? (
                        <ShieldAlert size={16} color={isSelected ? '#fff' : tokens.color.reject} />
                      ) : (
                        <FileCheck size={16} color={isSelected ? '#fff' : tokens.color.approve} />
                      )}
                    </Box>
                  </Tooltip>
                );
              }

              return (
                <Paper
                  key={req.id}
                  variant="outlined"
                  onClick={() => onSelectRequest(req)}
                  sx={{
                    p: 1.5,
                    cursor: 'pointer',
                    borderRadius: 1.5,
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderColor: isSelected ? accentColor : tokens.color.borderSubtle,
                    borderLeftWidth: isSelected ? 4 : 1,
                    borderLeftColor: isSelected ? accentColor : tokens.color.borderSubtle,
                    backgroundColor: isSelected
                      ? 'rgba(59, 130, 246, 0.08)'
                      : tokens.color.bgCard,
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      backgroundColor: isSelected
                        ? 'rgba(59, 130, 246, 0.12)'
                        : tokens.color.bgCardHover,
                      borderColor: isSelected ? accentColor : tokens.color.borderLight,
                    },
                  }}
                >
                  {/* Line 1: Short ID + Channel badge + Type */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontFamily: tokens.font.mono,
                        fontWeight: 700,
                        color: isSelected ? accentColor : tokens.color.brand300,
                        fontSize: '0.78rem',
                      }}
                    >
                      {formatShortId(req.id)}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <ChannelBadge channel={req.submission_channel} />
                      <Chip
                        size="small"
                        label={isRevocation ? 'REVOKE' : 'ISSUE'}
                        sx={{
                          height: 18,
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          backgroundColor: isRevocation ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: isRevocation ? tokens.color.reject : tokens.color.approve,
                        }}
                      />
                    </Box>
                  </Box>

                  {/* Line 2: Claimant Name / Subject */}
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{
                      fontWeight: isSelected ? 700 : 600,
                      color: tokens.color.textMain,
                      fontSize: '0.84rem',
                      mb: 0.5,
                    }}
                  >
                    {claimantName}
                  </Typography>

                  {/* Line 3: Submitter / Station + Timestamp */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: tokens.color.textDim }}>
                    <Typography variant="caption" sx={{ fontSize: '0.72rem', color: tokens.color.textDim }}>
                      {req.created_by || 'clerk'} • {req.station_id || 'Counter-01'}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.7rem', color: tokens.color.textDim }}>
                      {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </Box>

                  {/* Extra 1-line note if flagged or moderated */}
                  {(req.flag_reason || req.moderator_notes) && (
                    <Box
                      sx={{
                        mt: 0.75,
                        pt: 0.5,
                        borderTop: '1px dashed',
                        borderColor: tokens.color.borderSubtle,
                      }}
                    >
                      <Typography
                        variant="caption"
                        noWrap
                        sx={{
                          display: 'block',
                          color: req.status === 'FLAGGED' ? tokens.color.flag : tokens.color.textDim,
                          fontSize: '0.7rem',
                          fontWeight: 600,
                        }}
                      >
                        {req.flag_reason || req.moderator_notes}
                      </Typography>
                    </Box>
                  )}
                </Paper>
              );
            })
          )}
        </Box>
      </Box>

      {/* RIGHT DETAIL COLUMN (approx 70-72%, flex: 1) */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          borderRadius: 2,
        }}
      >
        {children}
      </Box>
    </Box>
  );
};
