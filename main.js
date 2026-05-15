/* ============================================================
   MasterReg — main.js
   ============================================================ */

/* ---- Active nav link ---- */
document.querySelectorAll('.nav-links a').forEach(link => {
  if (link.href === location.href) link.classList.add('active');
});

/* ---- Countdown Timer ---- */
function updateCountdown() {
  const deadline = new Date('2026-06-15T23:59:59');
  const now = new Date();
  const diff = deadline - now;
  if (diff <= 0) {
    document.querySelectorAll('.countdown').forEach(el => {
      el.innerHTML = '<span style="color:#d63f3f;font-weight:700;">Deadline passed</span>';
    });
    return;
  }
  const days  = Math.floor(diff / (1000*60*60*24));
  const hours = Math.floor((diff % (1000*60*60*24)) / (1000*60*60));
  const mins  = Math.floor((diff % (1000*60*60)) / (1000*60));
  const secs  = Math.floor((diff % (1000*60)) / 1000);

  document.querySelectorAll('.countdown').forEach(el => {
    const units = el.querySelectorAll('.countdown-unit');
    if (units.length === 4) {
      units[0].textContent = String(days).padStart(2,'0');
      units[1].textContent = String(hours).padStart(2,'0');
      units[2].textContent = String(mins).padStart(2,'0');
      units[3].textContent = String(secs).padStart(2,'0');
    } else if (units.length === 3) {
      units[0].textContent = String(hours).padStart(2,'0');
      units[1].textContent = String(mins).padStart(2,'0');
      units[2].textContent = String(secs).padStart(2,'0');
    }
  });
}
updateCountdown();
setInterval(updateCountdown, 1000);

/* ---- Fade-in on scroll ---- */
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.style.opacity = '1';
      e.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.step-card, .date-item, .ai-benefit, .prompt-card').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(28px)';
  el.style.transition = 'opacity .5s ease, transform .5s ease';
  observer.observe(el);
});

/* ---- Drag-and-drop specializations ---- */
function initDragDrop() {
  const list = document.querySelector('.specialization-list');
  if (!list) return;
  let dragEl = null;

  list.querySelectorAll('.spec-item').forEach(item => {
    item.setAttribute('draggable', true);
    item.addEventListener('dragstart', () => {
      dragEl = item;
      setTimeout(() => item.classList.add('dragging'), 0);
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      dragEl = null;
      updateRankNumbers();
    });
  });

  list.addEventListener('dragover', e => {
    e.preventDefault();
    const afterEl = getDragAfterEl(list, e.clientY);
    if (!dragEl) return;
    if (afterEl == null) list.appendChild(dragEl);
    else list.insertBefore(dragEl, afterEl);
  });
}

function getDragAfterEl(container, y) {
  const els = [...container.querySelectorAll('.spec-item:not(.dragging)')];
  return els.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function updateRankNumbers() {
  document.querySelectorAll('.specialization-list .spec-item').forEach((item, i) => {
    const rank = item.querySelector('.spec-rank');
    if (rank) rank.textContent = i + 1;
  });
}

/* ---- Remove specialization ---- */
function initRemoveSpec() {
  document.querySelectorAll('.spec-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.spec-item');
      item.style.transition = 'opacity .25s, transform .25s';
      item.style.opacity = '0';
      item.style.transform = 'translateX(20px)';
      setTimeout(() => { item.remove(); updateRankNumbers(); }, 250);
    });
  });
}

/* ---- Add specialization modal ---- */
function initAddSpec() {
  const btn = document.querySelector('.add-spec-btn');
  if (!btn) return;
  const overlay = document.getElementById('addSpecModal');
  if (!overlay) return;
  const closeBtn = overlay.querySelector('.modal-close');
  const addBtn = overlay.querySelector('.modal-add-btn');
  const input = overlay.querySelector('.modal-spec-input');

  btn.addEventListener('click', () => overlay.classList.add('open'));
  closeBtn?.addEventListener('click', () => overlay.classList.remove('open'));
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });

  addBtn?.addEventListener('click', () => {
    const name = input.value.trim();
    if (!name) return;
    const list = document.querySelector('.specialization-list');
    const items = list.querySelectorAll('.spec-item');
    const newRank = items.length + 1;
    const div = document.createElement('div');
    div.className = 'spec-item';
    div.innerHTML = `
      <span class="drag-handle">⠿</span>
      <span class="spec-rank">${newRank}</span>
      <span class="spec-name">${name}</span>
      <span class="spec-seats">— Seats</span>
      <button class="spec-remove" title="Remove">
        <svg viewBox="0 0 24 24" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`;
    list.appendChild(div);
    input.value = '';
    overlay.classList.remove('open');
    initDragDrop();
    initRemoveSpec();
  });
}

