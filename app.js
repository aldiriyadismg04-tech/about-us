
const AI_WORKER_URL = "https://our-little-universe-ai.aldigaming617.workers.dev";
const ANNIVERSARY = "2026-10-08";
const ACCESS_CODE = "8102026";

// Supabase configuration
const SUPABASE_URL = "https://hjmsqflsgjaocrcunrjb.supabase.co";
const SUPABASE_KEY = "sb_publishable_KgJXq1G2iThdGqnnL4BHAA_isaIGEw_";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const $ = selector => document.querySelector(selector);
const $$ = selector => document.querySelectorAll(selector);

const db = {
  get(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[c]);
}

function dateLabel(value) {
  return new Date(value + "T12:00:00").toLocaleDateString("id-ID", {
    day:"numeric", month:"long", year:"numeric"
  });
}

// LOGIN DEMO
$("#login-form").addEventListener("submit", event => {
  event.preventDefault();

  if ($("#access-code").value !== ACCESS_CODE) {
    $("#login-error").textContent = "Kode salah. Coba lagi ya ♡";
    return;
  }

  sessionStorage.setItem("olu-login", "yes");
  openApp();
});

function openApp() {
  $("#login").classList.add("hidden");
  $("#app").classList.remove("hidden");
  renderDates();
  renderStreak();
  renderNotes();
  loadQuestion();
}

$("#logout").addEventListener("click", () => {
  sessionStorage.removeItem("olu-login");
  $("#app").classList.add("hidden");
  $("#login").classList.remove("hidden");
  $("#access-code").value = "";
});

if (sessionStorage.getItem("olu-login") === "yes") openApp();

// NAVIGATION
function showPage(name) {
  $$(".page").forEach(page => page.classList.remove("active"));
  $(`#page-${name}`)?.classList.add("active");

  $$(".nav-button").forEach(button => {
    button.classList.toggle("selected", button.dataset.page === name);
  });

  if (name === "questions") loadQuestion();
  window.scrollTo({top:0, behavior:"smooth"});
}

$$("[data-page]").forEach(button => {
  button.addEventListener("click", event => {
    event.preventDefault();
    showPage(button.dataset.page);
  });
});

// DATE COUNTERS
function renderDates() {
  const now = new Date();
  const midnight = new Date(today() + "T00:00:00");
  const start = new Date(ANNIVERSARY + "T00:00:00");

  $("#today-date").textContent = now.toLocaleDateString("id-ID", {
    weekday:"long", day:"numeric", month:"long", year:"numeric"
  });

  $("#days").textContent = Math.max(0, Math.floor((midnight-start)/86400000));

  let next = new Date(`${now.getFullYear()}-10-08T00:00:00`);
  if (next < midnight) next.setFullYear(next.getFullYear()+1);

  $("#countdown").textContent = Math.round((next-midnight)/86400000);
}

// STREAK — LOCAL DEMO
function getCheckins() {
  return db.get("olu-checkins", {});
}

function streakCount() {
  const data = getCheckins();
  const d = new Date(today()+"T00:00:00");
  let count = 0;

  while (true) {
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const names = data[key] || [];

    if (names.includes("Aldi") && names.includes("Partner")) {
      count++;
      d.setDate(d.getDate()-1);
    } else {
      break;
    }
  }

  return count;
}

function renderStreak() {
  const data = getCheckins();
  const names = data[today()] || [];
  const both = names.includes("Aldi") && names.includes("Partner");
  const one = names.length > 0;
  const count = streakCount();

  $("#home-streak").textContent = count;
  $("#streak-count").textContent = count;

  $("#home-streak-status").textContent = both
    ? "Kalian berdua sudah hadir hari ini! ✨"
    : one ? "Tinggal satu check-in lagi!"
    : "Ayo hadir untuk satu sama lain hari ini.";

  $("#big-flame").className = "flame " + (both ? "lit" : one ? "partial" : "dim");

  $("#streak-message").textContent = both
    ? "Api kita menyala terang! ♡"
    : one ? "Satu orang sudah check-in."
    : "Api menunggu check-in pertama.";

  $$(".person").forEach(button => {
    const checked = names.includes(button.dataset.person);
    button.classList.toggle("checked", checked);
    button.disabled = checked;
  });

  $("#checkin-status").textContent = both
    ? "Aldi dan Partner sudah check-in hari ini! ♡"
    : one ? `${names.join(" dan ")} sudah check-in.`
    : "Belum ada yang check-in.";
}

$$(".person").forEach(button => {
  button.addEventListener("click", () => {
    const data = getCheckins();
    const names = data[today()] || [];
    if (!names.includes(button.dataset.person)) names.push(button.dataset.person);
    data[today()] = names;
    db.set("olu-checkins", data);
    renderStreak();
  });
});

// NOTES — LOCAL DEMO
function renderNotes() {
  const notes = db.get("olu-notes", []);
  const note = notes.find(item => item.date === today());

  $("#home-note").textContent = note
    ? `${note.author}: ${note.text}`
    : "Belum ada catatan hari ini. Tulis pesan kecil untuk pasanganmu.";

  $("#home-music").innerHTML = note?.music
    ? `<a href="${escapeHTML(note.music)}" target="_blank" rel="noopener noreferrer">♫ Dengarkan lagu ↗</a>`
    : "";

  $("#notes-list").innerHTML = notes.length
    ? notes.map(item => `
      <article class="note-item">
        <div class="note-meta">${escapeHTML(item.author)} · ${escapeHTML(dateLabel(item.date))}</div>
        <p>${escapeHTML(item.text)}</p>
        ${item.music ? `<a href="${escapeHTML(item.music)}" target="_blank" rel="noopener noreferrer">♫ Buka lagu ↗</a>` : ""}
      </article>
    `).join("")
    : `<p class="muted small">Belum ada catatan. ♡</p>`;
}

