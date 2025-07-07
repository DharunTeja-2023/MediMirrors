let recognition;
let isListening = false;

// 🔄 Toggle Modes
function switchMode(mode) {
  document.getElementById("listeningMode").classList.toggle("hidden", mode !== 'listening');
  document.getElementById("cameraMode").classList.toggle("hidden", mode !== 'camera');

  document.getElementById("listeningToggle").classList.toggle("active", mode === 'listening');
  document.getElementById("cameraToggle").classList.toggle("active", mode === 'camera');

  if (mode === 'camera') startAutoCamera();
}

// 🎙 Voice Input
async function toggleListening() {
  const micButton = document.querySelector(".mic-button");
  const output = document.getElementById("voice-output");

  if (!("webkitSpeechRecognition" in window)) {
    output.innerText = "❌ Speech recognition not supported.";
    return;
  }

  if (!recognition) {
    recognition = new webkitSpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = async (event) => {
      const speechResult = event.results[0][0].transcript;
      output.innerText = `🗣 "${speechResult}"`;
      const langCode = await detectLanguageLibre(speechResult);
      processMultiplePrescriptions(speechResult);
      speakTableContent(langCode);
      setReminders();
      stopListeningUI();
    };

    recognition.onerror = (event) => {
      output.innerText = `❌ Error: ${event.error}`;
      stopListeningUI();
    };

    recognition.onend = () => {
      if (isListening) stopListeningUI();
    };
  }

  if (!isListening) {
    recognition.start();
    isListening = true;
    micButton.innerText = "🛑 Stop Listening";
    micButton.classList.add("listening");
    output.innerText = "🎙 Listening...";
  } else {
    recognition.stop();
    stopListeningUI();
  }
}

function stopListeningUI() {
  const micButton = document.querySelector(".mic-button");
  micButton.innerText = "🎙 Start Listening";
  micButton.classList.remove("listening");
  isListening = false;
}

// 🌍 Detect Language (STT -> Detect spoken language)
async function detectLanguageLibre(text) {
  try {
    const res = await fetch("https://libretranslate.de/detect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text })
    });
    const data = await res.json();
    const lang = data[0].language;

    const langMap = {
      en: "en-US", hi: "hi-IN", ta: "ta-IN", te: "te-IN",
      bn: "bn-IN", kn: "kn-IN", mr: "mr-IN", ml: "ml-IN",
      gu: "gu-IN", ur: "ur-IN"
    };

    return langMap[lang] || "en-IN";
  } catch {
    return "en-IN";
  }
}

// 🗣️ Speak extracted prescription table rows
function speakTableContent(langCode) {
  const rows = document.querySelectorAll("#prescription-table-body tr");
  if (rows.length === 0) {
    speakText("No prescription data available to read.", langCode);
    return;
  }

  const prescriptionData = Array.from(rows).map(row =>
    Array.from(row.children).map(td => td.innerText.trim()).join(", ")
  ).join(". ");

  speakText(prescriptionData, langCode);
}