/* ---- Chat widget (home page) ---- */
function initHomeChat() {
  const input = document.querySelector('.chat-input');
  const sendBtn = document.querySelector('.chat-send');
  const body = document.querySelector('.chat-body');
  if (!input || !sendBtn || !body) return;

  function sendMsg(text) {
    const msgEl = document.createElement('div');
    msgEl.className = 'chat-msg user';
    msgEl.textContent = text;
    body.appendChild(msgEl);
    body.scrollTop = body.scrollHeight;
    input.value = '';
    // Simulate bot reply
    setTimeout(() => {
      const botEl = document.createElement('div');
      botEl.className = 'chat-msg bot';
      botEl.textContent = getBotReply(text);
      body.appendChild(botEl);
      body.scrollTop = body.scrollHeight;
    }, 800);
  }

  sendBtn.addEventListener('click', () => {
    if (input.value.trim()) sendMsg(input.value.trim());
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && input.value.trim()) sendMsg(input.value.trim());
  });
  document.querySelectorAll('.chat-suggestion').forEach(btn => {
    btn.addEventListener('click', () => sendMsg(btn.textContent));
  });
}

/* ---- Orienta AI page ---- */
function initOrientaChat() {
  const input = document.querySelector('.orienta-input');
  const sendBtn = document.querySelector('.orienta-send-btn');
  const body = document.querySelector('.orienta-chat-body');
  const counter = document.querySelector('.char-count');
  if (!input || !body) return;

  input.addEventListener('input', () => {
    if (counter) counter.textContent = `${input.value.length}/600`;
  });

  function sendMsg(text) {
    if (!text.trim()) return;
    appendMsg('user', text, body);
    input.value = '';
    if (counter) counter.textContent = '0/600';
    setTimeout(() => {
      appendMsg('bot', getBotReply(text), body);
    }, 900);
  }

  sendBtn?.addEventListener('click', () => sendMsg(input.value));
  input?.addEventListener('keydown', e => { if (e.key === 'Enter') sendMsg(input.value); });

  document.querySelectorAll('.orienta-tag, .prompt-card').forEach(el => {
    el.addEventListener('click', () => {
      const text = el.querySelector('.prompt-card-text')?.textContent || el.textContent;
      sendMsg(text.trim());
    });
  });
}

function appendMsg(role, text, body) {
  const el = document.createElement('div');
  el.className = `chat-msg ${role === 'user' ? 'user' : 'bot'}`;
  el.textContent = text;
  el.style.opacity = '0';
  el.style.transform = 'translateY(10px)';
  body.appendChild(el);
  body.scrollTop = body.scrollHeight;
  requestAnimationFrame(() => {
    el.style.transition = 'opacity .3s, transform .3s';
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  });
}

function getBotReply(text) {
  const t = text.toLowerCase();
  if (t.includes('cybersecurity') || t.includes('cyber'))
    return "Cybersecurity at your faculty is about 40% theory and 60% practical. You'll cover network defense, ethical hacking labs, cryptography, and security auditing. It's one of the most in-demand tracks with 20 available seats.";
  if (t.includes('ai') || t.includes('artificial intelligence') || t.includes('intelligence'))
    return "Artificial Intelligence covers machine learning, deep learning, NLP, and computer vision. The track has strong industry partnerships and 30 available seats. Great career paths in tech, finance, and research.";
  if (t.includes('software') || t.includes('engineering'))
    return "Software Engineering focuses on large-scale system design, Agile methodologies, cloud computing, and DevOps. With 25 seats, it's the most versatile track for software industry careers.";
  if (t.includes('data science') || t.includes('data'))
    return "Data Science covers statistics, big data processing, visualization, and machine learning pipelines. Strong demand in banking, healthcare, and e-commerce sectors.";
  if (t.includes('compare') || t.includes('difference'))
    return "Great question! Cybersecurity focuses on protecting systems, AI on building intelligent systems, and Software Engineering on scalable development. Your choice should align with your preferred balance of theory vs. practice.";
  return "I can help you explore any specialization — what it covers, career paths, difficulty, required modules, and how competitive it is. Just ask me anything!";
}

/* ---- Form submissions ---- */
function initForms() {
  const saveBtn = document.querySelector('.btn-save-draft');
  const submitBtn = document.querySelector('.btn-submit-app');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      saveBtn.textContent = '✓ Draft saved';
      saveBtn.style.color = 'var(--green-dark)';
      setTimeout(() => { saveBtn.textContent = 'Save draft'; saveBtn.style.color = ''; }, 2000);
    });
  }
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      const items = document.querySelectorAll('.spec-item');
      if (items.length < 1) {
        alert('Please add at least one specialization before submitting.');
        return;
      }
      submitBtn.textContent = '✓ Application Submitted!';
      submitBtn.style.background = 'var(--green-bright)';
      submitBtn.disabled = true;
    });
  }
}

/* ---- Init all ---- */
document.addEventListener('DOMContentLoaded', () => {
  initDragDrop();
  initRemoveSpec();
  initAddSpec();
  initHomeChat();
  initOrientaChat();
  initForms();
});
