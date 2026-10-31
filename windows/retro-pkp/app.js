// PKP HAFAS Planner JS Frontend Logic (2007 Style)

// Dynamically determine the backend proxy URL
const PROXY_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:'
  ? 'http://127.0.0.1:8787/'
  : '/'; // Relative URL when deployed on the same Cloudflare Worker

// Store selected station info from autocomplete
let plannerFromLoc = null;
let plannerToLoc = null;
let stationLoc = null;

// Keep track of search results and the shared location lookup table for detail views
let currentConnections = [];
let currentLocL = []; // res.common.locL — resolves stop.locX → station name

// Initialize Page and Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  initDateTime();
  initTabs();
  initAutocomplete('planner-from', 'suggestions-from', (loc) => { plannerFromLoc = loc; });
  initAutocomplete('planner-to', 'suggestions-to', (loc) => { plannerToLoc = loc; });
  initAutocomplete('station-name', 'suggestions-station', (loc) => { stationLoc = loc; });

  // Event Listeners for buttons
  document.getElementById('planner-form').addEventListener('submit', handlePlannerSearch);
  document.getElementById('stations-form').addEventListener('submit', handleStationBoardSearch);
  document.getElementById('btn-back-to-planner').addEventListener('click', () => showView('view-planner-form'));
  document.getElementById('btn-back-to-results').addEventListener('click', () => showView('view-results'));
  document.getElementById('btn-clear-planner').addEventListener('click', clearPlanner);
  document.getElementById('btn-clear-stations').addEventListener('click', clearStations);
  
  // Date adjust buttons
  document.getElementById('btn-date-prev').addEventListener('click', () => adjustDate(-1));
  document.getElementById('btn-date-next').addEventListener('click', () => adjustDate(1));
});

// Initialize current Date/Time in retro inputs
function initDateTime() {
  const now = new Date();
  
  // Format: DD.MM.YYYY
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  document.getElementById('planner-date').value = `${day}.${month}.${year}`;
  
  // Format: HH:MM
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  document.getElementById('planner-time').value = `${hours}:${minutes}`;
  document.getElementById('station-time').value = `${hours}:${minutes}`;

  // Update clock/top header
  const weekdays = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
  const currentWeekday = weekdays[now.getDay()];
  document.getElementById('current-time-display').innerText = `${currentWeekday}, ${day}.${month}.${String(year).substring(2)}, ${hours}:${minutes}`;
}

// Date adjuster (prev/next day)
function adjustDate(daysOffset) {
  const dateStr = document.getElementById('planner-date').value;
  const parts = dateStr.split('.');
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    d.setDate(d.getDate() + daysOffset);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    document.getElementById('planner-date').value = `${day}.${month}.${year}`;
  }
}

// Clean fields
function clearPlanner() {
  document.getElementById('planner-from').value = '';
  document.getElementById('planner-to').value = '';
  plannerFromLoc = null;
  plannerToLoc = null;
  initDateTime();
}

function clearStations() {
  document.getElementById('station-name').value = '';
  stationLoc = null;
  initDateTime();
  document.getElementById('station-board-results-box').style.display = 'none';
}

// Tab navigation controller
function initTabs() {
  const tabPlanner = document.getElementById('tab-planner');
  const tabStations = document.getElementById('tab-stations');

  tabPlanner.addEventListener('click', () => {
    tabPlanner.className = 'activeslider';
    tabStations.className = 'slider';
    tabStations.style.backgroundColor = '#C2C2C2';
    tabPlanner.style.backgroundColor = '';
    
    document.getElementById('page-title-text').innerText = 'Zapytanie o połączenie';
    showView('view-planner-form');
  });

  tabStations.addEventListener('click', () => {
    tabStations.className = 'activeslider';
    tabPlanner.className = 'slider';
    tabPlanner.style.backgroundColor = '#C2C2C2';
    tabStations.style.backgroundColor = '';
    
    document.getElementById('page-title-text').innerText = 'Zapytanie o stację';
    showView('view-stations-form');
  });
}

