// components/ops-dashboard-web/src/components/shared/RequiredReasonField.tsx
import React from 'react';
import { TextField } from '@mui/material';

interface RequiredReasonFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  error?: boolean;
  helperText?: string;
  minRows?: number;
}

export const RequiredReasonField: React.FC<RequiredReasonFieldProps> = ({
  value,
  onChange,
  label = 'Justification / Reason (Mandatory)',
  placeholder = 'Provide detailed justification for audit attribution and cryptographic logging...',
  error = false,
  helperText,
  minRows = 3,
}) => {
  return (
    <TextField
      fullWidth
      multiline
      minRows={minRows}
      required
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      error={error || (value.trim().length === 0)}
      helperText={
        helperText || (value.trim().length === 0 ? 'Justification is required for audit logging' : undefined)
      }
    />
  );
};
