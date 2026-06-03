"use client";

import React, { useRef, useEffect, useState } from "react";
import { cn } from "../lib/utils";
import type { LivenessChallenge } from "../liveness/types";

// ---------------------------------------------------------------------------
// Animated GIF avatar showing each gesture.
// Slide-from-right transition when gesture changes.
// Always renders a fixed-height container to prevent layout shift.
// ---------------------------------------------------------------------------

const GIF_MAP: Record<LivenessChallenge, string> = {
	nod: "Nod.gif",
	turn: "Turn.gif",
	blink: "Blink.gif",
	smile: "Smile.gif",
};

const LABEL_MAP: Record<LivenessChallenge, string> = {
	nod: "Nod your head up and down",
	turn: "Turn your head to either side",
	blink: "Blink your eyes",
	smile: "Smile",
};

interface LivenessAvatarProps {
	gesture: LivenessChallenge | null;
	visible: boolean;
	/** Base path where gesture GIFs are served from. Defaults to "/kyc-assets" */
	assetsBasePath?: string;
	className?: string;
}

export function LivenessAvatar({
	gesture,
	visible,
	assetsBasePath = "/kyc-assets",
	className,
}: LivenessAvatarProps) {
	const [displayed, setDisplayed] = useState<LivenessChallenge | null>(gesture);
	const [slideState, setSlideState] = useState<"in" | "out-left" | "in-right">(
		"in",
	);
	const prevRef = useRef<LivenessChallenge | null>(null);

	useEffect(() => {
		if (gesture && gesture !== prevRef.current) {
			if (prevRef.current !== null) {
				// Slide old one out to left, then new one in from right
				setSlideState("out-left");
				const t = setTimeout(() => {
					setDisplayed(gesture);
					setSlideState("in-right");
					const t2 = setTimeout(() => setSlideState("in"), 300);
					return () => clearTimeout(t2);
				}, 250);
				prevRef.current = gesture;
				return () => clearTimeout(t);
			} else {
				setDisplayed(gesture);
				setSlideState("in");
			}
			prevRef.current = gesture;
		}
	}, [gesture]);

	const g = displayed;
	const basePath = assetsBasePath.replace(/\/$/, "");

	return (
		<div
			className={cn(
				"flex justify-center overflow-hidden transition-all duration-300 ease-in-out",
				visible ? "max-h-48 opacity-100" : "max-h-0 opacity-0",
				className,
			)}>
			<div
				className={cn(
					"transition-all duration-250",
					slideState === "out-left" && "translate-x-full opacity-0",
					slideState === "in-right" &&
						"translate-x-0 opacity-100 animate-avatar-slide-in",
					slideState === "in" && "translate-x-0 opacity-100",
				)}>
				<div className='h-32 w-32 overflow-hidden rounded-full'>
					{g && (
						<img
							src={`${basePath}/${GIF_MAP[g]}`}
							alt={LABEL_MAP[g]}
							className='h-full w-full object-cover scale-125'
						/>
					)}
				</div>
			</div>
		</div>
	);
}
