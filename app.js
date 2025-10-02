// ========================
// DEV TOOLS
// ========================
console.log("✅ app.js loaded");


// ========================
// GLOBAL ELEMENTS
// ========================
const player1      = document.querySelector(".player1");
const player2      = document.querySelector(".player2");
const player1Text  = document.querySelector(".player1 h2");
const player2Text  = document.querySelector(".player2 h2");
const navBtn       = document.querySelectorAll(".nav-toggle");
const closeBtn     = document.querySelector(".close-btn");
const popupNav     = document.querySelector(".popup-nav");
const navLinks     = document.querySelectorAll(".popup-nav a");
const descBtn      = document.querySelectorAll(".desc-btn");
const descClose    = document.querySelectorAll(".desc-close");
const submissionForm = document.querySelector(".submission-form");
const submitStatus   = document.getElementById("submit-status");
const nextOverlay    = document.getElementById("next-overlay");
const nextBtn        = document.getElementById("next-btn");


// ========================
// STATE
// ========================
let currentThings = [];   // active duel pair
let lastWinnerIndex = null; // index of winner in currentThings


// ========================
// API HELPERS
// ========================
async function apiGet(url) {
  try {
    const res = await fetch(url);
    return await res.json();
  } catch (err) {
    console.error("GET failed:", url, err);
    return null;
  }
}

async function apiPost(url, body, isFormData = false) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: isFormData ? {} : { "Content-Type": "application/json" },
      body: isFormData ? body : JSON.stringify(body),
    });
    return await res.json();
  } catch (err) {
    console.error("POST failed:", url, err);
    return null;
  }
}


// ========================
// DATA LOADING
// ========================
async function loadRandomThings() {
  const things = await apiGet("http://localhost:3000/random-things");
  if (things && things.length) {
    currentThings = things;
    renderThings();
  }
}

async function loadNewOpponent(winnerIndex) {
  const winner = currentThings[winnerIndex];
  const loser  = currentThings[winnerIndex === 0 ? 1 : 0];

  const newOpponent = await apiGet(
    `http://localhost:3000/random-opponent/${winner.id}/${loser.id}`
  );
  console.log("New opponent from server:", newOpponent);

  if (!newOpponent) {
    console.warn("⚠️ No new opponent available, reloading random things.");
    return loadRandomThings(); // fallback
  }

  currentThings = winnerIndex === 0
    ? [winner, newOpponent]
    : [newOpponent, winner];

  renderThings();
}


// ========================
// RENDERING
// ========================
function renderThings() {
  renderPlayer(0, ".player1", player1Text, ".player1 .desc-text h3", ".player1-img");
  renderPlayer(1, ".player2", player2Text, ".player2 .desc-text h3", ".player2-img");
}

function renderPlayer(index, playerSelector, titleEl, descSelector, boxSelector) {
  const thing = currentThings[index];
  if (!thing) return;

  // Update title
  if (titleEl) titleEl.textContent = thing.title;

  // Update description
  const descEl = document.querySelector(descSelector);
  if (descEl) descEl.textContent = thing.description || "No description provided.";

  // Update image
  const box = document.querySelector(boxSelector);
  if (thing.imageUrl && box) {
    box.style.backgroundImage = `url(http://localhost:3000${thing.imageUrl})`;
    box.style.backgroundSize = "cover";
    box.style.backgroundPosition = "center";
  }
}


// ========================
// STATS
// ========================
async function updateStatsForBoth() {
  for (let i = 0; i < currentThings.length; i++) {
    const thing = currentThings[i];
    const selector = i === 0 ? ".player1" : ".player2";

    const stats = await apiGet(`http://localhost:3000/stats/${thing.id}`);
    if (!stats) continue;

    const playerBox = document.querySelector(selector);
    const titleEl = playerBox.querySelector("h2");

    let statEl = playerBox.querySelector(".stats");
    if (!statEl) {
      statEl = document.createElement("div");
      statEl.className = "stats";
      titleEl.insertAdjacentElement("afterend", statEl);
    }

    statEl.innerHTML = `
      <div class="stats-bar">
        <div class="stats-fill" style="width:${stats.percent}%"></div>
      </div>
      <div class="stats-text">${stats.percent}% (${stats.wins}/${stats.total})</div>
    `;
  }
}


// ========================
// VOTING
// ========================
function setupVoting() {
  if (player1) {
    player1.addEventListener("click", async () => {
      await apiPost("http://localhost:3000/vote", {
        winnerId: currentThings[0].id,
        loserId: currentThings[1].id,
      });
      updateStatsForBoth();
      lastWinnerIndex = 0;
      nextOverlay.classList.add("show");
    });
  }

  if (player2) {
    player2.addEventListener("click", async () => {
      await apiPost("http://localhost:3000/vote", {
        winnerId: currentThings[1].id,
        loserId: currentThings[0].id,
      });
      updateStatsForBoth();
      lastWinnerIndex = 1;
      nextOverlay.classList.add("show");
    });
  }

if (nextBtn) {
  nextBtn.addEventListener("click", async () => {
    nextOverlay.classList.remove("show");
    document.querySelectorAll(".stats").forEach(el => el.remove());

    if (lastWinnerIndex !== null) {
      await loadNewOpponent(lastWinnerIndex);  // ✅ winner stays
    } else {
      await loadRandomThings();  // fallback if no winner
    }
  });
}
}
// ========================
// NAVIGATION
// ========================
function setupNavigation() {
  navBtn.forEach(btn => btn.addEventListener("click", () => popupNav.classList.add("open")));
  if (closeBtn) {
    closeBtn.addEventListener("click", () => popupNav.classList.remove("open"));
    closeBtn.addEventListener("mouseenter", () => closeBtn.style.color = 'rgba(114, 114, 114, 1)');
    closeBtn.addEventListener("mouseleave", () => closeBtn.style.color = '');
  }
  navLinks.forEach(link => {
    link.addEventListener("mouseenter", () => link.style.color = 'rgba(114, 114, 114, 1)');
    link.addEventListener("mouseleave", () => link.style.color = '');
  });
}


// ========================
// DESCRIPTION MODALS
// ========================
function setupDescriptions() {
  descBtn.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      btn.nextElementSibling.classList.add("show");
    });
  });

  descClose.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.target.parentElement.classList.remove("show");
    });
  });

  document.querySelectorAll(".desc-text").forEach(box => {
    box.addEventListener("click", (e) => e.stopPropagation());
  });
}


// ========================
// FORM SUBMISSION
// ========================
function setupForm() {
  if (!submissionForm) return;

  submissionForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("🚀 Submit handler started");

    const formData = new FormData(submissionForm);
    console.log("FormData created:", [...formData.entries()]);

    const res = await apiPost("http://localhost:3000/submit", formData, true);
    if (!res) {
      submitStatus.textContent = "❌ Network error. Is the server running?";
      submitStatus.style.color = "red";
      return;
    }

    if (res.error) {
      submitStatus.textContent = `❌ ${res.error}`;
      submitStatus.style.color = "red";
    } else {
      submitStatus.textContent = "✅ Submitted! Thank you.";
      submitStatus.style.color = "lightgreen";
      submissionForm.reset();
    }
  });
}


// ========================
// INITIALIZE
// ========================
function init() {
  if (player1Text || player2Text) loadRandomThings();
  setupVoting();
  setupNavigation();
  setupDescriptions();
  setupForm();
}

init();