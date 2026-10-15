const grid = document.querySelector('#notesGrid');
const count = document.querySelector('#noteCount');
const visibleCount = document.querySelector('#visibleCount');
const search = document.querySelector('#search');
const empty = document.querySelector('#emptyState');
const modal = document.querySelector('#modal');
const form = document.querySelector('#noteForm');
const heading = document.querySelector('#heading');
const answer = document.querySelector('#answer');
const error = document.querySelector('#formError');
const subjectNav = document.querySelector('#subjectNav');
const subjectModal = document.querySelector('#subjectModal');
const subjectForm = document.querySelector('#subjectForm');
const subjectName = document.querySelector('#subjectName');
const subjectError = document.querySelector('#subjectError');
const reader = document.querySelector('#reader');
const studyModal = document.querySelector('#studyModal');
const studyButton = document.querySelector('#studyButton');
const answerPreview = document.querySelector('#answerPreview');
const writeTab = document.querySelector('#writeTab');
const previewTab = document.querySelector('#previewTab');
let notes = [];
let subjects = [];
let activeSubject = localStorage.getItem('activeSubject') || 'linux';
let studyDeck = [];
let studyIndex = 0;
let studyRevealed = false;
let learnedNotes = new Set();

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function markdownHtml(value) {
  const lines = escapeHtml(value).split('\n');
  let html = '';
  let inList = false;
  let inCode = false;
  let codeLines = [];
  const inline = (line) => line.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (!inCode) {
        if (inList) { html += '</ul>'; inList = false; }
        inCode = true; codeLines = [];
      } else {
        html += `<pre><code>${codeLines.join('\n')}</code></pre>`;
        inCode = false;
      }
      continue;
    }
    if (inCode) { codeLines.push(line); continue; }
    if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      if (/^#{1,3}\s/.test(line)) html += `<h3>${inline(line.replace(/^#{1,3}\s+/, ''))}</h3>`;
      else if (line.trim()) html += `<p>${inline(line)}</p>`;
    }
  }
  if (inList) html += '</ul>';
  if (inCode) html += `<pre><code>${codeLines.join('\n')}</code></pre>`;
  return html;
}

function renderSubjects() {
  subjectNav.innerHTML = subjects.map((subject) => `<span class="subject-item"><button class="subject-tab ${subject.slug === activeSubject ? 'active' : ''}" data-subject="${escapeHtml(subject.slug)}" aria-current="${subject.slug === activeSubject ? 'page' : 'false'}">${escapeHtml(subject.name)}</button><button class="delete-subject" data-delete-subject="${escapeHtml(subject.slug)}" aria-label="Delete ${escapeHtml(subject.name)} subject" title="Delete subject">×</button></span>`).join('') + '<button class="subject-add" id="addSubjectButton"><span>+</span> Add more</button>';
  subjectNav.querySelectorAll('[data-subject]').forEach((button) => button.addEventListener('click', () => selectSubject(button.dataset.subject)));
  subjectNav.querySelectorAll('[data-delete-subject]').forEach((button) => button.addEventListener('click', () => deleteSubject(button.dataset.deleteSubject)));
  document.querySelector('#addSubjectButton').addEventListener('click', openSubjectForm);
  const subject = subjects.find((item) => item.slug === activeSubject);
  if (subject) {
    document.querySelector('#subjectTitle').textContent = subject.name;
    document.querySelector('#saveLocation').textContent = `Saved to ${subject.file}`;
  }
}