// Helper to switch view containers
function showView(viewId) {
  const views = ['view-planner-form', 'view-stations-form', 'view-results', 'view-journey-details'];
  views.forEach(v => {
    document.getElementById(v).style.display = (v === viewId) ? 'block' : 'none';
  });
}

// AUTOCOMPLETE FOR STATION INPUTS
function initAutocomplete(inputId, suggestionsId, onSelectCallback) {
  const input = document.getElementById(inputId);
  const suggestions = document.getElementById(suggestionsId);
  let timeout = null;

  input.addEventListener('input', () => {
    clearTimeout(timeout);
    const query = input.value.trim();
    if (query.length < 3) {
      suggestions.style.display = 'none';
      return;
    }

    timeout = setTimeout(async () => {
      try {
        const list = await fetchLocations(query);
        renderSuggestions(list, input, suggestions, onSelectCallback);
      } catch (err) {
        console.error('Autocomplete error:', err);
      }
    }, 400);
  });

  // Close suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (e.target !== input && e.target !== suggestions) {
      suggestions.style.display = 'none';
    }
  });
}

// Render Suggestions Dropdown
function renderSuggestions(list, input, suggestions, onSelectCallback) {
  suggestions.innerHTML = '';
  if (!list || list.length === 0) {
    suggestions.style.display = 'none';
    return;
  }

  list.forEach(item => {
    const div = document.createElement('div');
    div.className = 'autocomplete-suggestion';
    div.innerText = item.name;
    div.addEventListener('click', () => {
      input.value = item.name;
      suggestions.style.display = 'none';
      onSelectCallback(item);
    });
    suggestions.appendChild(div);
  });

  suggestions.style.display = 'block';
  suggestions.style.width = (input.offsetWidth - 2) + 'px';
}

// Send LocMatch request to backend
async function fetchLocations(query) {
  const payload = {
    svcReqL: [{
      meth: 'LocMatch',
      req: {
        input: {
          loc: { name: query, type: 'S' },
          field: 'S'
        }
      }
    }],
    client: { id: 'PKP', v: '1.0' },
    ver: '1.42',
    lang: 'pl'
  };

  const res = await callHafas(payload);
  const matched = res?.svcResL?.[0]?.res?.match?.locL || [];
  return matched.map(loc => ({
    name: loc.name,
    extId: loc.extId,
    lid: loc.lid,
    raw: loc
  }));
}

// General HAFAS call wrapper
async function callHafas(payload) {
  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(`Proxy error: ${response.status} ${response.statusText}`);
  }
  return await response.json();
}

// Format Date/Time helper
function parseDateInput(rawDate) {
  // input: DD.MM.YYYY
  const parts = rawDate.split('.');
  if (parts.length === 3) {
    return `${parts[2]}${parts[1]}${parts[0]}`; // YYYYMMDD
  }
  return rawDate.replace(/[^0-9]/g, '');
}

function parseTimeInput(rawTime) {
  // input: HH:MM
  const parts = rawTime.split(':');
  if (parts.length === 2) {
    return `${parts[0]}${parts[1]}00`; // HHMMSS
  }
  return rawTime.replace(/[^0-9]/g, '');
}

// Formatter to present HH:MM
function formatTime(hafasTime) {
  if (!hafasTime || hafasTime.length < 4) return hafasTime;
  // Format HHMM or HHMMSS
  const hh = hafasTime.substring(0, 2);
  const mm = hafasTime.substring(2, 4);
  return `${hh}:${mm}`;
}

// Formatter to present DD.MM.YYYY
function formatDate(hafasDate) {
  if (!hafasDate || hafasDate.length !== 8) return hafasDate;
  const yyyy = hafasDate.substring(0, 4);
  const mm = hafasDate.substring(4, 6);
  const dd = hafasDate.substring(6, 8);
  return `${dd}.${mm}.${yyyy}`;
}

