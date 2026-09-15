// components/ops-dashboard-web/src/resources/auditLog/AuditLogFilters.tsx
import React from 'react';
import { Box, TextField, InputAdornment } from '@mui/material';
import { Search } from 'lucide-react';
import { tokens } from '@scatterid/design-tokens';

interface AuditLogFiltersProps {
  search: string;
  onSearchChange: (val: string) => void;
}

export const AuditLogFilters: React.FC<AuditLogFiltersProps> = ({ search, onSearchChange }) => {
  return (
    <Box sx={{ mb: 3 }}>
      <TextField
        fullWidth
        size="small"
        placeholder="Filter audit records by action name, actor username, or request ID..."
        value={search}
        onChange={e => onSearchChange(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search size={16} color={tokens.color.textDim} />
            </InputAdornment>
          ),
        }}
      />
    </Box>
  );
};
