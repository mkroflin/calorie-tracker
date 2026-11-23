/**
 * GOOGLE APPS SCRIPT - PRAĆENJE KALORIJA DASHBOARD
 * 
 * Upute za postavljanje:
 * 1. U svojoj Google tablici otvori: Extensions (Proširenja) -> Apps Script
 * 2. Obriši sav postojeći tekst u Code.gs i zalijepi sav sadržaj ove datoteke.
 * 3. Klikni plavi gumb "Save" (ikona diskete).
 * 4. U gornjem desnom kutu klikni "Deploy" -> "New deployment".
 * 5. Klikni na ikonu zupčanika pored "Select type" -> odaberi "Web app".
 * 6. Postavke:
 *    - Description: "Calorie Tracker Dashboard"
 *    - Execute as: "Me" (Ja)
 *    - Who has access: "Only myself" (Samo ja)  <-- Za 100% privatnost!
 * 7. Klikni "Deploy" i autoriziraj pristup svom Google računu.
 * 8. Dobit ćeš privatni URL koji možeš otvoriti na svom mobitelu!
 */

function doGet(e) {
  // Ako je poziv za dodavanje retka hrane: ?action=add&date=...&name=...&qty=...&p=...&c=...&f=...&kcal=...
  if (e && e.parameter && e.parameter.action === "add") {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById("1d50JU6jF67O3E-kT6pf3fM-fVy8AjQKN_9d71HzZu_I");
      const podaciSheet = ss.getSheetByName("Podaci") || ss.getSheets()[0];
      
      const date = e.parameter.date || formatDateValue(new Date());
      const name = e.parameter.name || "";
      const qty = e.parameter.qty || "1";
      const p = parseNumericValue(e.parameter.p);
      const c = parseNumericValue(e.parameter.c);
      const f = parseNumericValue(e.parameter.f);
      const kcal = parseNumericValue(e.parameter.kcal);
      
      podaciSheet.appendRow([date, name, qty, p, c, f, kcal]);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Uspješno dodano u tablicu!",
        row: [date, name, qty, p, c, f, kcal]
      })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: err.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  const data = getCalorieReportData();
  const html = buildHtmlDashboard(data);
  return HtmlService.createHtmlOutput(html)
    .setTitle('Praćenje Kalorija & Makronutrijenata')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
}

// Funkcija za asinkrono osvježavanje podataka izravno iz klijenta (klik na gumb "Osvježi")
function apiGetLatestData() {
  return getCalorieReportData();
}

function formatDateValue(val) {
  if (!val) return '';
  if (val instanceof Date) {
    const day = val.getDate();
    const month = val.getMonth() + 1;
    const year = val.getFullYear();
    return day + '.' + month + '.' + year + '.';
  }
  return String(val).trim();
}

function parseNumericValue(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return Math.round(val * 100) / 100;
  let s = String(val).trim().replace(/\s/g, '');
  if (s.indexOf('#') !== -1) return 0;
  if (s.indexOf(',') !== -1 && s.indexOf('.') !== -1) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.indexOf(',') !== -1) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

