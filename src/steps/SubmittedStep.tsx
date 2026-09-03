"use client";

import { configScope, SCOPE_ID_TYPES } from '../lib/scope';
import { useEffect, useRef, useState } from "react";
import { useKYCContext } from "../context/KYCContext";
import { useKYCConfig } from "../context/KYCConfigContext";
import { withRetry } from "../lib/retry";
import { mapToKycError } from "../lib/errors";
import { isBusinessFlow } from "../lib/business";
import { KYCError } from "../types/verification";
import { generateRequestId, buildSubmitMetadata, uploadCaptureVideos } from "./submit-helpers";
import { contactStepFor, expiredContactChannels } from "./contact-recovery";
import { multiIdWireSlots } from "../lib/multi-id";
import { submitBusinessApplication } from "./submit-business";
import { KeyPeopleAwaitList } from "./KeyPeopleAwaitList";
import { toAwaitRows } from "./CompletedStep";
import { KeyPeoplePending } from "./KeyPeoplePending";
import { useAwaitingPeople } from "./use-awaiting-people";
import { successAction, successDescription, successTitle } from "./success-copy";
import { PresenceExpectations } from "./presence-expectations";
import { SubmittingScreen, SubmitErrorScreen, SubmitSuccessScreen } from "./SubmittedScreens";
import { requiredPrefillSubmission } from './address/address-field-modes';

