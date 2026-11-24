#!/usr/bin/env python3
"""
Calorie Tracker Report Generator
Fetches live data from Google Sheets (tabs Podaci, Total, Baza) and generates an interactive, modern HTML report.
"""

import sys
import os
import json
import csv
import urllib.request
from datetime import datetime

SPREADSHEET_ID = "1d50JU6jF67O3E-kT6pf3fM-fVy8AjQKN_9d71HzZu_I"
GID_PODACI = "0"
GID_TOTAL = "285713744"
GID_BAZA = "598716833"

def parse_num(v):
    if not v:
        return 0.0
    v = str(v).strip().replace(" ", "")
    if "#" in v:
        return 0.0
    if "," in v and "." in v:
        v = v.replace(".", "").replace(",", ".")
    elif "," in v:
        v = v.replace(",", ".")
    try:
        return round(float(v), 2)
    except:
        return 0.0

def fetch_csv(gid):
    url = f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/export?format=csv&gid={gid}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    with urllib.request.urlopen(req) as resp:
        content = resp.read().decode("utf-8")
    return list(csv.reader(content.splitlines()))

def build_dataset():
    total_rows = fetch_csv(GID_TOTAL)
    podaci_rows = fetch_csv(GID_PODACI)

    daily_totals = []
    weekly_totals = []

    # Parse Total tab
    for r in total_rows[1:]:
        if not r:
            continue
        # Day info (Cols 0-6)
        if len(r) > 0 and r[0].strip():
            date = r[0].strip()
            kcal = parse_num(r[4]) if len(r) > 4 else 0
            if kcal > 0:
                daily_totals.append({
                    "date": date,
                    "p": parse_num(r[1]) if len(r) > 1 else 0,
                    "c": parse_num(r[2]) if len(r) > 2 else 0,
                    "f": parse_num(r[3]) if len(r) > 3 else 0,
                    "kcal": kcal,
                    "active": parse_num(r[5]) if len(r) > 5 else 0,
                    "net": parse_num(r[6]) if len(r) > 6 else 0
                })
        
        # Week info (Cols 9-15)
        if len(r) > 13 and r[9].strip() and r[13].strip() and r[13].strip() != "0":
            weekly_totals.append({
                "week": r[9].strip(),
                "p": parse_num(r[10]),
                "c": parse_num(r[11]),
                "f": parse_num(r[12]),
                "kcal": parse_num(r[13]),
                "active": parse_num(r[14]) if len(r) > 14 else 0,
                "net": parse_num(r[15]) if len(r) > 15 else 0
            })

    # Parse Podaci tab (meals)
    meals_by_date = {}
    food_stats = {}
    for r in podaci_rows[1:]:
        if not r or not r[0].strip():
            continue
        date = r[0].strip()
        name = r[1].strip() if len(r) > 1 else ""
        qty = r[2].strip() if len(r) > 2 else ""
        p = parse_num(r[3]) if len(r) > 3 else 0
        c = parse_num(r[4]) if len(r) > 4 else 0
        f = parse_num(r[5]) if len(r) > 5 else 0
        kcal = parse_num(r[6]) if len(r) > 6 else 0
        
        meal = {"name": name, "qty": qty, "p": p, "c": c, "f": f, "kcal": kcal}
        meals_by_date.setdefault(date, []).append(meal)
        
        if name:
            if name not in food_stats:
                food_stats[name] = {"count": 0, "total_kcal": 0, "total_p": 0}
            food_stats[name]["count"] += 1
            food_stats[name]["total_kcal"] += kcal
            food_stats[name]["total_p"] += p

    top_foods = sorted(
        [{"name": k, "count": v["count"], "total_kcal": round(v["total_kcal"], 1), "total_p": round(v["total_p"], 1)} 
         for k, v in food_stats.items()],
        key=lambda x: x["count"],
        reverse=True
    )

    return {
        "generated_at": datetime.now().strftime("%d.%m.%Y. %H:%M"),
        "daily": daily_totals,
        "weekly": weekly_totals,
        "meals_by_date": meals_by_date,
        "top_foods": top_foods,
        "updated": True
    }

