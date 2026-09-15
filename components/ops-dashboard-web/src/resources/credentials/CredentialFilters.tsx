// components/ops-dashboard-web/src/resources/credentials/CredentialFilters.tsx
import React from 'react';
import { Box, TextField, MenuItem, InputAdornment } from '@mui/material';
import { Search } from 'lucide-react';
import { tokens } from '@scatterid/design-tokens';

interface CredentialFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
}

export const CredentialFilters: React.FC<CredentialFiltersProps> = ({
  search,
  onSearchChange,
  status,
  onStatusChange,
}) => {
  return (
    <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
      <TextField
        size="small"
        placeholder="Filter by Credential ID, Subject, or Hash..."
        value={search}
        onChange={e => onSearchChange(e.target.value)}
        sx={{ minWidth: 320, flex: 1 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search size={16} color={tokens.color.textDim} />
            </InputAdornment>
          ),
        }}
      />
      <TextField
        select
        size="small"
        label="Status"
        value={status}
        onChange={e => onStatusChange(e.target.value)}
        sx={{ minWidth: 160 }}
      >
        <MenuItem value="all">All Statuses</MenuItem>
        <MenuItem value="anchored">Anchored</MenuItem>
        <MenuItem value="revoked">Revoked</MenuItem>
      </TextField>
    </Box>
  );
};
