// components/ops-dashboard-web/src/resources/keyRotation/emergency/TypedConfirmInput.tsx
import React from 'react';
import { Box, TextField, Typography } from '@mui/material';
import { tokens } from '@scatterid/design-tokens';

interface TypedConfirmInputProps {
  requiredText: string;
  value: string;
  onChange: (value: string) => void;
}

export const TypedConfirmInput: React.FC<TypedConfirmInputProps> = ({
  requiredText,
  value,
  onChange,
}) => {
  const matches = value === requiredText;

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="caption" sx={{ color: tokens.color.textDim, display: 'block', mb: 1 }}>
        Type <Typography component="span" variant="caption" sx={{ fontFamily: tokens.font.mono, fontWeight: 700, color: tokens.color.reject }}>{requiredText}</Typography> to confirm high-impact execution:
      </Typography>
      <TextField
        fullWidth
        size="small"
        placeholder={requiredText}
        value={value}
        onChange={e => onChange(e.target.value)}
        error={value.length > 0 && !matches}
        helperText={value.length > 0 && !matches ? 'Text does not match confirmation phrase' : undefined}
      />
    </Box>
  );
};
