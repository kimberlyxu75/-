const STORAGE_KEY = "cute-wallet-state-v1";
const money = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" });

const starterCategories = [
  { id: "food", name: "美食餐饮", emoji: "🥐", color: "#d99b8d" },
  { id: "coffee", name: "咖啡特调", emoji: "☕", color: "#bfcfc4" },
  { id: "traffic", name: "日常出行", emoji: "🚕", color: "#b8d6e6" },
  { id: "health", name: "健康护理", emoji: "💊", color: "#f9a9bd" },
  { id: "shopping", name: "服饰美妆", emoji: "🛍️", color: "#f6bddb" },
  { id: "fun", name: "娱乐休闲", emoji: "🍿", color: "#ead6a4" },
  { id: "daily", name: "居家生活", emoji: "🏠", color: "#c7dacd" },
  { id: "other", name: "日用超市", emoji: "🧺", color: "#ead9ce" }
];

starterCategories.forEach(category => { category.type = "expense"; });
starterCategories.push(
  { id: "salary", type: "income", name: "工资薪酬", emoji: "💼", color: "#83b59c" },
  { id: "bonus", type: "income", name: "奖金补贴", emoji: "🎁", color: "#d6b36b" },
  { id: "sidejob", type: "income", name: "兼职副业", emoji: "💡", color: "#8aafd0" },
  { id: "investment", type: "income", name: "投资收益", emoji: "🌱", color: "#a7ba80" },
  { id: "income-other", type: "income", name: "其他收入", emoji: "🪙", color: "#c6a3c7" }
);
let storageBlocked = false;
let temporaryMode = false;
let lastImportState = null;
let deletedRecord = null;
let changeQueue = Promise.resolve();
let stateRevision = null;
let state = loadState();
let recordType = "expense";
let statsType = "expense";
let categoryType = "expense";
const typeOf = item => item.type || "expense";
const typeLabel = type => type === "income" ? "收入" : "支出";
const categoriesOf = type => state.categories.filter(item => typeOf(item) === type);
const recordsOf = type => state.expenses.filter(item => typeOf(item) === type);
let activePeriod = "week";
let selectedDayDialogDate = "";

const els = {
  tabs: document.querySelectorAll(".tab"),
  views: document.querySelectorAll(".view"),
  headerYearTitle: document.querySelector("#header-year-title"),
  headerMonthSpent: document.querySelector("#header-month-spent"),
  headerMonthBudget: document.querySelector("#header-month-budget"),
  exportDataBtn: document.querySelector("#export-data-btn"),
  importDataInput: document.querySelector("#import-data-input"),
  todayPill: document.querySelector("#today-pill"),
  expenseForm: document.querySelector("#expense-form"),
  expenseDate: document.querySelector("#expense-date"),
  expenseAmount: document.querySelector("#expense-amount"),
  expenseCategory: document.querySelector("#expense-category"),
  expenseNote: document.querySelector("#expense-note"),
  clearAmountBtn: document.querySelector("#clear-amount-btn"),
  expenseList: document.querySelector("#expense-list"),
  todayTotal: document.querySelector("#today-total"),
  periodBtns: document.querySelectorAll(".period-btn"),
  periodLabel: document.querySelector("#period-label"),
  periodTotal: document.querySelector("#period-total"),
  periodSummary: document.querySelector("#period-summary"),
  categoryBars: document.querySelector("#category-bars"),
  calendarPanel: document.querySelector("#calendar-panel"),
  calendar: document.querySelector("#calendar"),
  calendarMonth: document.querySelector("#calendar-month"),
  calendarTitle: document.querySelector("#calendar-title"),
  dayExpenseDialog: document.querySelector("#day-expense-dialog"),
  dayDialogTitle: document.querySelector("#day-dialog-title"),
  dayDialogCount: document.querySelector("#day-dialog-count"),
  dayDialogTotal: document.querySelector("#day-dialog-total"),
  dayDialogList: document.querySelector("#day-dialog-list"),
  closeDayExpensesBtn: document.querySelector("#close-day-expenses-btn"),
  addOnDayBtn: document.querySelector("#add-on-day-btn"),
  yearPanel: document.querySelector("#year-panel"),
  yearTitle: document.querySelector("#year-title"),
  yearMonths: document.querySelector("#year-months"),
  budgetMonth: document.querySelector("#budget-month"),
  totalBudgetInput: document.querySelector("#total-budget-input"),
  totalBudgetFill: document.querySelector("#total-budget-fill"),
  totalBudgetCopy: document.querySelector("#total-budget-copy"),
  budgetList: document.querySelector("#budget-list"),
  categoryGrid: document.querySelector("#category-grid"),
  addCategoryBtn: document.querySelector("#add-category-btn"),
  categoryDialog: document.querySelector("#category-dialog"),
  categoryForm: document.querySelector("#category-form"),
  categoryId: document.querySelector("#category-id"),
  categoryName: document.querySelector("#category-name"),
  categoryEmoji: document.querySelector("#category-emoji"),
  categoryColor: document.querySelector("#category-color"),
  categoryDialogKicker: document.querySelector("#category-dialog-kicker"),
  categoryDialogTitle: document.querySelector("#category-dialog-title"),
  cancelCategoryBtn: document.querySelector("#cancel-category-btn"),
  categoryNotes: document.querySelector("#category-notes")
};

