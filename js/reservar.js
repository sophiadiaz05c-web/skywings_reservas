// ── State ─────────────────────────────────────────────────────────────
const state = {
  flightId:   new URLSearchParams(window.location.search).get('flightId'),
  flight:     null,
  passengers: [],          // { name, idNumber, age, hasDisability, isMinor, isRepresentative, representativeOf, seat }
  step:       1,
  seatIdx:    0            // which passenger is currently being seated in step 2
};

// Called from seatmap.js onclick
function handleSeatClick(seatId) {
  const p = state.passengers[state.seatIdx];
  p.seat = (p.seat === seatId) ? null : seatId;  // toggle
  renderSeatMap();
  renderSeatProgressList();
  renderStep2Nav();
}

// ── Init ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.requireAuth()) return;
  Auth.initNavbar();

  if (!state.flightId) { window.location.href = 'index.html'; return; }

  state.flight = SW.getFlightById(state.flightId);
  if (!state.flight) { window.location.href = 'index.html'; return; }

  if (state.flight.status !== 'programado') {
    alert('Este vuelo ya no acepta reservas (estado: ' + state.flight.status + ').');
    window.location.href = 'index.html';
    return;
  }

  renderFlightBanner();
});

function renderFlightBanner() {
  const f = state.flight;
  const el = document.getElementById('flightBanner');
  el.style.display = '';
  el.innerHTML = `
    <strong>✈ ${f.originCode} → ${f.destCode}</strong>
    &nbsp;|&nbsp; ${f.origin} → ${f.destination}
    &nbsp;|&nbsp; ${formatDateShort(f.date)} · ${f.time}
    &nbsp;|&nbsp; <span class="status-badge status-programado" style="padding:2px 8px;">Programado</span>`;
}

// ── Step 1: Passengers ────────────────────────────────────────────────

