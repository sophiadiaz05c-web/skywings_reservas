// ── Form helpers ──────────────────────────────────────────────────────

function toggleForm() {
  const body = document.getElementById('flightFormBody');
  body.style.display = body.style.display === 'none' ? '' : 'none';
}

function resetForm() {
  document.getElementById('flightForm').reset();
  document.getElementById('f_exitRows').value = '9, 10';
  document.getElementById('flightFormMsg').innerHTML = '';
}

function showFormMsg(msg, type = 'success') {
  document.getElementById('flightFormMsg').innerHTML =
    `<div class="alert alert-${type}" style="margin-bottom:1rem;">${msg}</div>`;
}

// ── Add flight ────────────────────────────────────────────────────────

function submitFlight(e) {
  e.preventDefault();

  const exitRowsRaw = document.getElementById('f_exitRows').value.trim();
  const exitRows = exitRowsRaw
    ? exitRowsRaw.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n >= 1 && n <= 22)
    : [9, 10];

  const flight = {
    origin:           document.getElementById('f_origin').value.trim(),
    originCode:       document.getElementById('f_originCode').value.trim().toUpperCase(),
    destination:      document.getElementById('f_dest').value.trim(),
    destCode:         document.getElementById('f_destCode').value.trim().toUpperCase(),
    date:             document.getElementById('f_date').value,
    time:             document.getElementById('f_time').value,
    aircraft:         document.getElementById('f_aircraft').value.trim(),
    emergencyExitRows: exitRows,
    status:           'programado'
  };

  SW.addFlight(flight);
  showFormMsg('✓ Vuelo registrado exitosamente.');
  document.getElementById('flightForm').reset();
  document.getElementById('f_exitRows').value = '9, 10';
  renderFlights();
}

// ── Render flights table ──────────────────────────────────────────────

function renderFlights() {
  const wrapper  = document.getElementById('flightsTableWrapper');
  const flights  = SW.getFlights();

  if (flights.length === 0) {
    wrapper.innerHTML = `
      <div class="card-body">
        <div class="empty-state">
          <div class="empty-icon">✈</div>
          <p>No hay vuelos registrados. Agrega el primero usando el formulario.</p>
        </div>
      </div>`;
    return;
  }

  const rows = flights.map(f => {
    const totalSeats = (2 * 4) + (20 * 6);
    const occupied   = SW.getOccupiedSeats(f.id).length;
    const exitLabel  = (f.emergencyExitRows || [9,10]).join(', ');

    return `<tr>
      <td>
        <strong>${f.originCode} → ${f.destCode}</strong><br>
        <span style="font-size:0.78rem;color:var(--gray-500);">${f.origin} → ${f.destination}</span>
      </td>
      <td>${formatDateShort(f.date)}</td>
      <td>${f.time}</td>
      <td>${f.aircraft}</td>
      <td>Filas ${exitLabel}</td>
      <td>
        <span class="tag tag-green">${totalSeats - occupied} libres</span><br>
        <span class="tag tag-red" style="margin-top:3px;display:inline-block;">${occupied} ocupados</span>
      </td>
      <td>
        <select class="form-control" style="width:130px;font-size:0.8rem;padding:5px 8px;"
                onchange="updateStatus('${f.id}', this.value)">
          <option value="programado" ${f.status==='programado'?'selected':''}>Programado</option>
          <option value="abordando"  ${f.status==='abordando' ?'selected':''}>Abordando</option>
          <option value="salido"     ${f.status==='salido'    ?'selected':''}>Salido</option>
        </select>
      </td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="openReservationsModal('${f.id}')">Ver reservas</button>
        <button class="btn btn-danger btn-sm" style="margin-top:4px;" onclick="deleteFlight('${f.id}')">Eliminar</button>
      </td>
    </tr>`;
  }).join('');

  wrapper.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Ruta</th>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Aeronave</th>
            <th>Salidas emerg.</th>
            <th>Asientos</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function updateStatus(id, status) {
  SW.updateFlight(id, { status });
  renderFlights();
}

function deleteFlight(id) {
  const flight = SW.getFlightById(id);
  const resCount = SW.getReservationsByFlight(id).length;
  const msg = resCount > 0
    ? `¿Eliminar el vuelo ${flight.originCode}→${flight.destCode}? También se eliminarán ${resCount} reserva(s) asociada(s).`
    : `¿Eliminar el vuelo ${flight.originCode}→${flight.destCode}?`;

  if (!confirm(msg)) return;
  SW.removeFlight(id);
  renderFlights();
}

// ── Reservations modal ────────────────────────────────────────────────

function openReservationsModal(flightId) {
  const flight       = SW.getFlightById(flightId);
  const reservations = SW.getReservationsByFlight(flightId);

  document.getElementById('reservationsModalTitle').textContent =
    `Reservas: ${flight.origin} → ${flight.destination} (${formatDateShort(flight.date)})`;

  if (reservations.length === 0) {
    document.getElementById('reservationsModalBody').innerHTML =
      '<div class="empty-state"><div class="empty-icon">🎫</div><p>No hay reservas para este vuelo.</p></div>';
  } else {
    const rows = reservations.flatMap(r =>
      r.passengers.map(p => {
        const tags = [
          p.isMinor          ? '<span class="tag tag-amber">Menor</span>' : '',
          p.isRepresentative ? '<span class="tag tag-blue">Representante</span>' : '',
          p.hasDisability    ? '<span class="tag tag-red">Discapacidad</span>' : ''
        ].filter(Boolean).join(' ');
        return `<tr>
          <td>${p.name} ${tags}</td>
          <td>${p.idNumber}</td>
          <td>${p.age} años</td>
          <td><strong>${p.seat}</strong></td>
          <td style="font-size:0.75rem;color:var(--gray-400);">#${r.id.toUpperCase().slice(0,6)}</td>
        </tr>`;
      })
    ).join('');

    document.getElementById('reservationsModalBody').innerHTML = `
      <div class="table-wrapper">
        <table>
          <thead>
            <tr><th>Pasajero</th><th>Cédula/Pasaporte</th><th>Edad</th><th>Asiento</th><th>Reserva</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  document.getElementById('reservationsModal').classList.add('open');
}

function closeReservationsModal() {
  document.getElementById('reservationsModal').classList.remove('open');
}

// ── Demo data ─────────────────────────────────────────────────────────

function loadDemoData() {
  if (!confirm('¿Cargar 3 vuelos de prueba? Esto agregará vuelos al sistema.')) return;

  const demos = [
    { origin:'Caracas', originCode:'CCS', destination:'Miami', destCode:'MIA',
      date:'2026-06-20', time:'08:30', aircraft:'Boeing 737-800', emergencyExitRows:[9,10], status:'programado' },
    { origin:'Caracas', originCode:'CCS', destination:'Bogotá', destCode:'BOG',
      date:'2026-06-21', time:'14:15', aircraft:'Airbus A320', emergencyExitRows:[9,10], status:'programado' },
    { origin:'Maracaibo', originCode:'MAR', destination:'Caracas', destCode:'CCS',
      date:'2026-06-22', time:'07:00', aircraft:'Boeing 737-700', emergencyExitRows:[9,10], status:'abordando' }
  ];

  demos.forEach(d => SW.addFlight(d));
  renderFlights();
  alert('✓ Datos de prueba cargados.');
}

document.addEventListener('DOMContentLoaded', renderFlights);