function speakText(text, lang = "en-IN") {
  if (!text) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 1.2;
  utterance.pitch = 1;
  utterance.volume = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function repeatSpeech() {
  const rows = document.querySelectorAll("#prescription-table-body tr");
  if (rows.length === 0) {
    speakText("No prescription data available to repeat.", "en-IN");
    return;
  }

  const text = Array.from(rows).map(row =>
    Array.from(row.children).map(td => td.innerText.trim()).join(", ")
  ).join(". ");

  speakText(text, "en-IN");
}

function resetTable() {
  const tbody = document.getElementById('prescription-table-body');
  tbody.innerHTML = '';
  if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
  const output = document.getElementById("voice-output");
  if (output) output.innerText = "Table cleared. Ready for a new prescription.";
}

// 🧠 Smart Prescription Parsing
function extractPrescriptionDetails(text) {
  const tabletRegex = /(?:Take|Tablet|Capsule)?\s?([A-Za-z0-9]+(?:\s[A-Za-z0-9]+)?)/i;
  const doseRegex = /(\d+\s?(mg|ml|mcg|g|units)?)/i;
  const frequencyRegex = /(once|twice|three times|four times|daily|weekly|every \d+ (hours|days)|at bedtime|after meals|before meals|before breakfast|before dinner|after breakfast|after lunch|after dinner|morning and night|as needed|prn)/i;
  const timeRegex = /(before|after)\s(meal|food|breakfast|lunch|dinner)/i;
  const durationRegex = /for\s(\d+\s?(day|days|week|weeks|month|months))/i;

  const frequencyMap = {
    "once": "Once a day", "twice": "Twice a day", "three times": "Three times a day",
    "four times": "Four times a day", "daily": "Once daily", "weekly": "Once a week",
    "at bedtime": "At bedtime", "after meals": "After each meal", "before meals": "Before each meal",
    "before breakfast": "Before breakfast", "before dinner": "Before dinner",
    "after breakfast": "After breakfast", "after lunch": "After lunch",
    "after dinner": "After dinner", "morning and night": "Twice a day",
    "as needed": "As needed (PRN)", "prn": "As needed (PRN)"
  };

  const freqRaw = text.match(frequencyRegex)?.[0]?.toLowerCase() || "N/A";
  const frequency = frequencyMap[freqRaw] || freqRaw;

  return {
    name: text.match(tabletRegex)?.[1] || "N/A",
    dose: text.match(doseRegex)?.[1] || "N/A",
    frequency: frequency || "N/A",
    time: text.match(timeRegex)?.[0] || "N/A",
    duration: text.match(durationRegex)?.[1] || "N/A"
  };
}

function processMultiplePrescriptions(rawText) {
  const lines = rawText
    .split(/[.\n]/)
    .map(line => line.trim())
    .filter(line =>
      /(tablet|tab|capsule|mg|ml|take|dose|morning|night|before|after|days)/i.test(line)
    );

  const tbody = document.getElementById('prescription-table-body');
  tbody.innerHTML = '';

  const prescriptions = [];

  lines.forEach(line => {
    const data = extractPrescriptionDetails(line);
    if (!data.name || data.name === "N/A") {
      Object.assign(data, smartSplitPrescription(line));
    }

    prescriptions.push(data);

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${data.name}</td>
      <td>${data.dose}</td>
      <td>${data.frequency}</td>
      <td>${data.time}</td>
      <td>${data.duration}</td>
    `;
    tbody.appendChild(row);
  });

  localStorage.setItem("prescriptions", JSON.stringify(prescriptions));
}

function smartSplitPrescription(sentence) {
  const result = { tablet: '', dose: '', frequency: '', time: '', duration: '' };
  const words = sentence.split(' ');

  result.tablet = words[0] || '';
  const doseIndex = words.findIndex(w => w.includes('mg') || w.includes('mcg'));
  if (doseIndex !== -1) result.dose = words.slice(doseIndex - 1, doseIndex + 1).join(' ');

  const freqWords = ['once', 'twice', 'thrice', 'daily', 'every', 'day', 'night'];
  const freqIndex = words.findIndex(w => freqWords.includes(w.toLowerCase()));
  if (freqIndex !== -1) result.frequency = words.slice(freqIndex, freqIndex + 3).join(' ');

  const timeWords = ['before', 'after', 'lunch', 'dinner', 'breakfast'];
  const timeIndex = words.findIndex(w => timeWords.includes(w.toLowerCase()));
  if (timeIndex !== -1) result.time = words.slice(timeIndex, timeIndex + 2).join(' ');

  const durationWords = ['days', 'weeks', 'months'];
  const durIndex = words.findIndex(w => durationWords.includes(w.toLowerCase()));
  if (durIndex !== -1) result.duration = words.slice(durIndex - 1, durIndex + 1).join(' ');

  return result;
}

// ⏰ Smart Reminders
function setReminders() {
  const rows = document.querySelectorAll("#prescription-table-body tr");
  rows.forEach((row, i) => {
    const name = row.children[0]?.innerText;
    const frequency = row.children[2]?.innerText.toLowerCase();
    let intervalMs = 0;

    if (frequency.includes("once")) intervalMs = 86400000;
    else if (frequency.includes("twice")) intervalMs = 43200000;
    else if (frequency.includes("three")) intervalMs = 28800000;
    else if (frequency.includes("four")) intervalMs = 21600000;
    else intervalMs = 43200000;

    setTimeout(() => {
      new Notification("💊 Reminder", { body: `Time to take ${name}` });
    }, 5000 + i * 3000);
  });
}

// 📷 CAMERA + OCR
let cameraStream = null;
let scanTriggered = false;
let cameraPermissionDenied = false;

function startAutoCamera() {
  const video = document.getElementById("video-preview");
  const canvas = document.getElementById("snapshot-canvas");

  if (cameraPermissionDenied || cameraStream) return;
  scanTriggered = false;

  navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
    .then((stream) => {
      cameraStream = stream;
      video.srcObject = stream;
      video.classList.remove("hidden");
      canvas.classList.add("hidden");
      video.play();

      document.getElementById("retry-camera")?.classList.add("hidden");
      setTimeout(() => autoCapture(video, canvas), 3000);
    })
    .catch(err => {
      cameraPermissionDenied = true;
      document.getElementById("ocr-output").innerText = "⚠ Camera access denied.";
      document.getElementById("retry-camera")?.classList.remove("hidden");
    });
}

function autoCapture(video, canvas) {
  if (scanTriggered) return;
  scanTriggered = true;

  const ctx = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.classList.remove("hidden");
  video.classList.add("hidden");

  runOCR(canvas);
  stopCamera();
}

function stopCamera() {
  const video = document.getElementById("video-preview");
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  video.pause();
  video.srcObject = null;
  video.classList.add("hidden");
}

function runOCR(canvas) {
  const outputDiv = document.getElementById("ocr-output");
  outputDiv.innerText = "🔍 Analyzing image...";

  Tesseract.recognize(canvas, 'eng', {
    logger: m => console.log(m)
  }).then(({ data: { text } }) => {
    const rawText = text.trim();
    const lines = rawText.split('\n').map(line => line.trim()).filter(Boolean);

    const filteredLines = lines.filter(line =>
      /(tablet|tab|capsule|cap|mg|ml|take|dose|morning|night|before|after|days)/i.test(line)
    );

    if (filteredLines.length === 0) {
      outputDiv.innerText = "⚠️ No medication lines detected.";
      return;
    }

    const combinedText = filteredLines.join(". ");
    outputDiv.innerText = `🧾 Extracted:\n${combinedText}`;
    processMultiplePrescriptions(combinedText);
  }).catch(err => {
    outputDiv.innerText = "❌ OCR failed: " + err.message;
  });
}

function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const img = new Image();
  const canvas = document.getElementById("snapshot-canvas");
  const ctx = canvas.getContext("2d");

  const reader = new FileReader();
  reader.onload = function (e) {
    img.onload = function () {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      canvas.classList.remove("hidden");
      document.getElementById("video-preview").classList.add("hidden");
      runOCR(canvas);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function loadPrescriptionsFromStorage() {
  const stored = localStorage.getItem("prescriptions");
  if (!stored) return;
  const data = JSON.parse(stored);
  const tableBody = document.getElementById("prescription-table-body");
  tableBody.innerHTML = "";
  data.forEach(details => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${details.name}</td>
      <td>${details.dose}</td>
      <td>${details.frequency}</td>
      <td>${details.time}</td>
      <td>${details.duration}</td>
    `;
    tableBody.appendChild(row);
  });
}

// 👁 Start camera when in view
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting && !cameraStream) {
      startAutoCamera();
    }
  });
}, { threshold: 0.6 });

const cameraSection = document.getElementById("cameraMode");
observer.observe(cameraSection);

window.addEventListener("DOMContentLoaded", loadPrescriptionsFromStorage);

// 🔐 Access control (doctor-only on scan page)
// firebase.auth().onAuthStateChanged(user => {
//   if (user) {
//     const uid = user.uid;
//     firebase.firestore().collection("users").doc(uid).get().then(doc => {
//       if (doc.exists) {
//         const data = doc.data();
//         if (data.role !== 'doctor') {
//           alert("⛔ Only Doctors can access this page!");
//           window.location.href = "login.html";
//         }
//       }
//     });
//   } else {
//     window.location.href = "login.html";
//   }
// });

window.speechSynthesis.onvoiceschanged = () => {
  window.speechSynthesis.getVoices(); // Preload voices
};
