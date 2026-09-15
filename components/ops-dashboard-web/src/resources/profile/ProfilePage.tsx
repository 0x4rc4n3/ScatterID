// components/ops-dashboard-web/src/resources/profile/ProfilePage.tsx
import React, { useState } from 'react';
import { Box, Typography, Paper, Grid } from '@mui/material';
import { User, Shield } from 'lucide-react';
import { MfaStatusCard } from './MfaStatusCard.js';
import { TransferMfaModal } from './TransferMfaModal.js';
import { StaffUserTable } from './userManagement/StaffUserTable.js';
import { RoleBadge } from '../../layout/RoleBadge.js';
import { useCurrentUser } from '../../hooks/useCurrentUser.js';
import { tokens } from '@scatterid/design-tokens';

export const ProfilePage: React.FC = () => {
  const { user, role } = useCurrentUser();
  const [transferModalOpen, setTransferModalOpen] = useState<boolean>(false);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: tokens.color.textMain }}>
          Profile & Security Administration
        </Typography>
        <Typography variant="body2" sx={{ color: tokens.color.textDim }}>
          Operator identity, hardware MFA management, and role-governed staff access control
        </Typography>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 3, backgroundColor: tokens.color.bgCard, borderColor: tokens.color.borderSubtle, height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <User size={20} color={tokens.color.brand500} />
                <Typography variant="h6" sx={{ fontWeight: 700, color: tokens.color.textMain }}>
                  Operator Session
                </Typography>
              </Box>
              <RoleBadge role={role} />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2 }}>
              <Box>
                <Typography variant="caption" sx={{ color: tokens.color.textDim }}>Authenticated Username:</Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, color: tokens.color.textMain }}>
                  {user?.username || 'Staff Operator'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: tokens.color.textDim }}>Assigned Role Authority:</Typography>
                <Typography variant="body2" sx={{ color: tokens.color.brand300, fontWeight: 600 }}>
                  {role === 'root' ? 'Root Administrator (All Privileges)' : 'Moderator (Verification & Review)'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: tokens.color.textDim }}>User ID UUID:</Typography>
                <Typography variant="caption" sx={{ fontFamily: tokens.font.mono, color: tokens.color.textMuted, display: 'block' }}>
                  {user?.id || 'session-uuid'}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <MfaStatusCard
            totpEnabled={Boolean(user?.totp_enabled)}
            onOpenTransferModal={() => setTransferModalOpen(true)}
          />
        </Grid>
      </Grid>

      <StaffUserTable />

      <TransferMfaModal
        open={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        onSuccess={() => setTransferModalOpen(false)}
      />
    </Box>
  );
};
