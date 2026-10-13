
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
let petActionBusy = false;
let moodBusy = false;
let challengeBusy = false;
let wrappedPeriod = "week";

let checkinRows = [];
let notesRows = [];
let answerRows = [];
let petRow = null;
let moodRows = [];
let challengeRow = null;
let challengeCompletionRows = [];

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
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn("Local settings could not be saved:", error);
    }
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

function shiftDate(dateString, days) {
  const d = new Date(dateString + "T12:00:00");
  d.setDate(d.getDate() + days);
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

function setText(selector, value) {
  const el = $(selector);
  if (el) el.textContent = value;
}

function setHTML(selector, value) {
  const el = $(selector);
  if (el) el.innerHTML = value;
}

function setStatus(selector, message) {
  setText(selector, message);
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
  questionRequest = null;
  checkinRows = [];
  notesRows = [];
  answerRows = [];
  petRow = null;
  moodRows = [];
  challengeRow = null;
  challengeCompletionRows = [];

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

  if (name === "activity") {
    loadActivity().catch(error => {
      console.error("Activity loading error:", error);
    });
  }

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

  setText("#today-date", now.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }));

  setText("#days", Math.max(
    0,
    Math.floor((midnight - start) / 86400000)
  ));

  let next = new Date(`${now.getFullYear()}-10-08T00:00:00`);
  if (next < midnight) next.setFullYear(next.getFullYear() + 1);

  setText("#countdown", Math.round(
    (next - midnight) / 86400000
  ));
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
      try {
        await fetchAnswers();
        renderAnswers();
      } catch (error) {
        console.error("Answer sync error:", error);
      }
    }

    if ($("#page-activity")?.classList.contains("active")) {
      await loadActivity();
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
  if (!currentUser) return;

  const todayRows = checkinRows.filter(
    row => row.checkin_date === today()
  );

  const checkedIds = new Set(todayRows.map(row => row.user_id));
  const meChecked = checkedIds.has(currentUser.id);
  const partnerChecked = checkedIds.has(partnerUserId);
  const both = meChecked && partnerChecked;
  const one = meChecked || partnerChecked;
  const count = streakCount();

  setText("#home-streak", count);
  setText("#streak-count", count);

  setText("#home-streak-status", both
    ? "Kalian berdua sudah hadir hari ini! ✨"
    : one
      ? "Satu check-in lagi untuk menyalakan api bersama!"
      : "Ayo hadir untuk satu sama lain hari ini."
  );

  const flame = $("#big-flame");
  if (flame) {
    flame.className =
      "flame " + (both ? "lit" : one ? "partial" : "dim");
  }

  setText("#streak-message", both
    ? "Api kita menyala terang! ♡"
    : one
      ? "Satu orang sudah check-in."
      : "Api menunggu check-in pertama."
  );

  $$(".person").forEach(button => {
    const isMe = button.dataset.person === "me";
    const isPartner = button.dataset.person === "partner";
    const checked = isMe ? meChecked : isPartner ? partnerChecked : false;

    button.classList.toggle("checked", checked);
    button.disabled = !isMe || meChecked;
  });

  setText("#checkin-status", both
    ? `${MY_NAME} dan ${PARTNER_NAME} sudah check-in hari ini! ♡`
    : meChecked
      ? `${MY_NAME} sudah check-in. Menunggu ${PARTNER_NAME}.`
      : partnerChecked
        ? `${PARTNER_NAME} sudah check-in. Sekarang giliranmu!`
        : "Belum ada yang check-in hari ini."
  );
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
          Dengarkan lagu pilihan kalian.
        </p>
        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer"
           class="spotify-open-link">
          ♫ Buka lagu ↗
        </a>
      </div>
    `;
  }

  return `
    <div class="spotify-card">
      <div class="spotify-card-label">♫ OUR SONG</div>
      <iframe class="spotify-embed"
        src="${escapeHTML(embedUrl)}"
        title="Pemutar Spotify"
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen>
      </iframe>
      <a href="${safeUrl}" target="_blank" rel="noopener noreferrer"
         class="spotify-open-link">
        Buka di aplikasi Spotify ↗
      </a>
    </div>
  `;
}

function renderNotes() {
  if (!currentUser) return;

  const todaysNote = notesRows.find(
    item => timestampDate(item.created_at) === today()
  );

  setText("#home-note", todaysNote
    ? `${displayNameForUser(todaysNote.author_id)}: ${todaysNote.body}`
    : "Belum ada catatan hari ini. Tulis pesan kecil untuk pasanganmu."
  );

  setHTML("#home-music", todaysNote?.music_url
    ? renderSpotifyCard(todaysNote.music_url)
    : ""
  );

  setHTML("#notes-list", notesRows.length
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
    : `<p class="muted small">Belum ada catatan. ♡</p>`
  );
}

$("#note-form")?.addEventListener("submit", async event => {
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

  setText("#daily-question", "Memuat pertanyaan hari ini... ✨");
  setText("#answers-status", "Tunggu sebentar ya.");
  $("#answers-reveal")?.classList.add("hidden");

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
            `Gagal menyimpan daily_questions. Kode: ${insertError.code || "-"}. ${insertError.message}`
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
            `Gagal membaca ulang pertanyaan. ${retry.error.message}`
          );
        }

        finalQuestion = retry.data?.question || result.question;
      }

      setText("#question-date", dateLabel(activeQuestionDate));
      setText("#daily-question", finalQuestion);

      try {
        await fetchAnswers();
        renderAnswers();
      } catch (answerError) {
        console.error("Daily answers error:", answerError);
        setText("#answers-status",
          `Pertanyaan berhasil dimuat, tetapi jawaban gagal dibaca: ${answerError.message || "Kesalahan tidak diketahui."}`
        );
      }
    } catch (error) {
      console.error("Question error:", error);
      setText("#daily-question", "Pertanyaan belum tersedia.");
      setText("#answers-status",
        `Penyebab: ${error.message || "Kesalahan tidak diketahui."}`
      );
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

  setText("#answers-status", both
    ? "Kalian berdua sudah menjawab! Baca jawaban kalian di bawah ♡"
    : one
      ? "Satu jawaban tersimpan. Jawaban terbuka setelah keduanya menjawab."
      : "Belum ada jawaban hari ini."
  );

  $("#answers-reveal")?.classList.toggle("hidden", !both);

  setHTML("#answers-reveal", both
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
    : ""
  );
}

$("#refresh-question")?.addEventListener("click", () => {
  questionRequest = null;
  loadQuestion();
});

$("#submit-answer")?.addEventListener("click", async () => {
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
// LUMI — HEWAN PELIHARAAN BERSAMA
// ==========================================

async function ensurePet() {
  const { error: insertError } = await supabaseClient
    .from("shared_pets")
    .insert({ couple_id: coupleId });

  // 23505 means Lumi already exists for this couple.
  if (insertError && insertError.code !== "23505") {
    throw insertError;
  }

  const { data, error } = await supabaseClient
    .from("shared_pets")
    .select("couple_id,name,level,exp,hunger,happiness,updated_at")
    .eq("couple_id", coupleId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Data Lumi belum tersedia.");

  petRow = data;
  renderPet();
}

function renderPet() {
  if (!petRow) return;

  const hunger = Math.max(0, Math.min(100, Number(petRow.hunger) || 0));
  const happiness = Math.max(0, Math.min(100, Number(petRow.happiness) || 0));
  const level = Math.max(1, Number(petRow.level) || 1);
  const exp = Math.max(0, Number(petRow.exp) || 0);
  const expIntoLevel = exp % 100;

  setText("#lumi-name", petRow.name || "Lumi");
  setText("#lumi-level", `Lv. ${level}`);
  setText("#lumi-exp", `${expIntoLevel}/100 EXP`);
  setText("#lumi-hunger-text", `${hunger}/100`);
  setText("#lumi-happiness-text", `${happiness}/100`);

  const expBar = $("#lumi-exp-bar");
  if (expBar) expBar.style.width = `${expIntoLevel}%`;

  const hungerBar = $("#lumi-hunger-bar");
  if (hungerBar) hungerBar.style.width = `${hunger}%`;

  const happinessBar = $("#lumi-happiness-bar");
  if (happinessBar) happinessBar.style.width = `${happiness}%`;

  const sprite = $("#lumi-sprite");
  if (sprite) {
    sprite.textContent = happiness < 25
      ? "🥺"
      : hunger < 25
        ? "🐣"
        : level >= 10
          ? "🐉"
          : level >= 5
            ? "🐱"
            : "🐰";
  }

  setText("#lumi-status",
    hunger < 25
      ? "Lumi mulai lapar. Siapa yang mau memberinya makan? ♡"
      : happiness < 25
        ? "Lumi ingin ditemani bermain."
        : "Lumi senang karena kalian merawatnya bersama! ♡"
  );
}

async function careForLumi(actionType) {
  if (!currentUser || !coupleId || petActionBusy) return;

  const feedButton = $("#lumi-feed");
  const playButton = $("#lumi-play");

  petActionBusy = true;
  if (feedButton) feedButton.disabled = true;
  if (playButton) playButton.disabled = true;

  try {
    const { data, error } = await supabaseClient.rpc("care_for_lumi", {
      cid: coupleId,
      action_type: actionType
    });

    if (error) throw error;

    petRow = Array.isArray(data) ? data[0] : data;
    if (!petRow) {
      await ensurePet();
    } else {
      renderPet();
    }

    setStatus("#lumi-action-status",
      actionType === "feed"
        ? `${MY_NAME} memberi Lumi makan. +5 EXP ✨`
        : `${MY_NAME} bermain bersama Lumi. +10 EXP ✨`
    );
  } catch (error) {
    console.error("Lumi action error:", error);
    setStatus("#lumi-action-status",
      `Aksi gagal: ${error.message || "Coba lagi nanti."}`
    );
  } finally {
    petActionBusy = false;
    if (feedButton) feedButton.disabled = false;
    if (playButton) playButton.disabled = false;
  }
}

$("#lumi-feed")?.addEventListener("click", () => careForLumi("feed"));
$("#lumi-play")?.addEventListener("click", () => careForLumi("play"));

// ==========================================
// MOOD HARIAN
// ==========================================

const MOOD_INFO = {
  happy: { label: "Bahagia", emoji: "😊" },
  calm: { label: "Tenang", emoji: "🌿" },
  loved: { label: "Merasa dicintai", emoji: "💗" },
  tired: { label: "Lelah", emoji: "🥹" },
  sad: { label: "Sedih", emoji: "🌧️" },
  miss: { label: "Merindukanmu", emoji: "💌" }
};

async function fetchMoods() {
  const { data, error } = await supabaseClient
    .from("daily_moods")
    .select("user_id,mood,mood_date")
    .eq("couple_id", coupleId)
    .eq("mood_date", today());

  if (error) throw error;
  moodRows = data || [];
  renderMoods();
}

function renderMoods() {
  const myMood = moodRows.find(row => row.user_id === currentUser?.id);
  const partnerMood = moodRows.find(row => row.user_id === partnerUserId);

  $$(".mood-button[data-mood]").forEach(button => {
    const selected = myMood?.mood === button.dataset.mood;
    button.classList.toggle("selected", Boolean(selected));
    button.setAttribute("aria-pressed", String(Boolean(selected)));
    button.disabled = moodBusy;
  });

  const renderPersonMood = (name, row) => {
    const info = row ? MOOD_INFO[row.mood] : null;
    return `
      <div class="couple-mood-item">
        <strong>${escapeHTML(name)}</strong>
        <span>${info ? `${info.emoji} ${escapeHTML(info.label)}` : "Belum memilih mood"}</span>
      </div>
    `;
  };

  setHTML("#couple-moods",
    renderPersonMood(MY_NAME, myMood) +
    renderPersonMood(PARTNER_NAME, partnerMood)
  );

  setStatus("#mood-status", myMood
    ? "Mood kamu hari ini sudah tersimpan ♡"
    : "Pilih satu mood yang paling menggambarkan harimu."
  );
}

async function saveMood(mood) {
  if (!currentUser || !coupleId || moodBusy || !MOOD_INFO[mood]) return;

  moodBusy = true;
  $$(".mood-button[data-mood]").forEach(button => {
    button.disabled = true;
  });

  setStatus("#mood-status", "Menyimpan mood...");

  try {
    const { error } = await supabaseClient
      .from("daily_moods")
      .upsert({
        couple_id: coupleId,
        mood_date: today(),
        user_id: currentUser.id,
        mood
      }, {
        onConflict: "couple_id,mood_date,user_id"
      });

    if (error) throw error;

    await fetchMoods();
  } catch (error) {
    console.error("Mood save error:", error);
    setStatus("#mood-status",
      `Mood gagal disimpan: ${error.message || "Coba lagi."}`
    );
  } finally {
    moodBusy = false;
    $$(".mood-button[data-mood]").forEach(button => {
      button.disabled = false;
    });
    renderMoods();
  }
}

$$(".mood-button[data-mood]").forEach(button => {
  button.addEventListener("click", () => saveMood(button.dataset.mood));
});

// ==========================================
// TANTANGAN HARIAN
// ==========================================

const DAILY_CHALLENGES = [
  "Kirim satu pesan baik untuk pasanganmu.",
  "Tanyakan bagaimana hari kalian berjalan.",
  "Bagikan satu lagu yang mengingatkanmu pada pasangan.",
  "Ucapkan terima kasih untuk satu hal kecil.",
  "Ceritakan satu hal menyenangkan hari ini.",
  "Kirim foto sesuatu yang membuatmu tersenyum.",
  "Luangkan lima menit untuk ngobrol tanpa distraksi.",
  "Berikan satu pujian yang tulus.",
  "Ceritakan satu hal yang ingin kalian lakukan bersama.",
  "Kirim pesan penyemangat untuk hari ini.",
  "Ingat kembali satu kenangan yang membuat kalian tertawa.",
  "Tanyakan satu hal baru yang ingin pasangan coba."
];

function challengeForDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const dayNumber = Math.floor(
    new Date(year, month - 1, day).getTime() / 86400000
  );

  return DAILY_CHALLENGES[
    ((dayNumber % DAILY_CHALLENGES.length) + DAILY_CHALLENGES.length) %
    DAILY_CHALLENGES.length
  ];
}

async function ensureDailyChallenge() {
  const date = today();

  const { error: insertError } = await supabaseClient
    .from("daily_challenges")
    .insert({
      couple_id: coupleId,
      challenge_date: date,
      challenge_text: challengeForDate(date)
    });

  if (insertError && insertError.code !== "23505") {
    throw insertError;
  }

  const { data, error } = await supabaseClient
    .from("daily_challenges")
    .select("couple_id,challenge_date,challenge_text")
    .eq("couple_id", coupleId)
    .eq("challenge_date", date)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error(
      "Tantangan belum ditemukan. Pastikan kolom challenge_text tersedia di daily_challenges."
    );
  }

  challengeRow = data;
  await fetchChallengeCompletions();
}

async function fetchChallengeCompletions() {
  const { data, error } = await supabaseClient
    .from("challenge_completions")
    .select("user_id,challenge_date")
    .eq("couple_id", coupleId)
    .eq("challenge_date", today());

  if (error) throw error;
  challengeCompletionRows = data || [];
  renderChallenge();
}

function renderChallenge() {
  if (!currentUser) return;

  const completedIds = new Set(
    challengeCompletionRows.map(row => row.user_id)
  );

  const meDone = completedIds.has(currentUser.id);
  const partnerDone = completedIds.has(partnerUserId);
  const total = Number(meDone) + Number(partnerDone);

  setText("#challenge-date", `Tantangan · ${dateLabel(today())}`);
  setText("#challenge-text",
    challengeRow?.challenge_text || challengeForDate(today())
  );
  setText("#challenge-progress-text", `${total}/2 selesai`);

  const progressBar = $("#challenge-progress-bar");
  if (progressBar) progressBar.style.width = `${total * 50}%`;

  const meButton = $("#challenge-me");
  const partnerButton = $("#challenge-partner");

  if (meButton) {
    meButton.classList.toggle("completed", meDone);
    meButton.disabled = challengeBusy || meDone;
    meButton.innerHTML = `
      <strong>${escapeHTML(MY_NAME)}</strong>
      <span>${meDone ? "✓ Selesai" : "○ Belum selesai"}</span>
    `;
  }

  if (partnerButton) {
    partnerButton.classList.toggle("completed", partnerDone);
    // A user's browser must not mark the partner's challenge complete.
    partnerButton.disabled = true;
    partnerButton.innerHTML = `
      <strong>${escapeHTML(PARTNER_NAME)}</strong>
      <span>${partnerDone ? "✓ Selesai" : "○ Menunggu pasangan"}</span>
    `;
  }

  setStatus("#challenge-status",
    total === 2
      ? "Kalian berhasil menyelesaikan tantangan hari ini! ♡"
      : meDone
        ? `Bagus! Sekarang menunggu ${PARTNER_NAME}.`
        : partnerDone
          ? `${PARTNER_NAME} sudah selesai. Sekarang giliranmu!`
          : "Selesaikan tantangan, lalu tunggu pasanganmu."
  );
}

async function toggleMyChallenge() {
  if (!currentUser || !coupleId || challengeBusy) return;

  const alreadyDone = challengeCompletionRows.some(
    row => row.user_id === currentUser.id
  );

  if (alreadyDone) return;

  challengeBusy = true;
  renderChallenge();
  setStatus("#challenge-status", "Menyimpan progres...");

  try {
    const { error } = await supabaseClient
      .from("challenge_completions")
      .insert({
        couple_id: coupleId,
        challenge_date: today(),
        user_id: currentUser.id
      });

    if (error && error.code !== "23505") throw error;

    await fetchChallengeCompletions();
  } catch (error) {
    console.error("Challenge completion error:", error);
    setStatus("#challenge-status",
      `Progres gagal disimpan: ${error.message || "Coba lagi."}`
    );
  } finally {
    challengeBusy = false;
    renderChallenge();
  }
}

$("#challenge-me")?.addEventListener("click", toggleMyChallenge);

// ==========================================
// WRAPPED — RINGKASAN AKTIVITAS
// ==========================================

function getWrappedRange(period) {
  const end = today();

  if (period === "month") {
    const d = new Date();
    return {
      start: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`,
      end
    };
  }

  return {
    start: shiftDate(end, -6),
    end
  };
}

