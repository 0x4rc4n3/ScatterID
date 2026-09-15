// components/ops-dashboard-web/src/resources/keyRotation/routine/KeyPoolStepper.tsx
import React from 'react';
import { Stepper, Step, StepLabel, Box, Typography } from '@mui/material';
import { tokens } from '@scatterid/design-tokens';

interface KeyPoolStepperProps {
  currentStage: 'pre_staged' | 'active' | 'retired';
}

export const KeyPoolStepper: React.FC<KeyPoolStepperProps> = ({ currentStage }) => {
  const steps = [
    { key: 'pre_staged', label: '1. Advance Pre-Staged' },
    { key: 'active', label: '2. Promoted & Active Signing' },
    { key: 'retired', label: '3. Historical / Retired' },
  ];

  const activeIndex = steps.findIndex(s => s.key === currentStage);

  return (
    <Box sx={{ width: '100%', py: 2 }}>
      <Stepper activeStep={activeIndex >= 0 ? activeIndex : 1} alternativeLabel>
        {steps.map(step => (
          <Step key={step.key}>
            <StepLabel
              StepIconProps={{
                sx: {
                  '&.Mui-active': { color: tokens.color.brand500 },
                  '&.Mui-completed': { color: tokens.color.approve },
                },
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 600, color: tokens.color.textMain }}>
                {step.label}
              </Typography>
            </StepLabel>
          </Step>
        ))}
      </Stepper>
    </Box>
  );
};
