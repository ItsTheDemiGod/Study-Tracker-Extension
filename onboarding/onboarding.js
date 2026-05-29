'use strict';

const STEPS = ['step0', 'step1', 'step2', 'step3'];

function goTo(index) {
  STEPS.forEach((id, i) => {
    document.getElementById(id).classList.toggle('hidden', i !== index);
  });
  document.querySelectorAll('.ob-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
    dot.classList.toggle('done',   i < index);
  });
}

// ── Navigation ────────────────────────────────────────────────────────────────

document.getElementById('step0Next').addEventListener('click', () => goTo(1));
document.getElementById('step1Back').addEventListener('click', () => goTo(0));
document.getElementById('step1Next').addEventListener('click', () => goTo(2));
document.getElementById('step2Back').addEventListener('click', () => goTo(1));
document.getElementById('step2Next').addEventListener('click', () => goTo(3));
document.getElementById('step3Back').addEventListener('click', () => goTo(2));
document.getElementById('step3Skip').addEventListener('click',   () => finish(true));
document.getElementById('step3Finish').addEventListener('click', () => finish(false));

// ── Finish ────────────────────────────────────────────────────────────────────

async function finish(skipKey) {
  const goalH    = Math.max(1, Math.min(12, parseInt(document.getElementById('obGoalH').value) || 4));
  const checked  = document.querySelectorAll('#obSubjects input:checked');
  const subjects = [...checked].map(el => el.value);
  const blockMode = document.querySelector('input[name="obBlockMode"]:checked')?.value || 'gentle';
  const geminiKey = skipKey ? '' : (document.getElementById('obGeminiKey').value.trim() || '');

  const { settings = {}, goals = {} } = await chrome.storage.local.get(['settings', 'goals']);

  await chrome.storage.local.set({
    settings: {
      ...settings,
      subjects:           subjects.length ? subjects : ['Math', 'DSA'],
      blockMode,
      geminiApiKey:       geminiKey,
      onboardingComplete: true,
    },
    goals: {
      ...goals,
      daily:  goalH * 3600,
      weekly: goalH * 3600 * 5,
    },
  });

  window.close();
}

// ── Init ──────────────────────────────────────────────────────────────────────

goTo(0);
