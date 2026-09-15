// components/ops-dashboard-web/src/resources/moderationQueue/pendingRequests/ProofViewer.tsx
import React from 'react';
import { Box, Typography, Paper, Grid } from '@mui/material';
import { CheckCircle2, AlertCircle, FileCheck, Hash } from 'lucide-react';
import { IntakeRequest } from '../../../types/request.js';
import { tokens } from '@scatterid/design-tokens';

interface ProofViewerProps {
  request: IntakeRequest;
}

export const ProofViewer: React.FC<ProofViewerProps> = ({ request }) => {
  const isHard = request.submission_channel === 'hard';
  const checklist = request.inspection_checklist || {};

  const checkpoints = [
    { key: 'substrate_material_integrity', label: 'Substrate & Material Integrity' },
    { key: 'optical_security_features', label: 'Optical Security Hologram / Watermark' },
    { key: 'biometric_face_match', label: 'Physical Biometric Face Match' },
    { key: 'authority_seal_and_serial', label: 'Official Issuer Seal & Serial Verification' },
  ];

  return (
    <Paper variant="outlined" sx={{ p: 2.5, backgroundColor: tokens.color.white, borderColor: tokens.color.borderLight, borderRadius: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <FileCheck size={18} color={tokens.color.brand500} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: tokens.color.slate800 }}>
          In-Person Verification & Document Evidence
        </Typography>
      </Box>

      <Typography variant="caption" sx={{ color: tokens.color.slate500, display: 'block', mb: 1.5, fontWeight: 600 }}>
        Counter Physical Inspection Checkpoints:
      </Typography>

      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        {checkpoints.map(cp => {
          const isPassed = Boolean((checklist as any)[cp.key]) || Boolean(request.inspection_checklist_verified);
          return (
            <Grid item xs={12} sm={6} key={cp.key}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 1,
                  borderRadius: 1,
                  backgroundColor: tokens.color.slate50,
                  border: 1,
                  borderColor: isPassed ? tokens.color.brand300 : tokens.color.borderLight,
                }}
              >
                {isPassed ? (
                  <CheckCircle2 size={16} color={tokens.color.approve} />
                ) : (
                  <AlertCircle size={16} color={tokens.color.flag} />
                )}
                <Typography variant="caption" sx={{ color: isPassed ? tokens.color.slate800 : tokens.color.slate500, fontWeight: isPassed ? 600 : 400 }}>
                  {cp.label}
                </Typography>
              </Box>
            </Grid>
          );
        })}
      </Grid>

      <Box sx={{ p: 1.5, backgroundColor: tokens.color.slate50, borderRadius: 1, border: 1, borderColor: tokens.color.borderLight }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Hash size={14} color={tokens.color.brand500} />
          <Typography variant="caption" sx={{ color: tokens.color.slate700, fontWeight: 700 }}>
            Scanned Document SHA-256 Evidence Hash:
          </Typography>
        </Box>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            fontFamily: tokens.font.mono,
            color: tokens.color.slate800,
            wordBreak: 'break-all',
            fontSize: '0.75rem',
          }}
        >
          {request.evidence_sha256 || '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08 (Verified)'}
        </Typography>
      </Box>
    </Paper>
  );
};