function getCalorieReportData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById('1d50JU6jF67O3E-kT6pf3fM-fVy8AjQKN_9d71HzZu_I');
  
  // 1. Čitanje taba Total
  const totalSheet = ss.getSheetByName('Total') || ss.getSheets()[1];
  const totalValues = totalSheet ? totalSheet.getDataRange().getValues() : [];
  
  const dailyTotals = [];
  const weeklyTotals = [];
  
  for (let i = 1; i < totalValues.length; i++) {
    const r = totalValues[i];
    if (!r || r.length === 0) continue;
    
    // Dnevni podaci (stupci 0-6)
    const dateStr = formatDateValue(r[0]);
    const kcal = parseNumericValue(r[4]);
    if (dateStr && kcal > 0) {
      dailyTotals.push({
        date: dateStr,
        p: parseNumericValue(r[1]),
        c: parseNumericValue(r[2]),
        f: parseNumericValue(r[3]),
        kcal: kcal,
        active: parseNumericValue(r[5]),
        net: parseNumericValue(r[6])
      });
    }
    
    // Tjedni podaci (stupci 9-15)
    if (r.length > 13) {
      const weekDate = formatDateValue(r[9]);
      const weekKcal = parseNumericValue(r[13]);
      if (weekDate && weekKcal > 0) {
        weeklyTotals.push({
          week: weekDate,
          p: parseNumericValue(r[10]),
          c: parseNumericValue(r[11]),
          f: parseNumericValue(r[12]),
          kcal: weekKcal,
          active: parseNumericValue(r[14]),
          net: parseNumericValue(r[15])
        });
      }
    }
  }
  
  // 2. Čitanje taba Podaci
  const podaciSheet = ss.getSheetByName('Podaci') || ss.getSheets()[0];
  const podaciValues = podaciSheet ? podaciSheet.getDataRange().getValues() : [];
  
  const mealsByDate = {};
  const foodStats = {};
  
  for (let j = 1; j < podaciValues.length; j++) {
    const row = podaciValues[j];
    if (!row || row.length === 0) continue;
    
    const dateVal = formatDateValue(row[0]);
    const nameVal = row[1] ? String(row[1]).trim() : '';
    const qtyVal = row[2] ? String(row[2]).trim() : '';
    const pVal = parseNumericValue(row[3]);
    const cVal = parseNumericValue(row[4]);
    const fVal = parseNumericValue(row[5]);
    const kcalVal = parseNumericValue(row[6]);
    
    if (dateVal) {
      if (!mealsByDate[dateVal]) mealsByDate[dateVal] = [];
      mealsByDate[dateVal].push({
        name: nameVal,
        qty: qtyVal,
        p: pVal,
        c: cVal,
        f: fVal,
        kcal: kcalVal
      });
    }
    
    if (nameVal) {
      if (!foodStats[nameVal]) {
        foodStats[nameVal] = { count: 0, total_kcal: 0, total_p: 0 };
      }
      foodStats[nameVal].count++;
      foodStats[nameVal].total_kcal += kcalVal;
      foodStats[nameVal].total_p += pVal;
    }
  }
  
  const topFoods = [];
  for (const name in foodStats) {
    topFoods.push({
      name: name,
      count: foodStats[name].count,
      total_kcal: Math.round(foodStats[name].total_kcal * 10) / 10,
      total_p: Math.round(foodStats[name].total_p * 10) / 10
    });
  }
  topFoods.sort((a, b) => b.count - a.count);
  
  const now = new Date();
  const generatedAt = now.getDate() + '.' + (now.getMonth() + 1) + '.' + now.getFullYear() + '. ' + 
                      String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  
  return {
    generated_at: generatedAt,
    daily: dailyTotals,
    weekly: weeklyTotals,
    meals_by_date: mealsByDate,
    top_foods: topFoods,
    spreadsheet_id: ss.getId()
  };
}