function render() {
  const query = search.value.trim().toLowerCase();
  const shown = notes
    .filter((note) => `${note.heading} ${note.answer}`.toLowerCase().includes(query))
    .sort((a, b) => b.number - a.number);
  count.textContent = String(notes.length).padStart(2, '0');
  studyButton.disabled = notes.length === 0;
  visibleCount.textContent = shown.length;
  empty.hidden = shown.length > 0;
  grid.innerHTML = shown.map((note) => `<article class="note-card"><button class="card-open" data-note-number="${note.number}" aria-label="Open note: ${escapeHtml(note.heading)}"><span class="card-top"><span class="note-index">NO. ${String(note.number).padStart(2, '0')}</span><span class="note-mark" aria-hidden="true">↗</span></span><span class="note-title">${escapeHtml(note.heading)}</span><span class="note-preview">${escapeHtml(note.answer)}</span><span class="card-bottom">◷ <span>${escapeHtml(note.saved)}</span></span></button><button class="delete-note" data-delete-note="${note.number}" aria-label="Delete note: ${escapeHtml(note.heading)}" title="Delete note">×</button></article>`).join('');
  grid.querySelectorAll('[data-note-number]').forEach((card) => card.addEventListener('click', () => openReader(Number(card.dataset.noteNumber))));
  grid.querySelectorAll('[data-delete-note]').forEach((button) => button.addEventListener('click', () => deleteNote(Number(button.dataset.deleteNote))));
}

async function loadSubjects() {
  const response = await fetch('/api/subjects');
  if (!response.ok) throw new Error('Could not load subjects.');
  subjects = await response.json();
  if (!subjects.some((subject) => subject.slug === activeSubject)) activeSubject = subjects[0]?.slug || 'linux';
  localStorage.setItem('activeSubject', activeSubject);
  renderSubjects();
  await loadNotes();
}

async function loadNotes() {
  const response = await fetch(`/api/notes?subject=${encodeURIComponent(activeSubject)}`);
  if (!response.ok) throw new Error('Could not load notes.');
  notes = await response.json();
  render();
}

async function selectSubject(slug) {
  activeSubject = slug;
  localStorage.setItem('activeSubject', slug);
  search.value = '';
  renderSubjects();
  try { await loadNotes(); }
  catch { grid.innerHTML = '<p class="load-error">Could not load this subject\'s notes.</p>'; }
}

function openForm() { modal.hidden = false; document.body.style.overflow = 'hidden'; setTimeout(() => heading.focus(), 50); }
function closeForm() { modal.hidden = true; document.body.style.overflow = ''; form.reset(); error.textContent = ''; }
function openSubjectForm() { subjectModal.hidden = false; document.body.style.overflow = 'hidden'; setTimeout(() => subjectName.focus(), 50); }
function closeSubjectForm() { subjectModal.hidden = true; document.body.style.overflow = ''; subjectForm.reset(); subjectError.textContent = ''; }

