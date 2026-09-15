// components/ops-dashboard-web/src/resources/auditLog/ExportButton.tsx
import React from 'react';
import { Button } from '@mui/material';
import { Download } from 'lucide-react';
import { tokens } from '@scatterid/design-tokens';

interface ExportButtonProps {
  data: any[];
  filename?: string;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  data,
  filename = 'scatterid_audit_log.json',
}) => {
  const handleExport = () => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      size="small"
      variant="outlined"
      startIcon={<Download size={14} />}
      onClick={handleExport}
      disabled={data.length === 0}
      sx={{ borderColor: tokens.color.borderSubtle, color: tokens.color.textMain }}
    >
      Export Log JSON
    </Button>
  );
};