// Formatter for travel duration — HAFAS returns dur as HHMMSS zero-padded string (e.g. "001400" = 14 min)
function formatDuration(dur) {
  if (!dur) return '-';
  // Colon-separated format HH:MM or HH:MM:SS
  if (String(dur).includes(':')) {
    const parts = String(dur).split(':');
    const h = parseInt(parts[0]);
    const m = parseInt(parts[1]);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
  const s = String(dur);
  // HAFAS HHMMSS format — exactly 6 digits
  if (/^\d{6}$/.test(s)) {
    const h = parseInt(s.substring(0, 2));
    const m = parseInt(s.substring(2, 4));
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
  // Fallback: treat as plain minutes
  const mins = parseInt(s);
  if (!isNaN(mins)) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
  return dur;
}

// Handle Connection Search Form Submit
async function handlePlannerSearch(e) {
  e.preventDefault();
  const fromName = document.getElementById('planner-from').value.trim();
  const toName = document.getElementById('planner-to').value.trim();
  const dateVal = document.getElementById('planner-date').value.trim();
  const timeVal = document.getElementById('planner-time').value.trim();
  const isDep = document.getElementById('mode-dep').checked;

  if (!fromName || !toName) {
    alert('Proszę podać stację startową i końcową.');
    return;
  }

  document.getElementById('results-message').innerText = 'Wyszukiwanie połączeń... Proszę czekać.';
  document.getElementById('connections-results-tbody').innerHTML = `
    <tr>
      <td colspan="8" align="center" style="background-color: white; padding: 15px;">
        <span style="font-weight: bold; font-size: 13px; color: #555;">Łączenie z bazą rozkładu jazdy...</span>
      </td>
    </tr>
  `;
  showView('view-results');
  document.getElementById('results-header-label').innerHTML = `&nbsp;&nbsp;Połączenia: ${fromName} -> ${toName}`;

  try {
    const outDate = parseDateInput(dateVal);
    const outTime = parseTimeInput(timeVal);

    // Build locations. Prefer autocomplete resolved properties if present.
    const depLoc = plannerFromLoc && plannerFromLoc.name === fromName
      ? { type: 'S', lid: plannerFromLoc.lid, extId: plannerFromLoc.extId }
      : { type: 'S', name: fromName };

    const arrLoc = plannerToLoc && plannerToLoc.name === toName
      ? { type: 'S', lid: plannerToLoc.lid, extId: plannerToLoc.extId }
      : { type: 'S', name: toName };

    const payload = {
      svcReqL: [{
        meth: 'TripSearch',
        req: {
          depLocL: [depLoc],
          arrLocL: [arrLoc],
          outDate: outDate,
          outTime: outTime,
          outFrwd: isDep,
          getPasslist: true,
          maxChg: -1,
          minChgTime: 0
        }
      }],
      client: { id: 'PKP', v: '1.0' },
      ver: '1.42',
      lang: 'pl'
    };

    const data = await callHafas(payload);
    const res = data?.svcResL?.[0]?.res || {};
    const trips = res.outConL || res.connections || [];
    currentConnections = trips;
    currentLocL = res.common?.locL || [];

    renderConnectionResults(trips, fromName, toName);
  } catch (err) {
    document.getElementById('results-message').innerHTML = `<span class="errormessage">Błąd wyszukiwania: ${err.message}</span>`;
    document.getElementById('connections-results-tbody').innerHTML = `
      <tr>
        <td colspan="8" align="center" style="background-color: white; color: red; padding: 10px;">
          Błąd połączenia z serwerem HAFAS. Spróbuj ponownie.
        </td>
      </tr>
    `;
  }
}

// Render connection rows in results table
function renderConnectionResults(trips, fromName, toName) {
  const tbody = document.getElementById('connections-results-tbody');
  tbody.innerHTML = '';
  
  if (!trips || trips.length === 0) {
    document.getElementById('results-message').innerText = 'Nie znaleziono bezpośrednich ani przesiadkowych połączeń w podanym czasie.';
    tbody.innerHTML = `
      <tr>
        <td colspan="8" align="center" style="background-color: white; padding: 10px;">Brak danych</td>
      </tr>
    `;
    return;
  }

  document.getElementById('results-message').innerText = `Znaleziono ${trips.length} połączeń.`;

  trips.forEach((trip, idx) => {
    // Parse sections
    const secL = trip.secL || [];
    
    // First leg and last leg info
    const firstLeg = secL[0] || {};
    const lastLeg = secL[secL.length - 1] || {};
    
    const depTimeRaw = stopTime(firstLeg.dep, 'd') || trip.dep?.time || '';
    const arrTimeRaw = stopTime(lastLeg.arr, 'a') || trip.arr?.time || '';
    
    const depStName = firstLeg.dep?.loc?.name || fromName;
    const arrStName = lastLeg.arr?.loc?.name || toName;
    
    const duration = trip.dur || '';
    const chg = trip.chg !== undefined ? trip.chg : (secL.length - 1);
    
    // Collect train names/categories
    const trains = secL
      .filter(sec => sec.type === 'JNY' || sec.journey)
      .map(sec => {
        const jny = sec.journey || {};
        return jny.prod?.catOut || jny.dir || 'Pociąg';
      })
      .join(', ');

    const trColorClass = idx % 2 === 0 ? 'resultlight' : 'resultdark';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="${trColorClass}">${depStName}</td>
      <td class="${trColorClass}" align="center"><b>${formatTime(depTimeRaw)}</b></td>
      <td class="${trColorClass}">${arrStName}</td>
      <td class="${trColorClass}" align="center"><b>${formatTime(arrTimeRaw)}</b></td>
      <td class="${trColorClass}" align="center">${formatDuration(duration)}</td>
      <td class="${trColorClass}" align="center">${chg}</td>
      <td class="${trColorClass}">${trains || 'Osobowy'}</td>
      <td class="${trColorClass}" align="center">
        <a class="bold" onclick="showJourneyDetails(${idx})">szczegóły</a>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Resolve a station name from a stop object.
// HAFAS PKP uses stop.locX (integer index into res.common.locL) rather than an inline loc object.
function resolveStopName(stop, locL) {
  if (stop.locX !== undefined && locL && locL[stop.locX]) {
    return locL[stop.locX].name;
  }
  // Fallback: some responses embed the location directly
  return stop.loc?.name || stop.name || '—';
}

// HAFAS supplies scheduled (…TimeS) and, when available, real-time
// (…TimeR) values.  Prefer the latter so the dwell time agrees with the
// live timetable; fall back to the published schedule when no prediction is
// available.
function stopTime(stop, kind) {
  const scheduled = stop?.[kind + 'TimeS'];
  const realtime = stop?.[kind + 'TimeR'];
  return realtime || scheduled || '';
}

function formatStopTime(stop, kind) {
  const scheduled = stop?.[kind + 'TimeS'];
  const realtime = stop?.[kind + 'TimeR'];
  const displayed = realtime || scheduled;
  if (!displayed) return '-';
  const time = formatTime(displayed);
  // Keep the planned time visible if a live prediction differs from it.
  return realtime && scheduled && realtime !== scheduled
    ? `<b title="Planowo: ${formatTime(scheduled)}">${time}</b> <small>(plan. ${formatTime(scheduled)})</small>`
    : time;
}

// PKP sends platform data in compact railway notation, e.g. "II/2".
// Present it in words so passengers do not need to decode Roman numerals.
function formatPlatform(platform) {
  if (!platform || platform === '-') return '-';
  const match = String(platform).trim().match(/^([IVXLCDM]+)\s*\/\s*(.+)$/i);
  if (!match) return String(platform);

  const values = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  const roman = match[1].toUpperCase();
  let number = 0;
  for (let index = 0; index < roman.length; index++) {
    const value = values[roman[index]];
    const nextValue = values[roman[index + 1]] || 0;
    number += value < nextValue ? -value : value;
  }
  return `Peron ${number}, tor ${match[2]}`;
}

// Render a stopL array (from TripSearch passlist or JourneyDetails) into tbody
function renderStopList(stops, tbody, locL, startIdx) {
  locL = locL || currentLocL;
  startIdx = startIdx || 0;
  if (!stops || stops.length === 0) {
    const empty = document.createElement('tr');
    empty.innerHTML = '<td colspan="5" align="center" style="background-color: white;">Brak danych o przystankach.</td>';
    tbody.appendChild(empty);
    return;
  }
  stops.forEach((stop, idx) => {
    const cls = (startIdx + idx) % 2 === 0 ? 'resultlight' : 'resultdark';
    const name = resolveStopName(stop, locL);
    const arrRaw = stopTime(stop, 'a');
    const depRaw = stopTime(stop, 'd');
    const platform = formatPlatform(stop.aPlatfS || stop.dPlatfS || stop.platfS);

    let dwellTime = '-';
    if (arrRaw && depRaw) {
      const aMins = parseInt(arrRaw.substring(0, 2)) * 60 + parseInt(arrRaw.substring(2, 4));
      const dMins = parseInt(depRaw.substring(0, 2)) * 60 + parseInt(depRaw.substring(2, 4));
      const diff = dMins - aMins;
      if (diff > 0) dwellTime = diff + ' min';
      else if (diff === 0) dwellTime = '< 1 min';
    }

    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="' + cls + '"><b>' + name + '</b></td>' +
      '<td class="' + cls + '" align="center">' + formatStopTime(stop, 'a') + '</td>' +
      '<td class="' + cls + '" align="center">' + formatStopTime(stop, 'd') + '</td>' +
      '<td class="' + cls + '" align="center">' + dwellTime + '</td>' +
      '<td class="' + cls + '" align="center">' + platform + '</td>';
    tbody.appendChild(tr);
  });
}

// JourneyDetails returns the train's full route. Limit it to the portion used
// by this connection so a passenger does not see stations before boarding or
// after alighting.
function stopsForSection(stops, section, sectionLocL, detailLocL) {
  const departureName = resolveStopName(section.dep || {}, sectionLocL);
  const arrivalName = resolveStopName(section.arr || {}, sectionLocL);
  const first = stops.findIndex(stop => resolveStopName(stop, detailLocL) === departureName);
  const last = stops.findIndex((stop, index) =>
    index >= first && resolveStopName(stop, detailLocL) === arrivalName
  );

  return first >= 0 && last >= first ? stops.slice(first, last + 1) : stops;
}

// Show stops for a clicked connection result
async function showJourneyDetails(tripIdx) {
  const trip = currentConnections[tripIdx];
  if (!trip) return;

  const tbody = document.getElementById('journey-stops-tbody');
  tbody.innerHTML = '<tr><td colspan="5" align="center" style="background-color:white;padding:15px;">Wyszukiwanie stacji pośrednich...</td></tr>';
  showView('view-journey-details');

  const secL = trip.secL || [];
  const jnySecs = secL.filter(sec => sec.jny || sec.journey);

  if (jnySecs.length === 0) {
    renderStaticJourneyDetails(secL);
    return;
  }

  // Build header
  const firstJny = jnySecs[0].jny || jnySecs[0].journey;
  document.getElementById('journey-details-header-label').innerHTML = '&nbsp;&nbsp;Szczegóły trasy połączenia';
  document.getElementById('journey-info-panel').innerHTML =
    '<b>Liczba pociągów:</b> ' + jnySecs.length +
    (jnySecs.length > 1 ? ' &nbsp;|&nbsp; <b>Przesiadki:</b> ' + (jnySecs.length - 1) : '') +
    '<br><b>Przewoźnik:</b> PKP';

  // Fetch stopL for each leg
  const legs = [];
  for (const sec of jnySecs) {
    const jny = sec.jny || sec.journey;
    let stops = [];
    // TripSearch and JourneyDetails each have their own common.locL index
    // table. Never use a TripSearch table to resolve JourneyDetails stop.locX.
    let locL = currentLocL;

    // The TripSearch pass-list gets the station sequence quickly, but it
    // commonly omits platform data. Keep it as a fallback while loading the
    // complete JourneyDetails record below.
    if (jny.stopL && jny.stopL.length > 0) {
      stops = jny.stopL;
    }

    // JourneyDetails carries the platform/track fields for intermediate stops.
    // Use it even when TripSearch returned an inline pass-list.
    if (jny.jid) {
      try {
        const payload = {
          svcReqL: [{ meth: 'JourneyDetails', req: { jid: jny.jid } }],
          client: { id: 'PKP', v: '1.0' }, ver: '1.42', lang: 'pl'
        };
        const data = await callHafas(payload);
        const detailRes = data?.svcResL?.[0]?.res || {};
        if (detailRes.journey?.stopL?.length > 0) {
          const detailLocL = detailRes.common?.locL || locL;
          stops = stopsForSection(detailRes.journey.stopL, sec, currentLocL, detailLocL);
          locL = detailLocL;
        }
      } catch (err) {
        console.warn('JourneyDetails failed:', err);
      }
    }

    legs.push({ jny, stops, sec, locL });
  }

  // Render all legs with transfer separators
  tbody.innerHTML = '';
  let globalIdx = 0;

  for (let legN = 0; legN < legs.length; legN++) {
    const { jny, stops, locL } = legs[legN];
    const dir = jny.dirTxt || jny.dir || '—';
    const trainName = jny.prod?.name || jny.prod?.catOut || '';

    // Leg header row
    const headerTr = document.createElement('tr');
    headerTr.innerHTML =
      '<td colspan="5" style="background-color:#454545;color:white;padding:3px 5px;font-weight:bold;">' +
      '&#9658; ' + (trainName ? trainName + ' &nbsp;&rarr;&nbsp; ' : '') + dir +
      '</td>';
    tbody.appendChild(headerTr);

    if (stops.length > 0) {
      renderStopList(stops, tbody, locL, globalIdx);
      globalIdx += stops.length;
    } else {
      // bare dep/arr fallback for this leg
      const dep = legs[legN].sec.dep || {};
      const arr = legs[legN].sec.arr || {};
      const cls0 = globalIdx % 2 === 0 ? 'resultlight' : 'resultdark';
      const cls1 = (globalIdx + 1) % 2 === 0 ? 'resultlight' : 'resultdark';
      const tr1 = document.createElement('tr');
      tr1.innerHTML = '<td class="' + cls0 + '"><b>' + (dep.loc?.name || '—') + '</b></td>' +
        '<td class="' + cls0 + '" align="center">-</td>' +
        '<td class="' + cls0 + '" align="center"><b>' + formatTime(stopTime(dep, 'd')) + '</b></td>' +
        '<td class="' + cls0 + '" align="center">-</td><td class="' + cls0 + '" align="center">-</td>';
      const tr2 = document.createElement('tr');
      tr2.innerHTML = '<td class="' + cls1 + '"><b>' + (arr.loc?.name || '—') + '</b></td>' +
        '<td class="' + cls1 + '" align="center"><b>' + formatTime(stopTime(arr, 'a')) + '</b></td>' +
        '<td class="' + cls1 + '" align="center">-</td>' +
        '<td class="' + cls1 + '" align="center">-</td><td class="' + cls1 + '" align="center">-</td>';
      tbody.appendChild(tr1);
      tbody.appendChild(tr2);
      globalIdx += 2;
    }

    // Transfer separator between legs
    if (legN < legs.length - 1) {
      const nextLeg = legs[legN + 1];
      const lastStop = stops[stops.length - 1];
      const firstNext = nextLeg.stops[0];
      let waitMins = '';
      if (lastStop && firstNext) {
        const arrT = stopTime(lastStop, 'a') || stopTime(lastStop, 'd');
        const depT = stopTime(firstNext, 'd') || stopTime(firstNext, 'a');
        if (arrT && depT) {
          const a = parseInt(arrT.substring(0, 2)) * 60 + parseInt(arrT.substring(2, 4));
          const d = parseInt(depT.substring(0, 2)) * 60 + parseInt(depT.substring(2, 4));
          const diff = d - a;
          if (diff >= 0) waitMins = ' (' + diff + ' min oczekiwania)';
        }
      }
      const xferName = lastStop
        ? (resolveStopName(lastStop, locL) || '—')
        : '—';
      const xferTr = document.createElement('tr');
      xferTr.innerHTML =
        '<td colspan="5" style="background-color:#9E9E9E;color:white;padding:3px 5px;font-style:italic;">' +
        '&#8646; Przesiadka: ' + xferName + waitMins +
        '</td>';
      tbody.appendChild(xferTr);
    }
  }
}

// Last-resort fallback: dep/arr per leg, or inline stopL if available
function renderStaticJourneyDetails(secL) {
  const tbody = document.getElementById('journey-stops-tbody');
  tbody.innerHTML = '';
  document.getElementById('journey-details-header-label').innerHTML = '&nbsp;&nbsp;Szczegóły trasy połączenia';
  document.getElementById('journey-info-panel').innerHTML = '<i>Widok uproszczony — pełna lista przystanków niedostępna.</i>';

  let idx = 0;
  secL.forEach(sec => {
    const jny = sec.jny || sec.journey;

    if (sec.type === 'WALK') {
      const cls = idx % 2 === 0 ? 'resultlight' : 'resultdark';
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="' + cls + '" colspan="3"><i>Przejście piesze (przesiadka)</i></td>' +
        '<td class="' + cls + '" align="center">' + (sec.gis?.dist ? sec.gis.dist + ' m' : '-') + '</td>' +
        '<td class="' + cls + '" align="center">-</td>';
      tbody.appendChild(tr); idx++;
      return;
    }

    // If inline stopL is available for this leg, use it
    if (jny?.stopL?.length > 0) {
      jny.stopL.forEach(stop => {
        const cls = idx % 2 === 0 ? 'resultlight' : 'resultdark';
        const arrRaw = stopTime(stop, 'a');
        const depRaw = stopTime(stop, 'd');
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td class="' + cls + '"><b>' + resolveStopName(stop, currentLocL) + '</b></td>' +
          '<td class="' + cls + '" align="center">' + formatStopTime(stop, 'a') + '</td>' +
          '<td class="' + cls + '" align="center">' + formatStopTime(stop, 'd') + '</td>' +
          '<td class="' + cls + '" align="center">-</td>' +
        '<td class="' + cls + '" align="center">' + formatPlatform(stop.aPlatfS || stop.dPlatfS || stop.platfS) + '</td>';
        tbody.appendChild(tr); idx++;
      });
      return;
    }

    // Bare minimum: departure row then arrival row
    const dep = sec.dep || {};
    const arr = sec.arr || {};
    const depCls = idx % 2 === 0 ? 'resultlight' : 'resultdark';
    const trDep = document.createElement('tr');
    trDep.innerHTML =
      '<td class="' + depCls + '"><b>' + (dep.loc?.name || '—') + '</b></td>' +
      '<td class="' + depCls + '" align="center">-</td>' +
      '<td class="' + depCls + '" align="center"><b>' + formatTime(stopTime(dep, 'd')) + '</b></td>' +
      '<td class="' + depCls + '" align="center">-</td>' +
      '<td class="' + depCls + '" align="center">' + formatPlatform(dep.dPlatfS || dep.platfS) + '</td>';
    tbody.appendChild(trDep); idx++;

    const arrCls = idx % 2 === 0 ? 'resultlight' : 'resultdark';
    const trArr = document.createElement('tr');
    trArr.innerHTML =
      '<td class="' + arrCls + '"><b>' + (arr.loc?.name || '—') + '</b></td>' +
      '<td class="' + arrCls + '" align="center"><b>' + formatTime(stopTime(arr, 'a')) + '</b></td>' +
      '<td class="' + arrCls + '" align="center">-</td>' +
      '<td class="' + arrCls + '" align="center">-</td>' +
      '<td class="' + arrCls + '" align="center">' + formatPlatform(arr.aPlatfS || arr.platfS) + '</td>';
    tbody.appendChild(trArr); idx++;
  });
}

// Station Departures / Arrivals Search
async function handleStationBoardSearch(e) {
  e.preventDefault();
  const stationName = document.getElementById('station-name').value.trim();
  const isDep = document.getElementById('board-dep').checked;
  const timeVal = document.getElementById('station-time').value.trim();
  
  if (!stationName) {
    alert('Proszę podać nazwę stacji.');
    return;
  }

  const resultsBox = document.getElementById('station-board-results-box');
  const tbody = document.getElementById('station-board-results-tbody');
  
  tbody.innerHTML = `
    <tr>
      <td colspan="4" align="center" style="background-color: white; padding: 15px;">Pobieranie rozkładu stacyjnego...</td>
    </tr>
  `;
  resultsBox.style.display = 'block';
  
  const modeText = isDep ? 'Odjazdy' : 'Przyjazdy';
  document.getElementById('station-board-title-label').innerText = `${modeText} ze stacji ${stationName}`;

  try {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const dateQuery = `${year}${month}${day}`;
    const timeQuery = parseTimeInput(timeVal);

    const stationParam = stationLoc && stationLoc.name === stationName
      ? { type: 'S', lid: stationLoc.lid, extId: stationLoc.extId }
      : { type: 'S', name: stationName };

    const payload = {
      svcReqL: [{
        meth: 'StationBoard',
        req: {
          type: isDep ? 'DEP' : 'ARR',
          stbLoc: stationParam,
          date: dateQuery,
          time: timeQuery
        }
      }],
      client: { id: 'PKP', v: '1.0' },
      ver: '1.42',
      lang: 'pl'
    };

    const data = await callHafas(payload);
    const list = data?.svcResL?.[0]?.res?.jnyL || [];

    tbody.innerHTML = '';
    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" align="center" style="background-color: white; padding: 10px;">Brak pociągów do wyświetlenia w najbliższym czasie.</td>
        </tr>
      `;
      return;
    }

    const common = data?.svcResL?.[0]?.res?.common;

    list.forEach((item, index) => {
      const trColorClass = index % 2 === 0 ? 'resultlight' : 'resultdark';
      
      const time = stopTime(item.stbStop, 'd') || stopTime(item.stbStop, 'a') || item.date || '';
      const prod = common?.prodL?.[item.prodX];
      const train = prod?.name || prod?.prodCtx?.name || 'Pociąg';
      
      // If it is Departures (DEP), show destination. If Arrivals (ARR), show origin.
      const direction = item.dirTxt || item.dir || '—';
      
      const features = (item.prodL?.[0]?.addName || []).join(', ') || 'Standardowy';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="${trColorClass}" align="center"><b>${formatTime(time)}</b></td>
        <td class="${trColorClass}"><b>${train}</b></td>
        <td class="${trColorClass}">${direction}</td>
        <td class="${trColorClass}">${features}</td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" align="center" style="background-color: white; color: red; padding: 10px;">
          Błąd pobierania tablicy: ${err.message}
        </td>
      </tr>
    `;
  }
}
