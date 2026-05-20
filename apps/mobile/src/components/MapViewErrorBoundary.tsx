import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  onError?: () => void;
};

type State = { hasError: boolean };

/** MapView 네이티브 크래시는 JS try/catch로 잡히지 않음 — 렌더 단계 오류·자식 폴백용 */
export class MapViewErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    this.props.onError?.();
  }

  render(): ReactNode {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