function addPassenger() {
  const name  = document.getElementById('p_name').value.trim();
  const idNum = document.getElementById('p_id').value.trim();
  const age   = parseInt(document.getElementById('p_age').value);
  const dis   = document.getElementById('p_disability').checked;

  clearMsg('passengerFormMsg');

  if (!name || !idNum) {
    showMsg('passengerFormMsg', 'Completa el nombre y el número de identificación.', 'danger');
    return;
  }
  if (isNaN(age) || age < 0 || age > 120) {
    showMsg('passengerFormMsg', 'Ingresa una edad válida (0–120).', 'danger');
    return;
  }
  if (state.passengers.some(p => p.idNumber === idNum)) {
    showMsg('passengerFormMsg', 'Ya existe un pasajero con ese número de identificación.', 'danger');
    return;
  }

  state.passengers.push({
    name, idNumber: idNum, age,
    hasDisability:   dis,
    isMinor:         age < 18,
    isRepresentative: false,
    representativeOf: null,
    seat: null
  });

  // Reset form
  ['p_name','p_id','p_age'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('p_disability').checked = false;

  renderPassengerList();
  renderRepSection();
}

function removePassenger(idx) {
  state.passengers.splice(idx, 1);
  // Clear any representativeOf that pointed to removed passenger
  state.passengers.forEach(p => { p.isRepresentative = false; p.representativeOf = null; });
  renderPassengerList();
  renderRepSection();
}

function renderPassengerList() {
  const container = document.getElementById('passengerList');
  document.getElementById('passengerCount').textContent = `${state.passengers.length} pasajero(s)`;

  if (state.passengers.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:2rem 0;"><p>Agrega al menos un pasajero.</p></div>';
    return;
  }

  container.innerHTML = state.passengers.map((p, i) => {
    const tags = [
      p.isMinor       ? '<span class="tag tag-amber">Menor</span>' : '<span class="tag tag-green">Adulto</span>',
      p.hasDisability ? '<span class="tag tag-red">Discapacidad</span>' : ''
    ].filter(Boolean).join(' ');

    return `
      <div class="passenger-item" style="margin-bottom:8px;">
        <div class="p-info">
          <div class="p-name">${p.name} ${tags}</div>
          <div class="p-detail">${p.idNumber} · ${p.age} años</div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="removePassenger(${i})">✕</button>
      </div>`;
  }).join('');
}

function renderRepSection() {
  const minors   = state.passengers.filter(p => p.isMinor);
  const adults   = state.passengers.filter(p => !p.isMinor);
  const section  = document.getElementById('repSection');
  const container = document.getElementById('repAssignments');

  document.getElementById('minorCount').textContent = minors.length;

  if (minors.length === 0) { section.style.display = 'none'; return; }

  section.style.display = '';

  if (adults.length === 0) {
    container.innerHTML = '<div class="alert alert-danger">No hay adultos en la reserva. Agrega al menos un adulto como representante.</div>';
    return;
  }

  container.innerHTML = minors.map((minor, _) => {
    const options = adults.map(a =>
      `<option value="${a.idNumber}" ${minor.representativeOf === a.idNumber ? 'selected' : ''}>${a.name} (${a.idNumber})</option>`
    ).join('');

    return `
      <div class="form-group">
        <label class="form-label">Representante de <strong>${minor.name}</strong> (${minor.age} años)</label>
        <select class="form-control" onchange="assignRep('${minor.idNumber}', this.value)">
          <option value="">— Seleccionar representante —</option>
          ${options}
        </select>
      </div>`;
  }).join('');
}

function assignRep(minorId, adultId) {
  const minor = state.passengers.find(p => p.idNumber === minorId);
  if (!minor) return;
  minor.representativeOf = adultId || null;

  // Mark adult as representative
  state.passengers.forEach(p => { p.isRepresentative = false; });
  state.passengers.forEach(p => {
    if (state.passengers.some(m => m.representativeOf === p.idNumber)) {
      p.isRepresentative = true;
    }
  });
}

// ── Step 1 → Step 2 ───────────────────────────────────────────────────

function goToStep2() {
  clearMsg('step1Msg');

  if (state.passengers.length === 0) {
    showMsg('step1Msg', 'Agrega al menos un pasajero.', 'danger');
    return;
  }

  // Check all minors have a representative
  const minors = state.passengers.filter(p => p.isMinor);
  for (const m of minors) {
    if (!m.representativeOf) {
      showMsg('step1Msg', `El menor <strong>${m.name}</strong> no tiene representante asignado.`, 'danger');
      return;
    }
  }

  // Reset seat assignments when coming back from step 3
  state.seatIdx = 0;

  setStep(2);
  renderSeatProgressList();
  renderStep2PassengerInfo();
  renderSeatMap();
  renderStep2Nav();
}

// ── Step 2: Seat map ──────────────────────────────────────────────────

function renderSeatMap() {
  const p          = state.passengers[state.seatIdx];
  const occupied   = SW.getOccupiedSeats(state.flightId);
  const inBooking  = state.passengers
    .filter((_, i) => i !== state.seatIdx && state.passengers[i].seat)
    .map(px => px.seat);

  document.getElementById('seatMapContainer').innerHTML =
    buildSeatMap(state.flight, occupied, inBooking, p, null, p.seat);
}

function renderStep2PassengerInfo() {
  const p = state.passengers[state.seatIdx];
  const restrictions = [];
  if (p.isMinor)       restrictions.push('No puede sentarse en salidas de emergencia');
  if (p.age >= 60)     restrictions.push('No puede sentarse en salidas de emergencia');
  if (p.hasDisability) restrictions.push('No puede sentarse en salidas de emergencia');
  if (p.isRepresentative) restrictions.push('Es representante de un menor');

  document.getElementById('currentPassengerInfo').innerHTML = `
    <div style="font-size:1rem;font-weight:700;color:var(--primary);margin-bottom:8px;">${p.name}</div>
    <div style="font-size:0.85rem;color:var(--gray-600);margin-bottom:8px;">${p.idNumber} · ${p.age} años</div>
    ${p.hasDisability ? '<span class="tag tag-red">Discapacidad</span>' : ''}
    ${p.isMinor       ? '<span class="tag tag-amber">Menor de edad</span>' : ''}
    ${restrictions.length > 0
      ? `<div class="alert alert-warning" style="margin-top:10px;font-size:0.8rem;">${restrictions.join('<br>')}</div>`
      : ''}
    ${p.seat
      ? `<div class="alert alert-success" style="margin-top:10px;">Asiento seleccionado: <strong>${p.seat}</strong><br><small>Haz clic de nuevo para deseleccionar.</small></div>`
      : '<div class="alert alert-info" style="margin-top:10px;font-size:0.82rem;">Haz clic en un asiento disponible (verde) para seleccionarlo.</div>'}`;
}

function renderSeatProgressList() {
  const list = document.getElementById('seatProgressList');
  list.innerHTML = state.passengers.map((p, i) => {
    let cls = 'passenger-item';
    if (i === state.seatIdx) cls += ' current';
    else if (p.seat)         cls += ' done';
    else                     cls += ' pending';

    return `
      <div class="${cls}" onclick="jumpToPassenger(${i})" title="Ir a este pasajero">
        <div class="p-info">
          <div class="p-name">${p.name}</div>
          <div class="p-detail">${p.isMinor ? 'Menor · ' : ''}${p.age} años</div>
        </div>
        ${p.seat
          ? `<span class="p-seat-tag">${p.seat}</span>`
          : `<span class="text-muted" style="font-size:0.75rem;">${i === state.seatIdx ? 'Seleccionando...' : 'Pendiente'}</span>`}
      </div>`;
  }).join('');
}

function jumpToPassenger(idx) {
  state.seatIdx = idx;
  renderSeatMap();
  renderSeatProgressList();
  renderStep2PassengerInfo();
  renderStep2Nav();
}

function renderStep2Nav() {
  const allSeated = state.passengers.every(p => p.seat);
  const p         = state.passengers[state.seatIdx];
  const nav       = document.getElementById('step2Nav');

  let html = '';
  if (p.seat && state.seatIdx < state.passengers.length - 1) {
    html += `<button class="btn btn-secondary btn-full mb-1" onclick="nextPassenger()">
               → Siguiente pasajero
             </button>`;
  }
  if (allSeated) {
    html += `<button class="btn btn-primary btn-full" onclick="goToStep3()">
               Revisar y Confirmar →
             </button>`;
  }

  nav.innerHTML = html;
}

function nextPassenger() {
  if (state.seatIdx < state.passengers.length - 1) {
    state.seatIdx++;
    renderSeatMap();
    renderSeatProgressList();
    renderStep2PassengerInfo();
    renderStep2Nav();
  }
}

// ── Step 2 → Step 3 ───────────────────────────────────────────────────

function goToStep3() {
  const missing = state.passengers.filter(p => !p.seat).map(p => p.name);
  if (missing.length > 0) {
    alert(`Los siguientes pasajeros aún no tienen asiento: ${missing.join(', ')}`);
    return;
  }
  setStep(3);
  renderSummary();
}

function renderSummary() {
  const f = state.flight;
  document.getElementById('summaryFlight').innerHTML = `
    <div class="route-display" style="gap:0.75rem;">
      <div class="city-big">${f.originCode}</div>
      <div class="route-sep">✈</div>
      <div class="city-big">${f.destCode}</div>
    </div>
    <div style="font-size:0.9rem;color:var(--gray-600);margin-top:4px;">
      ${f.origin} → ${f.destination} &nbsp;|&nbsp;
      ${formatDate(f.date)} · ${f.time}
    </div>`;

  const exitRows = state.flight.emergencyExitRows || [9, 10];

  document.getElementById('summaryTable').innerHTML = state.passengers.map(p => {
    const row = parseInt(p.seat);
    const isExit = exitRows.includes(row);
    const conditions = [
      p.isMinor          ? '<span class="tag tag-amber">Menor</span>' : '',
      p.age >= 60        ? '<span class="tag tag-amber">Adulto mayor</span>' : '',
      p.hasDisability    ? '<span class="tag tag-red">Discapacidad</span>' : '',
      p.isRepresentative ? '<span class="tag tag-blue">Representante</span>' : ''
    ].filter(Boolean).join(' ') || '<span class="tag tag-green">Normal</span>';

    return `<tr>
      <td><strong>${p.name}</strong></td>
      <td>${p.idNumber}</td>
      <td>${p.age} años</td>
      <td>${conditions}</td>
      <td>
        <strong>${p.seat}</strong>
        ${isExit ? '<span class="tag tag-amber" style="margin-left:4px;">Salida emerg.</span>' : ''}
      </td>
    </tr>`;
  }).join('');
}

// ── Confirm and save ──────────────────────────────────────────────────

function confirmReservation() {
  // Re-validate seats are still available (guard against concurrent bookings in future)
  const occupied = SW.getOccupiedSeats(state.flightId);
  const conflict = state.passengers.find(p => occupied.includes(p.seat));
  if (conflict) {
    showMsg('step3Msg', `El asiento <strong>${conflict.seat}</strong> ya fue tomado. Vuelve a seleccionar.`, 'danger');
    return;
  }

  const session = Auth.getSession();
  const reservation = SW.addReservation({
    flightId:   state.flightId,
    userId:     session ? session.userId : null,
    passengers: state.passengers.map(p => ({ ...p }))
  });

  window.location.href = `confirmacion.html?id=${reservation.id}`;
}

// ── Shared helpers ────────────────────────────────────────────────────

function setStep(n) {
  state.step = n;
  [1, 2, 3].forEach(i => {
    document.getElementById(`step${i}`).style.display = (i === n) ? '' : 'none';

    const el = document.getElementById(`wstep${i}`);
    el.classList.remove('active', 'done');
    if (i < n)  el.classList.add('done');
    if (i === n) el.classList.add('active');

    if (i < 3) {
      const conn = document.getElementById(`wconn${i}`);
      conn.classList.toggle('done', i < n);
    }
  });

  if (n === 2) {
    renderStep2PassengerInfo();
  }
}

function showMsg(id, msg, type = 'info') {
  document.getElementById(id).innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
}

function clearMsg(id) {
  document.getElementById(id).innerHTML = '';
}
