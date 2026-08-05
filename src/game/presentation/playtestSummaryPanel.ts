/* global HTMLButtonElement, HTMLDivElement, navigator */

export interface PlaytestSummaryPanel {
  show(summaryText: string): void;
  hide(): void;
  destroy(): void;
  isVisible(): boolean;
  getSummaryText(): string;
}

export function createPlaytestSummaryPanel(root: HTMLElement | null): PlaytestSummaryPanel {
  let panel: HTMLDivElement | null = null;
  let summaryText = '';
  let visible = false;

  const ensure = () => {
    if (panel || !root) return panel;
    panel = document.createElement('div');
    panel.className = 'rh3-playtest-summary';
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', 'RH-3 Playtest Summary');
    panel.hidden = true;
    panel.innerHTML = [
      '<h2 class="rh3-playtest-summary__title">RH-3 Playtest Summary</h2>',
      '<pre class="rh3-playtest-summary__body"></pre>',
      '<button type="button" class="rh3-playtest-summary__copy">Copy Playtest Summary</button>',
      '<p class="rh3-playtest-summary__status" aria-live="polite"></p>',
    ].join('');
    const copyButton = panel.querySelector('.rh3-playtest-summary__copy') as HTMLButtonElement;
    copyButton.addEventListener('click', async () => {
      const status = panel?.querySelector('.rh3-playtest-summary__status');
      try {
        if (!navigator.clipboard?.writeText) {
          throw new Error('clipboard unavailable');
        }
        await navigator.clipboard.writeText(summaryText);
        if (status) status.textContent = 'Playtest summary copied.';
      } catch {
        if (status) {
          status.textContent =
            'Clipboard unavailable. Select the summary text above and copy it manually.';
        }
      }
    });
    root.append(panel);
    return panel;
  };

  return {
    show(text) {
      summaryText = text;
      const node = ensure();
      if (!node) return;
      const body = node.querySelector('.rh3-playtest-summary__body');
      if (body) body.textContent = text;
      const status = node.querySelector('.rh3-playtest-summary__status');
      if (status) status.textContent = '';
      node.hidden = false;
      visible = true;
    },
    hide() {
      if (panel) panel.hidden = true;
      visible = false;
    },
    destroy() {
      panel?.remove();
      panel = null;
      visible = false;
      summaryText = '';
    },
    isVisible() {
      return visible;
    },
    getSummaryText() {
      return summaryText;
    },
  };
}
