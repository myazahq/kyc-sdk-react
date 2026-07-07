"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
	Upload,
	RotateCcw,
	Check,
	Loader2,
	Camera,
	AlertTriangle,
	CreditCard,
} from "lucide-react";
import { StepHeader } from "../components/StepHeader";
import { ImageCropper } from "../components/ImageCropper";
import { Button } from "../components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { CameraPermissionPrimer } from "../components/CameraPermissionPrimer";
import { useKYCContext } from "../context/KYCContext";
import { useKYCConfig } from "../context/KYCConfigContext";
import { stepAfterCapture } from "../lib/post-capture";
import { ID_TYPES, getScanSides } from "../utils/countries";
import { useCamera } from "../hooks/useCamera";
import { useCameraPrimer } from "../hooks/useCameraPrimer";
import {
	useDocumentDetection,
	type CardBounds,
} from "../hooks/useDocumentDetection";
import { useImageCompress } from "../hooks/useImageCompress";
import { useLightLevel } from "../hooks/useLightLevel";
import { primeSpeech } from "../liveness/speech";
import { withRetry } from "../lib/retry";
import { mapToKycError, safeReportError } from "../lib/errors";
import { KYCError } from "../types/verification";
import { cn } from "../lib/utils";
import {
	DOCUMENT_CAPTURE_WIDTH,
	DOCUMENT_CAPTURE_HEIGHT,
	DOCUMENT_IMAGE_QUALITY,
	DOCUMENT_VIDEO_BITRATE,
	createVideoRecorder,
	logCaptureSize,
} from "../lib/capture-settings";

// Scan phases:
//   front         — camera open for front side
//   front-preview — review front image before proceeding to back
//   back          — camera open for back side
//   review        — both images shown, ready to upload and proceed
type ScanPhase = "front" | "front-preview" | "back" | "review";

// State driving the post-capture zoom-crop animation. `snapshot` is the frozen
// full live frame; `bounds` is the detected card rectangle in full video-pixel
// coordinates; `captured` is the final cropped still to commit when done.
interface CaptureZoomState {
	snapshot: string;
	videoW: number;
	videoH: number;
	bounds: CardBounds;
	mirror: boolean;
	captured: string;
}

/** Respect the user's reduced-motion preference — skip the zoom animation. */
function prefersReducedMotion(): boolean {
	return (
		typeof window !== "undefined" &&
		typeof window.matchMedia === "function" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	);
}

/**
 * Grab the current video frame as a JPEG data URL (downscaled for memory; the
 * reported `w`/`h` are the FULL video dimensions so detected card bounds map
 * correctly onto it).
 */
function grabFrameSnapshot(
	video: HTMLVideoElement,
): { url: string; w: number; h: number } | null {
	const vw = video.videoWidth;
	const vh = video.videoHeight;
	if (vw === 0 || vh === 0) return null;
	const maxW = 1280;
	const scale = vw > maxW ? maxW / vw : 1;
	const canvas = document.createElement("canvas");
	canvas.width = Math.round(vw * scale);
	canvas.height = Math.round(vh * scale);
	const ctx = canvas.getContext("2d");
	if (!ctx) return null;
	ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
	return { url: canvas.toDataURL("image/jpeg", 0.82), w: vw, h: vh };
}