function loadState() {
  try {
    temporaryMode = localStorage.getItem("wallet-temporary-mode") === "true";
    const saved = temporaryMode ? null : localStorage.getItem(STORAGE_KEY);
    stateRevision = saved;
    if (saved) {
      const raw = JSON.parse(saved);
      const next = WalletSecurity.validate(raw);
      if (!raw.categories.some(item => item.type !== undefined)) {
        next.categories.forEach(item => { item.type = "expense"; });
        next.categories.push(...structuredClone(starterCategories.filter(item => item.type === "income" && !next.categories.some(existing => existing.id === item.id))));
      }
      return next;
    }
  } catch {
    storageBlocked = true;
    setTimeout(() => notify("本地账本无法读取。为保护原数据，已暂停保存；请先导出或恢复备份，不要清除浏览器数据。"), 0);
  }
  return { categories: structuredClone(starterCategories), expenses: [], budgets: {}, notes: { categories: "" } };
}

function normalizeState(data) {
  return WalletSecurity.validate(data);
}

function saveState() {
  if (storageBlocked) return false;
  if (temporaryMode) { try { WalletSecurity.validate(state); return true; } catch { notify("数据格式无效，尚未保存。"); return false; } }
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current !== stateRevision) {
      storageBlocked = true;
      notify("账本已在另一个窗口修改。已暂停保存，请导出当前数据后重新打开，避免覆盖其他窗口的修改。");
      return false;
    }
    const serialized = JSON.stringify(WalletSecurity.validate(state));
    localStorage.setItem(STORAGE_KEY, serialized);
    stateRevision = serialized;
    return true;
  } catch {
    notify("保存失败：可能是存储空间不足或数据格式无效。当前修改尚未保存，请立即导出备份。");
    return false;
  }
}

function todayISO() {
  return dateISO(new Date());
}

function shiftDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return dateISO(date);
}

function monthKey(date = new Date()) {
  return dateISO(date).slice(0, 7);
}

function categoryById(id) {
  return state.categories.find((category) => category.id === id) || {
    id: "missing",
    name: "已删除类别",
    emoji: "🧾",
    color: "#9aa6b2"
  };
}

