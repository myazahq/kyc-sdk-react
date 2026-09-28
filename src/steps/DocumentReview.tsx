"use client";

import { useState } from "react";
import { Check, ImageUp, RotateCcw, X, ZoomIn } from '../components/icons';
import { Button } from "../components/ui/button";
import { useText } from "../i18n";
import { retakeLabelKey, type CaptureSide } from "../lib/document-capture-check";
import { cn } from "../lib/utils";

// ─── Document review ──────────────────────────────────────────────────────────
// What the user sees once their document is captured. Stacking the sides
// full-width pushed the back image AND Continue below the fold on a phone, and
// people did not realise there was more to do. So the layout is now:
//   • both sides SIDE BY SIDE at every breakpoint, "both captured" at a glance;
//   • retake as a NAMED button under each thumbnail (an icon on the image was
//     below a usable tap target); the photo carries labels, actions carry words;
//   • the action bar PINNED to the bottom, so Continue is always visible;
//   • tap a thumbnail to enlarge it: side by side means smaller, and checking
//     a capture is legible is the whole point of this screen.

interface Side {
	side: CaptureSide;
	src: string;
	label: string;
	onRetake: () => void;
}

interface DocumentReviewProps {
	front: string;
	back?: string | null;
	/** Overlay shown over each thumbnail while uploading. */
	uploadOverlay?: React.ReactNode;
	isBusy: boolean;
	onRetakeFront: () => void;
	onRetakeBack: () => void;
	/** "upload" when each side was picked from the device: it is replaced, not retaken. */
	source?: "camera" | "upload";
	/** Errors, retry notices and the Continue button — pinned below the images. */
	children: React.ReactNode;
}

export function DocumentReview({
	front,
	back,
	uploadOverlay,
	isBusy,
	onRetakeFront,
	onRetakeBack,
	source = "camera",
	children,
}: DocumentReviewProps) {
	const t = useText();
	const [zoomed, setZoomed] = useState<Side | null>(null);
	const uploaded = source === "upload";
	const ActionIcon = uploaded ? ImageUp : RotateCcw;
	const actionLabel = t(uploaded ? "uploadDocument.replace" : "common.retake");

	const sides: Side[] = [
		{ side: "front", src: front, label: t("uploadDocument.review.front"), onRetake: onRetakeFront },
		...(back ? [{ side: "back" as const, src: back, label: t("uploadDocument.review.back"), onRetake: onRetakeBack }] : []),
	];
	const isTwoSided = sides.length > 1;
	const confirmation = t(
		isTwoSided ?
			uploaded ? "uploadDocument.review.bothAdded" : "uploadDocument.review.bothCaptured"
		: uploaded ? "uploadDocument.review.photoAdded" : "uploadDocument.review.photoCaptured",
	);

	return (
		<div className='relative flex min-h-0 flex-1 flex-col'>
			{/* Confirmation line — says the capture is COMPLETE, which is the thing
			    users were scrolling to find out. */}
			<p className='mb-3 flex items-center justify-center gap-1.5 text-sm font-medium text-foreground'>
				<span className='flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15'>
					<Check className='h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400' />
				</span>
				{confirmation}
			</p>

			<div className='min-h-0 flex-1 overflow-y-auto'>
				<div
					className={cn(
						"grid gap-3",
						// Two columns on EVERY breakpoint, not just sm+ — the phone is
						// exactly where stacking pushed the second side out of sight.
						isTwoSided ? "grid-cols-2" : "grid-cols-1",
					)}>
					{sides.map((side) => (
						<figure key={side.side} className='space-y-1'>
							{/* The frame hugs the photo (`w-fit`) instead of the column.
							    A capped image inside a full-width frame letterboxes, which
							    on a wide desktop modal means large grey bars and badges
							    stranded away from the picture's corners. */}
							<div className='relative mx-auto w-fit max-w-full overflow-hidden rounded-xl border border-border bg-muted'>
								<button
									type='button'
									onClick={() => setZoomed(side)}
									className='block cursor-zoom-in'
									aria-label={`View ${side.label.toLowerCase()} larger`}>
									{/* Height cap, not width. `w-full` alone renders at the
									    photo's natural aspect — a passport across a desktop
									    modal is ~900px tall, which pushes Retake and Continue
									    below the fold and makes reviewing a photo a scroll.
									    The point of this screen is to see the photo AND the
									    action at once. */}
									<img
										src={side.src}
										alt={`${side.label} of document`}
										className='max-h-[46vh] w-auto max-w-full object-contain'
									/>
									{/* Always visible, not hover-revealed: a phone has no
									    hover, so a hover-only affordance is simply absent on
									    the device most of these captures happen on. */}
									<span className='absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60'>
										<ZoomIn className='h-3.5 w-3.5 text-white' />
									</span>
								</button>

								<span className='absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white'>
									{side.label}
								</span>

								{uploadOverlay}
							</div>

							{/* Retake (or Replace) as a NAMED control under the photo. It was
							    a 24px unlabelled circle on the image: below a usable tap
							    target and unreadable as a button. The photo now carries only
							    labels; the actions have words. */}
							<button
								type='button'
								onClick={side.onRetake}
								disabled={isBusy}
								className='flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-40'>
								<ActionIcon className='h-3.5 w-3.5' />
								{actionLabel}
							</button>
						</figure>
					))}
				</div>

				<p className='mt-1 text-center text-xs text-muted-foreground'>
					{t("uploadDocument.review.tapToEnlarge")}
				</p>
			</div>

			{/* Pinned: the action can never end up below the fold. */}
			<div className='shrink-0 pt-4'>{children}</div>

			{/* Opaque and dark on purpose. A translucent tint of the theme
			    background is nearly the colour already behind it in dark mode, so
			    enlarging appeared to do nothing at all. An overlay has to announce
			    itself as a new layer. */}
			{zoomed && (
				<div className='absolute inset-0 z-20 flex flex-col gap-2 bg-[#0A0A12]/95 p-2'>
					<div className='flex shrink-0 items-center justify-between'>
						<span className='rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white'>
							{zoomed.label}
						</span>
						{/* A real target, not a bare glyph on a dark field. */}
						<button
							type='button'
							onClick={() => setZoomed(null)}
							aria-label='Close'
							className='flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25'>
							<X className='h-5 w-5' />
						</button>
					</div>

					{/* Clicking the image closes it — the same gesture that opened it,
					    which is what people try first. */}
					<button
						type='button'
						onClick={() => setZoomed(null)}
						aria-label='Close enlarged view'
						className='flex min-h-0 flex-1 cursor-zoom-out items-center justify-center'>
						<img
							src={zoomed.src}
							alt={`${zoomed.label} of document, enlarged`}
							className='max-h-full w-full rounded-xl object-contain'
						/>
					</button>

					<Button
						variant='secondary'
						className='h-12 w-full shrink-0 gap-1.5 bg-white/15 text-white hover:bg-white/25'
						disabled={isBusy}
						onClick={() => {
							const retake = zoomed.onRetake;
							setZoomed(null);
							retake();
						}}>
						<ActionIcon className='h-4 w-4' />
						{t(retakeLabelKey(zoomed.side, uploaded))}
					</Button>
				</div>
			)}
		</div>
	);
}
