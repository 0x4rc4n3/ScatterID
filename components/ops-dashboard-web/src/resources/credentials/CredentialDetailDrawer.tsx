// components/ops-dashboard-web/src/resources/credentials/CredentialDetailDrawer.tsx
import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Divider,
  Grid,
  Paper,
} from '@mui/material';
import { X, Key, Shield, Hash, FileText } from 'lucide-react';
import { StatusBadge } from './StatusBadge.js';
import { CredentialRecord } from '../../types/credential.js';
import { tokens } from '@scatterid/design-tokens';

interface CredentialDetailDrawerProps {
  open: boolean;
  credential: CredentialRecord | null;
  onClose: () => void;
}

export const CredentialDetailDrawer: React.FC<CredentialDetailDrawerProps> = ({
  open,
  credential,
  onClose,
}) => {
  if (!credential) return null;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 540 },
          backgroundColor: tokens.color.white,
          borderLeft: 1,
          borderColor: tokens.color.borderLight,
          p: 3,
        },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, color: tokens.color.slate800 }}>
          Credential Specification
        </Typography>
        <IconButton onClick={onClose} size="small" sx={{ color: tokens.color.slate500 }}>
          <X size={20} />
        </IconButton>
      </Box>

      <Divider sx={{ borderColor: tokens.color.borderLight, mb: 3 }} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="caption" sx={{ color: tokens.color.slate500 }}>Credential Identifier</Typography>
          <Typography variant="body1" sx={{ fontWeight: 700, color: tokens.color.slate800, fontFamily: tokens.font.mono }}>
            {credential.id || credential.credentialId}
          </Typography>
        </Box>
        <StatusBadge status={credential.status} />
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 2, backgroundColor: tokens.color.slate50, borderColor: tokens.color.borderLight }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Hash size={16} color={tokens.color.brand500} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: tokens.color.slate800 }}>
                Cryptographic Commitment (SHA3-256)
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ wordBreak: 'break-all', fontFamily: tokens.font.mono, color: tokens.color.brand700, fontWeight: 600 }}>
              {credential.dataHash}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 2, backgroundColor: tokens.color.slate50, borderColor: tokens.color.borderLight }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Key size={16} color={tokens.color.cyanMid} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: tokens.color.slate800 }}>
                PQC Signature Parameters
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: tokens.color.slate500, display: 'block' }}>
              Public Key ID: <Typography component="span" variant="caption" sx={{ fontFamily: tokens.font.mono, color: tokens.color.slate800, fontWeight: 600 }}>{credential.publicKeyId || 'registry-default'}</Typography>
            </Typography>
            <Typography variant="caption" sx={{ color: tokens.color.slate500, display: 'block' }}>
              Algorithm: <Typography component="span" variant="caption" sx={{ fontFamily: tokens.font.mono, color: tokens.color.slate800, fontWeight: 600 }}>{credential.algorithm || 'ML-DSA-65 (NIST FIPS 204)'}</Typography>
            </Typography>
            {credential.anchorTxId && (
              <Typography variant="caption" sx={{ color: tokens.color.slate500, display: 'block' }}>
                Ledger Tx: <Typography component="span" variant="caption" sx={{ fontFamily: tokens.font.mono, color: tokens.color.brand700, fontWeight: 600 }}>{credential.anchorTxId}</Typography>
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <FileText size={16} color={tokens.color.slate500} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: tokens.color.slate800 }}>
            Claim Payload (Pre-image)
          </Typography>
        </Box>
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            backgroundColor: tokens.color.slate50,
            borderColor: tokens.color.borderLight,
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          <Box
            component="pre"
            sx={{
              margin: 0,
              fontFamily: tokens.font.mono,
              fontSize: '0.75rem',
              color: tokens.color.slate800,
            }}
          >
            {JSON.stringify(credential.rawClaim || credential.claim || {}, null, 2)}
          </Box>
        </Paper>
      </Box>
    </Drawer>
  );
};