function paintColor(color, alpha = 0.14) {
  const clean = color.replace("#", "");
  const value = parseInt(clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function periodRange(period) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (period === "week") {
    const day = (now.getDay() + 6) % 7;
    start.setDate(now.getDate() - day);
    end.setDate(start.getDate() + 6);
  }

  if (period === "month") {
    start.setDate(1);
    end.setMonth(start.getMonth() + 1, 0);
  }

  if (period === "year") {
    start.setMonth(0, 1);
    end.setMonth(11, 31);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function inRange(expense, range) {
  const date = new Date(`${expense.date}T12:00:00`);
  return date >= range.start && date <= range.end;
}

function sumExpenses(expenses) {
  return expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
}

function expensesForMonth(month, type = "expense") {
  return recordsOf(type).filter((expense) => expense.date.startsWith(month));
}

function categoryTotals(expenses, type = statsType) {
  return categoriesOf(type).map((category) => {
    const total = sumExpenses(expenses.filter((expense) => expense.categoryId === category.id));
    return { ...category, total };
  }).sort((a, b) => b.total - a.total);
}

function dateISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function weekdayLabel(date) {
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()];
}

function shortDateLabel(isoDate) {
  const [, month, day] = isoDate.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function commitChange(change) {
  const task = changeQueue.then(async () => {
    const previous = structuredClone(state);
    try {
      change();
      if (await saveState()) return true;
    } catch { notify("修改未保存，请重试或导出备份。"); }
    state = previous;
    return false;
  });
  changeQueue = task.catch(() => false);
  return task;
}

function renderAll() {
  renderHeader();
  renderCategoryOptions();
  renderExpenses();
  renderStats();
  renderCalendar();
  renderBudgets();
  renderCategories();
}

function renderHeader() {
  const month = monthKey();
  const [year, monthNumber] = month.split("-");
  const englishMonth = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric"
  }).format(new Date(Number(year), Number(monthNumber) - 1, 1));
  const budget = budgetForMonth(month);
  const spent = sumExpenses(expensesForMonth(month));

  if (els.headerYearTitle) {
    els.headerYearTitle.textContent = englishMonth;
  }
  els.headerMonthSpent.textContent = money.format(spent);
  els.headerMonthBudget.textContent = money.format(Number(budget.total || 0));
}

function renderCategoryOptions() {
  const categories = categoriesOf(recordType);
  const selected = els.expenseCategory.value;
  els.expenseCategory.innerHTML = categories.map(category => `<option value="${escapeHTML(category.id)}">${escapeHTML(category.emoji)} ${escapeHTML(category.name)}</option>`).join("");
  els.expenseCategory.value = categories.some(category => category.id === selected) ? selected : categories[0]?.id || "";
  document.querySelector("#amount-caption").textContent = `${typeLabel(recordType)}金额（元）`;
  document.querySelector("#category-caption").textContent = `选择${typeLabel(recordType)}类别`;
  els.expenseCategory.setAttribute("aria-label", `选择${typeLabel(recordType)}类别`);
  els.expenseNote.placeholder = recordType === "income" ? "这笔收入来自哪里？" : "这笔钱花在哪里了？";
  document.querySelector(".submit-record").textContent = `＋ 记录${typeLabel(recordType)}`;
}

function renderExpenses() {
  const todayTotal = sumExpenses(recordsOf(recordType).filter((expense) => expense.date === todayISO()));
  els.todayTotal.textContent = `今日${typeLabel(recordType)} ${money.format(todayTotal)}`;

  const recentStart = shiftDate(-6);
  const recentEnd = todayISO();
  const ordered = recordsOf(recordType)
    .filter((expense) => expense.date >= recentStart && expense.date <= recentEnd)
    .sort((a, b) => `${b.date}${b.id}`.localeCompare(`${a.date}${a.id}`));
  const grouped = ordered.reduce((groups, expense) => {
    groups[expense.date] ||= [];
    groups[expense.date].push(expense);
    return groups;
  }, {});

  els.expenseList.innerHTML = ordered.length ? Object.entries(grouped).map(([date, expenses]) => {
    const dailyTotal = sumExpenses(expenses);
    return `
      <section class="expense-day-group">
        <div class="expense-day-head">
          <strong>${shortDateLabel(date)} · ${weekdayLabel(new Date(`${date}T12:00:00`))}</strong>
          <span>${typeLabel(recordType)}：${money.format(dailyTotal)}</span>
        </div>
        <div class="expense-day-card">
          ${expenses.map((expense) => {
            const category = categoryById(expense.categoryId);
            return `
              <article class="expense-row">
                <div class="expense-left">
                  <div class="emoji-tile" style="background:${paintColor(category.color, 0.2)}; color:${escapeHTML(category.color)}">${escapeHTML(category.emoji)}</div>
                  <div class="expense-main">
                    <strong>${escapeHTML(category.name)}</strong>
                    <div class="expense-meta">${escapeHTML(expense.note || "没有备注")}</div>
                  </div>
                </div>
                <div class="expense-amount">${recordType === "income" ? "+" : "−"}${money.format(expense.amount).replace("¥", "¥")}</div>
                <button class="icon-btn" data-delete-expense="${escapeHTML(expense.id)}" type="button" title="删除">⌫</button>
              </article>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }).join("") : `<div class="empty">最近 7 天还没有账单记录。</div>`;
}

function renderStats() {
  const range = periodRange(activePeriod);
  if (activePeriod === "month") {
    const [year, month] = (els.calendarMonth.value || monthKey()).split("-").map(Number);
    range.start = new Date(year, month - 1, 1);
    range.end = new Date(year, month, 0, 23, 59, 59, 999);
  }
  const periodExpenses = recordsOf(statsType).filter((expense) => inRange(expense, range));
  const total = sumExpenses(periodExpenses);
  const totals = categoryTotals(periodExpenses);
  const top = totals.find((item) => item.total > 0);
  const labels = { week: "本周总花销", month: "本月总花销", year: "今年总花销" };
  const summaryLabels = { week: "这周", month: "这个月", year: "今年" };

  els.periodLabel.textContent = `${activePeriod === "week" ? "本周" : activePeriod === "month" ? els.calendarMonth.value : "今年"}总${typeLabel(statsType)}`;
  renderCalendar();
  els.periodTotal.textContent = money.format(total);
  if (els.periodSummary) {
    els.periodSummary.textContent = top
      ? `${summaryLabels[activePeriod]}最会花在「${top.name}」${top.emoji}，占比 ${Math.round((top.total / total) * 100)}%。`
      : "还没有记录，今天可以从一杯水开始。";
  }

  if (activePeriod === "week") {
    els.categoryBars.innerHTML = renderMonthlyDonut(totals, total) + renderWeeklyBreakdown(range, periodExpenses);
  } else if (activePeriod === "month") {
    els.categoryBars.innerHTML = renderMonthlyDonut(totals, total);
  } else {
    els.categoryBars.innerHTML = renderCategoryBars(totals, total);
  }

  if (els.yearPanel) {
    els.yearPanel.hidden = activePeriod !== "year";
  }
  if (els.calendarPanel) {
    els.calendarPanel.hidden = activePeriod !== "month";
  }
  if (activePeriod === "year" && els.yearMonths) {
    renderYearMonths(range.start.getFullYear());
  }
}

function renderCategoryBars(totals, total) {
  return totals.some((item) => item.total > 0) ? totals.map((item) => {
    const percent = total ? Math.round((item.total / total) * 100) : 0;
    return `
      <div class="bar-row">
        <strong>${escapeHTML(item.emoji)} ${escapeHTML(item.name)}</strong>
        <div class="bar-track"><div class="bar-fill" style="width:${percent}%; background:${escapeHTML(item.color)}"></div></div>
        <span>${money.format(item.total)}</span>
      </div>
    `;
  }).join("") : `<div class="empty">这个维度还没有${typeLabel(statsType)}。</div>`;
}

function renderWeeklyBreakdown(range, expenses) {
  const days = [];
  const start = new Date(range.start);

  for (let offset = 0; offset < 7; offset += 1) {
    const cursor = new Date(start);
    cursor.setDate(start.getDate() + offset);
    const isoDate = dateISO(cursor);
    const daily = expenses
      .filter((expense) => expense.date === isoDate)
      .sort((a, b) => b.id.localeCompare(a.id));
    const total = sumExpenses(daily);
    const top = categoryTotals(daily).find((item) => item.total > 0);
    const isToday = isoDate === todayISO();

    days.push(`
      <details class="week-day-card" ${isToday ? "open" : ""}>
        <summary>
          <div>
            <span class="week-day-name">${weekdayLabel(cursor)}${isToday ? " · 今天" : ""}</span>
            <strong>${shortDateLabel(isoDate)}</strong>
          </div>
          <div class="week-day-total">
            <span>${daily.length} 笔</span>
            <strong>${money.format(total)}</strong>
          </div>
        </summary>
        <div class="week-expense-list">
          ${daily.length ? daily.map((expense) => {
            const category = categoryById(expense.categoryId);
            return `
              <article class="week-expense-row">
                <div class="week-expense-left">
                  <div class="emoji-tile is-small" style="background:${paintColor(category.color)}; color:${escapeHTML(category.color)}">${escapeHTML(category.emoji)}</div>
                  <div>
                    <strong>${escapeHTML(expense.note || category.name)}</strong>
                    <span>${escapeHTML(category.name)}</span>
                  </div>
                </div>
                <strong>${money.format(expense.amount)}</strong>
              </article>
            `;
          }).join("") : `<div class="week-empty">${top ? top.emoji : "◌"} 这一天还没有${typeLabel(statsType)}记录</div>`}
        </div>
      </details>
    `);
  }

  return `<div class="week-breakdown">${days.join("")}</div>`;
}

function renderMonthlyDonut(totals, total) {
  const positive = totals.filter((item) => item.total > 0);
  if (!positive.length) {
    return `<div class="empty">所选期间还没有${typeLabel(statsType)}。</div>`;
  }

  let cursor = 0;
  const gradient = positive.map((item, index) => {
    const start = cursor;
    cursor += index === positive.length - 1 ? 360 - cursor : (item.total / total) * 360;
    return `${escapeHTML(item.color)} ${start.toFixed(2)}deg ${cursor.toFixed(2)}deg`;
  }).join(", ");

  const top = positive[0];
  return `
    <div class="donut-summary">
      <div class="donut-chart" style="background: conic-gradient(${gradient});">
        <div>
          <span>最大占比</span>
          <strong>${Math.round((top.total / total) * 100)}%</strong>
        </div>
      </div>
      <div class="donut-legend">
        ${positive.map((item) => {
          const percent = Math.round((item.total / total) * 100);
          return `
            <div class="legend-row">
              <span class="legend-swatch" style="background:${escapeHTML(item.color)}"></span>
              <strong>${escapeHTML(item.emoji)} ${escapeHTML(item.name)}</strong>
              <span>${percent}%</span>
              <em>${money.format(item.total)}</em>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderYearMonths(year) {
  if (!els.yearMonths) return;

  const months = Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    const expenses = expensesForMonth(month, statsType);
    const total = sumExpenses(expenses);
    const top = categoryTotals(expenses).find((item) => item.total > 0);
    const shortName = new Intl.DateTimeFormat("en-US", { month: "short" })
      .format(new Date(Number(year), index, 1));
    return { month, number: index + 1, shortName, total, count: expenses.length, top };
  });
  const maxTotal = Math.max(...months.map((item) => item.total), 0);
  const annualTotal = months.reduce((sum, item) => sum + item.total, 0);
  const now = new Date();
  const averageDivisor = Number(year) === now.getFullYear() ? now.getMonth() + 1 : 12;
  const monthlyAverage = annualTotal / averageDivisor;
  const peakMonth = months.find((item) => item.total === maxTotal && item.total > 0);

  els.yearTitle.textContent = `${year}年每月总${typeLabel(statsType)}`;
  els.yearMonths.innerHTML = `
    <div class="year-summary">
      <div><span>年度总${typeLabel(statsType)}</span><strong>${money.format(annualTotal)}</strong></div>
      <div><span>月均${typeLabel(statsType)}${Number(year) === now.getFullYear() ? ` · 截至 ${months[averageDivisor - 1].shortName}` : ""}</span><strong>${money.format(monthlyAverage)}</strong></div>
      <div><span>${typeLabel(statsType)}最高月</span><strong>${peakMonth ? `${peakMonth.shortName} · ${money.format(peakMonth.total)}` : "暂无"}</strong></div>
    </div>
    <div class="year-bar-chart" role="img" aria-label="${year}年每月${typeLabel(statsType)}柱状图">
      ${months.map((item) => {
        const percent = maxTotal ? Math.max((item.total / maxTotal) * 100, item.total ? 5 : 0) : 0;
        const isPeak = peakMonth?.number === item.number;
        return `
          <div class="year-bar-item ${isPeak ? "is-peak" : ""}" title="${item.shortName}：${money.format(item.total)}，${item.count}笔">
            <span class="year-bar-value">${item.total ? money.format(item.total).replace(".00", "") : ""}</span>
            <div class="year-bar-track"><div style="height:${percent}%"></div></div>
            <strong>${item.shortName}</strong>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderCalendar() {
  const month = els.calendarMonth.value || monthKey();
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(year, monthNumber - 1, 1);
  const days = new Date(year, monthNumber, 0).getDate();
  const leading = first.getDay();
  const monthExpenses = expensesForMonth(month, statsType);
  const cells = [];

  for (let i = 0; i < leading; i += 1) {
    cells.push(`<div class="day-cell is-empty"></div>`);
  }

  for (let day = 1; day <= days; day += 1) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const daily = monthExpenses.filter((expense) => expense.date === date);
    const total = sumExpenses(daily);
    const top = categoryTotals(daily).find((item) => item.total > 0);
    cells.push(`
      <button class="day-cell ${total ? "has-expense" : ""} ${date === todayISO() ? "is-today" : ""}" data-calendar-date="${date}" type="button" style="${top ? `background:${paintColor(top.color, 0.18)}; border-color:${paintColor(top.color, 0.5)}` : ""}">
        <strong>${day}</strong>
        <span>${total ? money.format(total).replace(".00", "") : "-"}</span>
        <em>${top ? top.emoji : "♡"}</em>
      </button>
    `);
  }

  els.calendarTitle && (els.calendarTitle.textContent = `${year}年${monthNumber}月每日花销`);
  els.calendar.innerHTML = cells.join("");
}

