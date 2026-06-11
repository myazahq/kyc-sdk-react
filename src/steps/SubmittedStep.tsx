"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { useKYCContext } from "../context/KYCContext";
import { useKYCConfig } from "../context/KYCConfigContext";
import { isNumberOnlyIdType } from "../utils/countries";
import { collectWebDeviceMetadata } from "../utils/device-metadata";
import { withRetry } from "../lib/retry";
import { mapToKycError } from "../lib/errors";
import { KYCError } from "../types/verification";

function generateRequestId(): string {
	return `kyc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Replaces {firstName} / {lastName} tokens with the user's data (or ''). */
function fillTokens(template: string, firstName?: string, lastName?: string): string {
	return template
		.replace(/\{firstName\}/g, firstName ?? '')
		.replace(/\{lastName\}/g, lastName ?? '')
		.trim();
}

export function SubmittedStep() {
	const { state, dispatch } = useKYCContext();
	const config = useKYCConfig();

	// Increment to trigger a (re-)submission; starts at 0 to fire on mount.
	const [submitTrigger, setSubmitTrigger] = useState(0);
	const submittedTriggerRef = useRef<number | null>(null);

	// While a transient failure is being retried, surface "Retrying (n/total)…"
	// under the spinner so the user knows the SDK hasn't frozen.
	const [retryInfo, setRetryInfo] = useState<{ attempt: number; total: number } | null>(null);

	useEffect(() => {
		// Guard against React 18 Strict Mode double-invocation in dev — without
		// this, each mount fires two requests with different requestIds, creating
		// duplicate Verification rows.
		if (submittedTriggerRef.current === submitTrigger) return;
		submittedTriggerRef.current = submitTrigger;
		runSubmit();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [submitTrigger]);

	async function runSubmit() {
		// Put UI into loading state immediately
		dispatch({ type: "SUBMIT_VERIFICATION" });
		setRetryInfo(null);

		if (!state.selectedIdType) {
			dispatch({ type: "SET_ERROR", payload: new KYCError("unknown", "Missing ID type.") });
			return;
		}

		const idNumber =
			isNumberOnlyIdType(state.selectedIdType) ? state.idNumber : undefined;
		if (isNumberOnlyIdType(state.selectedIdType) && !idNumber) {
			dispatch({ type: "SET_ERROR", payload: new KYCError("unknown", "Missing ID number.") });
			return;
		}

		const api = config.api;
		const requestId = generateRequestId();

		try {
			// Upload video recordings (best-effort — failures do not block verification).
			// Each gets the same transient-retry treatment, but a final failure is swallowed.
			let documentFrontVideoId: string | undefined;
			let documentBackVideoId: string | undefined;
			let livenessVideoId: string | undefined;

			if (state.documentFrontVideoBlob) {
				try {
					documentFrontVideoId = await withRetry(() => api.upload(state.documentFrontVideoBlob!, "document_front_video"));
				} catch {
					/* non-fatal */
				}
			}

			if (state.documentBackVideoBlob) {
				try {
					documentBackVideoId = await withRetry(() => api.upload(state.documentBackVideoBlob!, "document_back_video"));
				} catch {
					/* non-fatal */
				}
			}

			if (state.livenessVideoBlob) {
				try {
					livenessVideoId = await withRetry(() => api.upload(state.livenessVideoBlob!, "liveness_video"));
				} catch {
					/* non-fatal */
				}
			}

			// Merge userData: config props take precedence over user-typed values
			const firstName = config.userData?.firstName || state.userData.firstName || undefined;
			const lastName  = config.userData?.lastName  || state.userData.lastName  || undefined;
			const dob       = config.userData?.dateOfBirth;
			const userData = (firstName || lastName || dob)
				? { firstName, lastName, ...(dob ? { dateOfBirth: dob } : {}) }
				: undefined;

			// The verify submission is retried on transient failures (network /
			// timeout / 5xx); terminal errors (401/402/403) surface immediately.
			const result = await withRetry(
				() =>
					api.verify({
						country: config.country,
						idType: state.selectedIdType!,
						...(idNumber ? { idNumber } : {}),
						...(userData ? { userData } : {}),
						mediaIds: {
							documentFront: state.mediaIds.documentFront,
							documentBack: state.mediaIds.documentBack,
							selfie: state.mediaIds.selfie,
							documentFrontVideo: documentFrontVideoId,
							documentBackVideo: documentBackVideoId,
							livenessVideo: livenessVideoId,
						},
						metadata: {
							requestId,
							...config.metadata,
							device: collectWebDeviceMetadata() as unknown as Record<string, unknown>,
						},
					}),
				{ onRetry: (attempt, total) => setRetryInfo({ attempt, total }) },
			);

			setRetryInfo(null);
			dispatch({ type: "SUBMISSION_SUCCESS", payload: result.verificationId });

			config.onSubmit?.({
				verificationId: result.verificationId,
				status: "pending",
				metadata: { requestId, ...config.metadata },
				submittedAt: new Date().toISOString(),
			});
		} catch (err) {
			// Retries (if any) are exhausted — surface a typed error.
			setRetryInfo(null);
			dispatch({ type: "SET_ERROR", payload: mapToKycError(err, "verify") });
		}
	}

	// ---------------------------------------------------------------------------
	// Loading state
	// ---------------------------------------------------------------------------

	if (state.status === "loading") {
		return (
			<div className='flex flex-col items-center justify-center gap-6 py-12 animate-fade-in'>
				<div className='relative flex items-center justify-center'>
					<div className='absolute h-20 w-20 rounded-full border-2 border-primary/30 animate-pulse-ring' />
					<div className='flex h-14 w-14 items-center justify-center rounded-full bg-primary/10'>
						<Loader2 className='h-7 w-7 animate-spin text-primary' />
					</div>
				</div>
				<div className='text-center space-y-2'>
					<p className='text-base font-medium'>
						{retryInfo ? "Reconnecting…" : "Submitting your verification..."}
					</p>
					<p className='text-sm text-muted-foreground'>
						{retryInfo
							? `Connection issue — retrying (${retryInfo.attempt}/${retryInfo.total})…`
							: "Please wait a moment."}
					</p>
				</div>
			</div>
		);
	}

	// ---------------------------------------------------------------------------
	// Error state
	// ---------------------------------------------------------------------------

	if (state.status === "error" && state.error) {
		return (
			<div className='flex flex-col items-center gap-6 py-8 animate-fade-in'>
				<div className='flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10'>
					<svg
						className='h-10 w-10 text-destructive'
						viewBox='0 0 24 24'
						fill='none'
						stroke='currentColor'
						strokeWidth='2.5'
						strokeLinecap='round'
						strokeLinejoin='round'>
						<circle cx='12' cy='12' r='10' />
						<line x1='12' y1='8' x2='12' y2='12' />
						<line x1='12' y1='16' x2='12.01' y2='16' />
					</svg>
				</div>

				<div className='text-center space-y-1'>
					<h2 className='text-xl font-semibold font-heading'>
						Submission Failed
					</h2>
					<p className='text-sm text-muted-foreground'>{state.error.message}</p>
				</div>

				<Button
					className='w-full'
					onClick={() => setSubmitTrigger((t) => t + 1)}>
					Try Again
				</Button>

				<Button
					variant='ghost'
					className='w-full'
					onClick={() => config.onClose?.()}>
					Close
				</Button>
			</div>
		);
	}

	// ---------------------------------------------------------------------------
	// Success state
	// ---------------------------------------------------------------------------

	const firstName = config.userData?.firstName || state.userData.firstName;
	const lastName = config.userData?.lastName || state.userData.lastName;
	const successTitle = config.success?.title
		? fillTokens(config.success.title, firstName, lastName)
		: "Verification Submitted!";
	const successDescription = config.success?.description
		? fillTokens(config.success.description, firstName, lastName)
		: "Your identity verification has been submitted for review. You'll be notified of the result.";

	return (
		<div className='flex flex-col items-center gap-6 py-6 animate-fade-in'>
			{/* Animated checkmark */}
			<div className='flex h-20 w-20 items-center justify-center rounded-full bg-[var(--kyc-success)]/10'>
				<svg
					className='h-10 w-10 text-[var(--kyc-success)]'
					viewBox='0 0 24 24'
					fill='none'
					stroke='currentColor'
					strokeWidth='3'
					strokeLinecap='round'
					strokeLinejoin='round'>
					<path
						d='M4 12l5 5L20 6'
						strokeDasharray='100'
						strokeDashoffset='100'
						className='animate-checkmark'
					/>
				</svg>
			</div>

			<div className='text-center space-y-2'>
				<h2 className='text-xl font-semibold font-heading'>
					{successTitle}
				</h2>
				<p className='text-sm text-muted-foreground'>
					{successDescription}
				</p>
			</div>

			<Button className='w-full' onClick={() => config.onClose?.()}>
				Done
			</Button>
		</div>
	);
}
