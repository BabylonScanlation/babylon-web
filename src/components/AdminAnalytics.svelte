<script>
import { Chart, registerables } from 'chart.js';
import { onMount } from 'svelte';
import { fade } from 'svelte/transition';

let summary = { totalViews: 0, totalUsers: 0, totalSeries: 0 };
let engagement = { topReactedSeries: [], topCommenters: [] };
let categories = { byType: [], byDemographic: [] };
let topSeriesData = [];
let loading = true;
let selectedRange = '7';

let dailyChartCanvas;
let topSeriesChartCanvas;
let typeChartCanvas;
let demoChartCanvas;

let charts = { daily: null, top: null, type: null, demo: null };

const palette = {
  primary: '#4facfe',
  secondary: '#00f2fe',
  accent: '#f093fb',
  success: '#4ade80',
  chart: ['#4facfe', '#f093fb', '#4ade80', '#f6d365', '#ff6b6b'],
};

async function fetchData() {
  try {
    loading = true;
    const res = await fetch(`/api/admin/stats/all?range=${selectedRange}&refresh=true`);
    if (!res.ok) throw new Error('Error stats');

    const data = await res.json();
    console.log('[Analytics Debug] Top Commenters:', data.engagement.topCommenters);
    summary = data.summary;
    engagement = data.engagement;
    categories = data.categories;
    topSeriesData = data.topSeries;

    renderDailyChart(data.dailyViews);
    renderTopSeriesChart(topSeriesData);

    if (categories) {
      renderCategoryPieChart('type', typeChartCanvas, categories.byType);
      renderCategoryPieChart('demo', demoChartCanvas, categories.byDemographic);
    }
  } catch (e) {
    console.error('Analytics error:', e);
  } finally {
    loading = false;
  }
}

function renderCategoryPieChart(key, canvas, data) {
  if (!canvas || !data) return;
  if (charts[key]) charts[key].destroy();

  // Astra: Detección de móvil para posicionar la leyenda
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  charts[key] = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: data.map((d) => d.name || 'N/A'),
      datasets: [
        {
          data: data.map((d) => d.count),
          backgroundColor: palette.chart,
          hoverOffset: 10,
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '75%',
      plugins: {
        legend: {
          position: isMobile ? 'bottom' : 'right',
          labels: {
            color: '#888',
            font: { size: 10, weight: 'bold' },
            padding: isMobile ? 10 : 15,
            usePointStyle: true,
            boxWidth: 8,
          },
        },
      },
    },
  });
}

function renderDailyChart(data) {
  if (!dailyChartCanvas || !data) return;
  if (charts.daily) charts.daily.destroy();
  const ctx = dailyChartCanvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(79, 172, 254, 0.4)');
  gradient.addColorStop(1, 'rgba(79, 172, 254, 0)');

  const labels = data.map((d) => d.date).reverse();
  const counts = data.map((d) => d.count).reverse();

  charts.daily = new Chart(dailyChartCanvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Vistas',
          data: counts,
          borderColor: palette.primary,
          borderWidth: 3,
          pointBackgroundColor: palette.primary,
          pointRadius: labels.length > 30 ? 0 : 2, // Astra: Menos ruido en rangos largos
          pointHoverRadius: 6,
          backgroundColor: gradient,
          fill: true,
          tension: 0.4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#666', font: { size: 10 } },
        },
        x: {
          grid: { display: false },
          ticks: { color: '#666', font: { size: 10 }, maxRotation: 45 },
        },
      },
    },
  });
}

function renderTopSeriesChart(data) {
  if (!topSeriesChartCanvas || !data) return;
  if (charts.top) charts.top.destroy();
  charts.top = new Chart(topSeriesChartCanvas, {
    type: 'bar',
    data: {
      labels: data.map((d) => (d.title.length > 12 ? d.title.substring(0, 12) + '..' : d.title)),
      datasets: [
        {
          data: data.map((d) => d.viewCount),
          backgroundColor: palette.accent,
          borderRadius: 20,
          barThickness: 'flex',
          maxBarThickness: 12,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, grid: { display: false }, ticks: { display: false } },
        y: {
          grid: { display: false },
          ticks: { color: '#888', font: { weight: 'bold', size: 10 } },
        },
      },
    },
  });
}

