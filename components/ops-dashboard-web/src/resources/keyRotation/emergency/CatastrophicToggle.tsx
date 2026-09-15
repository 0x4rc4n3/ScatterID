// components/ops-dashboard-web/src/resources/keyRotation/emergency/CatastrophicToggle.tsx
import React from 'react';
import { FormControlLabel, Switch, Typography, Box } from '@mui/material';
import { AlertTriangle } from 'lucide-react';
import { tokens } from '@scatterid/design-tokens';

interface CatastrophicToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export const CatastrophicToggle: React.FC<CatastrophicToggleProps> = ({ checked, onChange }) => {
  return (
    <Box sx={{ p: 2, borderRadius: 1, backgroundColor: tokens.color.bgBase, border: 1, borderColor: checked ? tokens.color.reject : tokens.color.borderSubtle }}>
      <FormControlLabel
        control={
          <Switch
            checked={checked}
            onChange={e => onChange(e.target.checked)}
            color="error"
          />
        }
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AlertTriangle size={16} color={checked ? tokens.color.reject : tokens.color.flag} />
            <Typography variant="body2" sx={{ fontWeight: 700, color: checked ? tokens.color.reject : tokens.color.textMain }}>
              Catastrophic Compromise Mode (Bypass Grace Window)
            </Typography>
          </Box>
        }
      />
      <Typography variant="caption" sx={{ color: tokens.color.textDim, display: 'block', mt: 0.5, pl: 4 }}>
        Enables immediate emergency delegation or revocation override when a primary signing key has suffered material exposure.
      </Typography>
    </Box>
  );
};
