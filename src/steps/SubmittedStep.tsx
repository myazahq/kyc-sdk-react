"use client";

import { useEffect, useRef, useState } from "react";
import { useKYCContext } from "../context/KYCContext";
import { useKYCConfig } from "../context/KYCConfigContext";
import { withRetry } from "../lib/retry";
import { mapToKycError } from "../lib/errors";
import { isBusinessFlow } from "../lib/business";
import { KYCError } from "../types/verification";
import { generateRequestId, fillTokens, buildSubmitMetadata, uploadCaptureVideos } from "./submit-helpers";
import { submitBusinessApplication } from "./submit-business";
import { KeyPeopleInviteLinks, type KeyPersonInvite } from "./KeyPeopleInviteLinks";
import { SubmittingScreen, SubmitErrorScreen, SubmitSuccessScreen } from "./SubmittedScreens";

export function SubmittedStep() {
	const { state, dispatch } = useKYCContext();
	const config = useKYCConfig();

	// Increment to trigger a (re-)submission; starts at 0 to fire on mount.
	const [submitTrigger, setSubmitTrigger] = useState(0);
	const submittedTriggerRef = useRef<number | null>(null);

	// While a transient failure is being retried, surface "Retrying (n/total)…"
	// under the spinner so the user knows the SDK hasn't frozen.
	const [invites, setInvites] = useState<KeyPersonInvite[]>([]);
	const [retryInfo, setRetryInfo] = useState<{ attempt: number; total: number } | null>(null);
	const onRetry = (attempt: number, total: number) => setRetryInfo({ attempt, total });

	useEffect(() => {
		// Guard against React 18 Strict Mode double-invocation in dev — without
		// this, each mount fires two requests with different requestIds, creating
		// duplicate Verification rows.
		if (submittedTriggerRef.current === submitTrigger) return;
		submittedTriggerRef.current = submitTrigger;
		runSubmit();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [submitTrigger]);

	// Business (KYB) APPLICATION — registry details + documents/key-people/
	// applicant extras, then (fire-and-forget) the applicant's own individual
	// verification. Extracted to submit-business.ts per the 200-line rule.
	async function submitBusiness(requestId: string): Promise<void> {
		if (!state.business.registrationNumber.trim()) {
			dispatch({ type: "SET_ERROR", payload: new KYCError("unknown", "Missing registration number.") });
			return;
		}
		const result = await submitBusinessApplication({ config, state, requestId, onRetry });
		setInvites(result.keyPeopleInvites);
		finishSubmit(result.verificationId, requestId);
	}

	async function submitIndividual(requestId: string): Promise<void> {
		if (!state.selectedIdType) {
			dispatch({ type: "SET_ERROR", payload: new KYCError("unknown", "Missing ID type.") });
			return;
		}
		const isNumberOnly =
			config.getIdTypeDefinition(state.selectedIdType)?.requiresDocumentCapture === false;
		const idNumber = isNumberOnly ? state.idNumber : undefined;
		if (isNumberOnly && !idNumber) {
			dispatch({ type: "SET_ERROR", payload: new KYCError("unknown", "Missing ID number.") });
			return;
		}

		const api = config.api;

		// Upload video recordings (best-effort — failures never block verification).
		const videoIds = await uploadCaptureVideos(api, state);

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
					// Flow attribution — validated server-side, dropped if stale.
					...(config.workflowId ? { workflowId: config.workflowId } : {}),
					// The liveness method that ran — per-method billing for
					// prop-configured mounts (a workflow's mode wins server-side).
					...(config.livenessMode ? { livenessMode: config.livenessMode } : {}),
					...(config.userId ? { userId: config.userId } : {}),
					...(userData ? { userData } : {}),
					// Extra-info questionnaire answers — validated server-side
					// against the workflow's published definition.
					...(Object.keys(state.questionnaireAnswers).length > 0
						? { questionnaire: state.questionnaireAnswers }
						: {}),
					mediaIds: {
						documentFront: state.mediaIds.documentFront,
						documentBack: state.mediaIds.documentBack,
						selfie: state.mediaIds.selfie,
						...videoIds,
					},
					metadata: buildSubmitMetadata(config.metadata, requestId, config.deviceIntelligence !== false),
				}),
			{ onRetry },
		);
		finishSubmit(result.verificationId, requestId);
	}

	function finishSubmit(verificationId: string, requestId: string) {
		setRetryInfo(null);
		dispatch({ type: "SUBMISSION_SUCCESS", payload: verificationId });
		config.onSubmit?.({
			verificationId,
			status: "pending",
			metadata: { ...config.metadata, requestId },
			submittedAt: new Date().toISOString(),
		});
	}

	async function runSubmit() {
		// Put UI into loading state immediately
		dispatch({ type: "SUBMIT_VERIFICATION" });
		setRetryInfo(null);
		const business = isBusinessFlow(config);
		const requestId = generateRequestId(business ? 'kyb' : 'kyc');
		try {
			if (business) await submitBusiness(requestId);
			else await submitIndividual(requestId);
		} catch (err) {
			// Retries (if any) are exhausted — surface a typed error.
			setRetryInfo(null);
			dispatch({ type: "SET_ERROR", payload: mapToKycError(err, "verify") });
		}
	}

	if (state.status === "loading") {
		return <SubmittingScreen retryInfo={retryInfo} />;
	}

	if (state.status === "error" && state.error) {
		return (
			<SubmitErrorScreen
				message={state.error.message}
				onRetry={() => setSubmitTrigger((t) => t + 1)}
				onClose={() => config.onClose?.()}
			/>
		);
	}

	const firstName = config.userData?.firstName || state.userData.firstName;
	const lastName = config.userData?.lastName || state.userData.lastName;
	const successTitle = config.success?.title
		? fillTokens(config.success.title, firstName, lastName)
		: "Verification Submitted!";
	const successDescription = config.success?.description
		? fillTokens(config.success.description, firstName, lastName)
		: isBusinessFlow(config)
			? "Your business verification has been submitted for review. You'll be notified of the result."
			: "Your identity verification has been submitted for review. You'll be notified of the result.";

	return (
		<SubmitSuccessScreen
			title={successTitle}
			description={successDescription}
			extra={invites.length > 0 ? <KeyPeopleInviteLinks invites={invites} /> : undefined}
			onDone={() => config.onClose?.()}
		/>
	);
}