function buildHtmlDashboard(data) {
  const jsonData = JSON.stringify(data);
  
  return `<!DOCTYPE html>
<html lang="hr" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Praćenje Kalorija Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #131c2e;
      --border: #233047;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
    }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      -webkit-tap-highlight-color: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar {
      width: 5px;
      height: 5px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #334155;
      border-radius: 4px;
    }
  </style>
</head>
<body class="p-3 sm:p-5 lg:p-8 min-h-screen">
  <div class="max-w-6xl mx-auto space-y-4 sm:space-y-6">
    
    <!-- Top Header -->
    <header class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--border)]">
      <div class="flex items-center gap-3">
        <span class="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 font-bold text-xl">🥗</span>
        <div>
          <h1 class="text-xl sm:text-2xl font-black tracking-tight text-white">Kalorije & Makronutrijenti</h1>
          <p class="text-xs text-[var(--text-muted)]">Privatni Google Sheets Dashboard &bull; Uživo</p>
        </div>
      </div>
      
      <div class="flex items-center gap-2">
        <button id="refreshBtn" onclick="refreshData()" class="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition active:scale-95 shadow-sm">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          <span id="refreshBtnText">Osvježi Podatke</span>
        </button>
        <span class="text-[11px] text-[var(--text-muted)] bg-[var(--card-bg)] px-2.5 py-2 rounded-lg border border-[var(--border)]" id="syncTime">
          ${data.generated_at}
        </span>
      </div>
    </header>

    <!-- Period Filters -->
    <div class="flex flex-wrap items-center justify-between gap-2 bg-[var(--card-bg)] p-2.5 rounded-xl border border-[var(--border)]">
      <div class="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-0.5">
        <button onclick="setFilter('all')" id="btn-all" class="filter-btn text-xs px-3 py-1.5 rounded-lg font-medium bg-sky-500 text-white transition whitespace-nowrap">Sve (${data.daily.length} dana)</button>
        <button onclick="setFilter(30)" id="btn-30" class="filter-btn text-xs px-3 py-1.5 rounded-lg font-medium text-[var(--text-muted)] hover:bg-slate-800 transition whitespace-nowrap">Zadnjih 30 dana</button>
        <button onclick="setFilter(14)" id="btn-14" class="filter-btn text-xs px-3 py-1.5 rounded-lg font-medium text-[var(--text-muted)] hover:bg-slate-800 transition whitespace-nowrap">Zadnjih 14 dana</button>
        <button onclick="setFilter(7)" id="btn-7" class="filter-btn text-xs px-3 py-1.5 rounded-lg font-medium text-[var(--text-muted)] hover:bg-slate-800 transition whitespace-nowrap">Zadnjih 7 dana</button>
      </div>
      <div class="text-[11px] text-[var(--text-muted)] px-1">
        Prikaz: <span class="text-slate-200 font-semibold" id="displayedDaysCount">${data.daily.length}</span> dana
      </div>
    </div>

    <!-- KPI Metric Cards -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
      <div class="bg-[var(--card-bg)] p-3 sm:p-4 rounded-xl border border-[var(--border)]">
        <div class="text-[11px] font-medium text-[var(--text-muted)]">Dnevni Prosjek</div>
        <div class="text-xl sm:text-2xl font-black mt-1 text-purple-400" id="cardKcal">-</div>
        <div class="text-[10px] text-[var(--text-muted)] mt-0.5">Kalorije</div>
      </div>

      <div class="bg-[var(--card-bg)] p-3 sm:p-4 rounded-xl border border-[var(--border)]">
        <div class="text-[11px] font-medium text-rose-400">Proteini</div>
        <div class="text-xl sm:text-2xl font-black mt-1 text-rose-400" id="cardProteini">-</div>
        <div class="text-[10px] text-[var(--text-muted)] mt-0.5" id="cardProteiniPct">-</div>
      </div>

      <div class="bg-[var(--card-bg)] p-3 sm:p-4 rounded-xl border border-[var(--border)]">
        <div class="text-[11px] font-medium text-sky-400">Ugljikohidrati</div>
        <div class="text-xl sm:text-2xl font-black mt-1 text-sky-400" id="cardCarbs">-</div>
        <div class="text-[10px] text-[var(--text-muted)] mt-0.5" id="cardCarbsPct">-</div>
      </div>

      <div class="bg-[var(--card-bg)] p-3 sm:p-4 rounded-xl border border-[var(--border)]">
        <div class="text-[11px] font-medium text-amber-400">Masti</div>
        <div class="text-xl sm:text-2xl font-black mt-1 text-amber-400" id="cardFats">-</div>
        <div class="text-[10px] text-[var(--text-muted)] mt-0.5" id="cardFatsPct">-</div>
      </div>

      <div class="bg-[var(--card-bg)] p-3 sm:p-4 rounded-xl border border-[var(--border)]">
        <div class="text-[11px] font-medium text-emerald-400">Aktivna Potrošnja</div>
        <div class="text-xl sm:text-2xl font-black mt-1 text-emerald-400" id="cardActive">-</div>
        <div class="text-[10px] text-[var(--text-muted)] mt-0.5">Aktivne kalorije</div>
      </div>

      <div class="bg-[var(--card-bg)] p-3 sm:p-4 rounded-xl border border-[var(--border)]">
        <div class="text-[11px] font-medium text-indigo-400">Neto Unos</div>
        <div class="text-xl sm:text-2xl font-black mt-1 text-indigo-400" id="cardNet">-</div>
        <div class="text-[10px] text-[var(--text-muted)] mt-0.5">Kcal minus aktivne</div>
      </div>
    </div>

    <!-- Charts Section -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
      <!-- Daily Calories Timeline -->
      <div class="lg:col-span-2 bg-[var(--card-bg)] p-4 sm:p-5 rounded-xl border border-[var(--border)] space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm sm:text-base font-bold text-white">Dnevni Unos Kalorija</h2>
            <p class="text-[11px] text-[var(--text-muted)]">Kretanje unosa kroz odabrani period</p>
          </div>
          <div class="flex items-center gap-3 text-[11px]">
            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-purple-500"></span> Kalorije</span>
            <span class="flex items-center gap-1.5"><span class="w-3 h-0.5 bg-rose-400 border border-dashed border-rose-400"></span> Prosjek</span>
          </div>
        </div>
        <div class="w-full h-56 sm:h-64 relative">
          <canvas id="timelineChart" class="w-full h-full"></canvas>
        </div>
      </div>

      <!-- Macro Donut Chart -->
      <div class="bg-[var(--card-bg)] p-4 sm:p-5 rounded-xl border border-[var(--border)] flex flex-col justify-between">
        <div>
          <h2 class="text-sm sm:text-base font-bold text-white">Raspodjela Makronutrijenata</h2>
          <p class="text-[11px] text-[var(--text-muted)]">Udio u ukupnom kalorijskom unosu</p>
          <div class="w-full h-44 sm:h-48 relative mt-1 flex items-center justify-center">
            <canvas id="macroDonutChart" class="w-full h-full"></canvas>
          </div>
        </div>
        
        <div class="space-y-1.5 mt-3 pt-3 border-t border-[var(--border)] text-xs">
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Proteini</span>
            <span class="font-bold font-mono" id="donutProteinVal">-</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-sky-500"></span> Ugljikohidrati</span>
            <span class="font-bold font-mono" id="donutCarbVal">-</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Masti</span>
            <span class="font-bold font-mono" id="donutFatVal">-</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Weekly & Top Foods -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      <!-- Weekly Averages -->
      <div class="bg-[var(--card-bg)] p-4 sm:p-5 rounded-xl border border-[var(--border)] space-y-3">
        <div>
          <h2 class="text-sm sm:text-base font-bold text-white">Tjedni Prosjeci</h2>
          <p class="text-[11px] text-[var(--text-muted)]">Prosječan dnevni unos po tjednima (iz taba 'Total')</p>
        </div>
        <div class="w-full h-56 relative">
          <canvas id="weeklyChart" class="w-full h-full"></canvas>
        </div>
      </div>

      <!-- Top Foods Table -->
      <div class="bg-[var(--card-bg)] p-4 sm:p-5 rounded-xl border border-[var(--border)] space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm sm:text-base font-bold text-white">Najčešće Konzumirano</h2>
            <p class="text-[11px] text-[var(--text-muted)]">Top 10 namirnica po učestalosti</p>
          </div>
          <span class="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">Baza obroka</span>
        </div>
        
        <div class="overflow-y-auto max-h-56 custom-scrollbar">
          <table class="w-full text-xs">
            <thead class="text-[var(--text-muted)] border-b border-[var(--border)] sticky top-0 bg-[var(--card-bg)]">
              <tr>
                <th class="text-left py-1.5">Namirnica</th>
                <th class="text-center py-1.5">Unosa</th>
                <th class="text-right py-1.5">Ukupno Kcal</th>
                <th class="text-right py-1.5">Proteina</th>
              </tr>
            </thead>
            <tbody id="topFoodsTable" class="divide-y divide-slate-800/80">
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Daily Meal Inspector -->
    <div class="bg-[var(--card-bg)] p-4 sm:p-5 rounded-xl border border-[var(--border)] space-y-3">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 class="text-sm sm:text-base font-bold text-white">Dnevnik Po Danima (Preglednik Obroka)</h2>
          <p class="text-[11px] text-[var(--text-muted)]">Klikni na bilo koji datum za detaljan popis pojedenog</p>
        </div>
        <input type="text" id="foodSearchInput" oninput="searchFood()" placeholder="Pretraži hranu..." class="bg-slate-900 border border-[var(--border)] rounded-lg px-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 w-full sm:w-56" />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <!-- Days List -->
        <div class="lg:col-span-2 overflow-x-auto max-h-80 custom-scrollbar border border-[var(--border)] rounded-lg">
          <table class="w-full text-xs text-left">
            <thead class="bg-slate-800/90 text-[var(--text-muted)] sticky top-0 backdrop-blur z-10 border-b border-[var(--border)]">
              <tr>
                <th class="p-2">Datum</th>
                <th class="p-2 text-right text-rose-400">Proteini</th>
                <th class="p-2 text-right text-sky-400">UH</th>
                <th class="p-2 text-right text-amber-400">Masti</th>
                <th class="p-2 text-right text-purple-400 font-bold">Kalorije</th>
                <th class="p-2 text-right text-emerald-400">Aktivne</th>
                <th class="p-2 text-right text-indigo-400">Neto</th>
              </tr>
            </thead>
            <tbody id="dailyTableBody" class="divide-y divide-slate-800/80">
            </tbody>
          </table>
        </div>

        <!-- Meals Drawer -->
        <div class="bg-slate-900/80 p-3.5 rounded-lg border border-[var(--border)] flex flex-col justify-between max-h-80">
          <div>
            <div class="flex items-center justify-between pb-2.5 border-b border-[var(--border)]">
              <div>
                <span class="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">Odabrani datum</span>
                <div class="text-sm font-bold text-sky-400" id="selectedDateTitle">-</div>
              </div>
              <span class="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono font-bold" id="selectedDateKcal">-</span>
            </div>
            
            <div class="overflow-y-auto max-h-56 custom-scrollbar mt-2.5 space-y-1.5" id="selectedDayMealsList">
              <div class="text-xs text-[var(--text-muted)] text-center py-6">Klikni na dan s lijeve strane za prikaz obroka</div>
            </div>
          </div>
          
          <div class="pt-2.5 border-t border-[var(--border)] text-[10px] text-[var(--text-muted)] flex justify-between">
            <span>Stavki unosa: <strong class="text-slate-200" id="selectedMealCount">0</strong></span>
            <span>Tab 'Podaci'</span>
          </div>
        </div>
      </div>
    </div>

  </div>

  <script>
    let reportData = ${jsonData};
    let currentFilter = 'all';
    let filteredDaily = [...reportData.daily];
    let selectedDate = null;

    function init() {
      applyFilter('all');
      renderWeeklyChart();
      renderTopFoods();
      if (filteredDaily.length > 0) {
        selectDay(filteredDaily[filteredDaily.length - 1].date);
      }
    }

    function setFilter(val) {
      document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.remove('bg-sky-500', 'text-white');
        b.classList.add('text-[var(--text-muted)]');
      });
      const activeBtn = document.getElementById('btn-' + val);
      if (activeBtn) {
        activeBtn.classList.remove('text-[var(--text-muted)]');
        activeBtn.classList.add('bg-sky-500', 'text-white');
      }
      applyFilter(val);
    }

    function applyFilter(filter) {
      currentFilter = filter;
      if (filter === 'all') {
        filteredDaily = [...reportData.daily];
      } else {
        const count = parseInt(filter);
        filteredDaily = reportData.daily.slice(-count);
      }

      document.getElementById('displayedDaysCount').innerText = filteredDaily.length;
      updateMetrics();
      renderTimelineChart();
      renderMacroDonut();
      renderDailyTable();
    }

    function updateMetrics() {
      if (filteredDaily.length === 0) return;
      const count = filteredDaily.length;
      let totalKcal = 0, totalP = 0, totalC = 0, totalF = 0, totalActive = 0, totalNet = 0;
      let activeDaysCount = 0;

      filteredDaily.forEach(d => {
        totalKcal += d.kcal;
        totalP += d.p;
        totalC += d.c;
        totalF += d.f;
        if (d.active > 0) {
          totalActive += d.active;
          activeDaysCount++;
        }
        if (d.net > 0) totalNet += d.net;
      });

      const avgKcal = Math.round(totalKcal / count);
      const avgP = Math.round(totalP / count);
      const avgC = Math.round(totalC / count);
      const avgF = Math.round(totalF / count);
      const avgActive = activeDaysCount > 0 ? Math.round(totalActive / activeDaysCount) : 0;
      const avgNet = Math.round(totalNet / count);

      const kcalP = avgP * 4;
      const kcalC = avgC * 4;
      const kcalF = avgF * 9;
      const totalMacroKcal = kcalP + kcalC + kcalF || 1;

      document.getElementById('cardKcal').innerText = avgKcal.toLocaleString('hr-HR') + ' kcal';
      document.getElementById('cardProteini').innerText = avgP + ' g';
      document.getElementById('cardProteiniPct').innerText = Math.round((kcalP / totalMacroKcal) * 100) + '% kalorija';
      
      document.getElementById('cardCarbs').innerText = avgC + ' g';
      document.getElementById('cardCarbsPct').innerText = Math.round((kcalC / totalMacroKcal) * 100) + '% kalorija';

      document.getElementById('cardFats').innerText = avgF + ' g';
      document.getElementById('cardFatsPct').innerText = Math.round((kcalF / totalMacroKcal) * 100) + '% kalorija';

      document.getElementById('cardActive').innerText = avgActive > 0 ? avgActive.toLocaleString('hr-HR') + ' kcal' : 'N/A';
      document.getElementById('cardNet').innerText = avgNet.toLocaleString('hr-HR') + ' kcal';

      document.getElementById('donutProteinVal').innerText = avgP + 'g (' + Math.round((kcalP / totalMacroKcal) * 100) + '%)';
      document.getElementById('donutCarbVal').innerText = avgC + 'g (' + Math.round((kcalC / totalMacroKcal) * 100) + '%)';
      document.getElementById('donutFatVal').innerText = avgF + 'g (' + Math.round((kcalF / totalMacroKcal) * 100) + '%)';
    }

    function renderTimelineChart() {
      const canvas = document.getElementById('timelineChart');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);
      if (filteredDaily.length === 0) return;

      const padL = 40, padR = 10, padT = 15, padB = 25;
      const chartW = w - padL - padR;
      const chartH = h - padT - padB;

      const maxKcal = Math.max(...filteredDaily.map(d => d.kcal), 4000);
      const minKcal = Math.min(...filteredDaily.map(d => d.kcal), 1500) * 0.85;

      const getY = (val) => padT + chartH - ((val - minKcal) / (maxKcal - minKcal)) * chartH;
      const getX = (i) => padL + (i / Math.max(1, filteredDaily.length - 1)) * chartW;

      ctx.strokeStyle = '#233047';
      ctx.lineWidth = 1;
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';

      for (let s = 0; s <= 4; s++) {
        const v = minKcal + (s / 4) * (maxKcal - minKcal);
        const y = getY(v);
        ctx.beginPath();
        ctx.setLineDash([3, 3]);
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.stroke();
        ctx.fillText(Math.round(v), padL - 5, y + 3);
      }
      ctx.setLineDash([]);

      const avg = filteredDaily.reduce((a, b) => a + b.kcal, 0) / filteredDaily.length;
      const avgY = getY(avg);
      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padL, avgY);
      ctx.lineTo(w - padR, avgY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      filteredDaily.forEach((d, i) => {
        const x = getX(i);
        const y = getY(d.kcal);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.lineTo(getX(filteredDaily.length - 1), getY(minKcal));
      ctx.lineTo(getX(0), getY(minKcal));
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, padT, 0, h - padB);
      grad.addColorStop(0, 'rgba(168, 85, 247, 0.35)');
      grad.addColorStop(1, 'rgba(168, 85, 247, 0.0)');
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2.5;
      filteredDaily.forEach((d, i) => {
        const x = getX(i);
        const y = getY(d.kcal);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      if (filteredDaily.length <= 35) {
        filteredDaily.forEach((d, i) => {
          const x = getX(i);
          const y = getY(d.kcal);
          ctx.fillStyle = '#a855f7';
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      ctx.textAlign = 'center';
      ctx.fillStyle = '#64748b';
      const labelInterval = Math.ceil(filteredDaily.length / 7);
      filteredDaily.forEach((d, i) => {
        if (i % labelInterval === 0 || i === filteredDaily.length - 1) {
          const parts = d.date.split('.');
          ctx.fillText(parts[0] + '.' + parts[1], getX(i), h - 8);
        }
      });
    }

    function renderMacroDonut() {
      const canvas = document.getElementById('macroDonutChart');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);
      if (filteredDaily.length === 0) return;

      const count = filteredDaily.length;
      let totalP = 0, totalC = 0, totalF = 0;
      filteredDaily.forEach(d => {
        totalP += d.p;
        totalC += d.c;
        totalF += d.f;
      });

      const kcalP = (totalP / count) * 4;
      const kcalC = (totalC / count) * 4;
      const kcalF = (totalF / count) * 9;
      const total = kcalP + kcalC + kcalF || 1;

      const slices = [
        { val: kcalP, color: '#f43f5e' },
        { val: kcalC, color: '#38bdf8' },
        { val: kcalF, color: '#fbbf24' }
      ];

      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(w, h) * 0.44;
      const innerR = r * 0.65;

      let startAngle = -Math.PI / 2;
      slices.forEach(s => {
        const angle = (s.val / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, startAngle, startAngle + angle);
        ctx.arc(cx, cy, innerR, startAngle + angle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = s.color;
        ctx.fill();
        startAngle += angle;
      });

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(Math.round(total) + ' kcal', cx, cy - 4);
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('prosjek', cx, cy + 12);
    }

    function renderWeeklyChart() {
      const canvas = document.getElementById('weeklyChart');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);

      const weeks = reportData.weekly;
      if (!weeks || weeks.length === 0) return;

      const padL = 35, padR = 10, padT = 15, padB = 25;
      const chartW = w - padL - padR;
      const chartH = h - padT - padB;

      const maxKcal = Math.max(...weeks.map(w => w.kcal), 4000);
      const barW = Math.max(10, (chartW / weeks.length) * 0.55);

      weeks.forEach((wk, i) => {
        const x = padL + (i + 0.5) * (chartW / weeks.length) - barW / 2;
        const barH = (wk.kcal / maxKcal) * chartH;
        const y = padT + chartH - barH;

        const grad = ctx.createLinearGradient(0, y, 0, y + barH);
        grad.addColorStop(0, '#38bdf8');
        grad.addColorStop(1, '#0284c7');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, y, barW, barH, [3, 3, 0, 0]) : ctx.rect(x, y, barW, barH);
        ctx.fill();

        ctx.fillStyle = '#f8fafc';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(Math.round(wk.kcal), x + barW / 2, y - 4);

        ctx.fillStyle = '#64748b';
        const parts = wk.week.split('.');
        ctx.fillText(parts[0] + '.' + parts[1], x + barW / 2, h - 8);
      });
    }

    function renderTopFoods() {
      const tbody = document.getElementById('topFoodsTable');
      if (!tbody) return;
      tbody.innerHTML = '';
      reportData.top_foods.slice(0, 10).forEach((item, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/50 transition cursor-pointer';
        tr.onclick = () => {
          document.getElementById('foodSearchInput').value = item.name;
          searchFood();
        };
        tr.innerHTML = `
          <td class="py-1.5 flex items-center gap-1.5">
            <span class="w-4 h-4 rounded bg-slate-800 text-[10px] text-slate-400 flex items-center justify-center font-mono">${idx + 1}</span>
            <span class="font-medium text-slate-200">${item.name}</span>
          </td>
          <td class="py-1.5 text-center font-mono font-semibold text-sky-400">${item.count}x</td>
          <td class="py-1.5 text-right font-mono text-purple-300">${Math.round(item.total_kcal).toLocaleString('hr-HR')}</td>
          <td class="py-1.5 text-right font-mono text-rose-400">${Math.round(item.total_p).toLocaleString('hr-HR')} g</td>
        `;
        tbody.appendChild(tr);
      });
    }

    function renderDailyTable() {
      const tbody = document.getElementById('dailyTableBody');
      if (!tbody) return;
      tbody.innerHTML = '';
      
      const reversed = [...filteredDaily].reverse();
      reversed.forEach(d => {
        const tr = document.createElement('tr');
        tr.id = 'row-' + d.date;
        tr.className = 'hover:bg-slate-800/60 transition cursor-pointer ' + (selectedDate === d.date ? 'bg-slate-800/90 font-semibold' : '');
        tr.onclick = () => selectDay(d.date);
        tr.innerHTML = `
          <td class="p-2 font-medium flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full ${selectedDate === d.date ? 'bg-sky-400' : 'bg-transparent'}"></span>
            ${d.date}
          </td>
          <td class="p-2 text-right font-mono text-rose-400">${d.p}</td>
          <td class="p-2 text-right font-mono text-sky-400">${d.c}</td>
          <td class="p-2 text-right font-mono text-amber-400">${d.f}</td>
          <td class="p-2 text-right font-mono text-purple-400 font-bold">${d.kcal.toLocaleString('hr-HR')}</td>
          <td class="p-2 text-right font-mono text-emerald-400">${d.active > 0 ? d.active : '-'}</td>
          <td class="p-2 text-right font-mono text-indigo-400">${d.net > 0 ? d.net : '-'}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    function selectDay(date) {
      selectedDate = date;
      document.querySelectorAll('#dailyTableBody tr').forEach(r => r.classList.remove('bg-slate-800/90', 'font-semibold'));
      const activeRow = document.getElementById('row-' + date);
      if (activeRow) activeRow.classList.add('bg-slate-800/90', 'font-semibold');

      const dayObj = reportData.daily.find(d => d.date === date);
      document.getElementById('selectedDateTitle').innerText = date;
      document.getElementById('selectedDateKcal').innerText = dayObj ? dayObj.kcal.toLocaleString('hr-HR') + ' kcal' : '-';

      const meals = reportData.meals_by_date[date] || [];
      const listEl = document.getElementById('selectedDayMealsList');
      document.getElementById('selectedMealCount').innerText = meals.length;

      if (meals.length === 0) {
        listEl.innerHTML = '<div class="text-xs text-[var(--text-muted)] text-center py-6">Nema unesenih pojedinačnih stavki.</div>';
        return;
      }

      listEl.innerHTML = '';
      meals.forEach(m => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'p-2 rounded bg-slate-800/70 border border-slate-700/60 text-xs flex items-center justify-between gap-2';
        itemDiv.innerHTML = `
          <div>
            <div class="font-medium text-slate-100">${m.name}</div>
            <div class="text-[10px] text-slate-400">Količina: <span class="font-mono text-sky-400">${m.qty}</span></div>
          </div>
          <div class="text-right">
            <div class="font-bold font-mono text-purple-400">${m.kcal} kcal</div>
            <div class="text-[10px] text-slate-400 font-mono">P:${m.p} &bull; C:${m.c} &bull; F:${m.f}</div>
          </div>
        `;
        listEl.appendChild(itemDiv);
      });
    }

    function searchFood() {
      const query = document.getElementById('foodSearchInput').value.toLowerCase().trim();
      if (!query) {
        renderDailyTable();
        return;
      }
      const tbody = document.getElementById('dailyTableBody');
      tbody.innerHTML = '';

      const matchingDates = new Set();
      for (const [date, meals] of Object.entries(reportData.meals_by_date)) {
        if (meals.some(m => m.name.toLowerCase().includes(query))) {
          matchingDates.add(date);
        }
      }

      filteredDaily.filter(d => matchingDates.has(d.date)).reverse().forEach(d => {
        const tr = document.createElement('tr');
        tr.id = 'row-' + d.date;
        tr.className = 'hover:bg-slate-800/60 transition cursor-pointer ' + (selectedDate === d.date ? 'bg-slate-800/90 font-semibold' : '');
        tr.onclick = () => selectDay(d.date);
        tr.innerHTML = `
          <td class="p-2 font-medium flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
            ${d.date}
          </td>
          <td class="p-2 text-right font-mono text-rose-400">${d.p}</td>
          <td class="p-2 text-right font-mono text-sky-400">${d.c}</td>
          <td class="p-2 text-right font-mono text-amber-400">${d.f}</td>
          <td class="p-2 text-right font-mono text-purple-400 font-bold">${d.kcal.toLocaleString('hr-HR')}</td>
          <td class="p-2 text-right font-mono text-emerald-400">${d.active > 0 ? d.active : '-'}</td>
          <td class="p-2 text-right font-mono text-indigo-400">${d.net > 0 ? d.net : '-'}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    function refreshData() {
      const btn = document.getElementById('refreshBtn');
      const text = document.getElementById('refreshBtnText');
      text.innerText = 'Učitavam...';
      btn.classList.add('opacity-75');

      if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run
          .withSuccessHandler(function(newData) {
            reportData = newData;
            document.getElementById('syncTime').innerText = newData.generated_at;
            text.innerText = 'Osvježeno!';
            btn.classList.remove('opacity-75');
            setTimeout(() => { text.innerText = 'Osvježi Podatke'; }, 1500);
            init();
          })
          .withFailureHandler(function(err) {
            alert('Greška pri osvježavanju: ' + err.message);
            text.innerText = 'Osvježi Podatke';
            btn.classList.remove('opacity-75');
          })
          .apiGetLatestData();
      } else {
        location.reload();
      }
    }

    window.addEventListener('load', init);
    window.addEventListener('resize', () => {
      renderTimelineChart();
      renderMacroDonut();
      renderWeeklyChart();
    });
  </script>
</body>
</html>`;
}
