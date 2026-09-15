// components/client-portal/frontend/src/desks/tracking/ProgressStepper.tsx
import React from 'react';
import { Check, Clock, AlertTriangle, X } from 'lucide-react';

interface ProgressStepperProps {
  status: string;
  isRevocation?: boolean;
}

export const ProgressStepper: React.FC<ProgressStepperProps> = ({
  status,
  isRevocation = false,
}) => {
  const normStatus = status.toLowerCase();

  const steps = [
    { key: 'submitted', label: '1. Submitted at Counter' },
    { key: 'review', label: '2. Moderator Review' },
    { key: 'root', label: '3. Root Authorization' },
    { key: 'executed', label: '4. Anchored on Ledger' },
  ];

  let currentStep = 1;
  let isRejected = normStatus === 'rejected';

  if (normStatus === 'pending') {
    currentStep = 2;
  } else if (normStatus === 'awaiting_root_accept' || normStatus === 'awaiting_root' || normStatus === 'flagged') {
    currentStep = 3;
  } else if (normStatus === 'executed' || normStatus === 'approved') {
    currentStep = 4;
  }

  return (
    <div className="py-4">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 w-full bg-borderLight -z-0" />

        {steps.map((step, idx) => {
          const stepNum = idx + 1;
          const isDone = currentStep > stepNum || (currentStep === 4 && stepNum === 4 && !isRejected);
          const isCurrent = currentStep === stepNum && !isRejected;

          return (
            <div key={step.key} className="flex flex-col items-center relative z-10 bg-white px-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition ${
                  isRejected && isCurrent
                    ? 'bg-reject text-white'
                    : isDone
                    ? 'bg-approve text-white'
                    : isCurrent
                    ? 'bg-brand500 text-white'
                    : 'bg-bgLight text-textLightMuted border border-borderLight'
                }`}
              >
                {isRejected && isCurrent ? (
                  <X className="w-4 h-4" />
                ) : isDone ? (
                  <Check className="w-4 h-4" />
                ) : (
                  stepNum
                )}
              </div>
              <span className="text-xs font-semibold text-textOnLight mt-2 text-center">
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
