const SW = (() => {
  const FLIGHTS_KEY = 'sw_flights';
  const RES_KEY     = 'sw_reservations';

  function load(key)        { return JSON.parse(localStorage.getItem(key) || '[]'); }
  function store(key, val)  { localStorage.setItem(key, JSON.stringify(val)); }
  function generateId()     { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // ── Flights ──────────────────────────────────────────────────────────
  function getFlights()       { return load(FLIGHTS_KEY); }
  function getFlightById(id)  { return getFlights().find(f => f.id === id); }

  function addFlight(flight) {
    const list = getFlights();
    flight.id = generateId();
    list.push(flight);
    store(FLIGHTS_KEY, list);
    return flight;
  }

  function updateFlight(id, updates) {
    store(FLIGHTS_KEY, getFlights().map(f => f.id === id ? { ...f, ...updates } : f));
  }

  function removeFlight(id) {
    store(FLIGHTS_KEY, getFlights().filter(f => f.id !== id));
    store(RES_KEY, load(RES_KEY).filter(r => r.flightId !== id));
  }

  // ── Reservations ─────────────────────────────────────────────────────
  function getReservations()  { return load(RES_KEY); }

  function addReservation(res) {
    const list = getReservations();
    res.id        = generateId();
    res.createdAt = new Date().toISOString();
    list.push(res);
    store(RES_KEY, list);
    return res;
  }

  function updateReservation(id, updates) {
    store(RES_KEY, getReservations().map(r => r.id === id ? { ...r, ...updates } : r));
  }

  function removeReservation(id) {
    store(RES_KEY, getReservations().filter(r => r.id !== id));
  }

  function getReservationsByFlight(flightId) {
    return getReservations().filter(r => r.flightId === flightId);
  }

  function getOccupiedSeats(flightId) {
    return getReservationsByFlight(flightId).flatMap(r => r.passengers.map(p => p.seat));
  }

  function getReservationsByPassengerId(idNumber) {
    return getReservations().filter(r => r.passengers.some(p => p.idNumber === idNumber));
  }

  return {
    generateId,
    getFlights, getFlightById, addFlight, updateFlight, removeFlight,
    getReservations, addReservation, updateReservation, removeReservation,
    getReservationsByFlight, getOccupiedSeats, getReservationsByPassengerId
  };
})();
