'use client';

import React from 'react';
import { ScanFace } from 'lucide-react';
import { StepHeader } from '../components/StepHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { useKYCContext } from '../context/KYCContext';
import { useKYCConfig } from '../context/KYCConfigContext';
import { APPLICANT_ROLE_LABELS, prevBusinessStep } from '../lib/business-application';
import type { ApplicantRole } from '../types/business';

const ROLES = Object.keys(APPLICANT_ROLE_LABELS) as ApplicantRole[];

/**
 * Applicant-role step ("Now verify your own identity"): the person submitting
 * the KYB application declares their relationship to the business (and
 * optionally their name), then runs the ordinary individual capture leg —
 * id-type → capture → liveness — for their own identity.
 */
export function ApplicantRoleStep() {
  const { state, dispatch } = useKYCContext();
  const config = useKYCConfig();
  const { applicantRole, applicantName } = state.businessApplication;

  const setApplication = (payload: { applicantRole?: ApplicantRole; applicantName?: string }) =>
    dispatch({ type: 'SET_BUSINESS_APPLICATION', payload });

  return (
    <div className="space-y-6 animate-slide-up">
      <StepHeader
        title="Now verify your own identity"
        description="Tell us your role at the business, then verify your identity with a government-issued ID."
        onBack={() =>
          dispatch({ type: 'SET_STEP', payload: prevBusinessStep('applicant-role', config.business) })
        }
      />

      <div className="flex items-center gap-3 rounded-xl bg-secondary/40 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ScanFace className="h-4.5 w-4.5" />
        </span>
        <p className="text-sm text-foreground/90">
          Regulations require the person submitting a business application to verify their own
          identity. This only takes a minute.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="applicantRole">Your role at the business</Label>
          <Select
            value={applicantRole ?? ''}
            onValueChange={(role) => setApplication({ applicantRole: role as ApplicantRole })}
          >
            <SelectTrigger id="applicantRole">
              <SelectValue placeholder="Select your role" />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {APPLICANT_ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="applicantName">
            Full name <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="applicantName"
            placeholder="Enter your full name"
            value={applicantName}
            onChange={(e) => setApplication({ applicantName: e.target.value })}
          />
        </div>
      </div>

      <Button
        onClick={() => dispatch({ type: 'SET_STEP', payload: 'id-type' })}
        disabled={!applicantRole}
        className="w-full"
      >
        Continue
      </Button>
    </div>
  );
}
