import { Component, type ReactNode } from 'react';
import { Overlay } from './overlay';

interface Props {
  children: ReactNode;
  onClose(): void;
}
/** Un chunk no disponible no debe derribar el editor ni borrar la partitura. */
export class LazyPanelBoundary extends Component<Props, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Overlay
        title="No se pudo abrir esta herramienta"
        closeLabel="Volver a la partitura"
        onClose={this.props.onClose}
      >
        <p role="alert">La herramienta no pudo cargarse. Revisa tu conexión. Tu partitura sigue en el editor.</p>
      </Overlay>
    );
  }
}
