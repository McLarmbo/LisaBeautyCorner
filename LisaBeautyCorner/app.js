/* Lisa's Beauty Corner - Pure JS SPA using localStorage */

const MAX_PER_DAY = 50;
const VIEWS = ["home", "login", "register", "dashboard"];

// ---- Storage helpers ----
const load = (k, fallback) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; }
};
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Keys
const K_USERS    = "lbc_users";
const K_SESSION  = "lbc_session";
const K_BOOKINGS = "lbc_bookings";

// Init
if (!load(K_USERS))    save(K_USERS, []);
if (!load(K_BOOKINGS)) save(K_BOOKINGS, []);
if (!load(K_SESSION))  save(K_SESSION, null);

// ---- Routing / UI ----
const flashEl = document.getElementById("flash");
function flash(msg, ms = 2500) {
  flashEl.textContent = msg;
  flashEl.style.display = "block";
  setTimeout(() => flashEl.style.display = "none", ms);
}

function showView(name) {
  VIEWS.forEach(v => {
    document.getElementById(`view-${v}`).classList.remove("active");
  });
  document.getElementById(`view-${name}`).classList.add("active");

  // Nav visibility based on session
  const session = load(K_SESSION, null);
  document.getElementById("nav-dashboard").classList.toggle("hidden", !session);
  document.getElementById("btn-logout").classList.toggle("hidden", !session);
  document.getElementById("nav-login").classList.toggle("hidden", !!session);
  document.getElementById("nav-register").classList.toggle("hidden", !!session);

  if (name === "dashboard") renderDashboard();
}

document.querySelectorAll("[data-route]").forEach(btn => {
  btn.addEventListener("click", e => showView(e.currentTarget.getAttribute("data-route")));
});

// ---- Auth ----
function register(name, email, password) {
  email = email.toLowerCase().trim();
  const users = load(K_USERS, []);
  if (users.some(u => u.email === email)) {
    throw new Error("Email already registered.");
  }
  users.push({ id: uid(), name: name.trim(), email, password }); // NOTE: plaintext for demo only
  save(K_USERS, users);
}

function login(email, password) {
  email = email.toLowerCase().trim();
  const users = load(K_USERS, []);
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) throw new Error("Invalid email or password.");
  save(K_SESSION, { userId: user.id, name: user.name, email: user.email });
}

function logout() {
  save(K_SESSION, null);
}

// ---- Booking logic ----
function countActiveByDate(dstr) {
  const bookings = load(K_BOOKINGS, []);
  return bookings.filter(b => b.appt_date === dstr && b.status === "active").length;
}

function userBookings(userId) {
  const bookings = load(K_BOOKINGS, []);
  return bookings.filter(b => b.user_id === userId).sort((a,b) => b.created_at.localeCompare(a.created_at));
}

function createBooking(userId, service, appt_date, note) {
  if (countActiveByDate(appt_date) >= MAX_PER_DAY) {
    throw new Error("Sorry, bookings are full for that day.");
  }
  const bookings = load(K_BOOKINGS, []);
  bookings.push({
    id: uid(),
    user_id: userId,
    service,
    appt_date,
    note: note || "",
    status: "active",
    created_at: new Date().toISOString()
  });
  save(K_BOOKINGS, bookings);
}

function updateBookingDate(bookingId, newDate) {
  const bookings = load(K_BOOKINGS, []);
  const idx = bookings.findIndex(b => b.id === bookingId);
  if (idx === -1) throw new Error("Booking not found.");
  const b = bookings[idx];
  if (b.appt_date !== newDate && countActiveByDate(newDate) >= MAX_PER_DAY) {
    throw new Error("That date is fully booked.");
  }
  b.appt_date = newDate;
  save(K_BOOKINGS, bookings);
}

function cancelBooking(bookingId) {
  const bookings = load(K_BOOKINGS, []);
  const idx = bookings.findIndex(b => b.id === bookingId);
  if (idx === -1) return;
  bookings[idx].status = "canceled";
  save(K_BOOKINGS, bookings);
}

// ---- Dashboard rendering ----
const myBookingsEl = document.getElementById("my-bookings");
const capacityInfoEl = document.getElementById("capacity-info");
const bookDateInput = document.getElementById("book-date");
const editDialog = document.getElementById("edit-dialog");
const editForm = document.getElementById("form-edit");

function todayISO() {
  const d = new Date();
  d.setHours(0,0,0,0);
  return d.toISOString().slice(0,10);
}

function setMinDates() {
  const min = todayISO();
  document.querySelectorAll('input[type="date"]').forEach(inp => inp.min = min);
}
setMinDates();

