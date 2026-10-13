
const AI_WORKER_URL = "https://our-little-universe-ai.aldigaming617.workers.dev";
const ANNIVERSARY = "2026-10-08";

const SUPABASE_URL = "https://hjmsqflsgjaocrcunrjb.supabase.co";
const SUPABASE_KEY = "sb_publishable_KgJXq1G2iThdGqnnL4BHAA_isaIGEw_";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const ACCOUNT_NAMES = {
  "aldiriyadismg04@gmail.com": {
    myName: "Aldi",
    partnerName: "Liza"
  },
  "shalizawatiliza@gmail.com": {
    myName: "Liza",
    partnerName: "Aldi"
  }
};

let currentUser = null;
let coupleId = null;
let partnerUserId = null;
let MY_NAME = "Aldi";
let PARTNER_NAME = "Liza";
let activeQuestionDate = null;
let questionRequest = null;
let syncTimer = null;

let checkinRows = [];
let notesRows = [];
let answerRows = [];

const $ = selector => document.querySelector(selector);
const $$ = selector => document.querySelectorAll(selector);

const localDB = {
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

function timestampDate(value) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function displayNameForUser(userId) {
  if (userId === currentUser?.id) return MY_NAME;
  if (userId === partnerUserId) return PARTNER_NAME;
  return "Pengguna";
}

function setAccountNames(user) {
  const email = user?.email?.trim().toLowerCase();
  const account = ACCOUNT_NAMES[email];

  if (!account) {
    throw new Error(
      "Email ini belum didaftarkan dalam ACCOUNT_NAMES di app.js."
    );
  }

  currentUser = user;
  MY_NAME = account.myName;
  PARTNER_NAME = account.partnerName;

  updateNameLabels();
}

function updateNameLabels() {
  $$(".my-name").forEach(el => {
    el.textContent = MY_NAME;
  });

  $$(".partner-name").forEach(el => {
    el.textContent = PARTNER_NAME;
  });

  const noteAuthor = $("#note-author");
  if (noteAuthor) {
    noteAuthor.innerHTML =
      `<option value="me">${escapeHTML(MY_NAME)}</option>`;
    noteAuthor.value = "me";
    noteAuthor.disabled = true;
  }

  const answerAuthor = $("#answer-author");
  if (answerAuthor) {
    answerAuthor.innerHTML =
      `<option value="me">${escapeHTML(MY_NAME)}</option>`;
    answerAuthor.value = "me";
    answerAuthor.disabled = true;
  }
}

// ==========================================
// LOGIN DAN PASANGAN DI SUPABASE
// ==========================================

async function initializeCouple() {
  const { data: membership, error } = await supabaseClient
    .from("couple_members")
    .select("couple_id,user_id")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) throw error;

  if (!membership) {
    throw new Error(
      "Akun ini belum terhubung ke pasangan di tabel couple_members."
    );
  }

  coupleId = membership.couple_id;

  const { data: partner, error: partnerError } = await supabaseClient
    .from("couple_members")
    .select("user_id")
    .eq("couple_id", coupleId)
    .neq("user_id", currentUser.id)
    .maybeSingle();

  if (partnerError) throw partnerError;

  if (!partner) {
    throw new Error(
      "Akun pasangan belum ditemukan di couple_members."
    );
  }

  partnerUserId = partner.user_id;
}

async function startApp(user) {
  setAccountNames(user);
  await initializeCouple();

  $("#login").classList.add("hidden");
  $("#app").classList.remove("hidden");

  renderDates();
  await syncAll();
  await loadQuestion();

  if (syncTimer) clearInterval(syncTimer);

  syncTimer = setInterval(() => {
    if (currentUser && coupleId) syncAll();
  }, 15000);
}

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
    const { data, error } = await supabaseClient.auth
      .signInWithPassword({ email, password });

    if (error) throw error;

    await startApp(data.user);
  } catch (error) {
    console.error("Login/app error:", error);
    $("#login-error").textContent =
      error.message || "Gagal membuka aplikasi.";
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
});