function openDayExpenseDialog(date) {
  if (!els.dayExpenseDialog) return;
  selectedDayDialogDate = date;

  const daily = recordsOf(statsType)
    .filter((expense) => expense.date === date)
    .sort((a, b) => b.id.localeCompare(a.id));
  const total = sumExpenses(daily);

  els.dayDialogTitle.textContent = `${date} ${typeLabel(statsType)}记录`;
  els.dayDialogCount.textContent = `${daily.length} 笔`;
  els.dayDialogTotal.textContent = money.format(total);
  els.dayDialogList.innerHTML = daily.length ? daily.map((expense) => {
    const category = categoryById(expense.categoryId);
    return `
      <article class="day-dialog-row">
        <div class="day-dialog-left">
          <div class="emoji-tile is-small" style="background:${paintColor(category.color)}; color:${escapeHTML(category.color)}">${escapeHTML(category.emoji)}</div>
          <div>
            <strong>${escapeHTML(expense.note || category.name)}</strong>
            <span>${escapeHTML(category.name)}</span>
          </div>
        </div>
        <strong>${money.format(expense.amount)}</strong>
      </article>
    `;
  }).join("") : `<div class="empty">这一天还没有${typeLabel(statsType)}记录。</div>`;

  els.dayExpenseDialog.showModal();
}

