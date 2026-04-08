(function() {
  const runtime = globalThis;
  const WS_URL = 'ws://' + runtime.location.host;
  let ws = null;
  let eventQueue = [];

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
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
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
      setTimeout(connect, 1000);
    };
  }

  function sendEvent(event) {
    event.timestamp = Date.now();
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    } else {
      eventQueue.push(event);
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
    const multi = container?.dataset.multiselect !== undefined;
    if (container && !multi) {
      container.querySelectorAll('.option, .card').forEach(o => o.classList.remove('selected'));
    }
    if (multi) {
      el.classList.toggle('selected');
    } else {
      el.classList.add('selected');
    }
    syncSelectableState(container);
    runtime.selectedChoice = el.dataset.choice;
  };

  // Expose API for explicit use
  runtime.brainstorm = {
    send: sendEvent,
    choice: (value, metadata = {}) => sendEvent({ type: 'choice', value, ...metadata })
  };

  connect();
})();
