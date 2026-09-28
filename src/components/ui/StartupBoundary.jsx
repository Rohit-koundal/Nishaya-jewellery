import { Component } from 'react';

// Keep this outside Redux/theme providers so even a provider failure has a UI.
// Never auto-reload: it could interrupt checkout or an unsaved admin form.
export default class StartupBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="store-startup" role="alert">
      <p className="store-startup__brand">NISHAYA JEWELLERY</p>
      <h1>We couldn't open the store</h1>
      <p>Check your connection and try again. Save any open edits before reloading.</p>
      <button className="store-startup__retry" type="button" onClick={() => window.location.reload()}>Reload page</button>
    </main>;
  }
}