function handleRangeChange(range) {
  selectedRange = range;
  fetchData();
}

onMount(() => {
  Chart.register(...registerables);
  fetchData();

  // Astra: Escuchar redimensionamiento para actualizar leyendas
  const handleResize = () => {
    if (categories.byType.length > 0) {
      renderCategoryPieChart('type', typeChartCanvas, categories.byType);
      renderCategoryPieChart('demo', demoChartCanvas, categories.byDemographic);
    }
  };
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
});
</script>

<div class="analytics-container" in:fade>
  <!-- Controls -->
  <div class="dashboard-header-sticky">
    <div class="range-selector-scroll">
      {#each ['7', '30', '90', 'all'] as r (r)}
        <button class:active={selectedRange === r} onclick={() => handleRangeChange(r)}>
          {r === 'all' ? 'Histórico' : `${r}d`}
        </button>
      {/each}
    </div>
    {#if loading} 
        <div class="mini-loader">
            <div class="dot-ping"></div>
        </div> 
    {/if}
  </div>

  <!-- Bento Grid Summary -->
  <div class="bento-grid summary-row">
    <div class="bento-card highlight blue">
        <div class="card-icon">👁️</div>
        <div class="card-info">
            <span>Vistas</span>
            <strong>{summary.totalViews.toLocaleString()}</strong>
        </div>
    </div>
    <div class="bento-card highlight purple">
        <div class="card-icon">👥</div>
        <div class="card-info">
            <span>Comunidad</span>
            <strong>{summary.totalUsers.toLocaleString()}</strong>
        </div>
    </div>
    <div class="bento-card highlight green">
        <div class="card-icon">📚</div>
        <div class="card-info">
            <span>Obras</span>
            <strong>{summary.totalSeries.toLocaleString()}</strong>
        </div>
    </div>
  </div>

  <!-- Main Charts Row -->
  <div class="bento-grid main-charts">
    <div class="bento-card chart-container">
      <div class="card-header">
        <h3>Tráfico</h3>
        <span class="trend-up">📈 Tendencia</span>
      </div>
      <div class="canvas-wrap"><canvas bind:this={dailyChartCanvas}></canvas></div>
    </div>
    
    <div class="bento-card chart-container">
      <div class="card-header">
        <h3>Ranking</h3>
      </div>
      <div class="canvas-wrap"><canvas bind:this={topSeriesChartCanvas}></canvas></div>
    </div>
  </div>

  <!-- Distribution Row -->
  <div class="bento-grid distribution-row">
    <div class="bento-card">
      <h3>Por Formato</h3>
      <div class="canvas-wrap-s"><canvas bind:this={typeChartCanvas}></canvas></div>
    </div>
    <div class="bento-card">
      <h3>Por Demografía</h3>
      <div class="canvas-wrap-s"><canvas bind:this={demoChartCanvas}></canvas></div>
    </div>
  </div>

  <!-- Engagement Row -->
  <div class="bento-grid engagement-row">
    <div class="bento-card table-card">
      <h3>Interacción (❤️)</h3>
      <div class="engagement-list">
          {#each engagement.topReactedSeries as s (s.title)}
            <div class="engagement-item">
                <span class="item-name">{s.title}</span>
                <div class="item-bar-wrap">
                    <div class="item-bar" style="width: {(s.interactionCount / (engagement.topReactedSeries[0]?.interactionCount || 1)) * 100}%"></div>
                </div>
                <span class="item-value">{s.interactionCount}</span>
            </div>
          {/each}
      </div>
    </div>

    <div class="bento-card table-card">
      <h3>Comunidad (💬)</h3>
      <div class="engagement-list">
          {#each engagement.topCommenters as u (u.email)}
            <div class="engagement-item">
                <span class="item-name">{u.username || u.displayName || u.email.split('@')[0]}</span>
                <div class="item-bar-wrap">
                    <div class="item-bar secondary" style="width: {(u.commentCount / (engagement.topCommenters[0]?.commentCount || 1)) * 100}%"></div>
                </div>
                <span class="item-value">{u.commentCount}</span>
            </div>
          {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .analytics-container { display: flex; flex-direction: column; gap: 1rem; font-family: 'Inter', system-ui, sans-serif; padding-bottom: 2rem; }

  /* Dashboard Header Sticky */
  .dashboard-header-sticky { 
    position: sticky; 
    top: 0; 
    z-index: 100; 
    background: rgba(10, 10, 10, 0.8); 
    backdrop-filter: blur(10px);
    padding: 0.75rem 0;
    margin: 0 -1rem 0.5rem;
    padding-left: 1rem;
    padding-right: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }

  .range-selector-scroll { 
    display: flex; 
    background: #1e1e1e; 
    padding: 3px; 
    border-radius: 10px; 
    gap: 2px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .range-selector-scroll::-webkit-scrollbar { display: none; }

  .range-selector-scroll button { 
    background: none; 
    border: none; 
    color: #666; 
    padding: 6px 12px; 
    cursor: pointer; 
    border-radius: 7px; 
    font-size: 0.75rem; 
    font-weight: 700; 
    transition: all 0.2s; 
    white-space: nowrap;
  }
  .range-selector-scroll button.active { background: #333; color: var(--accent-color); }
  
  .mini-loader { padding-right: 0.5rem; }
  .dot-ping { width: 8px; height: 8px; background: var(--accent-color); border-radius: 50%; animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite; }
  @keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }

  /* Bento Grid System */
  .bento-grid { display: grid; gap: 1rem; }
  .summary-row { grid-template-columns: repeat(3, 1fr); }
  .main-charts { grid-template-columns: 1.5fr 1fr; }
  .distribution-row { grid-template-columns: 1fr 1fr; }
  .engagement-row { grid-template-columns: 1fr 1fr; }

  .bento-card {
    background: #161616;
    border-radius: 16px;
    padding: 1.25rem;
    border: 1px solid rgba(255,255,255,0.03);
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
  }

  /* Highlight Cards */
  .bento-card.highlight { display: flex; align-items: center; gap: 1rem; padding: 1rem; }
  .card-icon { font-size: 1.4rem; background: rgba(255,255,255,0.02); width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 12px; }
  .card-info span { display: block; font-size: 0.65rem; color: #666; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .card-info strong { font-size: 1.4rem; font-weight: 800; line-height: 1; }
  
  .highlight.blue strong { color: #4facfe; }
  .highlight.purple strong { color: #f093fb; }
  .highlight.green strong { color: #4ade80; }

  /* Chart Cards */
  .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
  .card-header h3 { margin: 0; font-size: 0.85rem; color: #fff; font-weight: 700; }
  .trend-up { font-size: 0.65rem; background: rgba(74, 222, 128, 0.1); color: #4ade80; padding: 2px 8px; border-radius: 20px; font-weight: 700; }

  .canvas-wrap { height: 220px; position: relative; }
  .canvas-wrap-s { height: 200px; position: relative; }

  /* Engagement Lists */
  .engagement-list { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 0.5rem; }
  .engagement-item { display: flex; align-items: center; gap: 0.75rem; font-size: 0.75rem; }
  .item-name { flex: 0 0 80px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
  .item-bar-wrap { flex-grow: 1; height: 4px; background: rgba(255,255,255,0.03); border-radius: 10px; overflow: hidden; }
  .item-bar { height: 100%; background: linear-gradient(90deg, #f093fb, #f5576c); border-radius: 10px; }
  .item-bar.secondary { background: linear-gradient(90deg, #4facfe, #00f2fe); }
  .item-value { min-width: 25px; text-align: right; font-weight: 800; color: #fff; font-family: monospace; }

  @media (max-width: 768px) {
    .main-charts, .distribution-row, .engagement-row { grid-template-columns: 1fr; }
    .summary-row { grid-template-columns: 1fr; }
    .bento-card.highlight { padding: 1.25rem; }
    .card-info strong { font-size: 1.8rem; }
    .item-name { flex: 0 0 100px; }
    .canvas-wrap-s { height: 240px; } /* Más espacio para la leyenda inferior */
  }
</style>