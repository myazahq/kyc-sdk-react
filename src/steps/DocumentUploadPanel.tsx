"use client";

import React, { useId, useState } from "react";
import { ArrowRight, Check, ImageUp, Loader2 } from "lucide-react";
import { isDesktopDevice } from "../lib/device";
import { cn } from "../lib/utils";

// ─── Upload-only document capture ─────────────────────────────────────────────
//
// The screen the document step shows for each side when the workflow switches
// the live camera scan off (`allowDocumentScan: false`). Nothing here touches
// the camera: no permission primer, no viewfinder, no recording. The user picks
// a photo and the step runs it through the same crop, compress and upload path
// as the camera screen's "upload a photo instead" link.
//
// The whole dashed card is the target. A screen whose only job is to open the
// photo picker does not need a button inside a card that already looks
// tappable: the card lifts on hover, answers a press, shows a focus ring, turns
// solid while a file is dragged over it and spins while a pick is prepared. The
// primary-coloured line at the bottom says what a tap does.
//
// The builder preview renders it with no handlers: the screen end users get,
// with the picker left closed.

const TIPS = [
	"Lay the document flat on a plain surface",
	"Keep all four corners inside the photo",
	"Avoid glare, shadows and blur",
];

export interface DocumentUploadPanelProps {
	/** True while an image is being compressed: the picker waits. */
	busy?: boolean;
	/** Opens the file picker. Absent in the builder preview. */
	onChoose?: () => void;
	/** Accepts a dropped image file. Absent in the builder preview. */
	onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
}

export function DocumentUploadPanel({
	busy = false,
	onChoose,
	onDrop,
}: DocumentUploadPanelProps) {
	const [dragging, setDragging] = useState(false);
	const hintId = useId();
	// Dragging a file needs a pointer and a file manager beside the browser, so
	// a phone is never told to drag anything.
	const desktop = isDesktopDevice();
	const acceptsDrop = desktop && !!onDrop && !busy;
	const live = !!onChoose && !busy;

	const title =
		busy ? "Preparing your photo…"
		: dragging ? "Drop to add this photo"
		: desktop ? "Drag a photo here"
		: "Add a photo from your gallery or files";
	const action = desktop ? "Or browse your computer" : "Tap to choose a photo";
	const label =
		desktop ?
			"Choose a photo from your computer"
		:	"Choose a photo from your gallery or files";

	return (
		<div className='space-y-4'>
			<div
				className='rounded-2xl'
				onDragOver={
					acceptsDrop ?
						(e) => {
							e.preventDefault();
							setDragging(true);
						}
					:	undefined
				}
				onDragLeave={
					acceptsDrop ?
						(e) => {
							// Moving over a child element is not leaving the drop zone.
							if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
								setDragging(false);
							}
						}
					:	undefined
				}
				onDrop={
					acceptsDrop ?
						(e) => {
							setDragging(false);
							onDrop?.(e);
						}
					:	undefined
				}>
				<button
					type='button'
					onClick={onChoose}
					disabled={!live}
					aria-label={busy ? title : label}
					aria-describedby={hintId}
					aria-busy={busy || undefined}
					className={cn(
						"group flex w-full touch-manipulation flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-6 py-9 text-center outline-none",
						"transition-[background-color,border-color,transform] duration-200 ease-out",
						"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
						dragging ? "border-primary bg-primary/10" : "border-border bg-muted/30",
						live &&
							!dragging &&
							"cursor-pointer hover:border-primary/60 hover:bg-primary/5 motion-safe:active:scale-[0.99]",
						busy && "cursor-wait",
						!onChoose && "cursor-default",
					)}>
					<span
						className={cn(
							"flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-inset ring-primary/15 transition-transform duration-200 ease-out",
							live && "motion-safe:group-hover:-translate-y-0.5",
							dragging && "bg-primary/15 motion-safe:scale-110",
						)}>
						{busy ?
							<Loader2
								className='h-6 w-6 animate-spin text-primary motion-reduce:animate-none'
								aria-hidden='true'
							/>
						:	<ImageUp className='h-7 w-7 text-primary' aria-hidden='true' />}
					</span>

					<span className='block space-y-1'>
						<span
							className='block text-base font-semibold text-foreground'
							aria-live='polite'>
							{title}
						</span>
						<span id={hintId} className='block text-sm text-muted-foreground'>
							Use a clear, well-lit photo. You'll be able to crop it next.
						</span>
					</span>

					{/* Kept in the layout while dragging or busy so the card does not
					    change height under the pointer. */}
					<span
						aria-hidden='true'
						className={cn(
							"inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 group-hover:underline group-focus-visible:underline",
							(busy || dragging) && "invisible",
						)}>
						{action}
						<ArrowRight className='h-4 w-4 transition-transform duration-200 ease-out motion-safe:group-hover:translate-x-0.5' />
					</span>
				</button>
			</div>

			<ul className='space-y-2'>
				{TIPS.map((tip) => (
					<li
						key={tip}
						className='flex items-start gap-2 text-xs text-muted-foreground'>
						<Check
							className='mt-0.5 h-3.5 w-3.5 shrink-0 text-primary'
							aria-hidden='true'
						/>
						{tip}
					</li>
				))}
			</ul>
		</div>
	);
}
