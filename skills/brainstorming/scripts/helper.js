(function() {
  const runtime = globalThis;
  const wsProtocol = runtime.location.protocol === 'https:' ? 'wss://' : 'ws://';
  const WS_URL = wsProtocol + runtime.location.host;
  const reconnectBaseDelayMs = 1000;
  const reconnectMaxDelayMs = 30000;
  const reconnectJitterMs = 250;
  let ws = null;
  let eventQueue = [];
  let reconnectAttempts = 0;

  function getReconnectDelay() {
    const exponentialDelay = reconnectBaseDelayMs * (2 ** reconnectAttempts);
    const jitter = Math.floor(Math.random() * reconnectJitterMs);
    return Math.min(exponentialDelay + jitter, reconnectMaxDelayMs);
  }

  function updateIndicator(indicator, value) {
    if (!indicator) return;

    if (!value) {
      indicator.textContent = 'Click an option above, then return to the terminal';
      return;
    }

    const selectedText = document.createElement('span');
    selectedText.className = 'selected-text';
    selectedText.textContent = value;

    indicator.replaceChildren(
      selectedText,
      document.createTextNode(' — return to terminal to continue')
    );
  }

  function updateConnectionStatus(state) {
    const status = document.querySelector('.status');
    if (!status) return;

    const statusText = {
      connecting: 'Connecting',
      connected: 'Connected',
      disconnected: 'Disconnected'
    }[state] || 'Disconnected';

    status.dataset.state = state;
    status.textContent = statusText;
    status.setAttribute('aria-label', `Connection status: ${statusText.toLowerCase()}`);
    status.setAttribute('aria-busy', String(state === 'connecting'));
  }

  function syncSelectableState(container) {
    if (!container) return;

    const items = Array.from(container.querySelectorAll('.option, .card'));
    const activeItem = items.find((item) => item.classList.contains('selected')) || items[0] || null;

    items.forEach((item) => {
      const isSelected = item.classList.contains('selected');
      item.setAttribute('aria-selected', String(isSelected));
      if (item.classList.contains('card')) {
        item.setAttribute('aria-pressed', String(isSelected));
      }
      item.tabIndex = item === activeItem ? 0 : -1;
    });
  }

  function connect() {
    updateConnectionStatus('connecting');
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      reconnectAttempts = 0;
      updateConnectionStatus('connected');
      eventQueue.forEach(e => ws.send(JSON.stringify(e)));
      eventQueue = [];
    };

    ws.onmessage = (msg) => {
      let data;

      try {
        data = JSON.parse(msg.data);
      } catch {
        return;
      }

      if (data.type === 'reload') {
        runtime.location.reload();
      }
    };

    ws.onclose = () => {
      updateConnectionStatus('disconnected');
      const reconnectDelay = getReconnectDelay();
      reconnectAttempts += 1;
      setTimeout(connect, reconnectDelay);
    };
  }

  function sendEvent(event) {
    const timestampedEvent = {
      ...event,
      timestamp: Date.now()
    };

    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(timestampedEvent));
    } else {
      eventQueue.push(timestampedEvent);
    }
  }

  // Capture clicks on choice elements
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-choice]');
    if (!target) return;

    sendEvent({
      type: 'click',
      text: target.textContent.trim(),
      choice: target.dataset.choice,
      id: target.id || null
    });

    // Update indicator bar (defer so toggleSelect runs first)
    setTimeout(() => {
      const indicator = document.getElementById('indicator-text');
      if (!indicator) return;
      const container = target.closest('.options') || target.closest('.cards');
      const selected = container ? container.querySelectorAll('.selected') : [];
      if (selected.length === 0) {
        indicator.textContent = 'Click an option above, then return to the terminal';
      } else if (selected.length === 1) {
        const label = selected[0].querySelector('h3, .content h3, .card-body h3')?.textContent?.trim() || selected[0].dataset.choice;
        updateIndicator(indicator, label + ' selected');
      } else {
        updateIndicator(indicator, selected.length + ' selected');
      }
    }, 0);
  });

  // Frame UI: selection tracking
  runtime.selectedChoice = null;

  runtime.toggleSelect = function(el) {
    const container = el.closest('.options') || el.closest('.cards');
    const multi = container?.dataset.multiselect !== undefined
      && container.dataset.multiselect !== 'false';
    if (container && !multi) {
      container.querySelectorAll('.option, .card').forEach(o => o.classList.remove('selected'));
    }
    if (multi) {
      el.classList.toggle('selected');
    } else {
      el.classList.add('selected');
    }
    syncSelectableState(container);
    const selectedValues = container
      ? Array.from(container.querySelectorAll('.option.selected, .card.selected'))
        .map((item) => item.dataset.choice)
        .filter((value) => value !== undefined && value !== '')
      : [];
    runtime.selectedChoice = multi ? selectedValues : (selectedValues[0] ?? null);
  };

  // Expose API for explicit use
  runtime.brainstorm = {
    send: sendEvent,
    choice: (value, metadata = {}) => sendEvent({ ...metadata, type: 'choice', value })
  };

  connect();
})();
