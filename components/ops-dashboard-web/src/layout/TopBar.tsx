// components/ops-dashboard-web/src/layout/TopBar.tsx
import React from 'react';
import { AppBar, Box, Typography, Button } from '@mui/material';
import { User, LogOut, Shield } from 'lucide-react';
import { useLogout } from 'react-admin';
import { RoleBadge } from './RoleBadge.js';
import { useCurrentUser } from '../hooks/useCurrentUser.js';
import { tokens } from '@scatterid/design-tokens';

export const TopBar: React.FC = () => {
  const logout = useLogout();
  const { user, role } = useCurrentUser();

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{
        borderBottom: 1,
        borderColor: tokens.color.borderLight,
        px: 3,
        py: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: tokens.color.white,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 1,
            backgroundColor: tokens.color.brand500,
            color: tokens.color.white,
          }}
        >
          <Shield size={20} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em', color: tokens.color.slate800 }}>
          ScatterID <Typography component="span" variant="h6" sx={{ color: tokens.color.brand500, fontWeight: 700 }}>Ops Console</Typography>
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <User size={16} color={tokens.color.slate500} />
          <Typography variant="body2" sx={{ fontWeight: 600, color: tokens.color.slate800 }}>
            {user?.username || 'Operator'}
          </Typography>
          <RoleBadge role={role} />
        </Box>

        <Button
          size="small"
          variant="outlined"
          color="inherit"
          startIcon={<LogOut size={14} />}
          onClick={() => logout()}
          sx={{
            borderColor: tokens.color.borderLight,
            color: tokens.color.slate700,
            backgroundColor: tokens.color.slate50,
            '&:hover': {
              borderColor: tokens.color.reject,
              color: tokens.color.reject,
              backgroundColor: tokens.color.white,
            },
          }}
        >
          Sign Out
        </Button>
      </Box>
    </AppBar>
  );
};
