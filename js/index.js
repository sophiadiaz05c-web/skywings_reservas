// Change-seat modal state
let chg = { reservationId: null, passengerIdx: null, flight: null, passenger: null, newSeat: null };

// Called by seatmap.js via onclick
function handleSeatClick(seatId) {
  if (!chg.flight) return;
  chg.newSeat = seatId;
  document.getElementById('confirmChangeBtn').disabled = false;
  refreshChangeMap();
}

// ── Flight listing ────────────────────────────────────────────────────

function loadFlights() {
  const container = document.getElementById('flightsList');
  const flights = SW.getFlights().filter(f => f.status === 'programado');

  if (flights.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✈</div>
        <p>No hay vuelos programados en este momento.</p>
        <p class="text-muted mt-1">Consulta con el personal de SkyWings o visita el panel de administración.</p>
      </div>`;
    return;
  }

  container.innerHTML = `<div class="grid-3">${flights.map(flightCard).join('')}</div>`;
}

function flightCard(f) {
  const totalSeats = (2 * 4) + (20 * 6); // rows 1-2: 4 seats, rows 3-22: 6 seats
  const occupied   = SW.getOccupiedSeats(f.id).length;
  const available  = totalSeats - occupied;

  return `
    <div class="flight-card">
      <div class="flight-route">
        <div>
          <div class="flight-city">${f.originCode}</div>
          <div class="flight-iata">${f.origin}</div>
        </div>
        <div class="flight-arrow">✈</div>
        <div>
          <div class="flight-city">${f.destCode}</div>
          <div class="flight-iata">${f.destination}</div>
        </div>
      </div>
      <div class="flight-meta">
        <span>📅 <strong>${formatDateShort(f.date)}</strong></span>
        <span>🕐 <strong>${f.time}</strong></span>
        <span>✈ ${f.aircraft}</span>
      </div>
      <div class="flex justify-between align-center mb-2">
        <div>
          <span class="tag tag-green">${available} libres</span>
          <span class="tag tag-red" style="margin-left:4px;">${occupied} ocupados</span>
        </div>
        <span class="status-badge status-programado">● Programado</span>
      </div>
      <a href="reservar.html?flightId=${f.id}" class="btn btn-primary btn-full">Reservar Asiento</a>
    </div>`;
}

// ── Reservation lookup ────────────────────────────────────────────────

function searchReservations() {
  const idNum     = document.getElementById('searchId').value.trim();
  const container = document.getElementById('reservationResults');

  if (!idNum) {
    container.innerHTML = '<div class="alert alert-warning">Ingresa un número de cédula o pasaporte.</div>';
    return;
  }

  const reservations = SW.getReservationsByPassengerId(idNum);

  if (reservations.length === 0) {
    container.innerHTML = '<div class="alert alert-info">No se encontraron reservas para ese número de identificación.</div>';
    return;
  }

  container.innerHTML = reservations.map(r => reservationCard(r, idNum)).join('');
}

function reservationCard(r, searchId) {
  const flight = SW.getFlightById(r.flightId);
  if (!flight) return '';

  const canModify   = flight.status === 'programado';
  const statusLabel = { programado: 'Programado', abordando: 'Abordando', salido: 'Salido' }[flight.status];

  const rows = r.passengers.map((p, i) => {
    const isMe  = p.idNumber === searchId;
    const tags  = [
      p.isMinor          ? '<span class="tag tag-amber">Menor</span>' : '',
      p.isRepresentative ? '<span class="tag tag-blue">Representante</span>' : '',
      p.hasDisability    ? '<span class="tag tag-red">Discapacidad</span>' : ''
    ].filter(Boolean).join(' ');

    const actions = canModify && isMe
      ? `<button class="btn btn-outline btn-sm" onclick="openChangeModal('${r.id}',${i})">Cambiar</button>
         <button class="btn btn-danger btn-sm" style="margin-left:4px;" onclick="cancelReservation('${r.id}')">Cancelar</button>`
      : (!canModify ? '<span class="text-muted">No modificable</span>' : '—');

    return `<tr ${isMe ? 'style="background:#EFF6FF;"' : ''}>
      <td>${p.name} ${tags}</td>
      <td>${p.idNumber}</td>
      <td>${p.age} años</td>
      <td><strong>${p.seat}</strong></td>
      <td>${actions}</td>
    </tr>`;
  }).join('');

  return `
    <div class="card mb-2">
      <div class="card-header">
        <div>
          <strong>${flight.origin} → ${flight.destination}</strong>
          <span style="margin-left:8px;font-size:0.82rem;color:var(--gray-500);">
            ${formatDateShort(flight.date)} · ${flight.time}
          </span>
        </div>
        <div class="flex gap-1 align-center">
          <span class="status-badge status-${flight.status}">● ${statusLabel}</span>
          <span class="text-muted">Res. #${r.id.toUpperCase().slice(0,6)}</span>
        </div>
      </div>
      <div class="card-body">
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Pasajero</th><th>Cédula/Pasaporte</th><th>Edad</th><th>Asiento</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        ${!canModify ? '<div class="alert alert-warning mt-2" style="margin-top:1rem;">Este vuelo ya no permite cambios ni cancelaciones.</div>' : ''}
      </div>
    </div>`;
}

// ── Change seat modal ─────────────────────────────────────────────────

function openChangeModal(reservationId, passengerIdx) {
  const res       = SW.getReservations().find(r => r.id === reservationId);
  const flight    = SW.getFlightById(res.flightId);
  const passenger = res.passengers[passengerIdx];

  chg = { reservationId, passengerIdx, flight, passenger, newSeat: null };

  document.getElementById('changeSeatInfo').innerHTML =
    `Cambiando asiento de <strong>${passenger.name}</strong>. Asiento actual: <strong>${passenger.seat}</strong>`;

  document.getElementById('confirmChangeBtn').disabled = true;
  refreshChangeMap();
  document.getElementById('changeSeatModal').classList.add('open');
}

function refreshChangeMap() {
  // Occupied = all seats on this flight EXCEPT the passenger's current seat
  const occupied = SW.getOccupiedSeats(chg.flight.id).filter(s => s !== chg.passenger.seat);
  document.getElementById('changeSeatMap').innerHTML =
    buildSeatMap(chg.flight, occupied, [], chg.passenger, chg.passenger.seat, chg.newSeat);
}

function confirmSeatChange() {
  if (!chg.newSeat) return;

  const res        = SW.getReservations().find(r => r.id === chg.reservationId);
  const passengers = res.passengers.map((p, i) =>
    i === chg.passengerIdx ? { ...p, seat: chg.newSeat } : p
  );

  SW.updateReservation(chg.reservationId, { passengers });
  closeChangeModal();
  searchReservations();
  alert(`✓ Asiento cambiado a ${chg.newSeat} exitosamente.`);
}

function cancelReservation(reservationId) {
  const res    = SW.getReservations().find(r => r.id === reservationId);
  const flight = SW.getFlightById(res.flightId);

  if (flight.status !== 'programado') {
    alert('No se puede cancelar: el vuelo ya está en abordaje o ha salido.');
    return;
  }

  if (!confirm('¿Confirmas cancelar TODA la reserva? Esta acción no se puede deshacer.')) return;

  SW.removeReservation(reservationId);
  searchReservations();
  alert('Reserva cancelada exitosamente.');
}

function closeChangeModal() {
  document.getElementById('changeSeatModal').classList.remove('open');
  chg = { reservationId: null, passengerIdx: null, flight: null, passenger: null, newSeat: null };
}

document.addEventListener('DOMContentLoaded', loadFlights);