function openReader(number) {
  const note = notes.find((item) => item.number === number);
  const subject = subjects.find((item) => item.slug === activeSubject);
  if (!note) return;
  document.querySelector('#readerNumber').textContent = `NOTE ${String(note.number).padStart(2, '0')}`;
  document.querySelector('#readerSubject').textContent = subject?.name || activeSubject;
  document.querySelector('#readerTitle').textContent = note.heading;
  document.querySelector('#readerSaved').textContent = `Saved ${note.saved}`;
  document.querySelector('#readerAnswer').innerHTML = markdownHtml(note.answer);
  reader.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeReader() { reader.hidden = true; document.body.style.overflow = ''; }

function learnedStorageKey() { return `learnedNotes:${activeSubject}`; }
function saveLearnedNotes() { localStorage.setItem(learnedStorageKey(), JSON.stringify([...learnedNotes])); }
function loadLearnedNotes() {
  try { learnedNotes = new Set(JSON.parse(localStorage.getItem(learnedStorageKey()) || '[]')); }
  catch { learnedNotes = new Set(); }
}
function renderStudyCard() {
  const note = studyDeck[studyIndex];
  if (!note) return;
  const subject = subjects.find((item) => item.slug === activeSubject);
  const learned = learnedNotes.has(note.number);
  document.querySelector('#studyProgressText').textContent = `CARD ${studyIndex + 1} OF ${studyDeck.length}`;
  document.querySelector('#studyLearnedText').textContent = `${learnedNotes.size} learned`;
  document.querySelector('#studyProgressBar').style.width = `${((studyIndex + 1) / studyDeck.length) * 100}%`;
  document.querySelector('#studySubject').textContent = subject?.name || activeSubject;
  document.querySelector('#studyQuestion').textContent = note.heading;
  document.querySelector('#studyAnswer').innerHTML = markdownHtml(note.answer);
  document.querySelector('#studyAnswer').hidden = !studyRevealed;
  document.querySelector('#revealAnswer').hidden = studyRevealed;
  document.querySelector('#studyActions').hidden = !studyRevealed;
  document.querySelector('#markLearned').disabled = learned;
  document.querySelector('#markLearned').querySelector('span').textContent = learned ? 'Learned ✓' : 'Got it';
  document.querySelector('#reviewAgain').hidden = !learned;
  document.querySelector('#previousCard').disabled = studyIndex === 0;
  document.querySelector('#nextCard').textContent = studyIndex === studyDeck.length - 1 ? 'Finish' : 'Next →';
}
function openStudy() {
  studyDeck = [...notes].sort((a, b) => b.number - a.number);
  if (!studyDeck.length) return;
  studyIndex = 0;
  studyRevealed = false;
  loadLearnedNotes();
  learnedNotes = new Set([...learnedNotes].filter((number) => notes.some((note) => note.number === number)));
  saveLearnedNotes();
  renderStudyCard();
  studyModal.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeStudy() { studyModal.hidden = true; document.body.style.overflow = ''; }
function changeStudyCard(index) {
  if (index < 0 || index >= studyDeck.length) return closeStudy();
  studyIndex = index;
  studyRevealed = false;
  renderStudyCard();
}

function setAnswerEditor(mode) {
  const isPreview = mode === 'preview';
  answer.hidden = isPreview;
  answerPreview.hidden = !isPreview;
  answerPreview.innerHTML = isPreview ? (markdownHtml(answer.value) || '<p class="preview-placeholder">Nothing to preview yet.</p>') : '';
  writeTab.classList.toggle('active', !isPreview);
  previewTab.classList.toggle('active', isPreview);
}

function insertFormatting(format) {
  const start = answer.selectionStart;
  const end = answer.selectionEnd;
  const selected = answer.value.slice(start, end);
  let before = '';
  let content = selected || 'text';
  let after = '';
  if (format === 'bold') { before = '**'; after = '**'; }
  if (format === 'code') { before = '`'; after = '`'; }
  if (format === 'list') {
    const lineStart = answer.value.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = answer.value.indexOf('\n', end);
    const actualEnd = lineEnd < 0 ? answer.value.length : lineEnd;
    const lines = answer.value.slice(lineStart, actualEnd).split('\n');
    answer.setRangeText(lines.map((line) => `- ${line}`).join('\n'), lineStart, actualEnd, 'select');
    answer.focus();
    answer.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  if (format === 'codeblock') { before = '```bash\n'; after = '\n```'; content = selected || 'command'; }
  answer.setRangeText(`${before}${content}${after}`, start, end, 'select');
  answer.focus();
  answer.dispatchEvent(new Event('input', { bubbles: true }));
}

async function deleteNote(number) {
  const note = notes.find((item) => item.number === number);
  if (!note || !window.confirm(`Delete “${note.heading}” from ${subjects.find((item) => item.slug === activeSubject)?.name || activeSubject}? This cannot be undone.`)) return;
  try {
    const response = await fetch(`/api/notes?subject=${encodeURIComponent(activeSubject)}&number=${number}`, { method: 'DELETE' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'The notes server did not accept the delete request. Restart it with `node server.js` and reload the dashboard.');
    notes = notes.filter((item) => item.number !== number);
    render();
  } catch (err) {
    window.alert(err.message || 'Could not reach the notes server. Start it with `node server.js` and reload the dashboard.');
  }
}

async function deleteSubject(slug) {
  const subject = subjects.find((item) => item.slug === slug);
  if (!subject || !window.confirm(`Delete the ${subject.name} subject and all notes in ${subject.file}? This cannot be undone.`)) return;
  try {
    const response = await fetch(`/api/subjects?slug=${encodeURIComponent(slug)}`, { method: 'DELETE' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'The notes server did not accept the delete request. Restart it with `node server.js` and reload the dashboard.');
    subjects = subjects.filter((item) => item.slug !== slug);
    if (activeSubject === slug) {
      activeSubject = subjects[0].slug;
      localStorage.setItem('activeSubject', activeSubject);
      search.value = '';
    }
    renderSubjects();
    await loadNotes();
  } catch (err) {
    window.alert(err.message || 'Could not reach the notes server. Start it with `node server.js` and reload the dashboard.');
  }
}

document.querySelector('#addButton').addEventListener('click', openForm);
document.querySelector('#closeButton').addEventListener('click', closeForm);
document.querySelector('#closeSubjectButton').addEventListener('click', closeSubjectForm);
document.querySelector('#closeReader').addEventListener('click', closeReader);
document.querySelector('#closeStudy').addEventListener('click', closeStudy);
studyButton.addEventListener('click', openStudy);
document.querySelector('#revealAnswer').addEventListener('click', () => { studyRevealed = true; renderStudyCard(); });
document.querySelector('#previousCard').addEventListener('click', () => changeStudyCard(studyIndex - 1));
document.querySelector('#nextCard').addEventListener('click', () => changeStudyCard(studyIndex + 1));
document.querySelector('#shuffleCards').addEventListener('click', () => {
  for (let i = studyDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [studyDeck[i], studyDeck[j]] = [studyDeck[j], studyDeck[i]];
  }
  studyIndex = 0; studyRevealed = false; renderStudyCard();
});
document.querySelector('#markLearned').addEventListener('click', () => {
  const note = studyDeck[studyIndex];
  if (!note) return;
  learnedNotes.add(note.number); saveLearnedNotes();
  if (studyIndex < studyDeck.length - 1) changeStudyCard(studyIndex + 1);
  else renderStudyCard();
});
document.querySelector('#reviewAgain').addEventListener('click', () => {
  learnedNotes.delete(studyDeck[studyIndex].number); saveLearnedNotes();
  renderStudyCard();
});
modal.addEventListener('click', (event) => { if (event.target === modal) closeForm(); });
subjectModal.addEventListener('click', (event) => { if (event.target === subjectModal) closeSubjectForm(); });
reader.addEventListener('click', (event) => { if (event.target === reader) closeReader(); });
studyModal.addEventListener('click', (event) => { if (event.target === studyModal) closeStudy(); });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (!reader.hidden) closeReader();
    else if (!studyModal.hidden) closeStudy();
    else if (!modal.hidden) closeForm();
    else if (!subjectModal.hidden) closeSubjectForm();
  }
});
search.addEventListener('input', render);
answer.addEventListener('input', () => { if (previewTab.classList.contains('active')) answerPreview.innerHTML = markdownHtml(answer.value); });
writeTab.addEventListener('click', () => setAnswerEditor('write'));
previewTab.addEventListener('click', () => setAnswerEditor('preview'));
document.querySelectorAll('[data-format]').forEach((button) => button.addEventListener('click', () => insertFormatting(button.dataset.format)));

form.addEventListener('submit', async (event) => {
  event.preventDefault(); error.textContent = '';
  const button = form.querySelector('button[type="submit"]'); button.disabled = true;
  try {
    const response = await fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ heading: heading.value, answer: answer.value, subject: activeSubject }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not save this note.');
    notes.push(result); render(); closeForm();
  } catch (err) { error.textContent = err.message || 'Could not save this note.'; }
  finally { button.disabled = false; }
});

subjectForm.addEventListener('submit', async (event) => {
  event.preventDefault(); subjectError.textContent = '';
  const button = subjectForm.querySelector('button[type="submit"]'); button.disabled = true;
  try {
    const response = await fetch('/api/subjects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: subjectName.value }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not add subject.');
    subjects.push(result); closeSubjectForm(); await selectSubject(result.slug);
  } catch (err) { subjectError.textContent = err.message || 'Could not add subject.'; }
  finally { button.disabled = false; }
});

const themeButton = document.querySelector('#themeButton');
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('theme', theme);
  const dark = theme === 'dark';
  themeButton.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} mode`);
  themeButton.innerHTML = `${dark ? '☼' : '◐'} <span>${dark ? 'Light mode' : 'Dark mode'}</span>`;
}
themeButton.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
setTheme(localStorage.getItem('theme') || 'light');

loadSubjects().catch(() => { grid.innerHTML = '<p class="load-error">Could not load notes. Restart the dashboard with <code>node server.js</code>.</p>'; });