function budgetForMonth(month) {
  state.budgets[month] ||= { total: 0, categories: {} };
  state.budgets[month].categories ||= {};
  return state.budgets[month];
}

function renderBudgets(preserveInputs = false) {
  const month = els.budgetMonth.value || monthKey();
  const budget = budgetForMonth(month);
  const expenses = expensesForMonth(month);
  const totalSpent = sumExpenses(expenses);
  const totalBudget = Number(budget.total || 0);
  const percent = totalBudget ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
  const remaining = totalBudget - totalSpent;

  if (els.totalBudgetInput && document.activeElement !== els.totalBudgetInput) els.totalBudgetInput.value = totalBudget || "";
  els.totalBudgetFill.style.width = `${percent}%`;
  els.totalBudgetFill.style.background = remaining >= 0 ? "#39c985" : "#ff5f87";
  els.totalBudgetCopy.textContent = totalBudget
    ? `已花 ${money.format(totalSpent)}，${remaining >= 0 ? `还剩 ${money.format(remaining)}` : `超出 ${money.format(Math.abs(remaining))}`}。`
    : `本月已花 ${money.format(totalSpent)}`;

  if (preserveInputs === true) return;
  els.budgetList.innerHTML = categoriesOf("expense").map((category) => {
    const spent = sumExpenses(expenses.filter((expense) => expense.categoryId === category.id));
    const limit = Number(budget.categories[category.id] || 0);
    const ratio = limit ? Math.min((spent / limit) * 100, 100) : 0;
    const left = limit - spent;
    return `
      <article class="budget-row">
        <div class="budget-left">
          <div class="emoji-tile" style="background:${paintColor(category.color)}; color:${escapeHTML(category.color)}">${escapeHTML(category.emoji)}</div>
          <div class="budget-info">
            <strong>${escapeHTML(category.name)}</strong>
            <span class="budget-figures">已花 <b>${money.format(spent)}</b> · 预算 <b>${money.format(limit)}</b></span>
          </div>
        </div>
        <label class="budget-edit-field">
          <span>调整预算</span>
          <input data-budget-category="${escapeHTML(category.id)}" min="0" step="0.01" inputmode="decimal" aria-label="${escapeHTML(category.name)}预算" type="number" value="${limit || ""}" placeholder="0" />
        </label>
        <div class="mini-meter"><div style="width:${ratio}%; background:${left >= 0 ? category.color : "#ff5f87"}"></div></div>
        <p class="budget-copy ${left < 0 ? "is-over" : ""}">${limit ? (left >= 0 ? `剩余 ${money.format(left)}` : `超出 ${money.format(Math.abs(left))}`) : "未设置预算"}</p>
      </article>
    `;
  }).join("");
}

function renderCategories() {
  if (els.categoryNotes) {
    els.categoryNotes.value = state.notes?.categories || "";
  }

  const opened = [...els.categoryGrid.querySelectorAll("details[open]")].map(item => item.dataset.categoryGroup);
  const firstRender = !els.categoryGrid.children.length;
  els.categoryGrid.innerHTML = ["expense", "income"].map(type => `<details class="category-group" data-category-group="${type}" ${opened.includes(type) || firstRender && type === "expense" ? "open" : ""}>
    <summary>${typeLabel(type)}分类 <span>${categoriesOf(type).length} 个 · 展开管理</span></summary>
    <div class="category-group-items">${categoriesOf(type).map((category) => {
    const count = state.expenses.filter((expense) => expense.categoryId === category.id).length;
    return `
      <article class="category-card">
        <div class="category-left">
          <div class="emoji-tile" style="background:${paintColor(category.color)}; color:${escapeHTML(category.color)}">${escapeHTML(category.emoji)}</div>
          <div class="category-copy">
            <strong>${escapeHTML(category.name)}</strong>
            <small>${count} 笔账单</small>
          </div>
        </div>
        <div class="category-actions">
          <button class="icon-btn" data-edit-category="${escapeHTML(category.id)}" type="button" title="编辑">✎</button>
          <button class="icon-btn" data-delete-category="${escapeHTML(category.id)}" type="button" title="删除">⌫</button>
        </div>
      </article>
    `;
  }).join("") || '<p class="empty">还没有分类，新增一个吧。</p>'}</div>
  <button class="primary-btn" type="button" data-add-category="${type}">＋ 新增${typeLabel(type)}分类</button></details>`).join("");
}