export function DocumentCaptureStep() {
	const { state, dispatch } = useKYCContext();
	const config = useKYCConfig();

	// Whether the user may pick a document photo from the device (gallery / file
	// picker / drag-and-drop) instead of capturing live. Default on.
	const allowUpload = config.allowDocumentUpload !== false;

	const idTypeLabel =
		state.selectedIdType ?
			(Object.values(ID_TYPES)
				.flat()
				.find((t) => t.key === state.selectedIdType)?.label ??
			state.selectedIdType)
		:	"ID Document";

	const scanSides =
		state.selectedIdType ? getScanSides(state.selectedIdType) : "front_only";
	const isTwoSided = scanSides === "front_and_back";

	const initialPhase = (): ScanPhase => {
		if (isTwoSided) {
			if (!state.documentFrontImage) return "front";
			if (!state.documentBackImage) return "front-preview";
			return "review";
		}
		return state.documentFrontImage ? "review" : "front";
	};

	const [phase, setPhase] = useState<ScanPhase>(initialPhase);
	const [frontPreview, setFrontPreview] = useState<string | null>(
		state.documentFrontImage,
	);
	const [backPreview, setBackPreview] = useState<string | null>(
		state.documentBackImage,
	);
	const [showFlipBanner, setShowFlipBanner] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [uploadError, setUploadError] = useState<string | null>(null);
	// "Upload failed — retrying (n/total)…" surfaced while a transient upload retries.
	const [retryInfo, setRetryInfo] = useState<{
		attempt: number;
		total: number;
	} | null>(null);
	const [cropperSrc, setCropperSrc] = useState<string | null>(null);
	const [pauseForCrop, setPauseForCrop] = useState(false);
	// While set, a short "zoom-crop" animation plays over the viewport: the frozen
	// live frame zooms onto the detected document before the cropped still is
	// shown — instead of hard-cutting to a tight, zoomed crop. Cleared on finish.
	const [captureZoom, setCaptureZoom] = useState<CaptureZoomState | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	// True between opening the OS file picker and a file actually being chosen.
	// Used to detect a cancelled picker (window refocuses with no file) so we can
	// restore the camera instead of leaving a collapsed, empty screen.
	const uploadPendingRef = useRef(false);

	// Video recording refs — one recorder per camera session.
	// The "side" of each recording is captured at start time so the onstop
	// handler dispatches to the correct slot (front vs back).
	const recorderRef = useRef<MediaRecorder | null>(null);
	const docChunksRef = useRef<Blob[]>([]);
	const docMimeRef = useRef("video/webm");
	const recordingSideRef = useRef<"front" | "back" | null>(null);

	const cameraActive = (phase === "front" || phase === "back") && !pauseForCrop;

	// Show an "Allow camera access" primer before the OS prompt (Stripe-style),
	// unless the camera is already granted. The camera only starts — and thus the
	// OS prompt only fires — once the user taps "Grant access".
	const primerStatus = useCameraPrimer();
	const [primed, setPrimed] = useState(false);
	const needsPrimer = cameraActive && primerStatus === "needed" && !primed;

	// Document capture runs at a higher resolution than liveness so the still
	// image stays sharp enough for OCR (see capture-settings.ts). The video is
	// kept small via the bitrate + frame-rate caps, not by lowering resolution.
	const camera = useCamera({
		facingMode: "environment",
		enabled: cameraActive && (primerStatus === "granted" || primed),
		resolution: {
			width: DOCUMENT_CAPTURE_WIDTH,
			height: DOCUMENT_CAPTURE_HEIGHT,
		},
	});
	const detectionCanvasRef = useRef<HTMLCanvasElement | null>(null);
	const detection = useDocumentDetection({
		videoRef: camera.videoRef,
		canvasRef: detectionCanvasRef,
		enabled: cameraActive && camera.isReady,
	});
	const { compressDocument, isCompressing } = useImageCompress();
	const { level: lightLevel } = useLightLevel(
		camera.videoRef,
		cameraActive && camera.isReady,
	);
	const isDim = lightLevel === "dark";
	const isBright = lightLevel === "bright";

	// Report a denied camera permission to onError once. Document capture still
	// offers a gallery-upload fallback, so this is informational — the flow isn't
	// hard-blocked here (unlike liveness).
	const permissionReportedRef = useRef(false);
	useEffect(() => {
		if (camera.permissionDenied && !permissionReportedRef.current) {
			permissionReportedRef.current = true;
			safeReportError(
				config.onError,
				new KYCError(
					"camera_permission_denied",
					"Camera access is required to photograph your document. Please allow camera access to continue.",
				),
			);
		}
		if (!camera.permissionDenied) permissionReportedRef.current = false;
	}, [camera.permissionDenied, config]);

	// Mirror the preview when the active camera is front-facing (desktop webcams,
	// which can't honor `environment`). Display-only — captured frames via
	// canvas drawImage are unaffected, so OCR still reads correct text.
	const [mirrorPreview, setMirrorPreview] = useState(false);
	useEffect(() => {
		if (!camera.stream) {
			setMirrorPreview(false);
			return;
		}
		const settings = camera.stream.getVideoTracks()[0]?.getSettings();
		setMirrorPreview(settings?.facingMode !== "environment");
	}, [camera.stream]);

	// ---------------------------------------------------------------------------
	// Video recording — starts when camera stream is available
	// ---------------------------------------------------------------------------

	useEffect(() => {
		if (!camera.stream) return;

		docChunksRef.current = [];
		const created = createVideoRecorder(camera.stream, DOCUMENT_VIDEO_BITRATE);
		if (!created) return; // MediaRecorder not supported in this browser
		const { recorder, mimeType } = created;
		docMimeRef.current = mimeType;

		// Capture which side this recording is for. The recorder is created when the
		// camera stream becomes available, which only happens while we're in the
		// 'front' or 'back' capture phases.
		const sideAtStart: "front" | "back" = phase === "back" ? "back" : "front";
		recordingSideRef.current = sideAtStart;

		recorder.ondataavailable = (e) => {
			if (e.data.size > 0) docChunksRef.current.push(e.data);
		};
		recorder.onstop = () => {
			if (docChunksRef.current.length > 0) {
				const blob = new Blob(docChunksRef.current, {
					type: docMimeRef.current,
				});
				docChunksRef.current = [];
				logCaptureSize(`document ${sideAtStart} video`, blob);
				dispatch({
					type:
						sideAtStart === "back" ?
							"SET_DOCUMENT_BACK_VIDEO"
						:	"SET_DOCUMENT_FRONT_VIDEO",
					payload: blob,
				});
			}
		};
		recorder.start(200);
		recorderRef.current = recorder;

		return () => {
			// If the recorder was already stopped manually (e.g. on capture), let
			// the original onstop dispatch the recorded blob — don't disturb it.
			if (recorder.state === "inactive") {
				if (recorderRef.current === recorder) recorderRef.current = null;
				return;
			}
			// Otherwise the user navigated away mid-recording — discard.
			docChunksRef.current = [];
			recorder.onstop = null;
			try {
				recorder.stop();
			} catch {
				/* already stopped */
			}
			if (recorderRef.current === recorder) recorderRef.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [camera.stream, dispatch]);

	// Stop the active recorder. When `save` is true, the existing onstop handler
	// dispatches the blob to the right slot. When false (user-initiated discard),
	// chunks are cleared first and onstop is suppressed.
	const stopDocRecorder = useCallback((save: boolean) => {
		const r = recorderRef.current;
		if (!r) return;
		if (!save) {
			docChunksRef.current = [];
			r.onstop = null;
		}
		if (r.state !== "inactive") {
			try {
				r.stop();
			} catch {
				/* already stopped */
			}
		}
		recorderRef.current = null;
	}, []);

	// ---------------------------------------------------------------------------
	// Auto-capture from document detection
	// ---------------------------------------------------------------------------

	useEffect(() => {
		if (!detection.capturedImage || !cameraActive) return;
		// Discourage auto-capture while lighting is poor — a too-dark or glare-blown
		// frame won't OCR. The manual shutter still works (user override); the
		// detector will re-fire once the card stabilizes under acceptable light.
		if (lightLevel !== "ok") {
			detection.reset();
			return;
		}
		const captured = detection.capturedImage;
		const bounds = detection.cardBounds;
		// Snapshot the live frame BEFORE stopping the camera, so we can animate the
		// crop-in (camera zooming onto the document) rather than hard-cutting to the
		// tight cropped still. Falls back to an instant swap when we can't animate.
		const video = camera.videoRef.current;
		const snap =
			video && bounds && video.videoWidth > 0 ? grabFrameSnapshot(video) : null;
		detection.reset();
		stopDocRecorder(true);
		camera.stop();
		if (snap && bounds && !prefersReducedMotion()) {
			setCaptureZoom({
				snapshot: snap.url,
				videoW: snap.w,
				videoH: snap.h,
				bounds,
				mirror: mirrorPreview,
				captured,
			});
		} else {
			storeCapture(captured);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [detection.capturedImage, lightLevel]);

	// Finish the zoom-crop animation: drop the overlay and commit the still.
	const finishCaptureZoom = useCallback(() => {
		if (!captureZoom) return;
		const captured = captureZoom.captured;
		setCaptureZoom(null);
		storeCapture(captured);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [captureZoom, phase, isTwoSided]);

	// ---------------------------------------------------------------------------
	// Store a captured image for the current phase
	// ---------------------------------------------------------------------------

	function storeCapture(base64: string) {
		if (phase === "front") {
			setFrontPreview(base64);
			dispatch({ type: "SET_DOCUMENT_FRONT", payload: base64 });
			setPhase(isTwoSided ? "front-preview" : "review");
		} else if (phase === "back") {
			setBackPreview(base64);
			dispatch({ type: "SET_DOCUMENT_BACK", payload: base64 });
			setPhase("review");
		}
	}

	function proceedToBack() {
		if (backPreview) {
			setPhase("review");
			return;
		}
		setShowFlipBanner(true);
		setTimeout(() => {
			setShowFlipBanner(false);
			setPhase("back");
			detection.reset();
		}, 1500);
	}

	// ---------------------------------------------------------------------------
	// File upload / drop
	// ---------------------------------------------------------------------------

	const handleFileChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file) return;
			uploadPendingRef.current = false; // a file was chosen — not a cancel
			const reader = new FileReader();
			reader.onload = () => {
				setUploadError(null);
				setPauseForCrop(true);
				setCropperSrc(reader.result as string);
			};
			reader.readAsDataURL(file);
			e.target.value = "";
		},
		[],
	);

	const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		const file = e.dataTransfer.files?.[0];
		if (!file || !file.type.startsWith("image/")) return;
		const reader = new FileReader();
		reader.onload = () => {
			setUploadError(null);
			setPauseForCrop(true);
			setCropperSrc(reader.result as string);
		};
		reader.readAsDataURL(file);
	}, []);

	const handleCropConfirm = useCallback(
		async (cropped: string) => {
			// Uploaded/cropped documents go through OCR too — keep them sharp.
			const compressed = await compressDocument(cropped);
			logCaptureSize("document still (cropped upload)", compressed);
			setPauseForCrop(false);
			setCropperSrc(null);
			storeCapture(compressed);
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[compressDocument, phase, isTwoSided],
	);

	// Restore the camera after an upload that didn't produce a cropper (e.g. the
	// user cancelled the OS file picker), so the step never gets stuck on an
	// empty/collapsed screen.
	const cancelUpload = useCallback(() => {
		uploadPendingRef.current = false;
		setPauseForCrop(false); // cameraActive flips back on → useCamera restarts
	}, []);

	const openUpload = useCallback(() => {
		stopDocRecorder(false);
		camera.stop();
		setPauseForCrop(true);
		uploadPendingRef.current = true;

		// The native file dialog gives no "cancelled" event. When the window
		// regains focus after it closes, check (after a tick, so a real selection's
		// change event lands first) whether a file was chosen — if not, recover.
		const onFocus = () => {
			window.removeEventListener("focus", onFocus);
			window.setTimeout(() => {
				if (uploadPendingRef.current) cancelUpload();
			}, 500);
		};
		window.addEventListener("focus", onFocus);

		fileInputRef.current?.click();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [camera, stopDocRecorder, cancelUpload]);

	// ---------------------------------------------------------------------------
	// Manual capture button
	// ---------------------------------------------------------------------------

	const handleManualCapture = useCallback(async () => {
		const video = camera.videoRef.current;
		if (!video || video.readyState < video.HAVE_CURRENT_DATA) return;

		const canvas = document.createElement("canvas");
		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
		canvas.getContext("2d")?.drawImage(video, 0, 0);
		const raw = canvas.toDataURL("image/jpeg", DOCUMENT_IMAGE_QUALITY);

		const compressed = await compressDocument(raw);
		logCaptureSize("document still (manual)", compressed);
		stopDocRecorder(true);
		camera.stop();
		detection.reset();
		setUploadError(null);
		storeCapture(compressed);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [camera, compressDocument, detection, phase, isTwoSided, stopDocRecorder]);

	// ---------------------------------------------------------------------------
	// Upload images and advance to liveness
	// ---------------------------------------------------------------------------

	const handleContinue = useCallback(async () => {
		if (!frontPreview) return;

		setIsUploading(true);
		setUploadError(null);
		setRetryInfo(null);

		const api = config.api;
		const onRetry = (attempt: number, total: number) =>
			setRetryInfo({ attempt, total });

		try {
			// Convert base64 to blob for upload
			const toBlob = (dataUrl: string): Blob => {
				const [header, data] = dataUrl.split(",");
				const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
				const binary = atob(data);
				const bytes = new Uint8Array(binary.length);
				for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
				return new Blob([bytes], { type: mime });
			};

			// Upload front (retried on transient failures: network / timeout / 5xx)
			const frontBlob = toBlob(frontPreview);
			const frontMediaId = await withRetry(
				() => api.upload(frontBlob, "document_front"),
				{ onRetry },
			);
			dispatch({
				type: "SET_MEDIA_ID",
				payload: { mediaType: "documentFront", mediaId: frontMediaId },
			});

			// Upload back if present
			if (isTwoSided && backPreview) {
				const backBlob = toBlob(backPreview);
				const backMediaId = await withRetry(
					() => api.upload(backBlob, "document_back"),
					{ onRetry },
				);
				dispatch({
					type: "SET_MEDIA_ID",
					payload: { mediaType: "documentBack", mediaId: backMediaId },
				});
			}

			setRetryInfo(null);
			setIsUploading(false);
			// Skip liveness when the org has it disabled for this ID — go straight
			// to the submission step.
			const features =
				state.selectedIdType ?
					config.getIdTypeFeatures(config.country, state.selectedIdType)
				:	null;
			const skipLiveness =
				config.enableSelfie === false ||
				(features ? !features.livenessCheck : config.enableLiveness === false);
			if (!skipLiveness) primeSpeech();
			dispatch({
				type: "SET_STEP",
				payload: skipLiveness ? stepAfterCapture(config) : "liveness",
			});
		} catch (err) {
			// Retries exhausted — show the inline error AND report a typed error once.
			setRetryInfo(null);
			setIsUploading(false);
			const kycError = mapToKycError(err, "upload");
			setUploadError(kycError.message);
			safeReportError(config.onError, kycError);
		}
	}, [
		frontPreview,
		backPreview,
		isTwoSided,
		config,
		dispatch,
		state.selectedIdType,
	]);

	// ---------------------------------------------------------------------------
	// Retake helpers
	// ---------------------------------------------------------------------------

	const retakeFront = () => {
		stopDocRecorder(false);
		setCaptureZoom(null);
		setFrontPreview(null);
		setUploadError(null);
		dispatch({ type: "CLEAR_DOCUMENT_FRONT" });
		detection.reset();
		setPhase("front");
	};

	const retakeBack = () => {
		stopDocRecorder(false);
		setCaptureZoom(null);
		setBackPreview(null);
		setUploadError(null);
		dispatch({ type: "CLEAR_DOCUMENT_BACK" });
		detection.reset();
		setPhase("back");
	};

	const handleBack = () => {
		camera.stop();
		setCaptureZoom(null);
		detection.reset();
		dispatch({ type: "SET_STEP", payload: "id-type" });
	};

	// ---------------------------------------------------------------------------
	// Labels
	// ---------------------------------------------------------------------------

	const isBusy = isCompressing || isUploading;

	// The gallery fallback is normally gated by `allowDocumentUpload`, but it's
	// always offered on the camera-permission-denied screen as an escape hatch so
	// the user is never hard-stuck without a way to provide their document.
	const showUploadFallback = allowUpload || camera.permissionDenied;

	// Centered spinner overlay shown over the document preview frame while uploading.
	const uploadOverlay = (
		<div className='absolute inset-0 flex items-center justify-center bg-black/40 animate-fade-in'>
			<div className='relative flex items-center justify-center'>
				<div className='absolute h-16 w-16 rounded-full border-2 border-primary/40 animate-pulse-ring' />
				<div className='flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 backdrop-blur-sm'>
					<Loader2 className='h-6 w-6 animate-spin text-primary' />
				</div>
			</div>
		</div>
	);

	const title =
		phase === "front" ?
			isTwoSided ? `Scan Front of Your ${idTypeLabel}`
			:	`Capture Your ${idTypeLabel}`
		: phase === "front-preview" ? "Front Side Captured"
		: phase === "back" ? `Scan Back of Your ${idTypeLabel}`
		: `Review Your ${idTypeLabel}`;

	const description =
		phase === "front" ?
			isTwoSided ? `Place the FRONT of your ${idTypeLabel} within the frame.`
			:	`Photograph your ${idTypeLabel} — position it within the frame and hold steady.`
		: phase === "front-preview" ?
			"Looks good? Tap Next to flip the card and scan the back side."
		: phase === "back" ?
			`Now place the BACK of your ${idTypeLabel} within the frame.`
		: isTwoSided ? "Both sides captured. Tap Continue to proceed."
		: "Looks good? Tap Continue to proceed.";

	const stepProgress =
		phase === "front" ?
			isTwoSided ? "Step 1 of 2"
			:	null
		: phase === "front-preview" ?
			isTwoSided ? "Step 1 of 2"
			:	null
		: phase === "back" ? "Step 2 of 2"
		: null;

	// ---------------------------------------------------------------------------
	// Render
	// ---------------------------------------------------------------------------

	if (cropperSrc) {
		const cancelCrop = () => {
			setCropperSrc(null);
			setPauseForCrop(false);
		};
		return (
			<div className='space-y-4 animate-slide-up'>
				<StepHeader
					title={
						phase === "back" ? "Crop Back of Document" : "Crop Your Document"
					}
					description='Position the frame so your ID card fills it edge-to-edge.'
					onBack={cancelCrop}
				/>
				<ImageCropper
					src={cropperSrc}
					onConfirm={handleCropConfirm}
					onCancel={cancelCrop}
				/>
			</div>
		);
	}

	return (
		<div className='space-y-5 animate-slide-up'>
			<StepHeader title={title} description={description} onBack={handleBack} />

			{/* Document type badge + progress */}
			<div className='flex flex-wrap items-center gap-2'>
				<div className='flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary'>
					<CreditCard
						className={cn(
							"h-4 w-4 shrink-0",
							showFlipBanner && "animate-card-flip",
						)}
					/>
					<span className='font-medium shrink-0'>Required:</span>
					<span className='min-w-0 wrap-break-word'>{idTypeLabel}</span>
					{isTwoSided && phase !== "review" && (
						<span className='shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold'>
							{phase === "back" ? "Back Side" : "Front Side"}
						</span>
					)}
				</div>
				{stepProgress && (
					<span className='shrink-0 text-xs text-muted-foreground'>
						{stepProgress}
					</span>
				)}
			</div>

			{/* Flip banner */}
			{showFlipBanner && (
				<div className='flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-primary animate-fade-in'>
					<CreditCard className='h-4 w-4 animate-card-flip' />
					Great! Now flip your card over to scan the back.
				</div>
			)}

			{/* Hidden file input */}
			<input
				ref={fileInputRef}
				type='file'
				accept='image/*'
				className='hidden'
				onChange={handleFileChange}
			/>

			{/* ------------------------------------------------------------------ */}
			{/* Front preview                                                        */}
			{/* ------------------------------------------------------------------ */}
			{phase === "front-preview" && (
				<div className='space-y-4'>
					<div className='overflow-hidden rounded-xl border border-border'>
						<img
							src={frontPreview!}
							alt='Front of document'
							className='w-full object-contain'
						/>
					</div>
					<div className='flex gap-3'>
						<Button
							variant='outline'
							className='flex-1 gap-2'
							onClick={retakeFront}
							disabled={isBusy}>
							<RotateCcw className='h-4 w-4' />
							Retake
						</Button>
						<Button
							className='flex-1 gap-2'
							onClick={proceedToBack}
							disabled={isBusy}>
							{backPreview ? "Continue to Review" : "Next — Scan Back"}
						</Button>
					</div>
				</div>
			)}

			{/* ------------------------------------------------------------------ */}
			{/* Review screen                                                        */}
			{/* ------------------------------------------------------------------ */}
			{phase === "review" && (
				<div className='space-y-4'>
					{isTwoSided ?
						<div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
							<div className='space-y-1.5'>
								<p className='text-xs font-medium text-muted-foreground text-center'>
									Front
								</p>
								<div className='relative overflow-hidden rounded-xl border border-border'>
									<img
										src={frontPreview!}
										alt='Front of document'
										className='w-full object-contain'
									/>
									{isUploading && uploadOverlay}
								</div>
								<Button
									variant='ghost'
									size='sm'
									className='w-full gap-1.5 text-xs'
									onClick={retakeFront}
									disabled={isBusy}>
									<RotateCcw className='h-3.5 w-3.5' />
									Retake Front
								</Button>
							</div>
							<div className='space-y-1.5'>
								<p className='text-xs font-medium text-muted-foreground text-center'>
									Back
								</p>
								<div className='relative overflow-hidden rounded-xl border border-border'>
									<img
										src={backPreview!}
										alt='Back of document'
										className='w-full object-contain'
									/>
									{isUploading && uploadOverlay}
								</div>
								<Button
									variant='ghost'
									size='sm'
									className='w-full gap-1.5 text-xs'
									onClick={retakeBack}
									disabled={isBusy}>
									<RotateCcw className='h-3.5 w-3.5' />
									Retake Back
								</Button>
							</div>
						</div>
					:	<div className='space-y-3'>
							<div className='relative overflow-hidden rounded-xl border border-border'>
								<img
									src={frontPreview!}
									alt='Document'
									className='w-full object-contain'
								/>
								{isUploading && uploadOverlay}
							</div>
							<Button
								variant='ghost'
								size='sm'
								className='w-full gap-1.5'
								onClick={retakeFront}
								disabled={isBusy}>
								<RotateCcw className='h-4 w-4' />
								Retake Photo
							</Button>
						</div>
					}

					{retryInfo && isUploading && (
						<p className='text-center text-xs text-amber-700 dark:text-amber-400'>
							Upload failed — retrying ({retryInfo.attempt}/{retryInfo.total})…
						</p>
					)}

					{uploadError ?
						<div className='space-y-3'>
							<Alert variant='destructive'>
								<AlertTriangle className='h-4 w-4' />
								<AlertTitle>Upload Failed</AlertTitle>
								<AlertDescription>{uploadError}</AlertDescription>
							</Alert>
							<Button
								className='w-full gap-2'
								onClick={handleContinue}
								disabled={isBusy}>
								Try Again
							</Button>
						</div>
					:	<Button
							className='w-full gap-2'
							onClick={handleContinue}
							disabled={isBusy}>
							{isUploading ?
								<Loader2 className='h-4 w-4 animate-spin' />
							:	<Check className='h-4 w-4' />}
							Continue
						</Button>
					}
				</div>
			)}

			{/* ------------------------------------------------------------------ */}
			{/* Camera permission primer (before the OS prompt)                     */}
			{/* ------------------------------------------------------------------ */}
			{needsPrimer && !showFlipBanner && (
				<CameraPermissionPrimer
					bodyText="When prompted, allow camera access to photograph your document."
					onGrant={() => setPrimed(true)}
				/>
			)}

			{/* ------------------------------------------------------------------ */}
			{/* Camera / capture screen                                             */}
			{/* ------------------------------------------------------------------ */}
			{cameraActive && !needsPrimer && !showFlipBanner && (
				<div className='space-y-3'>
					<div
						className='relative overflow-hidden rounded-xl bg-black'
						style={{ aspectRatio: "16/10" }}
						onDragOver={allowUpload ? (e) => e.preventDefault() : undefined}
						onDrop={allowUpload ? handleDrop : undefined}>
						<video
							ref={camera.videoRef}
							autoPlay
							playsInline
							muted
							className={cn(
								"h-full w-full object-cover",
								mirrorPreview && "transform-[scaleX(-1)]",
							)}
						/>
						<canvas
							ref={detectionCanvasRef}
							className='absolute hidden'
							aria-hidden='true'
						/>

						{camera.isReady && !camera.error && (
							<DocumentDetectionOverlay
								isDetected={detection.isCardDetected}
								isStable={detection.isStable}
								side={phase === "back" ? "back" : "front"}
							/>
						)}

						{!camera.isReady && !camera.error && (
							<div className='absolute inset-0 flex items-center justify-center bg-black/70'>
								<div className='h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent' />
							</div>
						)}

						{camera.error && (
							<div className='absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 text-center text-white'>
								{camera.permissionDenied ?
									<>
										<p className='text-sm font-medium'>
											Camera access was denied
										</p>
										<p className='text-xs text-white/80'>
											Allow camera access in your browser/site settings and tap
											Try Again
											{showUploadFallback ?
												" — or upload a photo of your document instead."
											:	"."}
										</p>
									</>
								:	<p className='text-sm'>{camera.error}</p>}
								<div className='flex gap-2'>
									<Button
										variant='outline'
										size='sm'
										onClick={() => camera.restart("environment")}
										className='border-white/30 text-white'>
										Try Again
									</Button>
									{showUploadFallback && (
										<Button
											variant='outline'
											size='sm'
											onClick={openUpload}
											className='border-white/30 text-white gap-1'>
											<Upload className='h-3.5 w-3.5' /> Upload
										</Button>
									)}
								</div>
							</div>
						)}

						{camera.isReady && !camera.error && !captureZoom && (
							<div className='absolute bottom-4 left-0 right-0 flex items-center justify-center'>
								<button
									onClick={handleManualCapture}
									className='flex h-14 w-14 items-center justify-center rounded-full border-4 border-primary bg-white transition-transform active:scale-95'
									aria-label='Capture photo'>
									<Camera className='h-5 w-5 text-primary' />
								</button>
							</div>
						)}

						{captureZoom && (
							<CaptureZoomTransition
								{...captureZoom}
								onDone={finishCaptureZoom}
							/>
						)}
					</div>

					<p className='text-center text-xs text-muted-foreground'>
						Card detected automatically · or tap the button to capture manually
					</p>

					{(isDim || isBright) && (
						<div className='flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 animate-lighting-in dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400'>
							<svg
								xmlns='http://www.w3.org/2000/svg'
								width='14'
								height='14'
								viewBox='0 0 24 24'
								fill='none'
								stroke='currentColor'
								strokeWidth='2'
								strokeLinecap='round'
								strokeLinejoin='round'
								className='mt-0.5 shrink-0'>
								<path d='M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5' />
								<path d='M9 18h6M10 22h4' />
							</svg>
							<span>
								{isBright ?
									"Too bright — reduce glare or move away from direct light for a clearer capture."
								:	"It looks dark here. Move to a brighter area for a clearer capture."
								}
							</span>
						</div>
					)}

					{allowUpload && (
						<div className='flex items-center justify-center gap-1.5 text-xs text-muted-foreground'>
							<span>Having trouble?</span>
							<button
								type='button'
								onClick={openUpload}
								className='inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline'>
								<Upload className='h-3 w-3' />
								Upload a photo instead
							</button>
						</div>
					)}
				</div>
			)}

			{/* Upload-in-progress placeholder — keeps the step from collapsing to an
          empty shell while the OS file picker is open (and gives a way back if
          the user cancels it). */}
			{pauseForCrop && (phase === "front" || phase === "back") && (
				<div className='space-y-3'>
					<div
						className='flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted/30 text-center'
						style={{ aspectRatio: "16/10" }}>
						<Loader2 className='h-6 w-6 animate-spin text-primary' />
						<p className='text-sm text-muted-foreground'>
							Opening photo picker…
						</p>
						<Button
							variant='outline'
							size='sm'
							onClick={cancelUpload}
							className='gap-1.5'>
							<Camera className='h-3.5 w-3.5' />
							Back to camera
						</Button>
					</div>
				</div>
			)}

			{isCompressing && (
				<p className='text-center text-xs text-muted-foreground'>
					Compressing image…
				</p>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// DocumentDetectionOverlay
// ---------------------------------------------------------------------------

function DocumentDetectionOverlay({
	isDetected,
	isStable,
	side,
}: {
	isDetected: boolean;
	isStable: boolean;
	side: "front" | "back";
}) {
	const GX = 15,
		GY = 12,
		GW = 130,
		GH = 76,
		cornerLen = 10;
	const borderColor = isDetected ? "#22c55e" : "rgba(255,255,255,0.85)";
	const borderWidth = isDetected ? 1.5 : 0.6;
	const label =
		isStable ? "Capturing…"
		: isDetected ? "Hold still…"
		: side === "back" ? "Align the BACK of your card"
		: "Align your ID within the frame";

	return (
		<div className='pointer-events-none absolute inset-0'>
			<svg
				className='h-full w-full'
				viewBox='0 0 160 100'
				preserveAspectRatio='none'>
				<defs>
					<mask id='doc-detect-mask'>
						<rect width='160' height='100' fill='white' />
						<rect x={GX} y={GY} width={GW} height={GH} rx='3' fill='black' />
					</mask>
				</defs>
				<rect
					width='160'
					height='100'
					fill='rgba(0,0,0,0.55)'
					mask='url(#doc-detect-mask)'
				/>
				<rect
					x={GX}
					y={GY}
					width={GW}
					height={GH}
					rx='3'
					fill='none'
					stroke={borderColor}
					strokeWidth={borderWidth}
					strokeDasharray={isDetected ? undefined : "7 3"}
				/>
				<path
					d={`M${GX},${GY + cornerLen} L${GX},${GY} L${GX + cornerLen},${GY}`}
					fill='none'
					stroke={borderColor}
					strokeWidth='2'
					strokeLinecap='round'
				/>
				<path
					d={`M${GX + GW - cornerLen},${GY} L${GX + GW},${GY} L${GX + GW},${GY + cornerLen}`}
					fill='none'
					stroke={borderColor}
					strokeWidth='2'
					strokeLinecap='round'
				/>
				<path
					d={`M${GX + GW},${GY + GH - cornerLen} L${GX + GW},${GY + GH} L${GX + GW - cornerLen},${GY + GH}`}
					fill='none'
					stroke={borderColor}
					strokeWidth='2'
					strokeLinecap='round'
				/>
				<path
					d={`M${GX + cornerLen},${GY + GH} L${GX},${GY + GH} L${GX},${GY + GH - cornerLen}`}
					fill='none'
					stroke={borderColor}
					strokeWidth='2'
					strokeLinecap='round'
				/>
			</svg>
			<div className='absolute bottom-20 left-0 right-0 text-center'>
				<span
					className={cn(
						"rounded-full px-3 py-1 text-xs font-medium backdrop-blur-sm",
						isDetected ?
							"bg-green-500/20 text-green-300"
						:	"bg-black/30 text-white/80",
					)}>
					{label}
				</span>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// CaptureZoomTransition
// ---------------------------------------------------------------------------

/**
 * Plays a short "the camera zoomed onto your document" animation: the frozen
 * full live frame (rendered object-cover, exactly as the user just saw it) pans
 * and scales so the detected card rectangle expands to fill the frame, then
 * hands off to the cropped still. A quick white shutter flash sells the capture.
 *
 * The transform is derived from the object-cover mapping between video pixels
 * and the rendered container, so the zoom tracks the real on-screen position of
 * the document.
 */
function CaptureZoomTransition({
	snapshot,
	videoW,
	videoH,
	bounds,
	mirror,
	onDone,
}: CaptureZoomState & { onDone: () => void }) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const doneRef = useRef(false);
	const [transform, setTransform] = useState<string>("none");

	const done = useCallback(() => {
		if (doneRef.current) return;
		doneRef.current = true;
		onDone();
	}, [onDone]);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) {
			done();
			return;
		}
		const { width: W, height: H } = el.getBoundingClientRect();
		if (W === 0 || H === 0) {
			done();
			return;
		}

		// object-cover: the frame is uniformly scaled to cover the container, then
		// center-cropped. Map the card's center (video px) to container px.
		const s = Math.max(W / videoW, H / videoH);
		const bcx = bounds.x + bounds.width / 2;
		const bcy = bounds.y + bounds.height / 2;
		let dcx = (bcx - videoW / 2) * s + W / 2;
		const dcy = (bcy - videoH / 2) * s + H / 2;
		// When the preview is mirrored, the content is flipped horizontally, so the
		// card's on-screen x is mirrored about the container center too.
		if (mirror) dcx = W - dcx;

		// Zoom so the whole card fits the container (min → "contain" the card),
		// matching the framing of the cropped still we hand off to.
		const z = Math.min(W / (bounds.width * s), H / (bounds.height * s));
		// translate so the card center lands at the container center (origin 50%).
		const tx = -z * (dcx - W / 2);
		const ty = -z * (dcy - H / 2);

		// Start at identity (the live framing), then animate to the zoom on the next
		// frame so the browser registers the transition.
		const raf = requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				setTransform(`translate(${tx}px, ${ty}px) scale(${z})`);
			});
		});

		// Safety net: if transitionend never fires, finish anyway.
		const timer = window.setTimeout(done, 900);
		return () => {
			cancelAnimationFrame(raf);
			window.clearTimeout(timer);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<div ref={containerRef} className='absolute inset-0 z-10 overflow-hidden bg-black'>
			<div
				className='h-full w-full will-change-transform'
				style={{
					transform,
					transformOrigin: "50% 50%",
					transition:
						transform === "none" ?
							undefined
						:	"transform 620ms cubic-bezier(0.22, 1, 0.36, 1)",
				}}
				onTransitionEnd={(e) => {
					if (e.propertyName === "transform") done();
				}}>
				<img
					src={snapshot}
					alt=''
					draggable={false}
					className={cn(
						"h-full w-full object-cover",
						mirror && "transform-[scaleX(-1)]",
					)}
				/>
			</div>
			<div className='pointer-events-none absolute inset-0 bg-white animate-capture-flash' />
		</div>
	);
}