$("#logout").addEventListener("click", async () => {
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = null;

  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    alert("Gagal keluar. Coba lagi ya.");
    return;
  }

  currentUser = null;
  coupleId = null;
  partnerUserId = null;
  activeQuestionDate = null;
  checkinRows = [];
  notesRows = [];
  answerRows = [];

  $("#app").classList.add("hidden");
  $("#login").classList.remove("hidden");
  $("#login-password").value = "";
  $("#login-error").textContent = "";
});

async function restoreSession() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    console.error(error);
    return;
  }

  if (data.session) {
    try {
      await startApp(data.session.user);
    } catch (error) {
      console.error("Restore session error:", error);
      $("#login-error").textContent =
        error.message || "Gagal memuat data pasangan.";
      await supabaseClient.auth.signOut();
      $("#login").classList.remove("hidden");
      $("#app").classList.add("hidden");
    }
  }
}

restoreSession();

// ==========================================
// NAVIGASI
// ==========================================

function showPage(name) {
  $$(".page").forEach(page => page.classList.remove("active"));
  $(`#page-${name}`)?.classList.add("active");

  $$(".nav-button").forEach(button => {
    button.classList.toggle("selected", button.dataset.page === name);
  });

  if (name === "questions") loadQuestion();
  if (name === "streak") renderStreak();
  if (name === "notes") renderNotes();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

$$("[data-page]").forEach(button => {
  button.addEventListener("click", event => {
    event.preventDefault();
    showPage(button.dataset.page);
  });
});

// ==========================================
// TANGGAL DAN HITUNG MUNDUR
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
  if (next < midnight) next.setFullYear(next.getFullYear() + 1);

  $("#countdown").textContent = Math.round(
    (next - midnight) / 86400000
  );
}

// ==========================================
// SINKRONISASI DATA
// ==========================================

async function syncAll() {
  if (!currentUser || !coupleId) return;

  try {
    await Promise.all([
      fetchCheckins(),
      fetchNotes()
    ]);

    renderStreak();
    renderNotes();

    if (activeQuestionDate) {
      await fetchAnswers();
      renderAnswers();
    }
  } catch (error) {
    console.error("Sync error:", error);
  }
}

async function fetchCheckins() {
  const { data, error } = await supabaseClient
    .from("checkins")
    .select("user_id,checkin_date")
    .eq("couple_id", coupleId)
    .order("checkin_date", { ascending: false });

  if (error) throw error;
  checkinRows = data || [];
}

