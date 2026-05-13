/**
 * Seat map renderer — overlays buttons on the plane image.
 * Each page must define window.handleSeatClick(seatId).
 *
 * Layout matches the provided Boeing 737-style image:
 *   Rows 1-2  : 4 seats  (A, C | D, F)   — Economy Plus
 *   Rows 3-22 : 6 seats  (A,B,C | D,E,F) — Economy / Clase Turista
 *   Exit rows : 9 and 10 (wing exits)
 */

const SEAT_LAYOUT = {
  rows: 22,
  defaultExitRows: [9, 10],

  // Rows that have only 4 seats instead of 6
  fourSeatRows: [1, 2],

  // X position (% of image width) for 6-seat rows
  // Left group (A,B,C): fuselage left side ~18-35%
  // Right group (D,E,F): fuselage right side ~57-73%
  xSix: { A: 19, B: 27, C: 35, D: 57, E: 65, F: 73 },

  // X position for 4-seat rows 1-2 (wider seats, only A C D F)
  xFour: { A: 22, C: 33, D: 59.5, F: 70 },

  // Y position (% of image height) per row.
  // Economy (1-9): rows start ~17.5%, step ~4% each.
  // Turista (10-22): rows start ~54%, step ~3% each.
  getY(row) {
    if (row <= 2) return 17.5 + (row - 1) * 3.8;
    if (row <= 9) return 20 + (row - 1) * 3.95;
    return 57.5 + (row - 10) * 4;
  }
};

function buildSeatMap(flight, occupiedSeats, otherBookingSeats, passenger, currentSeat, selectedSeat) {
  const exitRows   = (flight && flight.emergencyExitRows) ? flight.emergencyExitRows : SEAT_LAYOUT.defaultExitRows;
  const restricted = passenger.age < 18 || passenger.age >= 60 || passenger.hasDisability;

  let html = `<div class="plane-overlay-container">
    <img src="img/avion2.png" class="plane-img" alt="Mapa del avión SkyWings" draggable="false">
    <div class="buttons-container">`;

  for (let row = 1; row <= SEAT_LAYOUT.rows; row++) {
    const isFourSeat = SEAT_LAYOUT.fourSeatRows.includes(row);
    const cols       = isFourSeat ? ['A', 'C', 'D', 'F'] : ['A', 'B', 'C', 'D', 'E', 'F'];
    const xMap       = isFourSeat ? SEAT_LAYOUT.xFour : SEAT_LAYOUT.xSix;
    const isExit     = exitRows.includes(row);
    const yPos       = SEAT_LAYOUT.getY(row);

    cols.forEach(col => {
      const seatId     = `${row}${col}`;
      const xPos       = xMap[col];
      const isOccupied = occupiedSeats.includes(seatId) || otherBookingSeats.includes(seatId);
      const isMySeat   = seatId === currentSeat;
      const isSelected = seatId === selectedSeat;
      const isBlocked  = isExit && restricted;

      let cls     = 'seat-ov';
      let disabled = false;
      let onclick  = '';
      let title    = `Asiento ${seatId}`;

      if (isOccupied) {
        cls += ' ov-occupied'; disabled = true; title += ' — Ocupado';
      } else if (isMySeat || isSelected) {
        cls += ' ov-selected';
        onclick = `handleSeatClick('${seatId}')`;
        title += ' — Seleccionado';
      } else if (isBlocked) {
        cls += ' ov-blocked'; disabled = true;
        title += ' — No disponible (restricción salida emergencia)';
      } else {
        cls += ' ov-available';
        if (isExit) cls += ' ov-exit';
        onclick = `handleSeatClick('${seatId}')`;
        if (isExit) title += ' — Salida de emergencia';
      }

      html += `<button
        class="${cls}"
        style="top:${yPos}%;left:${xPos}%;"
        ${disabled ? 'disabled' : ''}
        ${onclick ? `onclick="${onclick}"` : ''}
        title="${title}"
        data-seat="${seatId}"
      ></button>`;
    });
  }

  html += `</div></div>`;
  return html;
}

function getColsForRow(row) {
  return SEAT_LAYOUT.fourSeatRows.includes(row)
    ? ['A', 'C', 'D', 'F']
    : ['A', 'B', 'C', 'D', 'E', 'F'];
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return `${+d} de ${months[+m - 1]} de ${y}`;
}

function formatDateShort(dateStr) {
  const [y, m, d] = dateStr.split('-');
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${+d} ${months[+m - 1]} ${y}`;
}
