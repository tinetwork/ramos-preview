const form = document.getElementById("bookingForm");
const detailsToggle = document.getElementById("detailsToggle");
const expandedFields = document.getElementById("expandedFields");
const estimateValue = document.getElementById("estimateValue");
const statusText = document.getElementById("statusText");
const confirmationDialog = document.getElementById("confirmationDialog");
const confirmationMessage = document.getElementById("confirmationMessage");
const closeDialog = document.getElementById("closeDialog");
const submitLabel = document.getElementById("submitLabel");
const payer = document.getElementById("payer");
const isStaticPreview =
  location.protocol === "file:" ||
  location.hostname.endsWith("github.io") ||
  location.hostname.endsWith("pages.dev") ||
  location.hostname.endsWith("netlify.app") ||
  location.hostname.endsWith("vercel.app");

const servicePrices = {
  "Ride only: standard curb-to-curb": 95,
  "Ride only: door-to-door assistance": 125,
  "Ride only: mobility assistance": 135,
  "Medical appointment ride": 120,
  "Legal or deposition ride": 145,
  "Ride + appointment support": 175,
  "Recurring therapy schedule": 85
};

function nextBusinessDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  if (date.getDay() === 0) date.setDate(date.getDate() + 1);
  if (date.getDay() === 6) date.setDate(date.getDate() + 2);
  return date.toISOString().slice(0, 10);
}

function seedDefaults() {
  form.elements.date.value = nextBusinessDate();
  form.elements.time.value = "09:00";
}

function estimateRide() {
  const service = form.elements.service.value;
  const passenger = form.elements.passenger.value;
  const base = servicePrices[service] || 95;
  const mobility = /wheelchair|mobility/i.test(`${service} ${passenger}`) ? 25 : 0;
  const language = /spanish|language/i.test(`${service} ${passenger}`) ? 20 : 0;
  const distance = inferDistance();
  const distanceCharge = Math.max(0, distance - 8) * 3.25;
  const amount = Math.round(base + mobility + language + distanceCharge);
  estimateValue.textContent = `$${amount}`;
  return { amount, distance };
}

function inferDistance() {
  const pickup = form.elements.pickup.value.trim();
  const dropoff = form.elements.dropoff.value.trim();
  if (!pickup || !dropoff) return 8;
  const combined = `${pickup} ${dropoff}`.toLowerCase();
  if (combined.includes("hospital") || combined.includes("surgery")) return 14;
  if (combined.includes("therapy") || combined.includes("clinic")) return 10;
  return Math.min(32, Math.max(8, Math.round((pickup.length + dropoff.length) / 7)));
}

function payloadFromForm() {
  const formData = new FormData(form);
  const estimate = estimateRide();
  return {
    ...Object.fromEntries(formData.entries()),
    estimate: String(estimate.amount),
    distance: String(estimate.distance)
  };
}

function updateSubmitCopy() {
  const isPrivatePay = payer.value === "Private pay now";
  submitLabel.textContent = isPrivatePay ? "Continue to checkout" : "Request confirmation";
  statusText.textContent = isPrivatePay
    ? "Secure checkout supports Apple Pay, Google Pay, Link, and cards through Stripe when configured."
    : "Case, employer, attorney, and clinic requests are captured for billing review and dispatch confirmation.";
}

async function submitBooking(event) {
  event.preventDefault();
  statusText.textContent = "Saving service details...";
  form.querySelector(".button-checkout").disabled = true;

  try {
    const payload = payloadFromForm();
    if (isStaticPreview) {
      showStaticPreviewConfirmation(payload);
      return;
    }

    const endpoint =
      payload.payer === "Private pay now"
        ? "api/create-checkout-session.php"
        : "api/bookings.php";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || result.error || "Unable to save this request.");

    if (result.mode === "stripe" && result.url) {
      statusText.textContent = "Opening Stripe Checkout...";
      window.location.href = result.url;
      return;
    }

    const bookingId = result.bookingId || "pending";
    confirmationMessage.textContent =
      result.mode === "demo"
        ? `Booking ${bookingId} was saved. Add STRIPE_SECRET_KEY on the server to send private-pay requests to Stripe Checkout with Apple Pay-ready dynamic payment methods.`
        : `Booking ${bookingId} was saved for dispatch and billing confirmation.`;
    confirmationDialog.showModal();
    statusText.textContent = `Booking ${bookingId} captured.`;
    form.reset();
    seedDefaults();
    estimateRide();
  } catch (error) {
    statusText.textContent = error.message || "Something went wrong. Please try again.";
  } finally {
    form.querySelector(".button-checkout").disabled = false;
    updateSubmitCopy();
  }
}

function showStaticPreviewConfirmation(payload) {
  const bookingId = `RIT-DEMO-${Date.now().toString(36).toUpperCase()}`;
  const saved = {
    bookingId,
    createdAt: new Date().toISOString(),
    ...payload
  };
  localStorage.setItem("ramos-preview-booking", JSON.stringify(saved));
  confirmationMessage.textContent = `Demo booking ${bookingId} was captured in this browser. On the live Hostinger version, this same form saves the request and can send private-pay requests to Stripe Checkout.`;
  confirmationDialog.showModal();
  statusText.textContent = `Demo booking ${bookingId} captured.`;
  form.reset();
  seedDefaults();
  estimateRide();
}

detailsToggle.addEventListener("click", () => {
  expandedFields.hidden = !expandedFields.hidden;
  detailsToggle.textContent = expandedFields.hidden ? "Add case details" : "Hide case details";
});

function scrollToBooking() {
  const bookingSection = document.getElementById("book");
  const header = document.querySelector(".site-header");
  const headerOffset = (header?.getBoundingClientRect().height || 0) + 18;
  const targetTop = bookingSection.getBoundingClientRect().top + window.scrollY - headerOffset;
  window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
  history.replaceState(null, "", "#book");
}

closeDialog.addEventListener("click", () => confirmationDialog.close());
document.querySelectorAll("a[href='#book']").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    scrollToBooking();
  });
});
form.addEventListener("input", estimateRide);
form.addEventListener("change", () => {
  estimateRide();
  updateSubmitCopy();
});
form.addEventListener("submit", submitBooking);

seedDefaults();
estimateRide();
updateSubmitCopy();