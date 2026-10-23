
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
// LUMI — PIXEL CAT PET
// ==========================================

let lumiAction = "idle";
let lumiActionTimer = null;
let lumiSleepTimer = null;
let lumiIsSleeping = false;

async function ensurePet() {
  const { error: insertError } = await supabaseClient
    .from("shared_pets")
    .insert({ couple_id: coupleId });

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
  setText("#lumi-level", level);
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
  const stage = $("#lumi-stage");

  if (sprite) {
    sprite.classList.toggle("is-sleeping", lumiIsSleeping);
    sprite.classList.toggle("is-eating", lumiAction === "eating");
    sprite.classList.toggle("is-playing", lumiAction === "playing");
    sprite.classList.toggle("is-hungry", hunger < 25);
    sprite.classList.toggle("is-sad", happiness < 25);
    sprite.classList.toggle("is-happy", lumiAction === "playing");

    sprite.setAttribute("aria-pressed", String(lumiIsSleeping));
    sprite.setAttribute(
      "aria-label",
      lumiIsSleeping
        ? "Bangunkan Lumi"
        : "Ketuk untuk menidurkan Lumi"
    );
  }

  if (stage) {
    stage.classList.toggle("is-sleeping", lumiIsSleeping);
  }

  if (lumiIsSleeping) {
    setText("#lumi-status", "Zzz... Lumi sedang tidur nyenyak 🌙");
  } else if (lumiAction === "eating") {
    setText("#lumi-status", "Nyam nyam! Terima kasih makanannya 🍓");
  } else if (lumiAction === "playing") {
    setText("#lumi-status", "Yeay! Lumi senang bermain denganmu! ♡");
  } else if (hunger < 25) {
    setText("#lumi-status", "Meong... Lumi mulai lapar 🍓");
  } else if (happiness < 25) {
    setText("#lumi-status", "Lumi ingin ditemani bermain 💗");
  } else if (level >= 10) {
    setText("#lumi-status", "Lumi tumbuh semakin hebat! ✨");
  } else {
    setText("#lumi-status", "Lumi senang kalian merawatnya bersama ♡");
  }
}

function setLumiAction(action, duration = 2200) {
  clearTimeout(lumiActionTimer);

  lumiAction = action;
  renderPet();

  if (action === "idle") return;

  lumiActionTimer = setTimeout(() => {
    lumiAction = "idle";
    renderPet();
  }, duration);
}

function toggleLumiSleep() {
  if (!currentUser || !petRow) return;

  clearTimeout(lumiActionTimer);
  clearTimeout(lumiSleepTimer);

  lumiIsSleeping = !lumiIsSleeping;
  lumiAction = "idle";

  setStatus(
    "#lumi-action-status",
    lumiIsSleeping
      ? "Lumi mulai tidur. Selamat istirahat, Lumi 🌙"
      : "Lumi sudah bangun kembali! ♡"
  );

  renderPet();

  if (lumiIsSleeping) {
    // Lumi bangun otomatis setelah 10 detik.
    lumiSleepTimer = setTimeout(() => {
      lumiIsSleeping = false;
      lumiAction = "idle";
      setStatus("#lumi-action-status", "Lumi sudah bangun kembali ♡");
      renderPet();
    }, 10000);
  }
}

async function careForLumi(actionType) {
  if (!currentUser || !coupleId || petActionBusy) return;

  if (!["feed", "play"].includes(actionType)) return;

  if (lumiIsSleeping) {
    setStatus("#lumi-action-status", "Bangunkan Lumi dulu ya 🌙");
    return;
  }

  const feedButton = $("#lumi-feed");
  const playButton = $("#lumi-play");

  petActionBusy = true;

  if (feedButton) feedButton.disabled = true;
  if (playButton) playButton.disabled = true;

  setLumiAction(actionType === "feed" ? "eating" : "playing");

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

    setStatus(
      "#lumi-action-status",
      actionType === "feed"
        ? `${MY_NAME} memberi Lumi makan. +5 EXP ✨`
        : `${MY_NAME} bermain bersama Lumi. +10 EXP ✨`
    );
  } catch (error) {
    console.error("Lumi action error:", error);

    setStatus(
      "#lumi-action-status",
      `Aksi gagal: ${error.message || "Coba lagi nanti."}`
    );

    lumiAction = "idle";
    renderPet();
  } finally {
    petActionBusy = false;

    if (feedButton) feedButton.disabled = false;
    if (playButton) playButton.disabled = false;
  }
}

$("#lumi-feed")?.addEventListener("click", () => {
  careForLumi("feed");
});

$("#lumi-play")?.addEventListener("click", () => {
  careForLumi("play");
});

$("#lumi-sprite")?.addEventListener("click", toggleLumiSleep);


/* ==========================================
   MOOD HARIAN — FIX HTML DAN EVENT KLIK
========================================== */

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
  if (!currentUser) return;

  const myMood = moodRows.find(
    row => row.user_id === currentUser.id
  );

  const partnerMood = moodRows.find(
    row => row.user_id === partnerUserId
  );

  // HTML memakai .mood-option, bukan .mood-button
  $$("#mood-options .mood-option[data-mood]").forEach(button => {
    const selected = myMood?.mood === button.dataset.mood;

    button.classList.toggle("selected", Boolean(selected));
    button.classList.toggle("active", Boolean(selected));
    button.setAttribute("aria-pressed", String(Boolean(selected)));
    button.disabled = moodBusy;
  });

  const renderPersonMood = (name, row) => {
    const info = row ? MOOD_INFO[row.mood] : null;

    return `
      <div class="couple-mood-item">
        <strong>${escapeHTML(name)}</strong>
        <span>
          ${info
            ? `${info.emoji} ${escapeHTML(info.label)}`
            : "Belum memilih mood"}
        </span>
      </div>
    `;
  };

  setHTML(
    "#couple-moods",
    renderPersonMood(MY_NAME, myMood) +
    renderPersonMood(PARTNER_NAME, partnerMood)
  );

  setStatus(
    "#mood-status",
    myMood
      ? `Mood kamu hari ini: ${MOOD_INFO[myMood.mood]?.label || myMood.mood} ♡`
      : "Pilih satu mood yang paling menggambarkan harimu."
  );
}

async function saveMood(mood) {
  if (!currentUser || !coupleId || moodBusy || !MOOD_INFO[mood]) {
    return;
  }

  moodBusy = true;
  renderMoods();

  setStatus("#mood-status", "Menyimpan mood... ♡");

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

    setStatus(
      "#mood-status",
      `Mood kamu hari ini: ${MOOD_INFO[mood].label} ♡`
    );
  } catch (error) {
    console.error("Mood save error:", error);

    setStatus(
      "#mood-status",
      `Mood gagal disimpan: ${error.message || "Coba lagi."}`
    );
  } finally {
    moodBusy = false;
    renderMoods();
  }
}

// Event delegation: klik emoji maupun teks tombol tetap berfungsi.
const moodContainer = $("#mood-options");

