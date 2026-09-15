// components/ops-dashboard-web/src/resources/keyRotation/gatewayKeys/GraceWindowModal.tsx
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
} from '@mui/material';
import { tokens } from '@scatterid/design-tokens';

interface GraceWindowModalProps {
  open: boolean;
  keyName: string;
  onConfirm: (graceHours: number) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export const GraceWindowModal: React.FC<GraceWindowModalProps> = ({
  open,
  keyName,
  onConfirm,
  onCancel,
  submitting = false,
}) => {
  const [hours, setHours] = useState<number>(24);

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>Rotate {keyName}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Specify the dual-key grace window in hours. During this period, both the retiring key and the new key remain valid to prevent client downtime.
        </Typography>
        <Box sx={{ my: 1 }}>
          <TextField
            fullWidth
            type="number"
            size="small"
            label="Grace Window (Hours)"
            value={hours}
            onChange={e => setHours(Math.max(1, parseInt(e.target.value, 10) || 1))}
            inputProps={{ min: 1, max: 168 }}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} color="inherit" disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={() => onConfirm(hours)}
          variant="contained"
          disabled={submitting}
          sx={{ backgroundColor: tokens.color.brand500, color: '#ffffff' }}
        >
          Execute Zero-Downtime Rotation
        </Button>
      </DialogActions>
    </Dialog>
  );
};
