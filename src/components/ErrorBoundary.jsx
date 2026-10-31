import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", minHeight: "60vh", padding: 40,
        }}>
          <h2 style={{ color: "#ef4444", marginBottom: 12 }}>Something went wrong</h2>
          <p style={{ color: "#6b7280", marginBottom: 20 }}>
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.href = "/";
            }}
          >
            Go to Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
