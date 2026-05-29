'use strict';

const QUOTES = [
  "The secret of getting ahead is getting started.",
  "Focus is the art of knowing what to ignore.",
  "Small progress is still progress. Keep going.",
  "Your future self is watching. Make them proud.",
  "One focused hour beats three distracted ones.",
];

const params   = new URLSearchParams(location.search);
const hostname = params.get('hostname') || 'this site';

document.getElementById('blockedHostname').textContent = hostname;
document.getElementById('blockedQuote').textContent    =
  '“' + QUOTES[Math.floor(Math.random() * QUOTES.length)] + '”';

document.getElementById('goBack').addEventListener('click', () => {
  if (history.length > 1) {
    history.back();
  } else {
    window.close();
  }
});