if (moodContainer && moodContainer.dataset.moodReady !== "true") {
  moodContainer.dataset.moodReady = "true";

  moodContainer.addEventListener("click", event => {
    const button = event.target.closest(".mood-option[data-mood]");

    if (!button || !moodContainer.contains(button)) return;

    saveMood(button.dataset.mood);
  });
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

/* ==========================================
   OUR HOUSE — PIXEL HOME + FURNITURE BAG
   SVG PIXEL ART • DRAG • SUPABASE SAVE
========================================== */

const HOUSE_DEFAULT = {
  characters: {
    aldi: { x: 34, y: 72, room: "living" },
    liza: { x: 43, y: 72, room: "living" }
  },
  furniture: [
    { id: "sofa", type: "sofa", x: 27, y: 39, room: "living" },
    { id: "plant", type: "plant", x: 83, y: 31, room: "living" },
    { id: "table", type: "table", x: 52, y: 53, room: "living" },
    { id: "tv", type: "tv", x: 72, y: 30, room: "living" },
    { id: "rug", type: "rug", x: 48, y: 67, room: "living" },
    { id: "lamp", type: "lamp", x: 15, y: 35, room: "living" },
    { id: "bookshelf", type: "bookshelf", x: 87, y: 55, room: "living" },
    { id: "bed", type: "bed", x: 36, y: 39, room: "bedroom" },
    { id: "desk", type: "desk", x: 76, y: 31, room: "bedroom" },
    { id: "wardrobe", type: "wardrobe", x: 80, y: 67, room: "bedroom" },
    { id: "plant2", type: "plant", x: 17, y: 67, room: "bedroom" },
    { id: "nightstand", type: "nightstand", x: 57, y: 39, room: "bedroom" }
  ],
  inventory: {
    chair: 6, table: 3, vase: 5, flower: 6,
    sofa: 2, plant: 6, tv: 2, rug: 3, bed: 2,
    desk: 2, wardrobe: 2, lamp: 4, bookshelf: 3,
    nightstand: 3, piano: 1, guitar: 2, fridge: 1,
    stove: 1, dishcabinet: 2, sink: 1, counter: 2,
    microwave: 1, washingmachine: 1, toilet: 1,
    bathtub: 1, mirror: 3, clock: 2, painting: 4,
    computer: 2, laptop: 2, speaker: 2, aquarium: 1,
    dumbbell: 2, treadmill: 1, yoga: 2, ball: 3,
    bookshelfSmall: 2, trashbin: 2, refrigeratorSmall: 1,
    guitarAmp: 1, plantSmall: 5, candle: 4, cushion: 5,
    petbed: 1, catTree: 1, doorplant: 2, doll: 2, partition: 7
  },
  lumi: { x: 58, y: 76, room: "living" }
};

/* width/height are percentages relative to the house world.
   Each sprite is drawn in SVG pixel-art style. */
const HOUSE_ITEMS = {
  sofa:             { name: "Sofa", width: 16, height: 17 },
  plant:            { name: "Tanaman", width: 11, height: 15 },
  table:            { name: "Meja", width: 14, height: 13 },
  tv:               { name: "Televisi", width: 13, height: 12 },
  rug:              { name: "Karpet", width: 22, height: 17 },
  bed:              { name: "Tempat tidur", width: 20, height: 24 },
  desk:             { name: "Meja kerja", width: 15, height: 17 },
  wardrobe:         { name: "Lemari pakaian", width: 15, height: 21 },
  lamp:             { name: "Lampu lantai", width: 9, height: 16 },
  bookshelf:        { name: "Rak buku", width: 13, height: 20 },
  nightstand:       { name: "Nakas", width: 11, height: 12 },
  chair:            { name: "Kursi", width: 10, height: 12 },
  vase:             { name: "Vas bunga", width: 8, height: 11 },
  flower:           { name: "Bunga", width: 9, height: 12 },
  piano:            { name: "Piano", width: 17, height: 19 },
  guitar:           { name: "Gitar", width: 10, height: 16 },
  fridge:           { name: "Kulkas", width: 13, height: 23 },
  stove:            { name: "Kompor", width: 14, height: 12 },
  dishcabinet:      { name: "Lemari piring", width: 15, height: 21 },
  sink:             { name: "Wastafel", width: 13, height: 13 },
  counter:          { name: "Meja dapur", width: 16, height: 13 },
  microwave:        { name: "Microwave", width: 11, height: 10 },
  washingmachine:   { name: "Mesin cuci", width: 13, height: 16 },
  toilet:           { name: "Toilet", width: 11, height: 13 },
  bathtub:          { name: "Bak mandi", width: 18, height: 12 },
  mirror:           { name: "Cermin", width: 10, height: 15 },
  clock:            { name: "Jam dinding", width: 8, height: 8 },
  painting:         { name: "Lukisan", width: 12, height: 12 },
  computer:         { name: "Komputer", width: 12, height: 13 },
  laptop:           { name: "Laptop", width: 11, height: 8 },
  speaker:          { name: "Speaker", width: 9, height: 13 },
  aquarium:         { name: "Akuarium", width: 14, height: 13 },
  dumbbell:         { name: "Dumbbell", width: 12, height: 7 },
  treadmill:        { name: "Treadmill", width: 16, height: 14 },
  yoga:             { name: "Matras yoga", width: 15, height: 10 },
  ball:             { name: "Bola", width: 9, height: 9 },
  bookshelfSmall:   { name: "Rak buku kecil", width: 11, height: 14 },
  trashbin:         { name: "Tempat sampah", width: 9, height: 12 },
  refrigeratorSmall:{ name: "Kulkas mini", width: 10, height: 16 },
  guitarAmp:        { name: "Amplifier gitar", width: 10, height: 11 },
  plantSmall:       { name: "Tanaman kecil", width: 8, height: 10 },
  candle:           { name: "Lilin", width: 6, height: 9 },
  cushion:          { name: "Bantal", width: 10, height: 8 },
  petbed:           { name: "Tempat tidur Lumi", width: 12, height: 9 },
  catTree:          { name: "Pohon kucing", width: 12, height: 18 },
  doorplant:        { name: "Tanaman pot", width: 10, height: 13 }, 
  doll:             { name: "Boneka", width: 10, height: 15},
  partition:        { name: "Tembok pemisah", width: 24, height: 12, solid: true}
};

let houseState = JSON.parse(JSON.stringify(HOUSE_DEFAULT));
let houseEditMode = false;
let houseBusy = false;
let houseSaveTimer = null;
let houseDrag = null;
let houseLastSaved = "";
let houseLoadRequest = null;
let houseWalkFrame = null;
let houseWalkToken = 0;
let houseSelectedItem = null;

/* ==========================================
   HELPERS
========================================== */

function houseRoom() {
  return $("#house-room")?.value || "living";
}

function houseClamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function houseNormalizePosition(saved, fallback) {
  if (!saved || !Number.isFinite(Number(saved.x)) ||
      !Number.isFinite(Number(saved.y))) {
    return { ...fallback };
  }

  return {
    ...fallback,
    ...saved,
    x: houseClamp(Number(saved.x), 5, 95),
    y: houseClamp(Number(saved.y), 18, 95),
    room: ["living", "bedroom"].includes(saved.room)
      ? saved.room : fallback.room
  };
}

function houseId(type) {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeHouseState(value) {
  const next = JSON.parse(JSON.stringify(HOUSE_DEFAULT));
  if (!value || typeof value !== "object") return next;

  for (const id of ["aldi", "liza"]) {
    next.characters[id] = houseNormalizePosition(
      value.characters?.[id],
      next.characters[id]
    );
  }

  // Save lama tetap didukung, tanpa memunculkan kembali
  // barang yang sudah diletakkan ke dalam rumah.
  if (Array.isArray(value.furniture)) {
    next.furniture = value.furniture
      .filter(item => item && typeof item === "object")
      .map((item, index) => {
        const legacy = HOUSE_ITEMS[item.id] ? item.id : null;
        const type = HOUSE_ITEMS[item.type]
          ? item.type
          : item.id === "plant2" ? "plant" : legacy;

        if (!type || !HOUSE_ITEMS[type]) return null;

        return {
          id: String(item.id || `${type}-${index}`),
          type,
          x: houseClamp(Number(item.x) || 50, 5, 95),
          y: houseClamp(Number(item.y) || 50, 18, 95),
          room: ["living", "bedroom"].includes(item.room)
            ? item.room : "living",
          zIndex: Number(item.zIndex) || 1
        };
      }).filter(Boolean);
  }

  // Inventory baru hanya ditambahkan untuk save lama
  // yang belum memiliki data inventory.
  next.inventory = {
    ...HOUSE_DEFAULT.inventory,
    ...(value.inventory && typeof value.inventory === "object"
      ? value.inventory : {})
  };

  for (const type of Object.keys(HOUSE_ITEMS)) {
    const count = Number(next.inventory[type]);
    next.inventory[type] = Number.isFinite(count)
      ? Math.max(0, Math.floor(count)) : 0;
  }

  next.lumi = houseNormalizePosition(value.lumi, next.lumi);
  return next;
}

/* ==========================================
   PIXEL SVG SPRITES
   Each furniture type has its own SVG drawing.
========================================== */

function houseFurnitureSVG(type) {
  const sprites = {
    sofa: `
      <rect x="7" y="20" width="50" height="29" fill="#70465a"/>
      <rect x="10" y="12" width="44" height="17" fill="#bd7892"/>
      <rect x="13" y="15" width="18" height="12" fill="#e7a9bd"/>
      <rect x="33" y="15" width="18" height="12" fill="#d891ab"/>
      <rect x="6" y="26" width="8" height="20" fill="#9b6078"/>
      <rect x="50" y="26" width="8" height="20" fill="#9b6078"/>
      <rect x="13" y="30" width="18" height="13" fill="#e7a9bd"/>
      <rect x="33" y="30" width="18" height="13" fill="#d891ab"/>
      <rect x="12" y="47" width="6" height="7" fill="#5c3b30"/>
      <rect x="46" y="47" width="6" height="7" fill="#5c3b30"/>`,
    plant: `
      <rect x="23" y="37" width="19" height="16" fill="#9a5d42"/>
      <rect x="20" y="35" width="25" height="5" fill="#d18b5d"/>
      <rect x="29" y="19" width="7" height="19" fill="#557c4e"/>
      <rect x="13" y="17" width="18" height="14" fill="#6e9e60"/>
      <rect x="35" y="12" width="17" height="15" fill="#47784d"/>
      <rect x="23" y="6" width="16" height="15" fill="#8dbd72"/>
      <rect x="35" y="25" width="14" height="12" fill="#669557"/>`,
    table: `
      <rect x="8" y="18" width="48" height="26" fill="#765035"/>
      <rect x="12" y="20" width="40" height="19" fill="#bd8750"/>
      <rect x="15" y="43" width="6" height="10" fill="#70472e"/>
      <rect x="43" y="43" width="6" height="10" fill="#70472e"/>
      <rect x="25" y="24" width="14" height="9" fill="#f0d8a5"/>
      <rect x="29" y="26" width="6" height="5" fill="#d28d9e"/>`,
    tv: `
      <rect x="8" y="12" width="48" height="34" fill="#594339"/>
      <rect x="12" y="16" width="40" height="25" fill="#2f4e5d"/>
      <rect x="16" y="20" width="12" height="7" fill="#86b8b0"/>
      <rect x="30" y="29" width="17" height="8" fill="#648d8e"/>
      <rect x="24" y="46" width="16" height="6" fill="#765035"/>`,
    rug: `
      <rect x="4" y="11" width="56" height="41" fill="#9b4f69"/>
      <rect x="9" y="16" width="46" height="31" fill="#d38a9d"/>
      <rect x="14" y="21" width="36" height="21" fill="#a95e7c"/>
      <rect x="20" y="26" width="24" height="11" fill="#f1d6b6"/>
      <rect x="27" y="29" width="10" height="5" fill="#d38a9d"/>`,
    bed: `
      <rect x="8" y="5" width="48" height="52" fill="#76513c"/>
      <rect x="12" y="9" width="40" height="44" fill="#c28aa8"/>
      <rect x="15" y="12" width="17" height="12" fill="#fff0d8"/>
      <rect x="33" y="12" width="16" height="12" fill="#fff0d8"/>
      <rect x="14" y="27" width="36" height="22" fill="#9c8ac9"/>
      <rect x="14" y="27" width="36" height="5" fill="#e8b8cf"/>
      <rect x="11" y="51" width="42" height="5" fill="#76513c"/>`,
    desk: `
      <rect x="7" y="20" width="50" height="26" fill="#805436"/>
      <rect x="11" y="22" width="42" height="19" fill="#c18b55"/>
      <rect x="13" y="44" width="7" height="10" fill="#70472e"/>
      <rect x="44" y="44" width="7" height="10" fill="#70472e"/>
      <rect x="23" y="8" width="23" height="15" fill="#4b626f"/>
      <rect x="26" y="11" width="17" height="9" fill="#b5d9d3"/>
      <rect x="29" y="23" width="10" height="3" fill="#594339"/>`,
    wardrobe: `
      <rect x="10" y="5" width="44" height="51" fill="#704a34"/>
      <rect x="14" y="9" width="17" height="43" fill="#bc8652"/>
      <rect x="33" y="9" width="17" height="43" fill="#d09a61"/>
      <rect x="28" y="9" width="4" height="43" fill="#704a34"/>
      <rect x="25" y="28" width="3" height="6" fill="#f3d49b"/>
      <rect x="36" y="28" width="3" height="6" fill="#f3d49b"/>`,
    lamp: `
      <rect x="27" y="25" width="10" height="27" fill="#805436"/>
      <rect x="18" y="12" width="28" height="18" fill="#e9c98e"/>
      <rect x="22" y="7" width="20" height="7" fill="#fff0c4"/>
      <rect x="20" y="28" width="24" height="4" fill="#bd8750"/>
      <rect x="21" y="51" width="22" height="5" fill="#704a34"/>`,
    bookshelf: `
      <rect x="9" y="5" width="46" height="52" fill="#765035"/>
      <rect x="14" y="10" width="36" height="12" fill="#d1a06b"/>
      <rect x="14" y="25" width="36" height="12" fill="#d1a06b"/>
      <rect x="14" y="40" width="36" height="12" fill="#d1a06b"/>
      <rect x="17" y="11" width="6" height="10" fill="#8b7ec0"/>
      <rect x="25" y="13" width="7" height="8" fill="#c96e87"/>
      <rect x="34" y="10" width="5" height="11" fill="#648d73"/>
      <rect x="42" y="12" width="5" height="9" fill="#d9b56c"/>
      <rect x="18" y="26" width="8" height="10" fill="#c96e87"/>
      <rect x="28" y="28" width="6" height="8" fill="#7f91c4"/>
      <rect x="36" y="25" width="10" height="11" fill="#648d73" />
      <rect x="18" y="41" width="6" height="10" fill="#d9b56c"/>
      <rect x="27" y="43" width="9" height="8" fill="#c96e87"/>
      <rect x="39" y="41" width="8" height="10" fill="#8b7ec0"/>`,
    nightstand: `
      <rect x="12" y="20" width="40" height="29" fill="#765035"/>
      <rect x="15" y="23" width="34" height="10" fill="#d1a06b"/>
      <rect x="15" y="35" width="34" height="10" fill="#bc8652"/>
      <rect x="29" y="27" width="5" height="3" fill="#f3d49b"/>
      <rect x="29" y="38" width="5" height="3" fill="#f3d49b"/>
      <rect x="15" y="48" width="5" height="6" fill="#704a34"/>
      <rect x="44" y="48" width="5" height="6" fill="#704a34"/>`,

    chair: `
      <rect x="19" y="8" width="26" height="23" fill="#a86f45"/>
      <rect x="22" y="11" width="20" height="17" fill="#d3a06a"/>
      <rect x="18" y="29" width="28" height="8" fill="#8d5838"/>
      <rect x="21" y="37" width="5" height="17" fill="#69432e"/>
      <rect x="39" y="37" width="5" height="17" fill="#69432e"/>`,
    vase: `
      <rect x="25" y="31" width="15" height="21" fill="#8e8bd0"/>
      <rect x="22" y="27" width="21" height="6" fill="#b7b4ee"/>
      <rect x="28" y="23" width="9" height="6" fill="#8e8bd0"/>
      <rect x="16" y="9" width="5" height="15" fill="#527c4d"/>
      <rect x="40" y="8" width="5" height="17" fill="#527c4d"/>
      <rect x="10" y="12" width="14" height="9" fill="#e77caa"/>
      <rect x="37" y="11" width="15" height="9" fill="#f2b65e"/>
      <rect x="23" y="5" width="17" height="10" fill="#e77caa"/>`,
    flower: `
      <rect x="30" y="23" width="4" height="29" fill="#4f8c52"/>
      <rect x="18" y="31" width="14" height="4" fill="#5da65b"/>
      <rect x="34" y="36" width="12" height="4" fill="#5da65b"/>
      <rect x="25" y="8" width="14" height="14" fill="#e779aa"/>
      <rect x="19" y="13" width="9" height="9" fill="#e779aa"/>
      <rect x="36" y="13" width="9" height="9" fill="#e779aa"/>
      <rect x="28" y="11" width="8" height="8" fill="#ffd568"/>
      <rect x="24" y="49" width="16" height="7" fill="#a86b49"/>`,
    piano: `
      <rect x="5" y="12" width="54" height="34" fill="#292936"/>
      <rect x="9" y="17" width="46" height="23" fill="#4a4b5c"/>
      <rect x="10" y="19" width="44" height="12" fill="#f5eee2"/>
      <rect x="14" y="19" width="4" height="8" fill="#292936"/>
      <rect x="23" y="19" width="4" height="8" fill="#292936"/>
      <rect x="32" y="19" width="4" height="8" fill="#292936"/>
      <rect x="41" y="19" width="4" height="8" fill="#292936"/>
      <rect x="50" y="19" width="4" height="8" fill="#292936"/>
      <rect x="9" y="44" width="5" height="10" fill="#292936"/>
      <rect x="50" y="44" width="5" height="10" fill="#292936"/>`,
    guitar: `
      <rect x="28" y="8" width="8" height="25" fill="#b77942"/>
      <rect x="24" y="26" width="16" height="16" fill="#dca34e"/>
      <rect x="19" y="32" width="13" height="15" fill="#c78536"/>
      <rect x="28" y="36" width="13" height="12" fill="#e4b65f"/>
      <rect x="29" y="7" width="6" height="6" fill="#745039"/>
      <rect x="29" y="12" width="2" height="30" fill="#f8e7b7"/>
      <rect x="33" y="12" width="2" height="30" fill="#f8e7b7"/>
      <rect x="28" y="34" width="7" height="7" fill="#6b4930"/>`,
    fridge: `
      <rect x="12" y="4" width="40" height="53" fill="#c5d9dc"/>
      <rect x="15" y="7" width="34" height="22" fill="#edf4f2"/>
      <rect x="15" y="32" width="34" height="21" fill="#b3cbd0"/>
      <rect x="42" y="12" width="3" height="11" fill="#64828b"/>
      <rect x="42" y="36" width="3" height="11" fill="#64828b"/>
      <rect x="9" y="55" width="8" height="3" fill="#6b747b"/>
      <rect x="47" y="55" width="8" height="3" fill="#6b747b"/>`,
    stove: `
      <rect x="8" y="19" width="48" height="30" fill="#aab7bc"/>
      <rect x="11" y="22" width="42" height="23" fill="#e2e6e5"/>
      <rect x="14" y="25" width="15" height="9" fill="#414951"/>
      <rect x="35" y="25" width="15" height="9" fill="#414951"/>
      <rect x="17" y="27" width="9" height="5" fill="#777f86"/>
      <rect x="38" y="27" width="9" height="5" fill="#777f86"/>
      <rect x="16" y="37" width="32" height="6" fill="#b7c3c5"/>
      <rect x="18" y="49" width="5" height="7" fill="#68747a"/>
      <rect x="43" y="49" width="5" height="7" fill="#68747a"/>`,
    dishcabinet: `
      <rect x="8" y="5" width="48" height="52" fill="#966c4a"/>
      <rect x="12" y="9" width="40" height="22" fill="#d2b58c"/>
      <rect x="12" y="34" width="40" height="18" fill="#b98a5d"/>
      <rect x="16" y="12" width="32" height="15" fill="#b7dce0"/>
      <rect x="20" y="15" width="8" height="9" fill="#f6f0dc"/>
      <rect x="31" y="15" width="8" height="9" fill="#f6f0dc"/>
      <rect x="16" y="38" width="32" height="10" fill="#d5ad7b"/>
      <rect x="28" y="39" width="4" height="7" fill="#765035"/>`,
    sink: `
      <rect x="8" y="25" width="48" height="24" fill="#a77b52"/>
      <rect x="12" y="21" width="40" height="9" fill="#d7d7d1"/>
      <rect x="17" y="22" width="30" height="6" fill="#9ccbd2"/>
      <rect x="28" y="11" width="7" height="12" fill="#879ca2"/>
      <rect x="30" y="8" width="12" height="4" fill="#879ca2"/>
      <rect x="14" y="49" width="6" height="7" fill="#70472e"/>
      <rect x="44" y="49" width="6" height="7" fill="#70472e"/>`,
    counter: `
      <rect x="6" y="23" width="52" height="25" fill="#9b6a43"/>
      <rect x="6" y="19" width="52" height="8" fill="#e5d2ae"/>
      <rect x="12" y="30" width="40" height="15" fill="#c58f5c"/>
      <rect x="15" y="48" width="5" height="7" fill="#70472e"/>
      <rect x="44" y="48" width="5" height="7" fill="#70472e"/>`,
    microwave: `
      <rect x="7" y="15" width="50" height="32" fill="#aab6bc"/>
      <rect x="11" y="19" width="34" height="23" fill="#45555c"/>
      <rect x="14" y="22" width="28" height="17" fill="#83b7bd"/>
      <rect x="48" y="21" width="5" height="4" fill="#596b73"/>
      <rect x="48" y="29" width="5" height="4" fill="#596b73"/>
      <rect x="48" y="37" width="5" height="4" fill="#596b73"/>`,
    washingmachine: `
      <rect x="9" y="6" width="46" height="49" fill="#c3d6dc"/>
      <rect x="14" y="11" width="36" height="7" fill="#edf3ef"/>
      <rect x="19" y="24" width="26" height="24" fill="#789ba9"/>
      <rect x="22" y="27" width="20" height="18" fill="#b9e1e1"/>
      <rect x="17" y="13" width="4" height="3" fill="#667b86"/>
      <rect x="26" y="13" width="14" height="3" fill="#8aa5ad"/>`,
    toilet: `
      <rect x="14" y="10" width="36" height="19" fill="#e9eee9"/>
      <rect x="18" y="13" width="28" height="13" fill="#c9d9d8"/>
      <rect x="17" y="29" width="30" height="13" fill="#f5f5eb"/>
      <rect x="22" y="38" width="20" height="15" fill="#d8e5e0"/>
      <rect x="18" y="49" width="28" height="5" fill="#b4c8c7"/>`,
    bathtub: `
      <rect x="5" y="20" width="54" height="26" fill="#d5e4e1"/>
      <rect x="9" y="24" width="46" height="16" fill="#8fc6d0"/>
      <rect x="12" y="27" width="40" height="10" fill="#bce5e5"/>
      <rect x="8" y="45" width="6" height="9" fill="#879ca2"/>
      <rect x="50" y="45" width="6" height="9" fill="#879ca2"/>`,
    mirror: `
      <rect x="13" y="5" width="38" height="50" fill="#8b6548"/>
      <rect x="17" y="9" width="30" height="42" fill="#9bd2d9"/>
      <rect x="21" y="13" width="8" height="34" fill="#d8f0eb"/>
      <rect x="34" y="19" width="8" height="25" fill="#c0e6e7"/>`,
    clock: `
      <rect x="13" y="13" width="38" height="38" fill="#8e6849"/>
      <rect x="17" y="17" width="30" height="30" fill="#f1dfb6"/>
      <rect x="31" y="21" width="3" height="12" fill="#564539"/>
      <rect x="32" y="31" width="11" height="3" fill="#564539"/>
      <rect x="28" y="20" width="3" height="3" fill="#564539"/>
      <rect x="28" y="41" width="3" height="3" fill="#564539"/>`,
    painting: `
      <rect x="5" y="8" width="54" height="46" fill="#865e3f"/>
      <rect x="10" y="13" width="44" height="36" fill="#9dc7c5"/>
      <rect x="10" y="34" width="44" height="15" fill="#527e67"/>
      <rect x="13" y="28" width="13" height="7" fill="#e8c77d"/>
      <rect x="28" y="21" width="11" height="12" fill="#e6a2ae"/>
      <rect x="39" y="31" width="12" height="4" fill="#d3e4ca"/>`,
    computer: `
      <rect x="9" y="7" width="46" height="32" fill="#48545e"/>
      <rect x="13" y="11" width="38" height="24" fill="#83b8c1"/>
      <rect x="18" y="15" width="11" height="7" fill="#d6e9d5"/>
      <rect x="31" y="23" width="15" height="7" fill="#6a91a1"/>
      <rect x="28" y="39" width="8" height="8" fill="#687781"/>
      <rect x="19" y="47" width="27" height="4" fill="#687781"/>`,
    laptop: `
      <rect x="12" y="10" width="40" height="25" fill="#4b5860"/>
      <rect x="16" y="14" width="32" height="17" fill="#83c4c8"/>
      <rect x="7" y="36" width="50" height="9" fill="#9baeb1"/>
      <rect x="17" y="38" width="30" height="4" fill="#d5dedb"/>`,
    speaker: `
      <rect x="14" y="5" width="36" height="52" fill="#4b4147"/>
      <rect x="18" y="9" width="28" height="44" fill="#76616a"/>
      <rect x="22" y="14" width="20" height="17" fill="#332f3b"/>
      <rect x="25" y="17" width="14" height="11" fill="#8c8aa5"/>
      <rect x="22" y="35" width="20" height="14" fill="#332f3b"/>
      <rect x="27" y="39" width="10" height="7" fill="#9994ac"/>`,
    aquarium: `
      <rect x="6" y="9" width="52" height="38" fill="#557b88"/>
      <rect x="10" y="13" width="44" height="30" fill="#80c9d2"/>
      <rect x="10" y="34" width="44" height="9" fill="#d3bd84"/>
      <rect x="19" y="22" width="10" height="5" fill="#f1a55c"/>
      <rect x="27" y="20" width="4" height="9" fill="#f1a55c"/>
      <rect x="38" y="27" width="9" height="4" fill="#e8c85d"/>
      <rect x="41" y="24" width="4" height="9" fill="#e8c85d"/>
      <rect x="8" y="47" width="48" height="7" fill="#765035"/>`,
    dumbbell: `
      <rect x="8" y="24" width="48" height="10" fill="#777f8e"/>
      <rect x="5" y="16" width="10" height="26" fill="#424956"/>
      <rect x="49" y="16" width="10" height="26" fill="#424956"/>
      <rect x="8" y="20" width="5" height="18" fill="#9ba4b5"/>
      <rect x="51" y="20" width="5" height="18" fill="#9ba4b5"/>`,
    treadmill: `
      <rect x="7" y="35" width="50" height="10" fill="#414853"/>
      <rect x="12" y="39" width="40" height="4" fill="#8d9da7"/>
      <rect x="15" y="14" width="5" height="27" fill="#5c6673"/>
      <rect x="14" y="10" width="27" height="5" fill="#5c6673"/>
      <rect x="35" y="15" width="5" height="9" fill="#8399a8"/>
      <rect x="44" y="42" width="5" height="12" fill="#414853"/>`,
    yoga: `
      <rect x="7" y="18" width="50" height="30" fill="#7777b6"/>
      <rect x="11" y="22" width="42" height="22" fill="#a4a3dc"/>
      <rect x="16" y="26" width="32" height="14" fill="#c9c7ee"/>
      <rect x="7" y="18" width="7" height="30" fill="#54538c"/>`,
    ball: `
      <rect x="18" y="10" width="28" height="38" fill="#e17b71"/>
      <rect x="12" y="16" width="40" height="26" fill="#e17b71"/>
      <rect x="24" y="11" width="16" height="36" fill="#f4d36d"/>
      <rect x="13" y="23" width="38" height="12" fill="#f4d36d"/>
      <rect x="28" y="19" width="8" height="21" fill="#6e9ec5"/>`,
    bookshelfSmall: `
      <rect x="12" y="8" width="40" height="48" fill="#8c5c3a"/>
      <rect x="16" y="13" width="32" height="10" fill="#d3a06a"/>
      <rect x="16" y="27" width="32" height="10" fill="#d3a06a"/>
      <rect x="16" y="41" width="32" height="10" fill="#d3a06a"/>
      <rect x="20" y="14" width="6" height="8" fill="#8c83c7"/>
      <rect x="29" y="14" width="7" height="8" fill="#d77e98"/>
      <rect x="38" y="28" width="7" height="8" fill="#79a67b"/>`,
    trashbin: `
      <rect x="16" y="15" width="32" height="38" fill="#79a4a0"/>
      <rect x="12" y="11" width="40" height="6" fill="#526f71"/>
      <rect x="21" y="21" width="4" height="25" fill="#a7cfca"/>
      <rect x="30" y="21" width="4" height="25" fill="#a7cfca"/>
      <rect x="39" y="21" width="4" height="25" fill="#a7cfca"/>`,
    refrigeratorSmall: `
      <rect x="13" y="7" width="38" height="48" fill="#d8e7e4"/>
      <rect x="17" y="11" width="30" height="20" fill="#f1f4ec"/>
      <rect x="17" y="34" width="30" height="17" fill="#b5d0d0"/>
      <rect x="40" y="16" width="3" height="9" fill="#66838b"/>
      <rect x="40" y="38" width="3" height="8" fill="#66838b"/>`,
    guitarAmp: `
      <rect x="9" y="10" width="46" height="43" fill="#40363d"/>
      <rect x="13" y="14" width="38" height="35" fill="#6e5662"/>
      <rect x="19" y="20" width="26" height="22" fill="#332f3b"/>
      <rect x="23" y="24" width="18" height="14" fill="#a08b9d"/>
      <rect x="17" y="16" width="4" height="4" fill="#f0cf83"/>
      <rect x="25" y="16" width="4" height="4" fill="#f0cf83"/>`,
    plantSmall: `
      <rect x="22" y="39" width="20" height="14" fill="#b77c54"/>
      <rect x="19" y="36" width="26" height="5" fill="#d6a276"/>
      <rect x="30" y="18" width="5" height="20" fill="#4c8050"/>
      <rect x="15" y="17" width="17" height="13" fill="#78a86d"/>
      <rect x="34" y="12" width="15" height="15" fill="#4d8b55"/>
      <rect x="25" y="7" width="14" height="14" fill="#9cc978"/>`,
    candle: `
      <rect x="23" y="17" width="18" height="35" fill="#f0dfbd"/>
      <rect x="27" y="10" width="10" height="8" fill="#f4b65d"/>
      <rect x="30" y="5" width="4" height="8" fill="#fff1a3"/>
      <rect x="19" y="50" width="26" height="5" fill="#c79b6a"/>`,
    cushion: `
      <rect x="9" y="14" width="46" height="34" fill="#c77e9e"/>
      <rect x="14" y="19" width="36" height="24" fill="#e5a8c1"/>
      <rect x="20" y="25" width="24" height="12" fill="#f5d0df"/>
      <rect x="27" y="28" width="10" height="6" fill="#c77e9e"/>`,
    petbed: `
      <rect x="7" y="20" width="50" height="30" fill="#d0a078"/>
      <rect x="12" y="24" width="40" height="22" fill="#e8c5a1"/>
      <rect x="17" y="29" width="30" height="12" fill="#b8a4d9"/>
      <rect x="25" y="31" width="14" height="8" fill="#e8dff5"/>`,
    catTree: `
      <rect x="28" y="19" width="8" height="35" fill="#a87953"/>
      <rect x="10" y="45" width="44" height="10" fill="#d2a579"/>
      <rect x="18" y="29" width="28" height="8" fill="#c9996d"/>
      <rect x="15" y="9" width="34" height="8" fill="#d9b08a"/>
      <rect x="21" y="17" width="22" height="12" fill="#8b694d"/>
      <rect x="24" y="20" width="16" height="8" fill="#bda0d8"/>`,
    doll: `
      <rect x="20" y="28" width="24" height="25" fill="#d98cae"/>
      <rect x="18" y="8" width="28" height="25" fill="#f0c6a5"/>
      <rect x="17" y="6" width="30" height="10" fill="#8b5b49"/>
      <rect x="23" y="18" width="4" height="4" fill="#443047"/>
      <rect x="37" y="18" width="4" height="4" fill="#443047"/>
      <rect x="27" y="26" width="10" height="3" fill="#b86f8c"/>
      <rect x="15" y="33" width="8" height="13" fill="#f0c6a5"/>
      <rect x="41" y="33" width="8" height="13" fill="#f0c6a5"/>
      <rect x="22" y="49" width="8" height="7" fill="#76506f"/>
      <rect x="34" y="49" width="8" height="7" fill="#76506f"/>`,
    partition: `
      <rect x="3" y="22" width="58" height="16" fill="#9d7655"/>
      <rect x="3" y="22" width="58" height="4" fill="#d9b58a"/>
      <rect x="3" y="34" width="58" height="4" fill="#6e4d3c"/>
      <rect x="7" y="26" width="50" height="7" fill="#b88d65"/>`,
    doorplant: `
      <rect x="22" y="37" width="20" height="16" fill="#a86f49"/>
      <rect x="18" y="34" width="28" height="5" fill="#d4a174"/>
      <rect x="30" y="18" width="5" height="18" fill="#527e4c"/>
      <rect x="15" y="17" width="18" height="14" fill="#77a967"/>
      <rect x="35" y="12" width="17" height="15" fill="#4e854f"/>
      <rect x="25" y="6" width="14" height="14" fill="#9acb79"/>`
  };

  return `
    <svg class="pixel-sprite" viewBox="0 0 64 60"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true" shape-rendering="crispEdges">
      <rect x="7" y="54" width="50" height="4"
        fill="#49342c" opacity=".3"/>
      ${sprites[type] || ""}
    </svg>
  `;
}

/* ==========================================
   CHARACTERS
========================================== */

function houseCharacterArt(id) {
  const isLiza = id === "liza";
  return `
    <svg class="pixel-person" viewBox="0 0 32 42"
      aria-hidden="true" xmlns="http://www.w3.org/2000/svg"
      shape-rendering="crispEdges">
      <ellipse cx="16" cy="39" rx="10" ry="2.5"
        fill="#49342c" opacity=".4"/>
      <rect x="8" y="5" width="16" height="15"
        fill="${isLiza ? "#59413d" : "#60483d"}"/>
      <rect x="7" y="10" width="18" height="10"
        fill="${isLiza ? "#59413d" : "#60483d"}"/>
      <rect x="10" y="10" width="12" height="11" fill="#f1c5a5"/>
      <rect x="11" y="14" width="3" height="3" fill="#49342c"/>
      <rect x="19" y="14" width="3" height="3" fill="#49342c"/>
      <rect x="14" y="18" width="5" height="2" fill="#c77b83"/>
      <rect x="6" y="22" width="20" height="12"
        fill="${isLiza ? "#eaa5c0" : "#8f91c9"}"/>
      <rect x="3" y="23" width="5" height="10"
        fill="${isLiza ? "#eaa5c0" : "#8f91c9"}"/>
      <rect x="24" y="23" width="5" height="10"
        fill="${isLiza ? "#eaa5c0" : "#8f91c9"}"/>
      <rect x="8" y="33" width="6" height="7" fill="#5c453a"/>
      <rect x="18" y="33" width="6" height="7" fill="#5c453a"/>
      <rect x="7" y="39" width="8" height="2" fill="#43332f"/>
      <rect x="17" y="39" width="8" height="2" fill="#43332f"/>
    </svg>
  `;
}

function houseLumiArt() {
  const original = $("#lumi-sprite");
  const originalSVG = original?.querySelector("svg");

  if (!originalSVG) {
    return `<div class="lumi-house-fallback" aria-label="Lumi">🐈</div>`;
  }

  const clone = originalSVG.cloneNode(true);
  clone.removeAttribute("id");
  clone.querySelectorAll("[id]").forEach(node =>
    node.removeAttribute("id")
  );
  clone.setAttribute("aria-hidden", "true");
  clone.style.pointerEvents = "none";
  return clone.outerHTML;
}

/* ==========================================
   INVENTORY / FURNITURE BAG
========================================== */

function houseRenderBag() {
  const bag = $("#house-bag-items");
  if (!bag) return;

  bag.innerHTML = Object.entries(HOUSE_ITEMS).map(([type, info]) => {
    const count = Number(houseState.inventory?.[type] || 0);
    const selected = houseSelectedItem === type;

    return `
      <button type="button"
        class="house-bag-item ${selected ? "selected" : ""}"
        data-bag-type="${type}"
        ${count <= 0 ? "disabled" : ""}
        aria-label="${escapeHTML(info.name)}, tersisa ${count}">
        <span class="house-bag-sprite">
          ${houseFurnitureSVG(type)}
        </span>
        <span class="house-bag-name">${escapeHTML(info.name)}</span>
        <span class="house-bag-count">×${count}</span>
      </button>
    `;
  }).join("");

  bag.querySelectorAll("[data-bag-type]").forEach(button => {
    button.addEventListener("click", () => {
      const type = button.dataset.bagType;
      if (!houseState.inventory[type]) return;

      houseSelectedItem = type;

      const room = houseRoom();
      const placed = houseState.furniture.filter(item => item.room === room);
      const offset = (placed.length % 5) * 5;
      const topZ = Math.max(0, ...houseState.furniture.filter(item => item.room === room).map(item => Number(item.zIndex) || 0)) + 1;

      houseState.furniture.push({
        id: houseId(type),
        type,
        x: houseClamp(40 + offset, 10, 90),
        y: houseClamp(55 + offset, 25, 88),
        room,
        zIndex: 1
      });

      houseState.inventory[type]--;
      houseSelectedItem = null;

      houseRender();
      houseRenderBag();
      scheduleHouseSave();

      setStatus(
        "#house-status",
        `${HOUSE_ITEMS[type].name} diletakkan! Aktifkan Tata Furnitur untuk menggesernya.`
      );
    });
  });
}

$("#house-bag-toggle")?.addEventListener("click", () => {
  const bag = $("#house-bag");
  if (!bag) return;
  bag.hidden = !bag.hidden;
  if (!bag.hidden) houseRenderBag();
});

/* ==========================================
   RENDER HOUSE
========================================== */

function houseRender() {
  const room = houseRoom();
  const world = $("#house-world");
  if (!world) return;

  world.dataset.room = room;
  world.classList.toggle("is-editing", houseEditMode);

  const architecture = $(".house-architecture");
  if (architecture) architecture.dataset.room = room;

  const furniture = houseState.furniture
    .filter(item => item.room === room && HOUSE_ITEMS[item.type])
    .map(item => {
      const info = HOUSE_ITEMS[item.type];
      return `
        <button type="button"
          class="house-item furniture ${houseEditMode ? "editable" : ""}"
          data-house-kind="furniture"
          data-house-id="${escapeHTML(item.id)}"
          style="left:${item.x}%;top:${item.y}%;z-index:${item.zIndex || 1};--item-width:${info.width}%;--item-height:${info.height}%;--item-scale:${item.scale || 100}%;--item-rotation:${item.rotation || 0}deg;--item-mirror:${item.mirror ? -1 : 1}"
          aria-label="${escapeHTML(info.name)}">
          <span class="house-furniture-transform"
  style="display:block;transform:rotate(${item.rotation || 0}deg) scaleX(${item.mirror ? -1 : 1}) scale(${(item.scale || 100) / 100});">
  ${houseFurnitureSVG(item.type)}
</span>
<span class="house-item-label">${escapeHTML(info.name)}</span>
        </button>
      `;
    }).join("");

  const characters = ["aldi", "liza"]
    .filter(id => houseState.characters[id].room === room)
    .map(id => {
      const p = houseState.characters[id];
      const name = id === "aldi" ? "Aldi" : "Liza";
      const isCurrent =
        String(MY_NAME).toLowerCase() === id;

      return `
        <button type="button"
          class="house-item character ${isCurrent ? "is-player" : ""} ${houseEditMode ? "editable" : ""}"
          data-house-kind="character"
          data-house-id="${id}"
          style="left:${p.x}%;top:${p.y}%"
          aria-label="${name}">
          ${houseCharacterArt(id)}
          <span class="house-name">${name}</span>
        </button>
      `;
    }).join("");

  const p = houseState.lumi;
  const lumi = p.room === room ? `
    <div class="house-item lumi-house ${houseEditMode ? "editable" : ""}"
      data-house-kind="lumi"
      style="left:${p.x}%;top:${p.y}%"
      aria-label="Lumi">
      <div class="lumi-house-sprite">${houseLumiArt()}</div>
      <span class="house-name">Lumi</span>
    </div>
  ` : "";

  $("#house-furniture").innerHTML = furniture;
  $("#house-characters").innerHTML = characters;
  $("#house-lumi").innerHTML = lumi;

  const editButton = $("#house-edit");
  if (editButton) {
    editButton.textContent = houseEditMode
      ? "✓ Selesai menata"
      : "✦ Tata furnitur";
  }

  setStatus(
    "#house-status",
    houseEditMode
      ? "Mode dekorasi aktif — seret barang untuk mengatur posisinya."
      : `${room === "living" ? "Living Room" : "Bedroom"} · Ketuk lantai untuk berjalan.`
  );

  houseRenderBag();
houseUpdateFurnitureToolbar();
}


/* Furniture editing toolbar */
function houseEnsureFurnitureToolbar() {
  if ($("#house-furniture-toolbar")) return;
  const toolbar = document.createElement("div");
  toolbar.id = "house-furniture-toolbar";
  toolbar.className = "house-furniture-toolbar";
  toolbar.hidden = true;
  toolbar.innerHTML = `
    <div class="house-furniture-toolbar-title"><span id="house-selected-name">Furnitur</span><button type="button" data-house-action="store" aria-label="Simpan ke tas">Simpan ke tas ↩</button></div>
    <label>Ukuran <input id="house-item-scale" type="range" min="40" max="180" value="100" step="5"></label>
    <div class="house-furniture-actions">
      <button type="button" data-house-action="rotate-left">↶ Putar</button>
      <button type="button" data-house-action="rotate-right">Putar ↷</button>
      <button type="button" data-house-action="mirror">⇋ Balik</button>
      <button type="button" data-house-action="front">Ke depan</button>
      <button type="button" data-house-action="back">Ke belakang</button>
    </div>`;
  $("#house-bottom-panel")?.prepend(toolbar);
  if (!$("#house-bottom-panel")) $("#page-house")?.append(toolbar);
  toolbar.addEventListener("pointerdown", e => e.stopPropagation());
  toolbar.addEventListener("click", e => {
    const button = e.target.closest("[data-house-action]");
    if (!button || !houseSelectedItem || !houseEditMode) return;
    const item = houseState.furniture.find(x => x.id === houseSelectedItem);
    if (!item) return;
    const action = button.dataset.houseAction;
    if (action === "store") {
      houseState.inventory[item.type] = (Number(houseState.inventory[item.type]) || 0) + 1;
      houseState.furniture = houseState.furniture.filter(x => x.id !== item.id);
      houseSelectedItem = null;
      houseRender(); scheduleHouseSave(); return;
    }
    if (action === "rotate-left") item.rotation = ((Number(item.rotation) || 0) - 15 + 360) % 360;
    if (action === "rotate-right") item.rotation = ((Number(item.rotation) || 0) + 15) % 360;
    if (action === "mirror") item.mirror = !item.mirror;
    if (action === "front") item.zIndex = Math.max(0, ...houseState.furniture.filter(x => x.room === item.room).map(x => Number(x.zIndex)||0)) + 1;
    if (action === "back") item.zIndex = Math.min(0, ...houseState.furniture.filter(x => x.room === item.room).map(x => Number(x.zIndex)||0)) - 1;
    houseRender(); scheduleHouseSave();
  });
  toolbar.querySelector("#house-item-scale")?.addEventListener("input", e => {
    const item = houseState.furniture.find(x => x.id === houseSelectedItem);
    if (!item) return;
    item.scale = Number(e.target.value);
    const el = $(`#house-furniture [data-house-id="${CSS.escape(item.id)}"] .house-furniture-transform`);
    if (el) el.style.transform = `rotate(${item.rotation || 0}deg) scaleX(${item.mirror ? -1 : 1}) scale(${item.scale / 100})`;
  });
  toolbar.querySelector("#house-item-scale")?.addEventListener("change", scheduleHouseSave);
}
function houseUpdateFurnitureToolbar() {
  houseEnsureFurnitureToolbar();
  const toolbar = $("#house-furniture-toolbar");
  const item = houseState.furniture.find(x => x.id === houseSelectedItem && x.room === houseRoom());
  if (!toolbar) return;
  toolbar.hidden = !houseEditMode || !item;
  if (item) {
    $("#house-selected-name").textContent = HOUSE_ITEMS[item.type]?.name || item.type;
    $("#house-item-scale").value = item.scale || 100;
  }
}

/* ==========================================
   LOAD / SAVE SUPABASE
========================================== */

async function houseLoad() {
  if (!currentUser || !coupleId) return;
  if (houseLoadRequest) return houseLoadRequest;

  houseLoadRequest = (async () => {
    houseBusy = true;

    try {
      const { data, error } = await supabaseClient
        .from("couple_house")
        .select("house_state")
        .eq("couple_id", coupleId)
        .maybeSingle();

      if (error) throw error;

      let saved = data;

      if (!saved) {
        const result = await supabaseClient
          .from("couple_house")
          .insert({
            couple_id: coupleId,
            house_state: HOUSE_DEFAULT
          });

        if (result.error && result.error.code !== "23505") {
          throw result.error;
        }

        const retry = await supabaseClient
          .from("couple_house")
          .select("house_state")
          .eq("couple_id", coupleId)
          .single();

        if (retry.error) throw retry.error;
        saved = retry.data;
      }

      houseState = normalizeHouseState(saved.house_state);
      houseLastSaved = JSON.stringify(houseState);
      houseRender();
    } catch (error) {
      console.error("House load error:", error);
      setStatus("#house-status", "Rumah belum berhasil dimuat. Periksa koneksi.");
    } finally {
      houseBusy = false;
      houseLoadRequest = null;
    }
  })();

  return houseLoadRequest;
}

async function houseSave() {
  if (!currentUser || !coupleId || houseBusy) return;

  const serialized = JSON.stringify(houseState);
  if (serialized === houseLastSaved) return;

  try {
    const { error } = await supabaseClient
      .from("couple_house")
      .update({
        house_state: houseState,
        updated_at: new Date().toISOString()
      })
      .eq("couple_id", coupleId);

    if (error) throw error;

    houseLastSaved = serialized;
    setStatus("#house-status", "Rumah berhasil disimpan ♡");
  } catch (error) {
    console.error("House save error:", error);
    setStatus("#house-status", "Gagal menyimpan perubahan rumah.");
  }
}

function scheduleHouseSave() {
  clearTimeout(houseSaveTimer);
  houseSaveTimer = setTimeout(houseSave, 700);
}

function housePlayerId() {
  return String(MY_NAME).toLowerCase() === "liza" ? "liza" : "aldi";
}

/* ==========================================
   TAP TO WALK
========================================== */

function houseStopWalking() {
  houseWalkToken++;
  if (houseWalkFrame) cancelAnimationFrame(houseWalkFrame);
  houseWalkFrame = null;
}


function houseBlocked(x, y, room, movingId) {
  return houseState.furniture.some(item => {
    if (item.room !== room || item.id === movingId || !HOUSE_ITEMS[item.type]?.solid) return false;
    const halfW = (HOUSE_ITEMS[item.type].width || 20) / 2;
    const halfH = (HOUSE_ITEMS[item.type].height || 5) / 2 + 2;
    return Math.abs(x - item.x) < halfW && Math.abs(y - item.y) < halfH;
  });
}

function houseWalkTo(clientX, clientY) {
  if (!currentUser || houseEditMode || houseBusy) return;

  const world = $("#house-world");
  if (!world) return;

  const rect = world.getBoundingClientRect();
  const id = housePlayerId();
  const person = houseState.characters[id];

  if (person.room !== houseRoom()) {
    setStatus("#house-status", "Karakter kamu berada di ruangan lain.");
    return;
  }

  const x = houseClamp(((clientX - rect.left) / rect.width) * 100, 8, 92);
  const y = houseClamp(((clientY - rect.top) / rect.height) * 100, 25, 91);

  const target = $("#house-walk-target");
  if (target) {
    target.style.left = `${x}%`;
    target.style.top = `${y}%`;
    target.classList.remove("visible");
    void target.offsetWidth;
    target.classList.add("visible");
  }

  houseStopWalking();

  const token = houseWalkToken;
  const startX = person.x;
  const startY = person.y;
  if (houseBlocked(x, y, houseRoom(), null)) { setStatus("#house-status", "Ada tembok pemisah di sana."); return; }
  const distance = Math.hypot(x - startX, y - startY);
  const duration = Math.max(180, Math.min(900, distance * 18));
  const startTime = performance.now();

  const animate = now => {
    if (token !== houseWalkToken) return;

    const progress = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);

    const nextX = startX + (x - startX) * eased;
    const nextY = startY + (y - startY) * eased;
    if (!houseBlocked(nextX, nextY, houseRoom(), null)) { person.x = nextX; person.y = nextY; }

    const character = $(
      `#house-characters [data-house-id="${id}"]`
    );

    if (character) {
      character.style.left = `${person.x}%`;
      character.style.top = `${person.y}%`;
      character.classList.toggle("walking", progress < 1);
      character.classList.toggle("facing-left", x < startX);
    }

    if (progress < 1) {
      houseWalkFrame = requestAnimationFrame(animate);
    } else {
      houseWalkFrame = null;
      scheduleHouseSave();
    }
  };

  houseWalkFrame = requestAnimationFrame(animate);
}

/* ==========================================
   ROOM CHANGES
========================================== */

function houseChangeRoom(room) {
  if (!["living", "bedroom"].includes(room)) return;

  houseStopWalking();
  if ($("#house-room")) $("#house-room").value = room;

  const id = housePlayerId();
  const person = houseState.characters[id];

  person.room = room;
  person.x = room === "living" ? 68 : 31;
  person.y = 70;

  houseRender();
  scheduleHouseSave();
}

$("#house-room")?.addEventListener("change", () => {
  houseStopWalking();
  houseRender();
});

$("#house-edit")?.addEventListener("click", () => {
  houseStopWalking();
  houseEditMode = !houseEditMode;
  houseDrag = null;
  houseRender();
});

$$(".house-door[data-door]").forEach(door => {
  door.addEventListener("click", event => {
    event.stopPropagation();
    houseChangeRoom(door.dataset.door);
  });
});

/* ==========================================
   DRAG FURNITURE / CHARACTERS / LUMI
========================================== */

const houseWorld = $("#house-world");

houseWorld?.addEventListener("pointerdown", event => {
  if (!houseEditMode || houseDrag) return;

  if (event.target.closest(".house-furniture-toolbar")) return;
  const element = event.target.closest("[data-house-kind]");
  if (!element) return;

  const kind = element.dataset.houseKind;
  const id = element.dataset.houseId || null;

  if (kind === "furniture" &&
      !houseState.furniture.some(item => item.id === id)) return;
  if (kind === "character" &&
      !["aldi", "liza"].includes(id)) return;
  if (!["furniture", "character", "lumi"].includes(kind)) return;

  event.preventDefault();
  if (kind === "furniture") { houseSelectedItem = id; houseRender(); }
  houseStopWalking();

  houseDrag = {
    kind,
    id,
    pointerId: event.pointerId,
    element,
    moved: false
  };

  try {
    houseWorld.setPointerCapture(event.pointerId);
  } catch (_) {}
});

houseWorld?.addEventListener("pointermove", event => {
  if (!houseDrag || event.pointerId !== houseDrag.pointerId) return;

  const rect = houseWorld.getBoundingClientRect();
  const x = houseClamp(((event.clientX - rect.left) / rect.width) * 100, 5, 95);
  const y = houseClamp(((event.clientY - rect.top) / rect.height) * 100, 18, 95);

  let target;

  if (houseDrag.kind === "furniture") {
    target = houseState.furniture.find(item => item.id === houseDrag.id);
  } else if (houseDrag.kind === "character") {
    target = houseState.characters[houseDrag.id];
  } else {
    target = houseState.lumi;
  }

  if (!target) return;

  target.x = x;
  target.y = y;
  target.room = houseRoom();
  houseDrag.moved = true;

  if (houseDrag.element?.isConnected) {
    houseDrag.element.style.left = `${x}%`;
    houseDrag.element.style.top = `${y}%`;
  }
});

function finishHouseDrag(event) {
  if (!houseDrag) return;
  if (event && event.pointerId !== houseDrag.pointerId) return;

  const moved = houseDrag.moved;
  houseDrag = null;

  if (moved) {
    houseRender();
    scheduleHouseSave();
  }
}

houseWorld?.addEventListener("pointerup", finishHouseDrag);
houseWorld?.addEventListener("pointercancel", finishHouseDrag);
houseWorld?.addEventListener("lostpointercapture", finishHouseDrag);

// Ketuk lantai untuk berjalan; ketuk barang tidak memicu jalan.
houseWorld?.addEventListener("click", event => {
  if (houseEditMode || event.target.closest(
    "[data-house-kind], .house-door"
  )) return;

  houseWalkTo(event.clientX, event.clientY);
});

/* ==========================================
   PAGE / AUTO LOAD
========================================== */

const houseOriginalShowPage = showPage;

showPage = function(name) {
  houseOriginalShowPage(name);

  if (name === "house") {
    houseLoad();
  }
};

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && currentUser && coupleId &&
      $("#page-house")?.classList.contains("active")) {
    houseLoad();
  }
});

window.addEventListener("beforeunload", () => {
  clearTimeout(houseSaveTimer);
  if (houseSaveTimer && currentUser && coupleId) {
    houseSave();
  }
});
