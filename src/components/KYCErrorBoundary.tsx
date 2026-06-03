'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from './ui/button';

// Browser-only SDK; consumer bundlers inline process.env.NODE_ENV.
declare const process: { env?: { NODE_ENV?: string } } | undefined;
function isDevEnv(): boolean {
  try {
    return typeof process !== 'undefined' && process?.env?.NODE_ENV !== 'production';
  } catch {
    return false;
  }
}

interface Props {
  children: ReactNode;
  onError?: (error: Error) => void;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class KYCErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface the real error — without this the boundary silently hides what
    // actually threw, making bugs (e.g. on liveness retake) undiagnosable.
    // eslint-disable-next-line no-console
    console.error('[MyazaKYC] Uncaught error in KYC flow:', error, info.componentStack);
    this.props.onError?.(error);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold font-heading">Something went wrong</h3>
            <p className="text-sm text-muted-foreground">
              An unexpected error occurred. Please try again.
            </p>
          </div>
          <Button variant="outline" onClick={this.handleReset}>
            Try Again
          </Button>
          {isDevEnv() && this.state.error && (
            <pre className="mt-2 max-h-40 w-full overflow-auto rounded-md bg-destructive/5 p-3 text-left text-xs text-destructive whitespace-pre-wrap">
              {this.state.error.message}
              {'\n'}
              {this.state.error.stack}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