function renderCapacityTag(dateStr) {
  if (!dateStr) { capacityInfoEl.textContent = "Pick a date"; return; }
  const used = countActiveByDate(dateStr);
  capacityInfoEl.textContent = `${used} / ${MAX_PER_DAY} booked`;
  capacityInfoEl.classList.toggle("full", used >= MAX_PER_DAY);
}

bookDateInput.addEventListener("change", e => renderCapacityTag(e.target.value));

function renderDashboard() {
  const session = load(K_SESSION, null);
  if (!session) {
    flash("Please log in to access bookings.");
    showView("login");
    return;
  }
  renderCapacityTag(bookDateInput.value);
  const items = userBookings(session.userId);
  myBookingsEl.innerHTML = "";

  if (items.length === 0) {
    myBookingsEl.innerHTML = `<p class="muted">No appointments yet.</p>`;
    return;
  }

  items.forEach(b => {
    const wrap = document.createElement("div");
    wrap.className = "booking";
    wrap.innerHTML = `
      <div class="meta">
        <span class="badge">${b.service}</span>
        <strong>${b.appt_date}</strong>
        <span class="badge">${b.status}</span>
        ${b.note ? `<span class="muted">“${b.note}”</span>` : ""}
      </div>
      <div class="actions">
        <button data-action="edit" data-id="${b.id}" ${b.status!=="active"?"disabled":""}>Edit date</button>
        <button data-action="cancel" data-id="${b.id}" ${b.status!=="active"?"disabled":""}>Cancel</button>
      </div>
    `;
    myBookingsEl.appendChild(wrap);
  });
}

// ---- Event handlers ----
// Register
document.getElementById("form-register").addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const name = fd.get("name").trim();
  const email = fd.get("email").trim();
  const password = fd.get("password");
  try {
    if (!name || !email || !password) throw new Error("All fields are required.");
    register(name, email, password);
    flash("Registration successful. Please log in.");
    showView("login");
  } catch (err) {
    flash(err.message);
  }
});

// Login
document.getElementById("form-login").addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const email = fd.get("email");
  const password = fd.get("password");
  try {
    login(email, password);
    flash("Welcome!");
    showView("dashboard");
  } catch (err) {
    flash(err.message);
  }
});

// Logout
document.getElementById("btn-logout").addEventListener("click", () => {
  logout();
  flash("Logged out.");
  showView("home");
});

// Book
document.getElementById("form-book").addEventListener("submit", (e) => {
  e.preventDefault();
  const session = load(K_SESSION, null);
  if (!session) { flash("Please log in first."); showView("login"); return; }

  const fd = new FormData(e.target);
  const service = fd.get("service");
  const dateStr = fd.get("date");
  const note = fd.get("note") || "";

  if (!service || !dateStr) { flash("Please choose a service and a date."); return; }

  const d = new Date(dateStr + "T00:00:00");
  const today = new Date(todayISO()+"T00:00:00");
  if (d < today) { flash("You cannot book for past dates."); return; }

  try {
    createBooking(session.userId, service, dateStr, note);
    e.target.reset();
    renderCapacityTag(bookDateInput.value);
    flash("Appointment booked!");
    renderDashboard();
  } catch (err) {
    flash(err.message);
  }
});

// Edit / Cancel in list
myBookingsEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const id = btn.getAttribute("data-id");
  const action = btn.getAttribute("data-action");
  if (action === "cancel") {
    cancelBooking(id);
    flash("Appointment canceled.");
    renderCapacityTag(bookDateInput.value);
    renderDashboard();
  } else if (action === "edit") {
    // open dialog
    editForm.reset();
    editForm.elements.id.value = id;
    const min = todayISO();
    editForm.elements.date.min = min;
    editDialog.showModal();
  }
});

// Save edit
document.getElementById("save-edit").addEventListener("click", (e) => {
  e.preventDefault();
  const id = editForm.elements.id.value;
  const dateStr = editForm.elements.date.value;
  if (!dateStr) { flash("Pick a date."); return; }

  const d = new Date(dateStr + "T00:00:00");
  const today = new Date(todayISO()+"T00:00:00");
  if (d < today) { flash("You cannot move to a past date."); return; }

  try {
    updateBookingDate(id, dateStr);
    flash("Appointment updated.");
    editDialog.close();
    renderCapacityTag(bookDateInput.value);
    renderDashboard();
  } catch (err) {
    flash(err.message);
  }
});

// On load: send user to right place
window.addEventListener("load", () => {
  const session = load(K_SESSION, null);
  showView(session ? "dashboard" : "home");
});