function openCategoryDialog(category) {
  const isEditing = Boolean(category);
  if (category) categoryType = typeOf(category);
  els.categoryId.value = category?.id || "";
  els.categoryName.value = category?.name || "";
  els.categoryEmoji.value = category?.emoji || "✨";
  els.categoryColor.value = category?.color || "#ff8db6";
  els.categoryDialogKicker.textContent = `${isEditing ? "编辑" : "新增"}${typeLabel(categoryType)}类别`;
  els.categoryDialogTitle.textContent = isEditing ? category.name : `${typeLabel(categoryType)}类别`;
  els.categoryDialog.showModal();
}

async function deleteCategory(id) {
  const used = state.expenses.some((expense) => expense.categoryId === id);
  if (used) {
    notify("这个类别已经有账单啦，先保留它，历史记录才不会迷路。");
    return;
  }
  if (!await commitChange(() => {
    state.categories = state.categories.filter(category => category.id !== id);
    for (const budget of Object.values(state.budgets)) delete budget.categories[id];
  })) return;
  renderAll();
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function notify(message) {
  const status = document.querySelector("#data-status");
  status.hidden = false;
  status.textContent = message;
}

function updateStorageLabel() {
  document.querySelector("#storage-mode-btn").textContent = temporaryMode ? "临时使用" : "本机保存";
  document.querySelector("#storage-disclosure").textContent = temporaryMode
    ? "临时模式：账本仅保留在本次页面中，关闭或刷新前请导出加密备份。"
    : "账本仅保存在这台设备的当前浏览器，不上传云端。清除浏览器数据会丢失账本，请定期导出加密备份。";
}

document.querySelector("#storage-mode-btn").addEventListener("click", async () => {
  if (temporaryMode) {
    if (!await askSecurityDialog("切换到本机保存后，账本将保留在此浏览器中。是否继续？")) return;
    try {
      const current = localStorage.getItem(STORAGE_KEY);
      if (current !== null) return notify("此浏览器已有其他账本，请先保留备份再切换。");
      localStorage.setItem(STORAGE_KEY, JSON.stringify(WalletSecurity.validate(state)));
      localStorage.setItem("wallet-temporary-mode", "false");
      stateRevision = localStorage.getItem(STORAGE_KEY);
      temporaryMode = false;
    } catch { return notify("切换失败，当前账本仍在本次页面中，请导出备份。"); }
  } else {
    if (storageBlocked) return notify("存储已暂停，无法切换。请先保留原始数据。");
    if (!await askSecurityDialog("切换临时模式会移除此浏览器保存的账本。必须先下载加密备份；账本仍留在本次页面，刷新后清空。是否继续？")) return;
    const password = await askSecurityDialog("设置切换前备份的密码（至少 12 个字符）", true);
    if (password === null) return;
    if (password.length < 12) return notify("密码至少需要 12 个字符。");
    try {
      const encrypted = await WalletSecurity.encrypt(state, password);
      downloadJSON(encrypted, "before-temporary-mode");
      if (!await askSecurityDialog("确认加密备份已下载并妥善保存后，移除此浏览器中的账本。是否确认？")) return;
      if (localStorage.getItem(STORAGE_KEY) !== stateRevision) return notify("其他窗口已修改账本，已取消切换。请重新打开后重试。");
      localStorage.setItem("wallet-temporary-mode", "true");
      localStorage.removeItem(STORAGE_KEY);
      temporaryMode = true;
      stateRevision = null;
    } catch { return notify("切换未完成，请检查存储权限并保留备份。"); }
  }
  updateStorageLabel();
});

function askSecurityDialog(message, password = false) {
  return new Promise(resolve => {
    const dialog = document.querySelector("#security-dialog");
    const input = document.querySelector("#security-password");
    document.querySelector("#security-message").textContent = message;
    input.hidden = !password;
    input.required = password;
    input.value = "";
    dialog.returnValue = "cancel";
    dialog.addEventListener("close", () => {
      const result = dialog.returnValue === "confirm" ? (password ? input.value : true) : null;
      input.value = "";
      resolve(result);
    }, { once: true });
    dialog.showModal();
  });
}

function downloadJSON(payload, suffix) {
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `personal-wallet-${suffix}-${todayISO()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportBackup() {
  await changeQueue;
  const password = await askSecurityDialog("设置备份密码（至少 12 个字符）。请妥善保存，丢失后无法恢复。取消则不导出。", true);
  if (password === null) return;
  if (password.length < 12) return notify("备份密码至少需要 12 个字符。");
  try {
    downloadJSON(await WalletSecurity.encrypt(state, password), "encrypted-backup");
  } catch { notify("加密导出失败。请通过 HTTPS 或本机 localhost 打开应用后重试。"); }
}

async function importBackup(file) {
  await changeQueue;
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error("文件超过 10MB 限制。");
    let backup = JSON.parse(await file.text());
    if (backup.app === "personal-wallet-encrypted") {
      const password = await askSecurityDialog("输入备份密码", true);
      if (password === null) return;
      backup = await WalletSecurity.decrypt(backup, password);
    }
    const next = WalletSecurity.validate(backup);
    if (!await askSecurityDialog(`将恢复 ${next.expenses.length} 笔账单、${next.categories.length} 个分类，并替换当前账本。是否继续？`)) return;
    if (storageBlocked) return notify("当前存储已暂停。请先保留原文件并处理存储问题，再恢复备份。");
    const previous = structuredClone(state);
    const safetyPassword = await askSecurityDialog("先保存恢复前的加密备份。请设置至少 12 个字符的备份密码，取消则停止恢复。", true);
    if (safetyPassword === null) return;
    if (safetyPassword.length < 12) return notify("密码至少需要 12 个字符，尚未恢复。");
    downloadJSON(await WalletSecurity.encrypt(previous, safetyPassword), "before-restore");
    if (!await askSecurityDialog("确认恢复前的加密备份已下载并妥善保存后，替换当前账本。是否确认？")) return;
    if (!await commitChange(() => { state = next; })) return;
    deletedRecord = null;
    document.querySelector("#undo-delete-btn").hidden = true;
    lastImportState = previous;
    document.querySelector("#undo-import-btn").hidden = false;
    renderAll();
    notify("备份已恢复，可在本次会话中撤销恢复。关闭页面前建议导出加密备份。");
  } catch (error) {
    notify("恢复失败，原账本未替换。请检查密码、文件内容和格式。" + (error.message || ""));
  } finally { els.importDataInput.value = ""; }
}

document.querySelector("#undo-import-btn").addEventListener("click", async () => {
  await changeQueue;
  if (!lastImportState || !await askSecurityDialog("撤销恢复会替换恢复后新增的记录，是否继续？")) return;
  if (!await commitChange(() => { state = lastImportState; })) return;
  deletedRecord = null;
  document.querySelector("#undo-delete-btn").hidden = true;
  lastImportState = null;
  document.querySelector("#undo-import-btn").hidden = true;
  renderAll();
});

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    els.tabs.forEach((item) => item.classList.toggle("is-active", item === tab));
    els.views.forEach((view) => view.classList.toggle("is-active", view.id === `${tab.dataset.view}-view`));
    if (tab.dataset.focusRecord) {
      els.expenseAmount.focus();
      els.expenseForm.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
});

els.periodBtns.forEach((button) => {
  button.addEventListener("click", () => {
    activePeriod = button.dataset.period;
    els.periodBtns.forEach((item) => item.classList.toggle("is-active", item === button));
    renderStats();
  });
});

els.exportDataBtn.addEventListener("click", exportBackup);

els.importDataInput.addEventListener("change", () => {
  const file = els.importDataInput.files?.[0];
  if (!file) return;
  importBackup(file);
});

els.expenseForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!WalletSecurity.validAmount(Number(els.expenseAmount.value), false) || !WalletSecurity.validDate(els.expenseDate.value)) return notify("请输入有效日期和最多两位小数的正金额。");
  if (!categoriesOf(recordType).some(item => item.id === els.expenseCategory.value)) return notify("请先在分类页新增对应的分类。");
  const record = {
    type: recordType,
    id: crypto.randomUUID(),
    date: els.expenseDate.value,
    amount: Number(els.expenseAmount.value),
    categoryId: els.expenseCategory.value,
    note: els.expenseNote.value.trim()
  };
  if (!await commitChange(() => state.expenses.push(record))) return;
  els.expenseAmount.value = "";
  els.expenseNote.value = "";
  renderAll();
});

document.querySelector(".quick-amounts").addEventListener("click", (event) => {
  const button = event.target.closest("[data-add-amount]");
  if (!button) return;
  const current = Number(els.expenseAmount.value || 0);
  els.expenseAmount.value = (current + Number(button.dataset.addAmount)).toFixed(2);
});

els.clearAmountBtn.addEventListener("click", () => {
  els.expenseAmount.value = "";
  els.expenseAmount.focus();
});

els.expenseList.addEventListener("click", async (event) => {
  const id = event.target.closest("[data-delete-expense]")?.dataset.deleteExpense;
  if (!id) return;
  const record = state.expenses.find(item => item.id === id);
  if (!record || !await commitChange(() => { state.expenses = state.expenses.filter(item => item.id !== id); })) return;
  deletedRecord = record;
  document.querySelector("#undo-delete-btn").hidden = false;
  renderAll();
  notify("账单已删除，可撤销最近一次删除。");
});

document.querySelector("#undo-delete-btn").addEventListener("click", async () => {
  const record = deletedRecord;
  if (!record || !await commitChange(() => {
    if (!state.expenses.some(item => item.id === record.id)) state.expenses.push(record);
  })) return;
  deletedRecord = null;
  document.querySelector("#undo-delete-btn").hidden = true;
  renderAll();
  notify("已恢复删除的账单。");
});

els.calendar.addEventListener("click", (event) => {
  const date = event.target.closest("[data-calendar-date]")?.dataset.calendarDate;
  if (!date) return;
  openDayExpenseDialog(date);
});

els.calendarMonth.addEventListener("change", renderStats);
els.budgetMonth.addEventListener("change", renderBudgets);

els.totalBudgetInput?.addEventListener("input", async () => {
  const month = els.budgetMonth.value || monthKey();
  const amount = Number(els.totalBudgetInput.value || 0);
  if (!WalletSecurity.validAmount(amount)) return;
  if (!await commitChange(() => { budgetForMonth(month).total = amount; })) return;
  renderHeader();
  renderBudgets(true);
});

els.budgetList.addEventListener("input", async (event) => {
  const id = event.target.dataset.budgetCategory;
  if (!id) return;
  const month = els.budgetMonth.value || monthKey();
  const amount = Number(event.target.value || 0);
  if (!WalletSecurity.validAmount(amount)) return;
  if (!await commitChange(() => {
    const budget = budgetForMonth(month);
    const categoryTotal = categoriesOf("expense").reduce((sum, category) => sum + Math.round(Number(category.id === id ? amount : budget.categories[category.id] || 0) * 100), 0) / 100;
    if (!WalletSecurity.validAmount(categoryTotal)) throw new Error("预算金额超出范围");
    budget.categories[id] = amount;
    budget.total = categoryTotal;
  })) return;
  if (els.budgetMonth.value !== month) return;
  renderHeader();
  renderBudgets(true);
  const row = event.target.closest(".budget-row");
  const spent = sumExpenses(expensesForMonth(els.budgetMonth.value || monthKey()).filter(item => item.categoryId === id));
  const left = amount - spent;
  row.querySelector(".budget-figures").innerHTML = `已花 <b>${money.format(spent)}</b> · 预算 <b>${money.format(amount)}</b>`;
  const meter = row.querySelector(".mini-meter > div");
  meter.style.width = `${amount ? Math.min(spent / amount * 100, 100) : 0}%`;
  meter.style.background = left >= 0 ? categoryById(id).color : "#ff5f87";
  const copy = row.querySelector(".budget-copy");
  copy.classList.toggle("is-over", left < 0);
  copy.textContent = amount ? (left >= 0 ? `剩余 ${money.format(left)}` : `超出 ${money.format(Math.abs(left))}`) : "未设置预算";
});

els.addCategoryBtn.addEventListener("click", () => openCategoryDialog());

els.categoryGrid.addEventListener("click", (event) => {
  const addType = event.target.closest("[data-add-category]")?.dataset.addCategory;
  if (addType) { categoryType = addType; openCategoryDialog(); }
  const editId = event.target.closest("[data-edit-category]")?.dataset.editCategory;
  const deleteId = event.target.closest("[data-delete-category]")?.dataset.deleteCategory;
  if (editId) openCategoryDialog(state.categories.find((category) => category.id === editId));
  if (deleteId) deleteCategory(deleteId);
});

els.categoryNotes?.addEventListener("input", async () => {
  const text = els.categoryNotes.value;
  await commitChange(() => { state.notes ||= {}; state.notes.categories = text; });
});

els.cancelCategoryBtn.addEventListener("click", () => els.categoryDialog.close());

els.closeDayExpensesBtn?.addEventListener("click", () => els.dayExpenseDialog.close());

els.dayExpenseDialog?.addEventListener("click", (event) => {
  if (event.target === els.dayExpenseDialog) {
    els.dayExpenseDialog.close();
  }
});

els.addOnDayBtn?.addEventListener("click", () => {
  if (selectedDayDialogDate) {
    els.expenseDate.value = selectedDayDialogDate;
  }
  recordType = statsType;
  syncTypeButtons("record", recordType);
  renderCategoryOptions();
  renderExpenses();
  els.dayExpenseDialog.close();
  const addTab = [...els.tabs].find((item) => item.dataset.focusRecord);
  addTab?.click();
});

els.categoryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = els.categoryId.value || crypto.randomUUID();
  const payload = {
    type: categoryType,
    id,
    name: els.categoryName.value.trim(),
    emoji: els.categoryEmoji.value.trim(),
    color: els.categoryColor.value
  };
  try { WalletSecurity.validate({ ...state, categories: [payload] , expenses: [], budgets: {} }); } catch { return notify("分类格式无效，名称最多 80 字，图标最多 32 字。"); }
  if (!await commitChange(() => {
    const existing = state.categories.findIndex(category => category.id === id);
    if (existing >= 0) state.categories[existing] = payload;
    else state.categories.push(payload);
  })) return;
  els.categoryDialog.close();
  renderAll();
});

function syncTypeButtons(scope, type) {
  document.querySelectorAll(`[data-${scope}-type]`).forEach(button => {
    const selected = button.dataset[`${scope}Type`] === type;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}
document.querySelectorAll("[data-record-type]").forEach(button => button.addEventListener("click", () => {
  recordType = button.dataset.recordType;
  syncTypeButtons("record", recordType);
  renderCategoryOptions();
  renderExpenses();
}));
document.querySelectorAll("[data-stats-type]").forEach(button => button.addEventListener("click", () => {
  statsType = button.dataset.statsType;
  syncTypeButtons("stats", statsType);
  renderStats();
}));
function boot() {
  updateStorageLabel();
  els.expenseDate.value = todayISO();
  els.calendarMonth.value = monthKey();
  els.budgetMonth.value = monthKey();
  renderAll();
}

boot();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
