// components/ops-dashboard-web/src/resources/systemHealth/RunReconciliationButton.tsx
import React, { useState } from 'react';
import { Button, Alert, Box } from '@mui/material';
import { Play } from 'lucide-react';
import { httpClient } from '../../dataProvider/httpClient.js';
import { ENDPOINTS } from '../../dataProvider/endpoints.js';
import { useCurrentUser } from '../../hooks/useCurrentUser.js';
import { tokens } from '@scatterid/design-tokens';

interface RunReconciliationButtonProps {
  onReconciliationFinished: () => void;
}

export const RunReconciliationButton: React.FC<RunReconciliationButtonProps> = ({
  onReconciliationFinished,
}) => {
  const { isRoot } = useCurrentUser();
  const [running, setRunning] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  // Per Rule 6: Nav items and controls a role can't use must not render at all
  if (!isRoot) return null;

  const handleRun = async () => {
    try {
      setRunning(true);
      setMessage(null);
      const res = await httpClient(ENDPOINTS.requests.reconcile, {
        method: 'POST',
      });
      setMessage(res.message || 'Reconciliation job successfully completed. Database and Fabric in sync.');
      onReconciliationFinished();
    } catch (err: any) {
      setMessage(err.message || 'Reconciliation job failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Box>
      <Button
        variant="contained"
        startIcon={<Play size={16} />}
        onClick={handleRun}
        disabled={running}
        sx={{ backgroundColor: tokens.color.brand500, color: '#ffffff' }}
      >
        {running ? 'Reconciling Ledger...' : 'Run Ledger Reconciliation'}
      </Button>
      {message && (
        <Alert severity="info" sx={{ mt: 2, backgroundColor: tokens.color.bgCard, color: tokens.color.textMain }}>
          {message}
        </Alert>
      )}
    </Box>
  );
};