def generate_html(data):
    json_data = json.dumps(data, ensure_ascii=False)
    
    html = f"""<!DOCTYPE html>
<html lang="hr" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Izvještaj o Prehrani & Kalorijama</title>
  <script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>
  <style>
    :root {{
      --bg: #0f172a;
      --card-bg: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --protein: #f43f5e;
      --carbs: #38bdf8;
      --fat: #fbbf24;
      --kcal: #a855f7;
    }}
    body {{
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }}
    .custom-scrollbar::-webkit-scrollbar {{
      width: 6px;
      height: 6px;
    }}
    .custom-scrollbar::-webkit-scrollbar-thumb {{
      background: #475569;
      border-radius: 4px;
    }}
  </style>
</head>
<body class="p-4 sm:p-6 lg:p-8 min-h-screen">
  <div class="max-w-7xl mx-auto space-y-6">
    
    <!-- Top Header -->
    <header class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[var(--border)]">
      <div>
        <div class="flex items-center gap-3">
          <span class="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 font-bold text-xl">🥗</span>
          <div>
            <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight">Izvještaj o Prehrani & Kalorijama</h1>
            <p class="text-sm text-[var(--text-muted)]">Analiza i praćenje unosa iz Google Sheets tablice</p>
          </div>
        </div>
      </div>
      
      <div class="flex flex-wrap items-center gap-3">
        <div class="text-xs text-[var(--text-muted)] bg-[var(--card-bg)] px-3 py-2 rounded-lg border border-[var(--border)]">
          Zadnje ažurirano: <span id="syncTime" class="text-[var(--text)] font-medium">{data['generated_at']}</span>
        </div>
        <button onclick="refreshData()" class="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition active:scale-95 shadow-sm shadow-sky-600/30">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          Osvježi Podatke
        </button>

      </div>
    </header>

    <!-- Filters & Range Bar -->
    <div class="flex flex-wrap items-center justify-between gap-4 bg-[var(--card-bg)] p-3.5 rounded-xl border border-[var(--border)]">
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mr-1">Period:</span>
        <button onclick="setFilter('all')" id="btn-all" class="filter-btn text-xs px-3 py-1.5 rounded-lg font-medium bg-sky-500 text-white transition">Sve ({len(data['daily'])} dana)</button>
        <button onclick="setFilter(30)" id="btn-30" class="filter-btn text-xs px-3 py-1.5 rounded-lg font-medium text-[var(--text-muted)] hover:bg-slate-700 transition">Zadnjih 30 dana</button>
        <button onclick="setFilter(14)" id="btn-14" class="filter-btn text-xs px-3 py-1.5 rounded-lg font-medium text-[var(--text-muted)] hover:bg-slate-700 transition">Zadnjih 14 dana</button>
        <button onclick="setFilter(7)" id="btn-7" class="filter-btn text-xs px-3 py-1.5 rounded-lg font-medium text-[var(--text-muted)] hover:bg-slate-700 transition">Zadnjih 7 dana</button>
      </div>
      <div class="text-xs text-[var(--text-muted)]" id="rangeLabel">
        Prikazano: <span class="text-slate-200 font-semibold" id="displayedDaysCount">{len(data['daily'])}</span> dana
      </div>
    </div>

    <!-- Key Metrics Cards -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
      <div class="bg-[var(--card-bg)] p-4 rounded-xl border border-[var(--border)] relative overflow-hidden">
        <div class="text-xs font-medium text-[var(--text-muted)]">Dnevni Prosjek</div>
        <div class="text-2xl font-black mt-1 text-purple-400" id="cardKcal">-</div>
        <div class="text-[11px] text-[var(--text-muted)] mt-1">Ukupne kalorije</div>
      </div>

      <div class="bg-[var(--card-bg)] p-4 rounded-xl border border-[var(--border)]">
        <div class="text-xs font-medium text-rose-400">Proteini (prosjek)</div>
        <div class="text-2xl font-black mt-1 text-rose-400" id="cardProteini">-</div>
        <div class="text-[11px] text-[var(--text-muted)] mt-1" id="cardProteiniPct">-</div>
      </div>

      <div class="bg-[var(--card-bg)] p-4 rounded-xl border border-[var(--border)]">
        <div class="text-xs font-medium text-sky-400">Ugljikohidrati</div>
        <div class="text-2xl font-black mt-1 text-sky-400" id="cardCarbs">-</div>
        <div class="text-[11px] text-[var(--text-muted)] mt-1" id="cardCarbsPct">-</div>
      </div>

      <div class="bg-[var(--card-bg)] p-4 rounded-xl border border-[var(--border)]">
        <div class="text-xs font-medium text-amber-400">Masti</div>
        <div class="text-2xl font-black mt-1 text-amber-400" id="cardFats">-</div>
        <div class="text-[11px] text-[var(--text-muted)] mt-1" id="cardFatsPct">-</div>
      </div>

      <div class="bg-[var(--card-bg)] p-4 rounded-xl border border-[var(--border)]">
        <div class="text-xs font-medium text-emerald-400">Aktivna Potrošnja</div>
        <div class="text-2xl font-black mt-1 text-emerald-400" id="cardActive">-</div>
        <div class="text-[11px] text-[var(--text-muted)] mt-1">Aktivne kalorije</div>
      </div>

      <div class="bg-[var(--card-bg)] p-4 rounded-xl border border-[var(--border)]">
        <div class="text-xs font-medium text-indigo-400">Neto Unos</div>
        <div class="text-2xl font-black mt-1 text-indigo-400" id="cardNet">-</div>
        <div class="text-[11px] text-[var(--text-muted)] mt-1">Kcal minus potrošnja</div>
      </div>
    </div>

    <!-- Charts Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Main Daily Calories Chart -->
      <div class="lg:col-span-2 bg-[var(--card-bg)] p-5 rounded-xl border border-[var(--border)] space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-base font-bold">Dnevni Unos Kalorija</h2>
            <p class="text-xs text-[var(--text-muted)]">Trend unosa kalorija kroz odabrani period</p>
          </div>
          <div class="flex items-center gap-3 text-xs">
            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-purple-500"></span> Kalorije</span>
            <span class="flex items-center gap-1.5"><span class="w-3 h-0.5 bg-rose-400 border border-dashed border-rose-400"></span> Prosjek</span>
          </div>
        </div>
        <div class="w-full h-64 sm:h-72 relative">
          <canvas id="timelineChart" class="w-full h-full"></canvas>
        </div>
      </div>

      <!-- Macro Split & Distribution -->
      <div class="bg-[var(--card-bg)] p-5 rounded-xl border border-[var(--border)] flex flex-col justify-between">
        <div>
          <h2 class="text-base font-bold">Raspodjela Makronutrijenata</h2>
          <p class="text-xs text-[var(--text-muted)]">Udio u ukupnom kalorijskom unosu</p>
          <div class="w-full h-48 sm:h-52 relative mt-2 flex items-center justify-center">
            <canvas id="macroDonutChart" class="w-full h-full"></canvas>
          </div>
        </div>
        
        <div class="space-y-2 mt-4 pt-4 border-t border-[var(--border)] text-xs">
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Proteini (4 kcal/g)</span>
            <span class="font-bold font-mono" id="donutProteinVal">-</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-sky-500"></span> Ugljikohidrati (4 kcal/g)</span>
            <span class="font-bold font-mono" id="donutCarbVal">-</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Masti (9 kcal/g)</span>
            <span class="font-bold font-mono" id="donutFatVal">-</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Weekly Trends & Top Foods Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Weekly Average Trend -->
      <div class="bg-[var(--card-bg)] p-5 rounded-xl border border-[var(--border)] space-y-4">
        <div>
          <h2 class="text-base font-bold">Tjedni Prosjeci (Iz taba 'Total')</h2>
          <p class="text-xs text-[var(--text-muted)]">Prosječan dnevni unos po tjednima</p>
        </div>
        <div class="w-full h-64 relative">
          <canvas id="weeklyChart" class="w-full h-full"></canvas>
        </div>
      </div>

      <!-- Top Foods Consumed -->
      <div class="bg-[var(--card-bg)] p-5 rounded-xl border border-[var(--border)] space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-base font-bold">Top Namirnice po Učestalosti</h2>
            <p class="text-xs text-[var(--text-muted)]">Najčešće konzumirane stavke</p>
          </div>
          <span class="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full font-mono font-medium">Baza obroka</span>
        </div>
        
        <div class="overflow-y-auto max-h-64 custom-scrollbar pr-1">
          <table class="w-full text-xs">
            <thead class="text-[var(--text-muted)] border-b border-[var(--border)] sticky top-0 bg-[var(--card-bg)]">
              <tr>
                <th class="text-left py-2">Namirnica</th>
                <th class="text-center py-2">Broj unosa</th>
                <th class="text-right py-2">Ukupno Kcal</th>
                <th class="text-right py-2">Ukupno Proteina</th>
              </tr>
            </thead>
            <tbody id="topFoodsTable" class="divide-y divide-slate-800">
              <!-- Populated by JS -->
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Daily Log Explorer (Click to inspect meals) -->
    <div class="bg-[var(--card-bg)] p-5 rounded-xl border border-[var(--border)] space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-bold">Dnevnik Po Danima (Preglednik Obroka)</h2>
          <p class="text-xs text-[var(--text-muted)]">Klikni na bilo koji dan za pregled svih pojedinačnih obroka</p>
        </div>
        <div class="flex items-center gap-2">
          <input type="text" id="foodSearchInput" oninput="searchFood()" placeholder="Pretraži namirnicu (npr. Shake, Piletina)..." class="bg-slate-900 border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 w-64" />
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Days List -->
        <div class="lg:col-span-2 overflow-x-auto max-h-96 custom-scrollbar border border-[var(--border)] rounded-lg">
          <table class="w-full text-xs text-left">
            <thead class="bg-slate-800/80 text-[var(--text-muted)] sticky top-0 backdrop-blur z-10 border-b border-[var(--border)]">
              <tr>
                <th class="p-2.5">Datum</th>
                <th class="p-2.5 text-right text-rose-400">Proteini</th>
                <th class="p-2.5 text-right text-sky-400">UH</th>
                <th class="p-2.5 text-right text-amber-400">Masti</th>
                <th class="p-2.5 text-right text-purple-400 font-bold">Kalorije</th>
                <th class="p-2.5 text-right text-emerald-400">Aktivne</th>
                <th class="p-2.5 text-right text-indigo-400">Neto</th>
              </tr>
            </thead>
            <tbody id="dailyTableBody" class="divide-y divide-slate-800">
              <!-- Populated by JS -->
            </tbody>
          </table>
        </div>

        <!-- Meals Drawer for Selected Day -->
        <div class="bg-slate-900/60 p-4 rounded-lg border border-[var(--border)] flex flex-col justify-between max-h-96">
          <div>
            <div class="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div>
                <span class="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">Odabrani dan</span>
                <div class="text-base font-bold text-sky-400" id="selectedDateTitle">-</div>
              </div>
              <span class="text-xs px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 font-mono font-bold" id="selectedDateKcal">-</span>
            </div>
            
            <div class="overflow-y-auto max-h-64 custom-scrollbar mt-3 space-y-2" id="selectedDayMealsList">
              <div class="text-xs text-[var(--text-muted)] text-center py-8">Klikni na dan s lijeve strane za prikaz obroka</div>
            </div>
          </div>
          
          <div class="pt-3 border-t border-[var(--border)] text-[11px] text-[var(--text-muted)] flex justify-between" id="selectedDayFooter">
            <span>Stavki unosa: <strong class="text-slate-200" id="selectedMealCount">0</strong></span>
            <span>Uneseno u: 'Podaci'</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <footer class="pt-6 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between text-xs text-[var(--text-muted)] gap-2">
      <div>Izvještaj o Prehrani & Kalorijama &bull; Osobni Dashboard</div>
      <div>Optimizirano za hosting na GitHub Pages / Vercel / Netlify / lokalno</div>
    </footer>

  </div>

  <script>
    // Embedded initial data
    let reportData = {json_data};
    let currentFilter = 'all';
    let filteredDaily = [...reportData.daily];
    let selectedDate = null;

    function init() {{
      applyFilter('all');
      renderWeeklyChart();
      renderTopFoods();
      if (filteredDaily.length > 0) {{
        selectDay(filteredDaily[filteredDaily.length - 1].date);
      }}
    }}

    function setFilter(val) {{
      document.querySelectorAll('.filter-btn').forEach(b => {{
        b.classList.remove('bg-sky-500', 'text-white');
        b.classList.add('text-[var(--text-muted)]');
      }});
      const activeBtn = document.getElementById('btn-' + val);
      if (activeBtn) {{
        activeBtn.classList.remove('text-[var(--text-muted)]');
        activeBtn.classList.add('bg-sky-500', 'text-white');
      }}
      applyFilter(val);
    }}

    function applyFilter(filter) {{
      currentFilter = filter;
      if (filter === 'all') {{
        filteredDaily = [...reportData.daily];
      }} else {{
        const count = parseInt(filter);
        filteredDaily = reportData.daily.slice(-count);
      }}

      document.getElementById('displayedDaysCount').innerText = filteredDaily.length;
      updateMetrics();
      renderTimelineChart();
      renderMacroDonut();
      renderDailyTable();
    }}

    function updateMetrics() {{
      if (filteredDaily.length === 0) return;
      const count = filteredDaily.length;
      let totalKcal = 0, totalP = 0, totalC = 0, totalF = 0, totalActive = 0, totalNet = 0;
      let activeDaysCount = 0;

      filteredDaily.forEach(d => {{
        totalKcal += d.kcal;
        totalP += d.p;
        totalC += d.c;
        totalF += d.f;
        if (d.active > 0) {{
          totalActive += d.active;
          activeDaysCount++;
        }}
        if (d.net > 0) totalNet += d.net;
      }});

      const avgKcal = Math.round(totalKcal / count);
      const avgP = Math.round(totalP / count);
      const avgC = Math.round(totalC / count);
      const avgF = Math.round(totalF / count);
      const avgActive = activeDaysCount > 0 ? Math.round(totalActive / activeDaysCount) : 0;
      const avgNet = Math.round(totalNet / count);

      // Pct of calories: P*4, C*4, F*9
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
    }}

    // Canvas Timeline Chart
    function renderTimelineChart() {{
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

      const padL = 45, padR = 15, padT = 20, padB = 30;
      const chartW = w - padL - padR;
      const chartH = h - padT - padB;

      const maxKcal = Math.max(...filteredDaily.map(d => d.kcal), 4000);
      const minKcal = Math.min(...filteredDaily.map(d => d.kcal), 1500) * 0.85;

      const getY = (val) => padT + chartH - ((val - minKcal) / (maxKcal - minKcal)) * chartH;
      const getX = (i) => padL + (i / Math.max(1, filteredDaily.length - 1)) * chartW;

      // Draw grid lines
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';

      const steps = 4;
      for (let s = 0; s <= steps; s++) {{
        const v = minKcal + (s / steps) * (maxKcal - minKcal);
        const y = getY(v);
        ctx.beginPath();
        ctx.setLineDash([3, 3]);
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.stroke();
        ctx.fillText(Math.round(v), padL - 6, y + 3);
      }}
      ctx.setLineDash([]);

      // Draw Average Line
      const avg = filteredDaily.reduce((a, b) => a + b.kcal, 0) / filteredDaily.length;
      const avgY = getY(avg);
      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padL, avgY);
      ctx.lineTo(w - padR, avgY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Fill Area Under Line
      ctx.beginPath();
      filteredDaily.forEach((d, i) => {{
        const x = getX(i);
        const y = getY(d.kcal);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }});
      ctx.lineTo(getX(filteredDaily.length - 1), getY(minKcal));
      ctx.lineTo(getX(0), getY(minKcal));
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, padT, 0, h - padB);
      grad.addColorStop(0, 'rgba(168, 85, 247, 0.35)');
      grad.addColorStop(1, 'rgba(168, 85, 247, 0.0)');
      ctx.fillStyle = grad;
      ctx.fill();

      // Draw Line
      ctx.beginPath();
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2.5;
      filteredDaily.forEach((d, i) => {{
        const x = getX(i);
        const y = getY(d.kcal);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }});
      ctx.stroke();

      // Draw Points if <= 35 days
      if (filteredDaily.length <= 35) {{
        filteredDaily.forEach((d, i) => {{
          const x = getX(i);
          const y = getY(d.kcal);
          ctx.fillStyle = '#a855f7';
          ctx.beginPath();
          ctx.arc(x, y, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.arc(x, y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }});
      }}

      // X-axis labels
      ctx.textAlign = 'center';
      ctx.fillStyle = '#64748b';
      const labelInterval = Math.ceil(filteredDaily.length / 8);
      filteredDaily.forEach((d, i) => {{
        if (i % labelInterval === 0 || i === filteredDaily.length - 1) {{
          const parts = d.date.split('.');
          const shortDate = parts[0] + '.' + parts[1];
          ctx.fillText(shortDate, getX(i), h - 10);
        }}
      }});
    }}

    // Macro Donut
    function renderMacroDonut() {{
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
      filteredDaily.forEach(d => {{
        totalP += d.p;
        totalC += d.c;
        totalF += d.f;
      }});

      const kcalP = (totalP / count) * 4;
      const kcalC = (totalC / count) * 4;
      const kcalF = (totalF / count) * 9;
      const total = kcalP + kcalC + kcalF || 1;

      const slices = [
        {{ label: 'Proteini', val: kcalP, color: '#f43f5e' }},
        {{ label: 'UH', val: kcalC, color: '#38bdf8' }},
        {{ label: 'Masti', val: kcalF, color: '#fbbf24' }}
      ];

      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(w, h) * 0.42;
      const innerR = r * 0.65;

      let startAngle = -Math.PI / 2;
      slices.forEach(s => {{
        const angle = (s.val / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, startAngle, startAngle + angle);
        ctx.arc(cx, cy, innerR, startAngle + angle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = s.color;
        ctx.fill();
        startAngle += angle;
      }});

      // Center text
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(Math.round(total) + ' kcal', cx, cy - 6);
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('makro zbroj', cx, cy + 12);
    }}

    // Weekly Chart
    function renderWeeklyChart() {{
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

      const padL = 40, padR = 10, padT = 20, padB = 30;
      const chartW = w - padL - padR;
      const chartH = h - padT - padB;

      const maxKcal = Math.max(...weeks.map(w => w.kcal), 4000);
      const barW = Math.max(12, (chartW / weeks.length) * 0.55);

      weeks.forEach((wk, i) => {{
        const x = padL + (i + 0.5) * (chartW / weeks.length) - barW / 2;
        const barH = (wk.kcal / maxKcal) * chartH;
        const y = padT + chartH - barH;

        // Bar
        const grad = ctx.createLinearGradient(0, y, 0, y + barH);
        grad.addColorStop(0, '#38bdf8');
        grad.addColorStop(1, '#0284c7');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]) : ctx.rect(x, y, barW, barH);
        ctx.fill();

        // Value text
        ctx.fillStyle = '#f8fafc';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(Math.round(wk.kcal), x + barW / 2, y - 5);

        // Date label
        ctx.fillStyle = '#64748b';
        const parts = wk.week.split('.');
        ctx.fillText(parts[0] + '.' + parts[1], x + barW / 2, h - 10);
      }});
    }}

    // Top Foods
    function renderTopFoods() {{
      const tbody = document.getElementById('topFoodsTable');
      if (!tbody) return;
      tbody.innerHTML = '';
      reportData.top_foods.slice(0, 10).forEach((item, idx) => {{
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/50 transition cursor-pointer';
        tr.onclick = () => {{
          document.getElementById('foodSearchInput').value = item.name;
          searchFood();
        }};
        tr.innerHTML = `
          <td class="py-2 flex items-center gap-2">
            <span class="w-4 h-4 rounded bg-slate-800 text-[10px] text-slate-400 flex items-center justify-center font-mono">${{idx + 1}}</span>
            <span class="font-medium text-slate-200">${{item.name}}</span>
          </td>
          <td class="py-2 text-center font-mono font-semibold text-sky-400">${{item.count}}x</td>
          <td class="py-2 text-right font-mono text-purple-300">${{Math.round(item.total_kcal).toLocaleString('hr-HR')}}</td>
          <td class="py-2 text-right font-mono text-rose-400">${{Math.round(item.total_p).toLocaleString('hr-HR')}} g</td>
        `;
        tbody.appendChild(tr);
      }});
    }}

    // Daily Table
    function renderDailyTable() {{
      const tbody = document.getElementById('dailyTableBody');
      if (!tbody) return;
      tbody.innerHTML = '';
      
      const reversed = [...filteredDaily].reverse();
      reversed.forEach(d => {{
        const tr = document.createElement('tr');
        tr.id = 'row-' + d.date;
        tr.className = 'hover:bg-slate-800/60 transition cursor-pointer ' + (selectedDate === d.date ? 'bg-slate-800/90 font-semibold' : '');
        tr.onclick = () => selectDay(d.date);
        tr.innerHTML = `
          <td class="p-2.5 font-medium flex items-center gap-2">
            <span class="w-1.5 h-1.5 rounded-full ${{selectedDate === d.date ? 'bg-sky-400' : 'bg-transparent'}}"></span>
            ${{d.date}}
          </td>
          <td class="p-2.5 text-right font-mono text-rose-400">${{d.p}}</td>
          <td class="p-2.5 text-right font-mono text-sky-400">${{d.c}}</td>
          <td class="p-2.5 text-right font-mono text-amber-400">${{d.f}}</td>
          <td class="p-2.5 text-right font-mono text-purple-400 font-bold">${{d.kcal.toLocaleString('hr-HR')}}</td>
          <td class="p-2.5 text-right font-mono text-emerald-400">${{d.active > 0 ? d.active : '-'}}</td>
          <td class="p-2.5 text-right font-mono text-indigo-400">${{d.net > 0 ? d.net : '-'}}</td>
        `;
        tbody.appendChild(tr);
      }});
    }}

    function selectDay(date) {{
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

      if (meals.length === 0) {{
        listEl.innerHTML = '<div class="text-xs text-[var(--text-muted)] text-center py-6">Nema evidentiranih pojedinačnih obroka za ovaj datum.</div>';
        return;
      }}

      listEl.innerHTML = '';
      meals.forEach(m => {{
        const itemDiv = document.createElement('div');
        itemDiv.className = 'p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs flex items-center justify-between gap-2';
        itemDiv.innerHTML = `
          <div>
            <div class="font-medium text-slate-100">${{m.name}}</div>
            <div class="text-[11px] text-slate-400">Količina: <span class="font-mono text-sky-400">${{m.qty}}</span></div>
          </div>
          <div class="text-right">
            <div class="font-bold font-mono text-purple-400">${{m.kcal}} kcal</div>
            <div class="text-[10px] text-slate-400 font-mono">P:${{m.p}} &bull; C:${{m.c}} &bull; F:${{m.f}}</div>
          </div>
        `;
        listEl.appendChild(itemDiv);
      }});
    }}

    function searchFood() {{
      const query = document.getElementById('foodSearchInput').value.toLowerCase().trim();
      if (!query) {{
        renderDailyTable();
        return;
      }}
      const tbody = document.getElementById('dailyTableBody');
      tbody.innerHTML = '';

      const matchingDates = new Set();
      for (const [date, meals] of Object.entries(reportData.meals_by_date)) {{
        if (meals.some(m => m.name.toLowerCase().includes(query))) {{
          matchingDates.add(date);
        }}
      }}

      filteredDaily.filter(d => matchingDates.has(d.date)).reverse().forEach(d => {{
        const tr = document.createElement('tr');
        tr.id = 'row-' + d.date;
        tr.className = 'hover:bg-slate-800/60 transition cursor-pointer ' + (selectedDate === d.date ? 'bg-slate-800/90 font-semibold' : '');
        tr.onclick = () => selectDay(d.date);
        tr.innerHTML = `
          <td class="p-2.5 font-medium flex items-center gap-2">
            <span class="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
            ${{d.date}}
          </td>
          <td class="p-2.5 text-right font-mono text-rose-400">${{d.p}}</td>
          <td class="p-2.5 text-right font-mono text-sky-400">${{d.c}}</td>
          <td class="p-2.5 text-right font-mono text-amber-400">${{d.f}}</td>
          <td class="p-2.5 text-right font-mono text-purple-400 font-bold">${{d.kcal.toLocaleString('hr-HR')}}</td>
          <td class="p-2.5 text-right font-mono text-emerald-400">${{d.active > 0 ? d.active : '-'}}</td>
          <td class="p-2.5 text-right font-mono text-indigo-400">${{d.net > 0 ? d.net : '-'}}</td>
        `;
        tbody.appendChild(tr);
      }});
    }}

    function refreshData() {{
      const btn = event.target.closest("button");
      if (btn) btn.innerHTML = "<span class=\"animate-spin inline-block mr-1\">↻</span> Učitavam...";
      setTimeout(() => {{
        location.reload();
      }}, 300);
    }} else {{
          alert('Google Sheets nije dozvolio izravni klijentski dohvat (CORS). Pokreni generate_report.py za novo generiranje.');
        }}
      }} catch (e) {{
        alert('Napomena: Zbog ograničenja preglednika (CORS), za najnovije podatke pokreni skriptu: python generate_report.py');
      }} finally {{
        btn.innerHTML = originalText;
      }}
    }}

    window.addEventListener('load', init);
    window.addEventListener('resize', () => {{
      renderTimelineChart();
      renderMacroDonut();
      renderWeeklyChart();
    }});
  </script>
</body>
</html>
"""
    return html

def main():
    output_path = sys.argv[1] if len(sys.argv) > 1 else "calorie_report.html"
    print(f"Fetching data from Google Sheet ({SPREADSHEET_ID})...")
    data = build_dataset()
    print(f"Parsed {len(data['daily'])} daily entries, {len(data['weekly'])} weekly summaries, and {len(data['top_foods'])} distinct foods.")
    
    html_content = generate_html(data)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"Successfully generated report at: {output_path}")

if __name__ == "__main__":
    main()
