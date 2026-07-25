import { Component } from 'react';
import './ErrorBoundary.css';

// Catches render errors in whatever it wraps and shows a fallback instead of
// letting React unmount the whole tree — without this, a single broken tab
// silently takes the entire modal (header, close button, everything) down
// with it, which is a much worse failure than a wrong number on screen.
// `resetKey` should change whenever the wrapped content changes (e.g. the
// active tab), so navigating away from the broken content clears the error.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught an error:', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-fallback">
          <p className="error-boundary-fallback__message">
            {this.props.message ?? "Une erreur inattendue est survenue lors de l'affichage de cette section."}
          </p>
          <p className="error-boundary-fallback__hint">Essayez un autre onglet, ou fermez et rouvrez cette fenêtre.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
