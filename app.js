const AI_WORKER_URL = "https://our-little-universe-ai.aldigaming617.workers.dev";
const ANNIVERSARY = "2026-10-08";

// ==========================================
// SUPABASE CONFIGURATION
// ==========================================
const SUPABASE_URL = "https://hjmsqflsgjaocrcunrjb.supabase.co";
const SUPABASE_KEY = "sb_publishable_KgJXq1G2iThdGqnnL4BHAA_isaIGEw_";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// GANTI EMAIL CONTOH DI BAWAH DENGAN EMAIL AKUN ASLI
const ACCOUNT_NAMES = {
  "aldiriyadismg04@gmail.com": {
    myName: "Aldi",
    partnerName: "Liza",
    myId: "aldi",
    partnerId: "liza"
  },

  "shalizawatiliza@gmail.com": {
    myName: "Liza",
    partnerName: "Aldi",
    myId: "liza",
    partnerId: "aldi"
  }
};

let MY_NAME = "Aldi";
let PARTNER_NAME = "Liza";
let MY_ID = "aldi";
let PARTNER_ID = "liza";
const ID_TO_NAME = {
  aldi: "Aldi",
  liza: "Liza"
};

const $ = selector => document.querySelector(selector);
const $$ = selector => document.querySelectorAll(selector);

// ==========================================
// LOCAL STORAGE
// Catatan: penyimpanan ini belum tersinkron
// otomatis antarperangkat.
// ==========================================
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

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

function dateLabel(value) {
  return new Date(value + "T12:00:00").toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function displayNameForId(id) {
  return ID_TO_NAME[id] || id || "Pengguna";
}

// ==========================================
// ACCOUNT IDENTITY
// ==========================================
function setAccountNames(user) {
  const email = user?.email?.trim().toLowerCase();
  const account = ACCOUNT_NAMES[email];

  if (!account) {
    throw new Error(
      "Email akun belum terdaftar. Periksa konfigurasi ACCOUNT_NAMES di app.js."
    );
  }

  MY_NAME = account.myName;
  PARTNER_NAME = account.partnerName;
  MY_ID = account.myId;
  PARTNER_ID = account.partnerId;

  updateNameLabels();
}

function updateNameLabels() {
  $$(".my-name").forEach(element => {
    element.textContent = MY_NAME;
  });

  $$(".partner-name").forEach(element => {
    element.textContent = PARTNER_NAME;
  });

  // Dropdown catatan
  const noteAuthor = $("#note-author");

  if (noteAuthor) {
    const previous = noteAuthor.value;

    noteAuthor.innerHTML = `
      <option value="${MY_ID}">${MY_NAME}</option>
      <option value="${PARTNER_ID}">${PARTNER_NAME}</option>
    `;

    noteAuthor.value =
      previous === MY_ID || previous === PARTNER_ID
        ? previous
        : MY_ID;
  }

  // Dropdown jawaban pertanyaan harian
  const answerAuthor = $("#answer-author");

  if (answerAuthor) {
    answerAuthor.innerHTML = `
      <option value="${MY_ID}">${MY_NAME}</option>
      <option value="${PARTNER_ID}">${PARTNER_NAME}</option>
    `;

    // Jawaban otomatis memakai identitas akun yang sedang login.
    answerAuthor.value = MY_ID;
  }
}

// ==========================================
// LOGIN SUPABASE
// ==========================================
$("#login-form").addEventListener("submit", async event => {
  event.preventDefault();

  const email = $("#login-email").value.trim();
  const password = $("#login-password").value;
  const button = $("#login-form button");
  const originalText = button.textContent;

  $("#login-error").textContent = "";
  button.disabled = true;
  button.textContent = "Membuka semesta...";

  try {
    const { data, error } =
      await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

    if (error) throw error;

    setAccountNames(data.user);
    openApp();
  } catch (error) {
    console.error("Login error:", error);

    $("#login-error").textContent =
      error.message || "Terjadi kesalahan saat login.";
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
});

function openApp() {
  updateNameLabels();

  $("#login").classList.add("hidden");
  $("#app").classList.remove("hidden");

  renderDates();
  renderStreak();
  renderNotes();
  loadQuestion();
}

$("#logout").addEventListener("click", async () => {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    alert("Gagal keluar. Coba lagi ya.");
    return;
  }

  $("#app").classList.add("hidden");
  $("#login").classList.remove("hidden");
  $("#login-password").value = "";
  $("#login-error").textContent = "";

  MY_NAME = "Aldi";
  PARTNER_NAME = "Liza";
  MY_ID = "aldi";
  PARTNER_ID = "liza";
});

async function restoreSession() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    console.error("Session error:", error);
    return;
  }

  if (data.session) {
    try {
      setAccountNames(data.session.user);
      openApp();
    } catch (error) {
      console.error("Account configuration error:", error);

      await supabaseClient.auth.signOut();

      $("#login-error").textContent = error.message;
      $("#login").classList.remove("hidden");
      $("#app").classList.add("hidden");
    }
  }
}

