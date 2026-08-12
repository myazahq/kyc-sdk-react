"use client";

import { Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";

// ---------------------------------------------------------------------------
// Presentational screens for SubmittedStep (loading / error / success),
// extracted so the step file stays within the 200-line rule. Pure render —
// all state and submission logic lives in SubmittedStep.tsx.
// ---------------------------------------------------------------------------

export function SubmittingScreen({ retryInfo }: { retryInfo: { attempt: number; total: number } | null }) {
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

export function SubmitErrorScreen({
	message,
	onRetry,
	onClose,
}: {
	message: string;
	onRetry: () => void;
	onClose: () => void;
}) {
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
				<p className='text-sm text-muted-foreground'>{message}</p>
			</div>

			<Button className='w-full' onClick={onRetry}>
				Try Again
			</Button>

			<Button variant='ghost' className='w-full' onClick={onClose}>
				Close
			</Button>
		</div>
	);
}

/**
 * Terminal affordance under the success message: a button, or — on hosted
 * links with no completion redirect, where a button would have nothing to do
 * (`window.close()` can't close a user-opened tab) — a static note instead.
 */
export type SubmitSuccessAction =
	| { label: string; onClick: () => void }
	| { note: string };

export function SubmitSuccessScreen({
	title,
	description,
	action,
	extra,
}: {
	title: string;
	description: string;
	action: SubmitSuccessAction;
	/** Optional block between the message and the terminal action (e.g. the KYB
	 *  key-people invite links). */
	extra?: React.ReactNode;
}) {
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
				<h2 className='text-xl font-semibold font-heading'>{title}</h2>
				<p className='text-sm text-muted-foreground'>{description}</p>
			</div>

			{extra}

			{'note' in action ? (
				<p className='text-sm text-muted-foreground text-center'>{action.note}</p>
			) : (
				<Button className='w-full' onClick={action.onClick}>
					{action.label}
				</Button>
			)}
		</div>
	);
}
