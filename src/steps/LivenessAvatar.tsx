"use client";

import React, { useRef, useEffect, useState } from "react";
import { cn } from "../lib/utils";
import type { LivenessChallenge } from "../liveness/types";

// ---------------------------------------------------------------------------
// Animated GIF avatar showing each gesture.
// GIFs are bundled as data URIs and loaded lazily per gesture so they don't
// bloat the main bundle — each loads only when its challenge is first shown.
// Falls back to URL-based loading when assetsBasePath is explicitly provided.
// ---------------------------------------------------------------------------

// The flash challenge has no gesture to demonstrate — the avatar hides for it.
type GestureChallenge = Exclude<LivenessChallenge, "flash">;

const LABEL_MAP: Record<GestureChallenge, string> = {
	nod: "Nod your head up and down",
	turn: "Turn your head to either side",
	blink: "Blink your eyes",
	smile: "Smile",
};

// Lazy loaders — each is a separate chunk in the ESM build (code splitting).
// Imported as data URIs by esbuild so no static file serving is needed.
const GIF_LOADERS: Record<GestureChallenge, () => Promise<{ default: string }>> = {
	nod: () => import("../../gifs/Nod.gif"),
	turn: () => import("../../gifs/Turn.gif"),
	blink: () => import("../../gifs/Blink.gif"),
	smile: () => import("../../gifs/Smile.gif"),
};

interface LivenessAvatarProps {
	gesture: LivenessChallenge | null;
	visible: boolean;
	/**
	 * Override the base path where gesture GIFs are served from (e.g. a CDN URL).
	 * When omitted (the default), GIFs are loaded from the bundled data URIs —
	 * no asset copying or CDN setup required.
	 */
	assetsBasePath?: string;
	className?: string;
}

export function LivenessAvatar({
	gesture: rawGesture,
	visible,
	assetsBasePath,
	className,
}: LivenessAvatarProps) {
	// Flash has no demonstrable gesture — treat it as "no avatar".
	const gesture: GestureChallenge | null =
		rawGesture === "flash" ? null : rawGesture;
	const [displayed, setDisplayed] = useState<GestureChallenge | null>(gesture);
	const [slideState, setSlideState] = useState<"in" | "out-left" | "in-right">(
		"in",
	);
	// Map of gesture → resolved src (data URI or URL)
	const [gifSrcs, setGifSrcs] = useState<Partial<Record<GestureChallenge, string>>>({});
	const prevRef = useRef<GestureChallenge | null>(null);

	// Load the GIF src for a gesture — either from the bundled data URI or URL.
	const loadGif = (g: GestureChallenge) => {
		if (assetsBasePath) {
			const base = assetsBasePath.replace(/\/$/, "");
			const FILE_MAP: Record<GestureChallenge, string> = {
				nod: "Nod.gif",
				turn: "Turn.gif",
				blink: "Blink.gif",
				smile: "Smile.gif",
			};
			setGifSrcs((prev) => ({ ...prev, [g]: `${base}/${FILE_MAP[g]}` }));
		} else {
			GIF_LOADERS[g]().then((mod) => {
				setGifSrcs((prev) => ({ ...prev, [g]: mod.default }));
			});
		}
	};

	// Pre-load the current gesture's GIF as soon as it changes.
	useEffect(() => {
		if (!gesture) return;
		if (!gifSrcs[gesture]) loadGif(gesture);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [gesture, assetsBasePath]);

	// Slide transition when the displayed gesture changes.
	useEffect(() => {
		if (gesture && gesture !== prevRef.current) {
			if (prevRef.current !== null) {
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
	const src = g ? gifSrcs[g] : undefined;

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
					{g && src && (
						<img
							src={src}
							alt={LABEL_MAP[g]}
							className='h-full w-full object-cover scale-125'
						/>
					)}
				</div>
			</div>
		</div>
	);
}