function countInRange(rows, dateKey, start, end) {
  return rows.filter(row =>
    row[dateKey] >= start && row[dateKey] <= end
  ).length;
}

async function renderWrapped() {
  if (!currentUser || !coupleId) return;

  const range = getWrappedRange(wrappedPeriod);
  setHTML("#wrapped-content",
    `<p class="wrapped-empty">Mengumpulkan cerita kalian... ✨</p>`
  );

  try {
    const [
      { data: moods, error: moodsError },
      { data: challenges, error: challengesError },
      { data: checkins, error: checkinsError }
    ] = await Promise.all([
      supabaseClient
        .from("daily_moods")
        .select("user_id,mood,mood_date")
        .eq("couple_id", coupleId)
        .gte("mood_date", range.start)
        .lte("mood_date", range.end),

      supabaseClient
        .from("challenge_completions")
        .select("user_id,challenge_date")
        .eq("couple_id", coupleId)
        .gte("challenge_date", range.start)
        .lte("challenge_date", range.end),

      supabaseClient
        .from("checkins")
        .select("user_id,checkin_date")
        .eq("couple_id", coupleId)
        .gte("checkin_date", range.start)
        .lte("checkin_date", range.end)
    ]);

    if (moodsError) throw moodsError;
    if (challengesError) throw challengesError;
    if (checkinsError) throw checkinsError;

    const moodData = moods || [];
    const challengeData = challenges || [];
    const checkinData = checkins || [];

    const periodCheckins = countInRange(
      checkinData, "checkin_date", range.start, range.end
    );

    const periodMoods = countInRange(
      moodData, "mood_date", range.start, range.end
    );

    const periodChallenges = countInRange(
      challengeData, "challenge_date", range.start, range.end
    );

    const periodNotes = notesRows.filter(row => {
      const date = timestampDate(row.created_at);
      return date >= range.start && date <= range.end;
    }).length;

    const uniqueCheckinDays = new Set(
      checkinData.map(row => `${row.user_id}:${row.checkin_date}`)
    ).size;

    const moodCounts = Object.keys(MOOD_INFO).map(key => ({
      key,
      ...MOOD_INFO[key],
      count: moodData.filter(row => row.mood === key).length
    }));

    const maxMoodCount = Math.max(
      1,
      ...moodCounts.map(item => item.count)
    );

    const moodBars = moodCounts
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count)
      .map(item => `
        <div class="wrapped-mood-row">
          <span>${item.emoji} ${escapeHTML(item.label)}</span>
          <div class="wrapped-mood-track">
            <div class="wrapped-mood-fill"
              style="width:${(item.count / maxMoodCount) * 100}%"></div>
          </div>
          <span class="wrapped-mood-count">${item.count}</span>
        </div>
      `).join("");

    const title = wrappedPeriod === "month"
      ? "Bulan ini"
      : "7 hari terakhir";

    const empty = periodCheckins === 0 &&
      periodMoods === 0 &&
      periodChallenges === 0 &&
      periodNotes === 0;

    setHTML("#wrapped-content", `
      <div class="muted small">
        ${escapeHTML(title)} · ${escapeHTML(dateLabel(range.start))}
        – ${escapeHTML(dateLabel(range.end))}
      </div>

      ${empty ? `
        <div class="wrapped-empty">
          Belum ada aktivitas yang tercatat dalam periode ini.
          Mulai kumpulkan cerita kecil kalian bersama ♡
        </div>
      ` : `
        <div class="wrapped-grid" style="margin-top:14px">
          <div class="wrapped-stat">
            <span class="eyebrow">CHECK-IN</span>
            <strong class="wrapped-number">${periodCheckins}</strong>
            <span class="wrapped-label">Check-in tersimpan</span>
          </div>
          <div class="wrapped-stat">
            <span class="eyebrow">MOOD</span>
            <strong class="wrapped-number">${periodMoods}</strong>
            <span class="wrapped-label">Mood yang dibagikan</span>
          </div>
          <div class="wrapped-stat">
            <span class="eyebrow">CHALLENGE</span>
            <strong class="wrapped-number">${periodChallenges}</strong>
            <span class="wrapped-label">Tantangan yang diselesaikan</span>
          </div>
          <div class="wrapped-stat">
            <span class="eyebrow">NOTES</span>
            <strong class="wrapped-number">${periodNotes}</strong>
            <span class="wrapped-label">Catatan yang dibuat</span>
          </div>
        </div>

        <div class="card" style="margin-top:13px">
          <div class="eyebrow">JEJAK KEHADIRAN</div>
          <p>
            Ada ${uniqueCheckinDays} catatan kehadiran individu
            dari check-in yang tersimpan selama periode ini.
          </p>
        </div>

        <div class="card" style="margin-top:13px">
          <div class="eyebrow">MOOD KALIAN</div>
          ${moodBars
            ? `<div class="wrapped-moods">${moodBars}</div>`
            : `<p class="wrapped-empty">Belum ada mood tercatat pada periode ini.</p>`
          }
        </div>
      `}
    `);
  } catch (error) {
    console.error("Wrapped error:", error);
    setHTML("#wrapped-content", `
      <div class="wrapped-empty">
        Ringkasan belum dapat dimuat.<br>
        ${escapeHTML(error.message || "Periksa koneksi dan kebijakan Supabase.")}
      </div>
    `);
  }
}

