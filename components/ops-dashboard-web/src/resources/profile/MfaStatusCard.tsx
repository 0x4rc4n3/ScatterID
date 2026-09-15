// components/ops-dashboard-web/src/resources/profile/MfaStatusCard.tsx
import React from 'react';
import { Paper, Typography, Box, Chip, Button } from '@mui/material';
import { ShieldCheck, Smartphone, RefreshCw } from 'lucide-react';
import { tokens } from '@scatterid/design-tokens';

interface MfaStatusCardProps {
  totpEnabled: boolean;
  onOpenTransferModal: () => void;
}

export const MfaStatusCard: React.FC<MfaStatusCardProps> = ({
  totpEnabled,
  onOpenTransferModal,
}) => {
  return (
    <Paper variant="outlined" sx={{ p: 3, backgroundColor: tokens.color.bgCard, borderColor: tokens.color.borderSubtle }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Smartphone size={20} color={tokens.color.brand500} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: tokens.color.textMain }}>
            Two-Factor Authentication (TOTP)
          </Typography>
        </Box>
        <Chip
          icon={<ShieldCheck size={16} color="#ffffff" />}
          label={totpEnabled ? 'ENFORCED & ACTIVE' : 'SETUP REQUIRED'}
          sx={{
            backgroundColor: totpEnabled ? tokens.color.approve : tokens.color.flag,
            color: '#ffffff !important',
            fontWeight: 700,
            '& .MuiChip-icon': { color: '#ffffff' },
          }}
        />
      </Box>

      <Typography variant="body2" sx={{ color: tokens.color.textDim, mb: 3 }}>
        Hardware/authenticator cryptographic second factor. Device transfers require password re-verification and issue peppered recovery codes.
      </Typography>

      <Button
        variant="outlined"
        startIcon={<RefreshCw size={14} />}
        onClick={onOpenTransferModal}
        sx={{ borderColor: tokens.color.borderSubtle, color: tokens.color.textMain }}
      >
        Transfer / Re-Enroll MFA Device
      </Button>
    </Paper>
  );
};