restoreSession();

// ==========================================
// NAVIGATION
// ==========================================
function showPage(name) {
  $$(".page").forEach(page => {
    page.classList.remove("active");
  });

  $(`#page-${name}`)?.classList.add("active");

  $$(".nav-button").forEach(button => {
    button.classList.toggle(
      "selected",
      button.dataset.page === name
    );
  });

  if (name === "questions") {
    loadQuestion();
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

$$("[data-page]").forEach(button => {
  button.addEventListener("click", event => {
    event.preventDefault();
    showPage(button.dataset.page);
  });
});

// ==========================================
// DATE COUNTERS
// ==========================================
function renderDates() {
  const now = new Date();
  const midnight = new Date(today() + "T00:00:00");
  const start = new Date(ANNIVERSARY + "T00:00:00");

  $("#today-date").textContent = now.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  $("#days").textContent = Math.max(
    0,
    Math.floor((midnight - start) / 86400000)
  );

  let next = new Date(`${now.getFullYear()}-10-08T00:00:00`);

  if (next < midnight) {
    next.setFullYear(next.getFullYear() + 1);
  }

  $("#countdown").textContent = Math.round(
    (next - midnight) / 86400000
  );
}

// ==========================================
// STREAK
// Identitas tetap: aldi dan liza
// ==========================================
function getCheckins() {
  const data = db.get("olu-checkins", {});

  // Migrasi data demo lama yang memakai nama tampilan.
  Object.keys(data).forEach(date => {
    if (!Array.isArray(data[date])) {
      data[date] = [];
      return;
    }

    data[date] = [
      ...new Set(data[date].map(value => {
        if (value === "Aldi") return "aldi";
        if (value === "Partner") return PARTNER_ID;
        return value;
      }))
    ];
  });

  db.set("olu-checkins", data);
  return data;
}

function streakCount() {
  const data = getCheckins();
  const d = new Date(today() + "T00:00:00");
  let count = 0;

  while (true) {
    const key =
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const names = data[key] || [];
    const both = names.includes("aldi") && names.includes("liza");

    if (both) {
      count++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  return count;
}

function renderStreak() {
  const data = getCheckins();
  const names = data[today()] || [];

  const both =
    names.includes("aldi") &&
    names.includes("liza");

  const one = names.length > 0;
  const count = streakCount();

  $("#home-streak").textContent = count;
  $("#streak-count").textContent = count;

  $("#home-streak-status").textContent = both
    ? "Kalian berdua sudah hadir hari ini! ✨"
    : one
      ? "Tinggal satu check-in lagi!"
      : "Ayo hadir untuk satu sama lain hari ini.";

  $("#big-flame").className =
    "flame " + (both ? "lit" : one ? "partial" : "dim");

  $("#streak-message").textContent = both
    ? "Api kita menyala terang! ♡"
    : one
      ? "Satu orang sudah check-in."
      : "Api menunggu check-in pertama.";

  $$(".person").forEach(button => {
    const personId =
      button.dataset.person === "me"
        ? MY_ID
        : button.dataset.person === "partner"
          ? PARTNER_ID
          : button.dataset.person;

    const checked = names.includes(personId);

    button.classList.toggle("checked", checked);
    button.disabled = checked;
  });

  const checkedNames = names.map(displayNameForId);

  $("#checkin-status").textContent = both
    ? `${displayNameForId("aldi")} dan ${displayNameForId("liza")} sudah check-in hari ini! ♡`
    : one
      ? `${checkedNames.join(" dan ")} sudah check-in.`
      : "Belum ada yang check-in.";
}

$$(".person").forEach(button => {
  button.addEventListener("click", () => {
    const personId =
      button.dataset.person === "me"
        ? MY_ID
        : button.dataset.person === "partner"
          ? PARTNER_ID
          : button.dataset.person;

    if (personId !== "aldi" && personId !== "liza") {
      return;
    }

    const data = getCheckins();
    const names = data[today()] || [];

    if (!names.includes(personId)) {
      names.push(personId);
    }

    data[today()] = names;
    db.set("olu-checkins", data);

    renderStreak();
  });
});

// ==========================================
// NOTES
// ==========================================
function getNotes() {
  const notes = db.get("olu-notes", []);

  return notes.map(item => {
    let authorId = item.authorId;

    // Kompatibilitas dengan catatan demo lama.
    if (!authorId) {
      if (item.author === "Aldi") {
        authorId = "aldi";
      } else if (item.author === "Partner") {
        authorId = PARTNER_ID;
      } else {
        authorId = item.author;
      }
    }

    return { ...item, authorId };
  });
}

function renderNotes() {
  const notes = getNotes();
  const note = notes.find(item => item.date === today());

  $("#home-note").textContent = note
    ? `${displayNameForId(note.authorId)}: ${note.text}`
    : "Belum ada catatan hari ini. Tulis pesan kecil untuk pasanganmu.";

  $("#home-music").innerHTML = note?.music
    ? `<a href="${escapeHTML(note.music)}" target="_blank" rel="noopener noreferrer">♫ Dengarkan lagu ↗</a>`
    : "";

  $("#notes-list").innerHTML = notes.length
    ? notes.map(item => `
        <article class="note-item">
          <div class="note-meta">
            ${escapeHTML(displayNameForId(item.authorId))}
            · ${escapeHTML(dateLabel(item.date))}
          </div>
          <p>${escapeHTML(item.text)}</p>
          ${item.music
            ? `<a href="${escapeHTML(item.music)}" target="_blank" rel="noopener noreferrer">♫ Buka lagu ↗</a>`
            : ""}
        </article>
      `).join("")
    : `<p class="muted small">Belum ada catatan. ♡</p>`;
}

$("#note-form").addEventListener("submit", event => {
  event.preventDefault();

  const text = $("#note-text").value.trim();
  const music = $("#music-link").value.trim();

  if (!text) return;

  if (
    music &&
    !/^https:\/\/(open\.spotify\.com|spotify\.link|www\.youtube\.com|youtu\.be)\//i.test(music)
  ) {
    alert("Masukkan link Spotify atau YouTube yang valid.");
    return;
  }

  const authorId = $("#note-author").value;

  if (authorId !== MY_ID && authorId !== PARTNER_ID) {
    alert("Pilih nama penulis yang valid.");
    return;
  }

  const notes = getNotes();

  notes.unshift({
    authorId,
    text,
    music,
    date: today()
  });

  db.set("olu-notes", notes);

  $("#note-text").value = "";
  $("#music-link").value = "";

  renderNotes();
});

// ==========================================
// DAILY QUESTIONS — CLOUDFLARE AI
// ==========================================
let activeQuestionDate = null;
let questionRequest = null;

function getAnswersForDate(date) {
  const all = db.get("olu-answers", {});
  const answers = all[date] || {};

  // Migrasi jawaban demo lama.
  if (answers.Aldi && !answers.aldi) {
    answers.aldi = answers.Aldi;
    delete answers.Aldi;
  }

  if (answers.Partner && !answers[PARTNER_ID]) {
    answers[PARTNER_ID] = answers.Partner;
    delete answers.Partner;
  }

  all[date] = answers;
  db.set("olu-answers", all);

  return answers;
}

async function loadQuestion() {
  if (questionRequest) return questionRequest;

  $("#daily-question").textContent =
    "AI sedang membuat pertanyaan... ✨";

  $("#answers-status").textContent = "Tunggu sebentar ya.";
  $("#answers-reveal").classList.add("hidden");

  questionRequest = (async () => {
    try {
      const response = await fetch(`${AI_WORKER_URL}/question`);
      const result = await response.json();

      if (!response.ok || !result.question || !result.date) {
        throw new Error(
          result.error || "Gagal mengambil pertanyaan."
        );
      }

      activeQuestionDate = result.date;

      $("#question-date").textContent =
        dateLabel(result.date);

      $("#daily-question").textContent =
        result.question;

      renderAnswers();
    } catch (error) {
      console.error(error);

      $("#daily-question").textContent =
        "Pertanyaan belum tersedia.";

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

  const answers = getAnswersForDate(activeQuestionDate);

  const myAnswer = answers[MY_ID];
  const partnerAnswer = answers[PARTNER_ID];

  const both = Boolean(myAnswer && partnerAnswer);
  const one = Boolean(myAnswer || partnerAnswer);

  $("#answers-status").textContent = both
    ? "Kalian berdua sudah menjawab! Baca jawaban kalian di bawah ♡"
    : one
      ? "Satu jawaban tersimpan. Jawaban terbuka setelah keduanya menjawab."
      : "Belum ada jawaban hari ini.";

  $("#answers-reveal").classList.toggle("hidden", !both);

  $("#answers-reveal").innerHTML = both
    ? `
        <div class="answer-item">
          <strong>${escapeHTML(displayNameForId(MY_ID))}</strong>
          <p>${escapeHTML(myAnswer)}</p>
        </div>
        <div class="answer-item">
          <strong>${escapeHTML(displayNameForId(PARTNER_ID))}</strong>
          <p>${escapeHTML(partnerAnswer)}</p>
        </div>
      `
    : "";
}

$("#refresh-question").addEventListener("click", () => {
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

  // Identitas penjawab mengikuti akun yang sedang login.
  const author = MY_ID;
  const answers = getAnswersForDate(activeQuestionDate);

  if (answers[author]) {
    alert("Kamu sudah menjawab pertanyaan hari ini.");
    return;
  }

  answers[author] = answer;

  const all = db.get("olu-answers", {});
  all[activeQuestionDate] = answers;

  db.set("olu-answers", all);

  $("#answer-text").value = "";
  renderAnswers();
});

// ==========================================
// SETTINGS
// ==========================================
function applySettings(settings) {
  document.body.classList.remove("theme-rose", "theme-blue");

  if (settings.theme === "rose") {
    document.body.classList.add("theme-rose");
  }

  if (settings.theme === "blue") {
    document.body.classList.add("theme-blue");
  }

  if (settings.wallpaper) {
    document.body.style.backgroundImage =
      `linear-gradient(#100d1bdc,#100d1bf2),url("${settings.wallpaper.replace(/["\\]/g, "")}")`;

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

  const next = {
    theme: $("#theme").value,
    wallpaper
  };

  db.set("olu-settings", next);
  applySettings(next);

  alert("Tampilan berhasil disimpan! ✨");
});
