// components/ops-dashboard-web/src/resources/keyRotation/KeyRotationTabs.tsx
import React, { useState } from 'react';
import { Box, Typography, Tabs, Tab } from '@mui/material';
import { KeyRound, ShieldAlert, Layers, Archive } from 'lucide-react';
import { RoutineRotationTab } from './routine/RoutineRotationTab.js';
import { EmergencyRotationTab } from './emergency/EmergencyRotationTab.js';
import { GatewayKeysTab } from './gatewayKeys/GatewayKeysTab.js';
import { ColdBackupTab } from './coldBackup/ColdBackupTab.js';
import { useCanAccess } from 'react-admin';
import { tokens } from '@scatterid/design-tokens';

export const KeyRotationTabs: React.FC = () => {
  const { canAccess: canEmergencyRotate } = useCanAccess({ resource: 'keyRotation', action: 'rotate' });
  const { canAccess: canColdBackup } = useCanAccess({ resource: 'keyRotation', action: 'export' });
  const isEmergencyAllowed = Boolean(canEmergencyRotate);
  const isColdBackupAllowed = Boolean(canColdBackup);
  const [currentTab, setCurrentTab] = useState<number>(0);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: tokens.color.textMain }}>
          Cryptographic Key Lifecycle & Rotation Control
        </Typography>
        <Typography variant="body2" sx={{ color: tokens.color.textDim }}>
          Manage NIST FIPS 204 post-quantum signing keys, zero-downtime gateway tokens, emergency fallback, and encrypted cold backups.
        </Typography>
      </Box>

      <Tabs
        value={currentTab}
        onChange={(_, val) => setCurrentTab(val)}
        sx={{
          borderBottom: 1,
          borderColor: tokens.color.borderSubtle,
          mb: 3,
          '& .MuiTab-root': {
            fontWeight: 700,
            textTransform: 'none',
            fontSize: '0.875rem',
            color: tokens.color.textDim,
            '&.Mui-selected': {
              color: tokens.color.brand500,
            },
          },
          '& .MuiTabs-indicator': {
            backgroundColor: tokens.color.brand500,
          },
        }}
      >
        <Tab icon={<KeyRound size={16} />} iconPosition="start" label="Signature Key Rotation" />
        {isEmergencyAllowed && (
          <Tab icon={<ShieldAlert size={16} />} iconPosition="start" label="Emergency Backup Authority" />
        )}
        <Tab icon={<Layers size={16} />} iconPosition="start" label="API Gateway Tokens" />
        {isColdBackupAllowed && (
          <Tab icon={<Archive size={16} />} iconPosition="start" label="Encrypted Backup Vault" />
        )}
      </Tabs>

      {currentTab === 0 && <RoutineRotationTab />}
      {currentTab === 1 && isEmergencyAllowed && <EmergencyRotationTab />}
      {currentTab === 1 && !isEmergencyAllowed && <GatewayKeysTab />}
      {currentTab === 2 && isEmergencyAllowed && <GatewayKeysTab />}
      {currentTab === 3 && isEmergencyAllowed && isColdBackupAllowed && <ColdBackupTab />}
      {currentTab === 2 && !isEmergencyAllowed && isColdBackupAllowed && <ColdBackupTab />}
    </Box>
  );
};