$$(".wrapped-tab[data-period]").forEach(button => {
  button.addEventListener("click", async () => {
    wrappedPeriod = button.dataset.period === "month" ? "month" : "week";

    $$(".wrapped-tab[data-period]").forEach(tab => {
      tab.classList.toggle("active", tab === button);
      tab.setAttribute("aria-pressed", String(tab === button));
    });

    await renderWrapped();
  });
});

$("#refresh-wrapped")?.addEventListener("click", renderWrapped);

// ==========================================
// MEMUAT SEMUA FITUR ACTIVITY
// ==========================================

async function loadActivity() {
  if (!currentUser || !coupleId) return;

  const results = await Promise.allSettled([
    ensurePet(),
    fetchMoods(),
    ensureDailyChallenge()
  ]);

  const messages = [];

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error("Activity feature error:", index, result.reason);
      messages.push(result.reason?.message || "Ada fitur yang gagal dimuat.");
    }
  });

  if (messages.length) {
    setStatus("#activity-status", messages.join(" · "));
  } else {
    setStatus("#activity-status", "");
  }

  await renderWrapped();
}

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

if ($("#theme")) $("#theme").value = settings.theme || "purple";
if ($("#wallpaper")) $("#wallpaper").value = settings.wallpaper || "";
applySettings(settings);

$("#save-settings")?.addEventListener("click", () => {
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
