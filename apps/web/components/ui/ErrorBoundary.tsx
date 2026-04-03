'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  moduleName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.moduleName ? `: ${this.props.moduleName}` : ''}]`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center rounded-card border border-red/20 bg-card p-8 text-center">
          <div className="mb-3 text-3xl">⚠️</div>
          <h3 className="font-syne text-lg font-bold text-text">
            Algo deu errado{this.props.moduleName ? ` em ${this.props.moduleName}` : ''}
          </h3>
          <p className="mt-1 text-sm text-muted">
            Ocorreu um erro inesperado. Tente recarregar a página.
          </p>
          <Button
            variant="ghost"
            className="mt-4"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Tentar novamente
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