export function SubmittedStep() {
	const { state, dispatch } = useKYCContext();
	const config = useKYCConfig();

	// Increment to trigger a (re-)submission; starts at 0 to fire on mount.
	const [submitTrigger, setSubmitTrigger] = useState(0);
	const submittedTriggerRef = useRef<number | null>(null);

	// While a transient failure is being retried, surface "Retrying (n/total)…"
	// under the spinner so the user knows the SDK hasn't frozen.

	// Whether the server minted any invites for this application. Not the invites
	// themselves: those are the applicant-entered first draft, and the list the
	// screen shows comes from the server once the register has been reconciled.
	// This only answers "is a list coming?", which is the difference between a
	// waiting line and an empty space.
	const [invitesExpected, setInvitesExpected] = useState(false);
	// The register is read AFTER the submission returns, so nothing is shown until
	// the server reports it has finished: discovery can add people the applicant
	// never listed and fill in ownership they did not know, and a list shown before
	// that is one a refresh would contradict.
	const settled = useAwaitingPeople(
		config.api,
		{ token: config.hostedToken, sessionId: state.sessionId },
		state.status === "success",
	);
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
		setInvitesExpected((result.keyPeopleInvites?.length ?? 0) > 0);
		finishSubmit(result.verificationId, requestId);
	}

	async function submitIndividual(requestId: string): Promise<void> {
		// Multi-ID: everything was committed per slot; ONE submission carries all
		// the checks (the server judges it by the workflow's pass policy). The
		// primary (first) slot fills the single-ID fields.
		const multiSlots = state.multiIdSlots.length >= 2 ? state.multiIdSlots : null;
		// Scoped flows carry the scope's transport marker instead of a picked ID —
		// the server requires a published workflow of the matching scope for it.
		const scope = configScope(config);
		const primaryIdType = scope
			? SCOPE_ID_TYPES[scope]
			: multiSlots
				? multiSlots[0]!.idType
				: state.selectedIdType;
		if (!primaryIdType) {
			dispatch({ type: "SET_ERROR", payload: new KYCError("unknown", "Missing ID type.") });
			return;
		}
		const isNumberOnly = multiSlots
			? false
			: config.getIdTypeDefinition(primaryIdType)?.requiresDocumentCapture === false;
		const idNumber = multiSlots ? multiSlots[0]!.idNumber : isNumberOnly ? state.idNumber : undefined;
		if (!multiSlots && isNumberOnly && !idNumber) {
			dispatch({ type: "SET_ERROR", payload: new KYCError("unknown", "Missing ID number.") });
			return;
		}

		const api = config.api;

		// Upload video recordings (best-effort — failures never block verification).
		//
		// Multi-ID runs send the LIVENESS video only. The document recordings are
		// per-slot, but the row has ONE documentFrontVideo slot, so shipping them
		// would file the last ID's recording as though it were the verification's
		// — a quiet misattribution in an audit trail. The per-slot document
		// IMAGES are all kept either way.
		const videoIds = await uploadCaptureVideos(
			api,
			multiSlots
				? { documentFrontVideoBlob: null, documentBackVideoBlob: null, livenessVideoBlob: state.livenessVideoBlob }
				: state,
		);

		// Multi-ID: each check has its OWN document recording, so they upload
		// per slot and ride that slot rather than the row's single
		// documentFrontVideo column — which can only hold one, and would file
		// the last ID's recording as though it were the verification's own.
		// Best-effort, exactly like the single-ID videos: a failed upload costs
		// a recording, never the verification.
		const slotVideos = multiSlots
			? await Promise.all(
					multiSlots.map((slot) =>
						uploadCaptureVideos(api, {
							documentFrontVideoBlob: slot.documentFrontVideoBlob ?? null,
							documentBackVideoBlob: slot.documentBackVideoBlob ?? null,
							livenessVideoBlob: null,
						}),
					),
				)
			: null;

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
					idType: primaryIdType,
					...(idNumber ? { idNumber } : {}),
					// Multi-ID: the committed slots, in pick order — ONE submission.
					...(multiSlots ? { idChecks: multiIdWireSlots(multiSlots) } : {}),
					// Resumable session this attempt belongs to (dropped if not ours).
					...(state.sessionId ? { sessionId: state.sessionId } : {}),
					// Flow attribution — validated server-side, dropped if stale.
					...(config.workflowId ? { workflowId: config.workflowId } : {}),
					// The liveness method that ran — per-method billing for
					// prop-configured mounts (a workflow's mode wins server-side).
					...(config.livenessMode ? { livenessMode: config.livenessMode } : {}),
					// What kind of PoA document mediaIds.proofOfAddress is. This pair was
					// MISSING until 2026-08-25: the step uploaded the document, stored the
					// mediaId in state, and the submission then omitted both fields — so
					// the media was never claimed (swept on its TTL), the PoA check never
					// ran and the component never billed, from the web SDK only.
					...(state.mediaIds.proofOfAddress
						? { proofOfAddressType: state.poaDocumentType ?? 'other' }
						: {}),
					// Smart-address submission (Address Intelligence) — the pin, the
					// directions and, when attestPresence took one, the device fix.
					...(state.address
						? {
								address: {
									lat: state.address.lat,
									lng: state.address.lng,
									// The line the applicant CONFIRMED (search pick /
									// reverse geocode): the server prefers it for the
									// composed address over its own weaker derivation.
									...(state.address.label?.trim() ? { label: state.address.label.trim() } : {}),
									...(state.address.accuracy != null ? { accuracy: state.address.accuracy } : {}),
									...(state.address.directions.trim()
										? { directions: state.address.directions.trim() }
										: {}),
									...(state.address.propertyName.trim()
										? { propertyName: state.address.propertyName.trim() }
										: {}),
									...(state.address.propertyNumber.trim()
										? { propertyNumber: state.address.propertyNumber.trim() }
										: {}),
									...(state.address.street?.trim()
										? { street: state.address.street.trim() }
										: {}),
									// The rest of the edit-details form — claims,
									// sent only when actually typed.
									...(state.address.unit?.trim() ? { unit: state.address.unit.trim() } : {}),
									...(state.address.neighbourhood?.trim()
										? { neighbourhood: state.address.neighbourhood.trim() }
										: {}),
									...(state.address.city?.trim() ? { city: state.address.city.trim() } : {}),
									...(state.address.state?.trim() ? { state: state.address.state.trim() } : {}),
									...(state.address.postcode?.trim()
										? { postcode: state.address.postcode.trim() }
										: {}),
									// Workflow-REQUIRED fields the applicant left untouched
										// ride their displayed map prefill: they saw it filled and
										// confirmed by continuing, and the server 422s a required
										// field that never arrives. Typed values are absent from
										// this helper, so nothing above is overridden.
										...requiredPrefillSubmission(config.addressCollection, state.address),
										...(state.address.streetView ? { streetView: state.address.streetView } : {}),
									...(state.address.deviceLat != null && state.address.deviceLng != null
										? {
												deviceLat: state.address.deviceLat,
												deviceLng: state.address.deviceLng,
												...(state.address.deviceAccuracy != null
													? { deviceAccuracy: state.address.deviceAccuracy }
													: {}),
												...(state.address.capturedAt ? { capturedAt: state.address.capturedAt } : {}),
											}
										: {}),
								},
							}
						: {}),
					...(config.userId ? { userId: config.userId } : {}),
					...(userData ? { userData } : {}),
					// Extra-info questionnaire answers — validated server-side
					// against the workflow's published definition.
					...(Object.keys(state.questionnaireAnswers).length > 0
						? { questionnaire: state.questionnaireAnswers }
						: {}),
					// Contact-verification proof tokens (email/phone OTP steps).
					...(state.contact.emailToken || state.contact.phoneToken
						? {
								contact: {
									...(state.contact.emailToken ? { emailToken: state.contact.emailToken } : {}),
									...(state.contact.phoneToken ? { phoneToken: state.contact.phoneToken } : {}),
								},
							}
						: {}),
					mediaIds: {
						// Multi-ID: slot documents ride idChecks; only the run-level
						// media (the one selfie + videos) sit at the top level.
						documentFront: multiSlots ? undefined : state.mediaIds.documentFront,
						documentBack: multiSlots ? undefined : state.mediaIds.documentBack,
						selfie: state.mediaIds.selfie,
						// Run-level like the selfie: one PoA document / door photo per run.
						proofOfAddress: state.mediaIds.proofOfAddress,
						addressPhoto: state.mediaIds.addressPhoto,
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
			setRetryInfo(null);
			// A refusal over stale contact proofs is recoverable in-flow: clear
			// the dead tokens and walk back to the contact step, which routes
			// straight back here once re-verified (see contact-recovery.ts).
			// Everything else: retries (if any) are exhausted — surface a typed
			// error.
			const expired = expiredContactChannels(err);
			if (expired.length > 0) {
				dispatch({ type: "CLEAR_CONTACT_PROOFS", payload: { channels: expired } });
				dispatch({ type: "CLEAR_ERROR" });
				dispatch({ type: "SET_STEP", payload: contactStepFor(expired[0]) });
				return;
			}
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
	// The applicant has entered the registration name by this screen, so
	// {businessName} resolves from real data (falling back to any upfront value).
	const businessName = state.business.registrationName.trim() || config.userData?.businessName;
	const tokens = { firstName, lastName, businessName };

	return (
		<SubmitSuccessScreen
			title={successTitle(config.success, tokens)}
			description={successDescription(config.success, tokens, isBusinessFlow(config), configScope(config))}
			extra={
				<>
					{config.addressCollection?.presence?.enabled === true && state.address && (
						<PresenceExpectations />
					)}
					{
				/* ONE list, from the server, once it is final.
				 *
				 * There used to be two: links built from what the applicant typed,
				 * replaced moments later by the server's reconciled view - a
				 * different component with a different layout, swapping under the
				 * reader. The client's version was also the wrong one to show,
				 * since the register can add people they never listed and correct
				 * the roles of those they did.
				 *
				 * So nothing appears until the answer will not change. `settled`
				 * is null while that is still true, and the line below says why
				 * rather than leaving a blank where a list is about to be. */
				settled
					? settled.length > 0
						? <KeyPeopleAwaitList rows={toAwaitRows(settled)} />
						: undefined
					: isBusinessFlow(config) && invitesExpected
						? <KeyPeoplePending />
						: undefined
					}
				</>
			}
			action={successAction({
				success: config.success,
				hostedMode: config.hostedMode === true,
				tokens,
				onClose: () => config.onClose?.(),
			})}
		/>
	);
}