$("#note-form").addEventListener("submit", event => {
  event.preventDefault();

  const text = $("#note-text").value.trim();
  const music = $("#music-link").value.trim();
  if (!text) return;

  if (music && !/^https:\/\/(open\.spotify\.com|spotify\.link|www\.youtube\.com|youtu\.be)\//i.test(music)) {
    alert("Masukkan link Spotify atau YouTube yang valid.");
    return;
  }

  const notes = db.get("olu-notes", []);
  notes.unshift({
    author:$("#note-author").value,
    text,
    music,
    date:today()
  });

  db.set("olu-notes", notes);
  $("#note-text").value = "";
  $("#music-link").value = "";
  renderNotes();
});

// DAILY QUESTIONS — CLOUDFLARE AI
let activeQuestionDate = null;
let questionRequest = null;

async function loadQuestion() {
  // Cegah request berulang saat pengguna berpindah menu.
  if (questionRequest) return questionRequest;

  $("#daily-question").textContent = "AI sedang membuat pertanyaan... ✨";
  $("#answers-status").textContent = "Tunggu sebentar ya.";
  $("#answers-reveal").classList.add("hidden");

  questionRequest = (async () => {
    try {
      const response = await fetch(`${AI_WORKER_URL}/question`);
      const result = await response.json();

      if (!response.ok || !result.question || !result.date) {
        throw new Error(result.error || "Gagal mengambil pertanyaan.");
      }

      activeQuestionDate = result.date;
      $("#question-date").textContent = dateLabel(result.date);
      $("#daily-question").textContent = result.question;
      renderAnswers();
    } catch (error) {
      console.error(error);
      $("#daily-question").textContent = "Pertanyaan belum tersedia.";
      $("#answers-status").textContent =
        "Periksa URL Cloudflare Worker dan coba lagi.";
    } finally {
      questionRequest = null;
    }
  })();

  return questionRequest;
}

function renderAnswers() {
  if (!activeQuestionDate) return;

  const all = db.get("olu-answers", {});
  const answers = all[activeQuestionDate] || {};
  const names = Object.keys(answers);
  const both = answers.Aldi && answers.Partner;

  $("#answers-status").textContent = both
    ? "Kalian berdua sudah menjawab! Baca jawaban kalian di bawah ♡"
    : names.length
      ? "Satu jawaban tersimpan. Jawaban terbuka setelah keduanya menjawab."
      : "Belum ada jawaban hari ini.";

  $("#answers-reveal").classList.toggle("hidden", !both);
  $("#answers-reveal").innerHTML = both
    ? ["Aldi","Partner"].map(name => `
        <div class="answer-item">
          <strong>${name}</strong>
          <p>${escapeHTML(answers[name])}</p>
        </div>
      `).join("")
    : "";
}

$("#refresh-question").addEventListener("click", () => {
  // Pertanyaan harian tetap sama; tombol ini hanya memuat ulang.
  questionRequest = null;
  loadQuestion();
});

$("#submit-answer").addEventListener("click", () => {
  const answer = $("#answer-text").value.trim();

  if (!activeQuestionDate) {
    alert("Tunggu sampai pertanyaan selesai dimuat.");
    return;
  }

  if (!answer) {
    alert("Tulis jawabanmu dulu ya ♡");
    return;
  }

  const all = db.get("olu-answers", {});
  const answers = all[activeQuestionDate] || {};
  const author = $("#answer-author").value;

  if (answers[author]) {
    alert("Nama ini sudah menjawab pertanyaan hari ini.");
    return;
  }

  answers[author] = answer;
  all[activeQuestionDate] = answers;
  db.set("olu-answers", all);

  $("#answer-text").value = "";
  renderAnswers();
});

// SETTINGS
function applySettings(settings) {
  document.body.classList.remove("theme-rose","theme-blue");

  if (settings.theme === "rose") document.body.classList.add("theme-rose");
  if (settings.theme === "blue") document.body.classList.add("theme-blue");

  if (settings.wallpaper) {
    document.body.style.backgroundImage =
      `linear-gradient(#100d1bdc,#100d1bf2),url("${settings.wallpaper.replace(/["\\]/g,"")}")`;
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundAttachment = "fixed";
    document.body.style.backgroundPosition = "center";
  } else {
    document.body.style.backgroundImage = "";
  }
}

const settings = db.get("olu-settings", {});
$("#theme").value = settings.theme || "purple";
$("#wallpaper").value = settings.wallpaper || "";
applySettings(settings);

$("#save-settings").addEventListener("click", () => {
  const wallpaper = $("#wallpaper").value.trim();

  if (wallpaper && !/^https?:\/\//i.test(wallpaper)) {
    alert("URL wallpaper tidak valid.");
    return;
  }

  const next = {theme:$("#theme").value, wallpaper};
  db.set("olu-settings", next);
  applySettings(next);
  alert("Tampilan berhasil disimpan! ✨");
});