async function fetchNotes() {
  const { data, error } = await supabaseClient
    .from("notes")
    .select("id,author_id,body,music_url,created_at")
    .eq("couple_id", coupleId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  notesRows = data || [];
}

// ==========================================
// CHECK-IN BERSAMA
// ==========================================

function streakCount() {
  const d = new Date(today() + "T00:00:00");
  let count = 0;

  while (true) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const usersToday = new Set(
      checkinRows
        .filter(row => row.checkin_date === key)
        .map(row => row.user_id)
    );

    if (
      usersToday.has(currentUser.id) &&
      usersToday.has(partnerUserId)
    ) {
      count++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  return count;
}

function renderStreak() {
  const todayRows = checkinRows.filter(
    row => row.checkin_date === today()
  );

  const checkedIds = new Set(todayRows.map(row => row.user_id));
  const meChecked = checkedIds.has(currentUser?.id);
  const partnerChecked = checkedIds.has(partnerUserId);
  const both = meChecked && partnerChecked;
  const one = meChecked || partnerChecked;
  const count = streakCount();

  $("#home-streak").textContent = count;
  $("#streak-count").textContent = count;

  $("#home-streak-status").textContent = both
    ? "Kalian berdua sudah hadir hari ini! ✨"
    : one
      ? "Satu check-in lagi untuk menyalakan api bersama!"
      : "Ayo hadir untuk satu sama lain hari ini.";

  $("#big-flame").className =
    "flame " + (both ? "lit" : one ? "partial" : "dim");

  $("#streak-message").textContent = both
    ? "Api kita menyala terang! ♡"
    : one
      ? "Satu orang sudah check-in."
      : "Api menunggu check-in pertama.";

  $$(".person").forEach(button => {
    const isMe = button.dataset.person === "me";
    const isPartner = button.dataset.person === "partner";
    const checked = isMe ? meChecked : isPartner ? partnerChecked : false;

    button.classList.toggle("checked", checked);
    button.disabled = !isMe || meChecked;
  });

  $("#checkin-status").textContent = both
    ? `${MY_NAME} dan ${PARTNER_NAME} sudah check-in hari ini! ♡`
    : meChecked
      ? `${MY_NAME} sudah check-in. Menunggu ${PARTNER_NAME}.`
      : partnerChecked
        ? `${PARTNER_NAME} sudah check-in. Sekarang giliranmu!`
        : "Belum ada yang check-in hari ini.";
}

$$(".person").forEach(button => {
  button.addEventListener("click", async () => {
    if (button.dataset.person !== "me" || !currentUser || !coupleId) {
      return;
    }

    button.disabled = true;

    try {
      const { error } = await supabaseClient
        .from("checkins")
        .insert({
          couple_id: coupleId,
          user_id: currentUser.id,
          checkin_date: today()
        });

      if (error && error.code !== "23505") throw error;

      await fetchCheckins();
      renderStreak();
    } catch (error) {
      console.error("Check-in error:", error);
      alert(`Check-in gagal: ${error.message || "Kesalahan tidak diketahui."}`);
      button.disabled = false;
    }
  });
});

// ==========================================
// CATATAN + SPOTIFY EMBED
// ==========================================

function spotifyEmbedUrl(value) {
  if (!value) return null;

  try {
    const url = new URL(value);

    if (
      url.protocol !== "https:" ||
      !["open.spotify.com", "www.open.spotify.com"].includes(url.hostname)
    ) {
      return null;
    }

    const parts = url.pathname.split("/").filter(Boolean);
    const allowedTypes = ["track", "album", "playlist", "episode", "show"];
    const typeIndex = parts.findIndex(part => allowedTypes.includes(part));

    if (typeIndex === -1 || !parts[typeIndex + 1]) return null;

    const type = parts[typeIndex];
    const id = parts[typeIndex + 1];

    if (!/^[a-zA-Z0-9]+$/.test(id)) return null;

    return `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`;
  } catch {
    return null;
  }
}

function renderSpotifyCard(value) {
  if (!value) return "";

  const embedUrl = spotifyEmbedUrl(value);
  const safeUrl = escapeHTML(value);

  if (!embedUrl) {
    return `
      <div class="spotify-card">
        <div class="spotify-card-label">♫ OUR SONG</div>
        <p class="spotify-card-description">
          Dengarkan lagu pilihan kalian di Spotify.
        </p>
        <a href="${safeUrl}"
           target="_blank"
           rel="noopener noreferrer"
           class="spotify-open-link">
          ♫ Buka lagu di Spotify ↗
        </a>
      </div>
    `;
  }

  return `
    <div class="spotify-card">
      <div class="spotify-card-label">♫ OUR SONG</div>
      <iframe
        class="spotify-embed"
        src="${escapeHTML(embedUrl)}"
        title="Pemutar Spotify"
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen>
      </iframe>
      <a href="${safeUrl}"
         target="_blank"
         rel="noopener noreferrer"
         class="spotify-open-link">
        Buka di aplikasi Spotify ↗
      </a>
    </div>
  `;
}

function renderNotes() {
  const todaysNote = notesRows.find(
    item => timestampDate(item.created_at) === today()
  );

  $("#home-note").textContent = todaysNote
    ? `${displayNameForUser(todaysNote.author_id)}: ${todaysNote.body}`
    : "Belum ada catatan hari ini. Tulis pesan kecil untuk pasanganmu.";

  $("#home-music").innerHTML = todaysNote?.music_url
    ? renderSpotifyCard(todaysNote.music_url)
    : "";

  $("#notes-list").innerHTML = notesRows.length
    ? notesRows.map(item => `
        <article class="note-item">
          <div class="note-meta">
            ${escapeHTML(displayNameForUser(item.author_id))}
            · ${escapeHTML(dateLabel(timestampDate(item.created_at)))}
          </div>
          <p>${escapeHTML(item.body)}</p>
          ${renderSpotifyCard(item.music_url)}
        </article>
      `).join("")
    : `<p class="muted small">Belum ada catatan. ♡</p>`;
}

$("#note-form").addEventListener("submit", async event => {
  event.preventDefault();

  const body = $("#note-text").value.trim();
  const music = $("#music-link").value.trim();

  if (!body || !currentUser || !coupleId) return;

  if (
    music &&
    !/^https:\/\/(open\.spotify\.com|spotify\.link|www\.youtube\.com|youtu\.be)\//i.test(music)
  ) {
    alert("Masukkan link Spotify atau YouTube yang valid.");
    return;
  }

  const submitButton = $("#note-form button[type='submit']");
  if (submitButton) submitButton.disabled = true;

  try {
    const { error } = await supabaseClient.from("notes").insert({
      couple_id: coupleId,
      author_id: currentUser.id,
      body,
      music_url: music || null
    });

    if (error) throw error;

    $("#note-text").value = "";
    $("#music-link").value = "";

    await fetchNotes();
    renderNotes();
  } catch (error) {
    console.error("Note error:", error);
    alert(`Catatan gagal disimpan: ${error.message || "Kesalahan tidak diketahui."}`);
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

// ==========================================
// PERTANYAAN HARIAN DARI CLOUDFLARE AI
// ==========================================

async function loadQuestion() {
  if (questionRequest) return questionRequest;
  if (!currentUser || !coupleId) return;

  $("#daily-question").textContent = "Memuat pertanyaan hari ini... ✨";
  $("#answers-status").textContent = "Tunggu sebentar ya.";
  $("#answers-reveal").classList.add("hidden");

  questionRequest = (async () => {
    try {
      let response;

      try {
        response = await fetch(`${AI_WORKER_URL}/question`);
      } catch (networkError) {
        throw new Error(
          `Cloudflare Worker tidak dapat dihubungi. ${networkError.message || ""}`
        );
      }

      let result;

      try {
        result = await response.json();
      } catch {
        throw new Error(
          `Worker mengembalikan respons yang bukan JSON. HTTP ${response.status}.`
        );
      }

      if (!response.ok || !result.question || !result.date) {
        throw new Error(
          `Cloudflare Worker gagal. HTTP ${response.status}. ${result.error || "Pertanyaan atau tanggal tidak tersedia."}`
        );
      }

      activeQuestionDate = result.date;

      const { data: savedQuestion, error: selectError } =
        await supabaseClient
          .from("daily_questions")
          .select("question")
          .eq("couple_id", coupleId)
          .eq("question_date", activeQuestionDate)
          .maybeSingle();

      if (selectError) {
        throw new Error(
          `Gagal membaca daily_questions. Kode: ${selectError.code || "-"}. ${selectError.message}`
        );
      }

      let finalQuestion = savedQuestion?.question;

      if (!finalQuestion) {
        const { error: insertError } = await supabaseClient
          .from("daily_questions")
          .insert({
            couple_id: coupleId,
            question_date: activeQuestionDate,
            question: result.question
          });

        if (insertError && insertError.code !== "23505") {
          throw new Error(
            `Gagal menyimpan daily_questions. Kode: ${insertError.code || "-"}. ${insertError.message}` +
            (insertError.details ? ` Detail: ${insertError.details}` : "") +
            (insertError.hint ? ` Petunjuk: ${insertError.hint}` : "")
          );
        }

        const retry = await supabaseClient
          .from("daily_questions")
          .select("question")
          .eq("couple_id", coupleId)
          .eq("question_date", activeQuestionDate)
          .maybeSingle();

        if (retry.error) {
          throw new Error(
            `Pertanyaan dikirim, tetapi gagal dibaca ulang. Kode: ${retry.error.code || "-"}. ${retry.error.message}`
          );
        }

        finalQuestion = retry.data?.question || result.question;
      }

      $("#question-date").textContent = dateLabel(activeQuestionDate);
      $("#daily-question").textContent = finalQuestion;

      try {
        await fetchAnswers();
        renderAnswers();
      } catch (answerError) {
        console.error("Daily answers error:", answerError);
        $("#answers-status").textContent =
          `Pertanyaan berhasil dimuat, tetapi jawaban gagal dibaca: ${answerError.message || "Kesalahan tidak diketahui."}`;
      }
    } catch (error) {
      console.error("Question error:", error);
      $("#daily-question").textContent = "Pertanyaan belum tersedia.";
      $("#answers-status").textContent =
        `Penyebab: ${error.message || "Kesalahan tidak diketahui."}`;
    } finally {
      questionRequest = null;
    }
  })();

  return questionRequest;
}

async function fetchAnswers() {
  if (!activeQuestionDate || !coupleId) return;

  const { data, error } = await supabaseClient
    .from("daily_answers")
    .select("user_id,answer")
    .eq("couple_id", coupleId)
    .eq("question_date", activeQuestionDate);

  if (error) throw error;
  answerRows = data || [];
}

function renderAnswers() {
  if (!activeQuestionDate || !currentUser) return;

  const myRow = answerRows.find(row => row.user_id === currentUser.id);
  const partnerRow = answerRows.find(row => row.user_id === partnerUserId);

  const both = Boolean(myRow && partnerRow);
  const one = Boolean(myRow || partnerRow);

  $("#answers-status").textContent = both
    ? "Kalian berdua sudah menjawab! Baca jawaban kalian di bawah ♡"
    : one
      ? "Satu jawaban tersimpan. Jawaban terbuka setelah keduanya menjawab."
      : "Belum ada jawaban hari ini.";

  $("#answers-reveal").classList.toggle("hidden", !both);

  $("#answers-reveal").innerHTML = both
    ? `
      <div class="answer-item">
        <strong>${escapeHTML(MY_NAME)}</strong>
        <p>${escapeHTML(myRow.answer)}</p>
      </div>
      <div class="answer-item">
        <strong>${escapeHTML(PARTNER_NAME)}</strong>
        <p>${escapeHTML(partnerRow.answer)}</p>
      </div>
    `
    : "";
}

$("#refresh-question").addEventListener("click", () => {
  questionRequest = null;
  loadQuestion();
});

$("#submit-answer").addEventListener("click", async () => {
  const answer = $("#answer-text").value.trim();

  if (!activeQuestionDate) {
    alert("Tunggu sampai pertanyaan selesai dimuat.");
    return;
  }

  if (!answer) {
    alert("Tulis jawabanmu dulu ya ♡");
    return;
  }

  const alreadyAnswered = answerRows.some(
    row => row.user_id === currentUser.id
  );

  if (alreadyAnswered) {
    alert("Kamu sudah menjawab pertanyaan hari ini.");
    return;
  }

  const button = $("#submit-answer");
  button.disabled = true;

  try {
    const { error } = await supabaseClient
      .from("daily_answers")
      .insert({
        couple_id: coupleId,
        question_date: activeQuestionDate,
        user_id: currentUser.id,
        answer
      });

    if (error) throw error;

    $("#answer-text").value = "";
    await fetchAnswers();
    renderAnswers();
  } catch (error) {
    console.error("Answer error:", error);
    alert(
      `Jawaban gagal disimpan. Kode: ${error.code || "-"}. ${error.message || "Kesalahan tidak diketahui."}`
    );
  } finally {
    button.disabled = false;
  }
});

// ==========================================
// PENGATURAN TAMPILAN — LOKAL PER PERANGKAT
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

const settings = localDB.get("olu-settings", {});

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

  localDB.set("olu-settings", next);
  applySettings(next);
  alert("Tampilan berhasil disimpan! ✨");
});

// Segarkan data saat pengguna kembali ke tab.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && currentUser && coupleId) {
    syncAll();
  }
});
