"use client";

import { AlertTriangle, ImageUp, RotateCcw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";
import {
	CAPTURE_CHECK_CONTINUE_ANYWAY,
	CAPTURE_CHECK_TITLE,
	captureProblemMessages,
	captureProblemSides,
	captureRetakeLabel,
	type CaptureProblem,
	type CaptureSide,
} from "../lib/document-capture-check";

// The review footer when the capture check found a photo the verification could
// not read. Retaking is the primary action; a detector can miss, so continuing
// with the photos as they are stays one tap away.

export function DocumentCaptureWarning({
	problems,
	uploadOnly,
	isBusy,
	onRetake,
	onContinueAnyway,
}: {
	problems: CaptureProblem[];
	/** Photos picked from the device are replaced, not retaken. */
	uploadOnly: boolean;
	isBusy: boolean;
	onRetake: (side: CaptureSide) => void;
	onContinueAnyway: () => void;
}) {
	const sides = captureProblemSides(problems);
	const RetakeIcon = uploadOnly ? ImageUp : RotateCcw;

	return (
		<div className='space-y-3 motion-safe:animate-slide-up'>
			<Alert className='border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-50 [&>svg]:text-amber-700 dark:[&>svg]:text-amber-300'>
				<AlertTriangle className='h-4 w-4' aria-hidden />
				<AlertTitle>{CAPTURE_CHECK_TITLE}</AlertTitle>
				<AlertDescription>
					<ul className='space-y-1'>
						{captureProblemMessages(problems).map((message) => (
							<li key={message}>{message}</li>
						))}
					</ul>
				</AlertDescription>
			</Alert>

			<div className={cn("grid gap-2", sides.length > 1 && "grid-cols-2")}>
				{sides.map((side, index) => (
					<Button
						key={side}
						variant={index === 0 ? "default" : "outline"}
						className='w-full gap-2'
						onClick={() => onRetake(side)}
						disabled={isBusy}>
						<RetakeIcon className='h-4 w-4' aria-hidden />
						{captureRetakeLabel(side, uploadOnly)}
					</Button>
				))}
			</div>

			<Button
				variant='outline'
				className='w-full'
				onClick={onContinueAnyway}
				disabled={isBusy}>
				{CAPTURE_CHECK_CONTINUE_ANYWAY}
			</Button>
		</div>
	);
}
