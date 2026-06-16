/**
 * ErrorBoundary — Global React error boundary (A6)
 *
 * Catches unhandled JavaScript exceptions in the component tree and renders
 * a friendly fallback instead of a blank white screen.
 *
 * Must be a class component — React only supports error boundaries via
 * getDerivedStateFromError / componentDidCatch lifecycle methods.
 *
 * When Sentry (M1) is added, replace the console.error with:
 *   import * as Sentry from "@sentry/react";
 *   Sentry.captureException(error, { extra: errorInfo });
 */

import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  /** Optional custom fallback UI — defaults to the built-in screen */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorId: null };
  }

  static getDerivedStateFromError(): State {
    // Generate a short incident ID to help with support tickets
    const errorId = Math.random().toString(36).slice(2, 8).toUpperCase();
    return { hasError: true, errorId };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // TODO (M1): Replace with Sentry.captureException(error, { extra: errorInfo })
    console.error("[ErrorBoundary] Unhandled error:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/home";
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#f2f0eb] px-6 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>

          <h1 className="mb-2 text-xl font-semibold text-gray-800">
            Algo deu errado
          </h1>
          <p className="mb-1 text-sm text-gray-500">
            Ocorreu um erro inesperado no aplicativo.
          </p>
          {this.state.errorId && (
            <p className="mb-6 text-xs text-gray-400">
              Código do erro: <span className="font-mono">{this.state.errorId}</span>
            </p>
          )}

          <div className="flex flex-col gap-3 w-full max-w-xs">
            <Button
              onClick={this.handleReload}
              className="w-full"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Tentar novamente
            </Button>
            <Button
              variant="outline"
              onClick={this.handleGoHome}
              className="w-full"
            >
              Voltar ao início
            </Button>
          </div>

          <p className="mt-8 text-xs text-gray-400 max-w-xs">
            Se o erro persistir, entre em contato com o suporte informando o código acima.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
