const app = document.querySelector("#app");
const DATA_ROOT = "./data/政协委员通";

const SECTION_ICONS = {
  委员之家: { icon: "groups", color: "text-primary", button: "text-primary", border: "hover:border-primary", action: "查看名单" },
  街道委员小组: { icon: "map", color: "text-secondary", button: "text-secondary", border: "hover:border-secondary", action: "打开资料" },
  界别基本情况: { icon: "overview", color: "text-primary", button: "text-primary", border: "hover:border-primary", action: "浏览界别" },
  新时代协商民主实践分中心: { icon: "account_tree", color: "text-secondary", button: "text-secondary", border: "hover:border-secondary", action: "查看实践" },
  委员履职平台: { icon: "domain", color: "text-primary", button: "text-primary", border: "hover:border-primary", action: "查看风采" },
  "2026年履职计划": { icon: "event_note", color: "text-secondary", button: "text-secondary", border: "hover:border-secondary", action: "查看计划" },
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function assetPath(path) {
  return encodeURI(`./${String(path).replace(/\\/g, "/").replace(/^\.\//, "")}`);
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json();
}

function normalizeWhitespace(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

function fillDownRecords(records, key) {
  let current = "";

  return records.map((record) => {
    const value = normalizeWhitespace(record[key]);
    if (value) {
      current = value;
    }

    return {
      ...record,
      [key]: current || value,
    };
  });
}

function parseMonthValue(text) {
  const matched = String(text).match(/(\d+)/);
  return matched ? Number(matched[1]) : Number.MAX_SAFE_INTEGER;
}

function groupCountText(section) {
  const parts = [];
  if (section.counts.tables) parts.push(`${section.counts.tables} 份表格`);
  if (section.counts.documents) parts.push(`${section.counts.documents} 份文稿`);
  if (section.counts.files) parts.push(`${section.counts.files} 份附件`);
  if (section.counts.images) parts.push(`${section.counts.images} 张图片`);
  return parts.join(" / ");
}

function parseCategorySections(documentData, images) {
  const sections = [];
  let current = null;

  for (const raw of documentData.paragraphs) {
    const paragraph = normalizeWhitespace(raw);
    if (!paragraph) continue;

    const headingMatch = paragraph.match(/^(\d+)\.(.+)$/);
    if (headingMatch) {
      if (current) sections.push(current);
      current = {
        order: Number(headingMatch[1]),
        title: normalizeWhitespace(headingMatch[2]),
        paragraphs: [],
      };
      continue;
    }

    if (current) {
      current.paragraphs.push(paragraph);
    }
  }

  if (current) sections.push(current);

  return sections.map((section) => {
    const summary = section.paragraphs.find((item) => item.includes("共有委员")) || section.paragraphs[0] || "";
    const countMatch = summary.match(/共有委员(\d+)名/);
    const image = images.find((item) => new RegExp(`/${section.order}(?!\\d)`).test(item.group || ""));

    return {
      title: section.title,
      summary,
      count: countMatch ? Number(countMatch[1]) : null,
      image: image ? assetPath(`data/政协委员通/03-界别基本情况/${image.file}`) : "",
    };
  });
}

function parseSectorFullData(documentData, images) {
  const sections = [];
  let current = null;

  for (const raw of documentData.paragraphs) {
    const paragraph = normalizeWhitespace(raw);
    if (!paragraph) continue;

    const headingMatch = paragraph.match(/^(\d+)\.(.+)$/);
    if (headingMatch) {
      if (current) sections.push(current);
      current = {
        order: Number(headingMatch[1]),
        title: normalizeWhitespace(headingMatch[2]),
        paragraphs: [],
      };
      continue;
    }

    if (current) {
      current.paragraphs.push(paragraph);
    }
  }

  if (current) sections.push(current);

  return sections.map((section) => {
    const summary = section.paragraphs.find((item) => item.includes("共有委员")) || section.paragraphs[0] || "";
    const countMatch = summary.match(/共有委员(\d+)名/);
    const sectionImages = images.filter((item) => new RegExp(`/${section.order}(?!\\d)`).test(item.group || ""));

    return {
      order: section.order,
      title: section.title,
      summary,
      count: countMatch ? Number(countMatch[1]) : null,
      paragraphs: section.paragraphs,
      images: sectionImages.map((img) => ({
        name: img.name,
        url: assetPath(`data/政协委员通/03-界别基本情况/${img.file}`),
      })),
    };
  });
}

function parsePracticeActivityPlan(documentData) {
  const paragraphs = documentData.paragraphs;
  const schedule = [];
  const pengbuActivities = [];
  const ziyangActivities = [];
  let mode = "schedule";
  let currentOrgs = [];
  let i = 0;

  while (i < paragraphs.length) {
    const p = normalizeWhitespace(paragraphs[i]);
    if (!p) { i++; continue; }

    if (p.includes("彭埠分中心活动安排")) { mode = "pengbu"; i++; continue; }
    if (p.includes("紫阳分中心活动安排")) { mode = "ziyang"; i++; continue; }

    if (mode === "schedule") {
      if (p === "承办单位" || p === "活动时间" || p === "活动形式") { i++; continue; }
      const monthMatch = p.match(/^(\d{1,2})月$/);
      if (monthMatch) {
        const month = Number(monthMatch[1]);
        const form = normalizeWhitespace(paragraphs[i + 1] || "");
        schedule.push({ month, orgs: currentOrgs, form });
        currentOrgs = [];
        i += 2;
        continue;
      }
      if (p) currentOrgs.push(p);
      i++;
    } else {
      const monthMatch = p.match(/^(\d{1,2})月[：:](.+)$/);
      if (monthMatch) {
        const month = Number(monthMatch[1]);
        const content = normalizeWhitespace(monthMatch[2]);
        const dashIndex = content.indexOf("——");
        const title = dashIndex > -1 ? content.substring(0, dashIndex) : content.split(/[—\-]/)[0];
        const desc = dashIndex > -1 ? content.substring(dashIndex + 2) : "";
        const entry = { month, title: normalizeWhitespace(title), description: normalizeWhitespace(desc || content) };
        if (mode === "pengbu") pengbuActivities.push(entry);
        else ziyangActivities.push(entry);
        i++;
        continue;
      }
      if (pengbuActivities.length > 0 && mode === "pengbu") {
        const last = pengbuActivities[pengbuActivities.length - 1];
        if (!last.description || last.description === last.title) {
          last.description = p;
        } else {
          last.description += p;
        }
      }
      if (ziyangActivities.length > 0 && mode === "ziyang") {
        const last = ziyangActivities[ziyangActivities.length - 1];
        if (!last.description || last.description === last.title) {
          last.description = p;
        } else {
          last.description += p;
        }
      }
      i++;
    }
  }

  return { schedule, pengbuActivities, ziyangActivities };
}

function groupRecordsByKey(records, groupKey) {
  const filled = fillDownRecords(records, groupKey);
  const groups = new Map();
  for (const record of filled) {
    const key = normalizeWhitespace(record[groupKey]) || "未分组";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  return Array.from(groups.entries()).map(([name, items]) => ({ name, records: items }));
}

function parseStudioFullCards(images, studios) {
  const studioMap = new Map(studios.map((studio) => [normalizeWhitespace(studio.name), studio]));

  return images
    .filter((item) => !item.name.includes("供参考"))
    .map((item) => {
      const dashIdx = item.name.indexOf("-");
      const numStr = dashIdx > 0 ? item.name.substring(0, dashIdx) : "";
      const rest = dashIdx > 0 ? item.name.substring(dashIdx + 1) : item.name;
      const parts = rest.split("-");
      const studioName = normalizeWhitespace(parts.shift() || rest);
      const summary = normalizeWhitespace(parts.join("-")) || "委员工作室活动剪影";
      const studio = studioMap.get(studioName);

      return {
        id: numStr ? Number(numStr) : null,
        title: studioName,
        summary,
        leader: studio?.leader || "",
        address: studio?.address || "",
        image: assetPath(`data/政协委员通/05-委员履职平台/${item.file}`),
      };
    });
}

function parseStudioCards(images, studios) {
  const studioMap = new Map(studios.map((studio) => [normalizeWhitespace(studio.name), studio]));

  return images
    .filter((item) => !item.name.includes("供参考"))
    .slice(0, 6)
    .map((item) => {
      const parts = item.name.split("-");
      parts.shift();
      const studioName = normalizeWhitespace(parts.shift() || item.name);
      const summary = normalizeWhitespace(parts.join("-")) || "委员工作室活动剪影";
      const studio = studioMap.get(studioName);

      return {
        title: studioName,
        summary,
        date: studio?.address || "上城区政协委员工作室",
        image: assetPath(`data/政协委员通/05-委员履职平台/${item.file}`),
      };
    });
}

function parsePracticeCards(images) {
  return images.slice(0, 6).map((item, index) => ({
    title: normalizeWhitespace(item.name.replace(/^[^-]+-/, "")),
    summary: "新时代协商民主实践分中心活动现场",
    date: `活动 ${String(index + 1).padStart(2, "0")}`,
    image: assetPath(`data/政协委员通/04-新时代协商民主实践分中心/${item.file}`),
  }));
}

function parseAnnualPlans(planTable) {
  return fillDownRecords(planTable.sheets[0].data.records, "界别").map((record) => ({
    sector: normalizeWhitespace(record["界别"]),
    title: normalizeWhitespace(record["活动名称"]),
    type: normalizeWhitespace(record["活动类型"]),
    month: normalizeWhitespace(record["拟召开时间"]),
  }));
}

const SECTION_PAGE_MAP = {
  委员之家: "members",
  街道委员小组: "members",
  界别基本情况: "sectors",
  新时代协商民主实践分中心: "practice",
  委员履职平台: "platform",
  "2026年履职计划": "plan",
};

function makeSectionCards(rootSections, detailSections) {
  return rootSections
    .filter((item) => item.title !== "星级委员工作室风采")
    .slice(0, 6)
    .map((item) => {
      const detail = detailSections.find((section) => section.folder === item.folder);
      const iconMeta = SECTION_ICONS[item.title] || SECTION_ICONS["委员之家"];

      return {
        title: item.title,
        summary: groupCountText(detail) || "栏目资料已接入首页。",
        action: iconMeta.action,
        icon: iconMeta.icon,
        color: iconMeta.color,
        button: iconMeta.button,
        border: iconMeta.border,
        page: SECTION_PAGE_MAP[item.title] || "home",
      };
    });
}

function buildTimelineItems(platformStats, annualPlans) {
  const sortedPlans = [...annualPlans].sort((a, b) => parseMonthValue(a.month) - parseMonthValue(b.month));

  return [
    {
      tone: "primary",
      title: "星级委员工作室认定",
      date: "2025年度",
      summary: `五星级 ${platformStats.five_star} 家，四星级 ${platformStats.four_star} 家，三星级 ${platformStats.three_star} 家。`,
    },
    ...sortedPlans.slice(0, 3).map((item, index) => ({
      tone: index % 2 === 0 ? "secondary" : "primary",
      title: item.title,
      date: `2026年${item.month}`,
      summary: `${item.sector} · ${item.type}`,
    })),
  ];
}

function renderStatus(title, summary) {
  return `
    <div class="min-h-screen flex items-center justify-center px-6">
      <div class="max-w-2xl rounded-lg border border-stone-200 bg-white p-10 shadow-sm">
        <p class="text-primary font-label-bold">${escapeHtml(title)}</p>
        <p class="mt-3 text-stone-600">${escapeHtml(summary)}</p>
      </div>
    </div>
  `;
}

function renderCards(cards) {
  return cards
    .map(
      (card) => `
        <div class="group bg-white p-8 border border-stone-200 ${card.border} hover:shadow-xl transition-all">
          <div class="mb-6">
            <span class="material-symbols-outlined text-4xl ${card.color}" data-weight="fill">${escapeHtml(card.icon)}</span>
          </div>
          <h3 class="font-headline-sm text-headline-sm mb-4">${escapeHtml(card.title)}</h3>
          <p class="text-stone-600 font-body-md mb-6 leading-relaxed">${escapeHtml(card.summary)}</p>
          <a class="${card.button} font-label-bold group-hover:gap-3 transition-all flex items-center gap-2 cursor-pointer" data-page="${escapeHtml(card.page)}">
            ${escapeHtml(card.action)} <span class="material-symbols-outlined text-sm">arrow_forward</span>
          </a>
        </div>
      `,
    )
    .join("");
}

function renderFeedItems(items) {
  return items
    .map(
      (item) => `
        <div class="flex gap-6 group cursor-pointer">
          <div class="w-24 h-24 flex-shrink-0 bg-stone-100 overflow-hidden">
            <img class="w-full h-full object-cover group-hover:scale-110 transition-transform" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}"/>
          </div>
          <div class="flex flex-col justify-center">
            <h4 class="font-label-bold text-lg group-hover:text-primary transition-colors">${escapeHtml(item.title)}</h4>
            <span class="text-stone-400 text-label-sm mt-2">${escapeHtml(item.date)}</span>
          </div>
        </div>
      `,
    )
    .join("");
}

function renderTimeline(items) {
  return items
    .map(
      (item) => `
        <div class="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
          <div class="flex items-center justify-center w-8 h-8 rounded-full border border-white ${item.tone === "secondary" ? "bg-secondary" : "bg-primary"} text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
            <span class="material-symbols-outlined text-xs">${item.tone === "secondary" ? "sync" : "done"}</span>
          </div>
          <div class="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 bg-stone-50 border border-stone-100 rounded-lg shadow-sm">
            <div class="flex items-center justify-between space-x-2 mb-1">
              <div class="font-label-bold ${item.tone === "secondary" ? "text-secondary" : "text-primary"}">${escapeHtml(item.title)}</div>
              <time class="font-label-sm text-stone-500">${escapeHtml(item.date)}</time>
            </div>
            <div class="text-stone-600">${escapeHtml(item.summary)}</div>
          </div>
        </div>
      `,
    )
    .join("");
}

function renderGallery(images, basePath) {
  if (!images || images.length === 0) return "";
  return `
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      ${images.map((img) => {
        const url = typeof img === "string" ? img : img.url;
        const name = typeof img === "string" ? "" : img.name;
        return `
          <div class="gallery-item aspect-square bg-stone-100 overflow-hidden rounded-lg cursor-pointer group" data-url="${escapeHtml(url)}" data-name="${escapeHtml(name)}">
            <img class="w-full h-full object-cover group-hover:scale-110 transition-transform" src="${escapeHtml(url)}" alt="${escapeHtml(name)}" loading="lazy"/>
          </div>`;
      }).join("")}
    </div>`;
}

function renderLightbox() {
  return `<div id="lightbox" class="fixed inset-0 z-[100] bg-black/85 hidden items-center justify-center p-4 cursor-pointer flex-col">
    <img id="lightbox-img" class="max-w-full max-h-[85vh] object-contain rounded" src="" alt=""/>
    <p id="lightbox-caption" class="text-white/90 text-sm mt-3 text-center max-w-2xl"></p>
  </div>`;
}

function renderMemberGroupTable(groups, columns) {
  return groups.map((group) => `
    <details class="border border-stone-200 rounded-lg mb-3 bg-white overflow-hidden">
      <summary class="px-6 py-4 cursor-pointer hover:bg-stone-50 flex items-center justify-between font-label-bold text-on-surface">
        <span>${escapeHtml(group.name)}</span>
        <span class="text-stone-400 font-label-sm">${group.records.length} 人</span>
      </summary>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-stone-50 text-stone-600">
            <tr>${columns.map((col) => `<th class="px-4 py-3 text-left font-label-bold whitespace-nowrap">${escapeHtml(col.label)}</th>`).join("")}</tr>
          </thead>
          <tbody class="divide-y divide-stone-100">
            ${group.records.map((record, idx) => `
              <tr class="hover:bg-stone-50/50">
                ${columns.map((col) => {
                  const val = col.key === "_index" ? String(idx + 1) : normalizeWhitespace(record[col.key] ?? "");
                  return `<td class="px-4 py-2.5 whitespace-nowrap">${escapeHtml(val)}</td>`;
                }).join("")}
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </details>`).join("");
}

function renderSectorCards(sectors) {
  return `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      ${sectors.map((sector) => `
        <div class="bg-white border border-stone-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
          <div class="p-6">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-headline-sm text-headline-sm">${escapeHtml(sector.title)}</h3>
              ${sector.count ? `<span class="bg-primary/10 text-primary px-3 py-1 rounded-full text-label-bold">${sector.count} 名委员</span>` : ""}
            </div>
            <p class="text-stone-600 text-body-md line-clamp-3 mb-4">${escapeHtml(sector.summary)}</p>
            ${sector.images.length > 0 ? `
              <div class="flex gap-2 mb-4 overflow-x-auto pb-2">
                ${sector.images.slice(0, 3).map((img) => `
                  <div class="gallery-item flex-shrink-0 w-20 h-20 bg-stone-100 rounded overflow-hidden cursor-pointer" data-url="${escapeHtml(img.url)}" data-name="${escapeHtml(img.name)}">
                    <img class="w-full h-full object-cover" src="${escapeHtml(img.url)}" alt="" loading="lazy"/>
                  </div>`).join("")}
                ${sector.images.length > 3 ? `<span class="flex-shrink-0 w-20 h-20 flex items-center justify-center text-stone-400 text-label-sm bg-stone-50 rounded">+${sector.images.length - 3}</span>` : ""}
              </div>` : ""}
            <details class="group">
              <summary class="text-primary font-label-bold cursor-pointer hover:underline flex items-center gap-1">
                <span class="group-open:hidden">展开详情</span>
                <span class="hidden group-open:inline">收起详情</span>
                <span class="material-symbols-outlined text-sm transition-transform group-open:rotate-180">expand_more</span>
              </summary>
              <div class="mt-4 pt-4 border-t border-stone-100">
                <div class="space-y-3 text-body-md text-stone-700 leading-relaxed">
                  ${sector.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
                </div>
                ${sector.images.length > 0 ? `
                  <div class="mt-6">
                    <h4 class="font-label-bold text-stone-500 mb-3">活动照片</h4>
                    ${renderGallery(sector.images)}
                  </div>` : ""}
              </div>
            </details>
          </div>
        </div>`).join("")}
    </div>`;
}

function renderPracticeSchedule(schedule) {
  if (!schedule || schedule.length === 0) return "";
  return `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-stone-50 text-stone-600">
          <tr>
            <th class="px-4 py-3 text-left font-label-bold">月份</th>
            <th class="px-4 py-3 text-left font-label-bold">承办单位</th>
            <th class="px-4 py-3 text-left font-label-bold">活动形式</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-stone-100">
          ${schedule.map((item) => `
            <tr class="hover:bg-stone-50/50">
              <td class="px-4 py-2.5 font-label-bold text-primary">${escapeHtml(String(item.month) + "月")}</td>
              <td class="px-4 py-2.5">${escapeHtml(item.orgs.join("、"))}</td>
              <td class="px-4 py-2.5">${escapeHtml(item.form)}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

function renderActivityTimeline(activities, centerName) {
  if (!activities || activities.length === 0) return "";
  return `
    <div class="space-y-4">
      ${activities.map((item) => `
        <div class="flex gap-4 group">
          <div class="flex flex-col items-center">
            <div class="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-label-bold text-sm">${item.month}</div>
            <div class="w-px flex-1 bg-stone-200 group-last:hidden"></div>
          </div>
          <div class="pb-6 flex-1">
            <h4 class="font-label-bold text-on-surface mb-1">${escapeHtml(item.title)}</h4>
            <p class="text-stone-600 text-sm leading-relaxed">${escapeHtml(item.description)}</p>
          </div>
        </div>`).join("")}
    </div>`;
}

function renderStudioGrid(studios) {
  return `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      ${studios.map((studio) => `
        <div class="bg-white border border-stone-200 rounded-lg p-5 hover:shadow-md transition-shadow">
          <div class="flex items-start gap-3">
            <span class="material-symbols-outlined text-primary text-2xl mt-0.5">domain</span>
            <div class="flex-1 min-w-0">
              <h4 class="font-label-bold text-on-surface truncate">${escapeHtml(studio.name)}</h4>
              <p class="text-stone-500 text-label-sm mt-1">领衔：${escapeHtml(studio.leader)}</p>
              <p class="text-stone-400 text-label-sm mt-1 flex items-start gap-1">
                <span class="material-symbols-outlined text-xs mt-0.5">location_on</span>
                <span class="line-clamp-2">${escapeHtml(studio.address)}</span>
              </p>
            </div>
          </div>
        </div>`).join("")}
    </div>`;
}

function renderPlanGroups(groups) {
  return groups.map((group) => `
    <details class="border border-stone-200 rounded-lg mb-3 bg-white overflow-hidden" open>
      <summary class="px-6 py-4 cursor-pointer hover:bg-stone-50 flex items-center justify-between font-label-bold text-on-surface">
        <span>${escapeHtml(group.name)}</span>
        <span class="text-stone-400 font-label-sm">${group.items.length} 项活动</span>
      </summary>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-stone-50 text-stone-600">
            <tr>
              <th class="px-4 py-3 text-left font-label-bold">活动名称</th>
              <th class="px-4 py-3 text-left font-label-bold">活动类型</th>
              <th class="px-4 py-3 text-left font-label-bold">时间</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-stone-100">
            ${group.items.map((item) => `
              <tr class="hover:bg-stone-50/50">
                <td class="px-4 py-2.5">${escapeHtml(item.title)}</td>
                <td class="px-4 py-2.5"><span class="bg-stone-100 px-2 py-0.5 rounded text-label-sm">${escapeHtml(item.type)}</span></td>
                <td class="px-4 py-2.5 text-primary font-label-bold">${escapeHtml(item.month)}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </details>`).join("");
}

function renderPage(data) {
  return `
    <header class="fixed top-0 w-full h-16 z-50 bg-red-800 shadow-lg border-b-2 border-yellow-600/30">
      <div class="flex justify-between items-center max-w-[1440px] mx-auto px-4 md:px-8 w-full h-full">
        <div class="flex items-center gap-3">
          <button id="mobile-menu-btn" class="md:hidden text-white p-1" aria-label="菜单">
            <span class="material-symbols-outlined">menu</span>
          </button>
          <span class="text-lg md:text-xl font-bold text-white tracking-tight">${escapeHtml(data.siteTitle)}</span>
        </div>
        <nav class="hidden md:flex h-full items-center">
          <ul class="flex h-full items-center">
            ${data.nav
              .map(
                (item, index) => `
                  <li>
                    <button class="nav-item ${index === 0 ? "text-white font-bold border-b-4 border-yellow-500 pb-4 h-full flex items-center px-4 pt-1" : "text-white/90 hover:text-white hover:bg-white/10 px-4 transition-colors font-label-bold h-full flex items-center"}" data-page="${escapeHtml(item.key)}">
                      ${escapeHtml(item.label)}
                    </button>
                  </li>`,
              )
              .join("")}
          </ul>
        </nav>
        <div class="flex items-center gap-3 md:gap-6">
          <div class="hidden lg:flex flex-col items-end text-white/85">
            <span class="text-label-sm">数据更新时间</span>
            <span class="font-label-bold">${escapeHtml(data.updatedAt)}</span>
          </div>
          <a class="bg-yellow-500 hover:bg-yellow-600 text-red-900 font-bold py-2 px-4 md:px-6 rounded-lg transition-all text-label-bold" href="#" data-page="download">下载</a>
        </div>
      </div>
      <div id="mobile-menu" class="hidden md:hidden bg-red-900 border-t border-white/10">
        <div class="px-4 py-3 grid grid-cols-2 gap-2">
          ${data.nav.map((item) => `
            <a class="text-white/90 hover:text-white hover:bg-white/10 px-3 py-2.5 rounded text-sm font-label-bold nav-item-mobile" href="#" data-page="${escapeHtml(item.key)}">${escapeHtml(item.label)}</a>`).join("")}
        </div>
      </div>
    </header>
    <main id="main-content" class="pt-16">

      <div class="page-panel is-active" data-page="home">
        <section class="relative h-[600px] overflow-hidden">
          <img class="w-full h-full object-cover" src="${escapeHtml(data.hero.image)}" alt="${escapeHtml(data.hero.alt)}"/>
          <div class="absolute inset-0 bg-gradient-to-r from-red-900/80 to-transparent flex items-center">
            <div class="max-w-[1200px] mx-auto px-8 w-full">
              <div class="max-w-2xl text-white">
                <span class="bg-yellow-500 text-red-900 px-3 py-1 text-label-bold rounded-sm mb-6 inline-block">${escapeHtml(data.hero.badge)}</span>
                <h1 class="font-display-lg text-display-lg mb-6 leading-tight">${escapeHtml(data.hero.title)}</h1>
                <p class="font-body-lg text-body-lg opacity-90 mb-8">${escapeHtml(data.hero.summary)}</p>
                <div class="flex gap-4">
                  <a class="bg-white text-red-800 font-label-bold py-4 px-8 rounded-lg hover:bg-stone-100 transition-all flex items-center gap-2" href="#" data-page="plan">
                    ${escapeHtml(data.hero.action)}
                    <span class="material-symbols-outlined">arrow_forward</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section class="py-16 bg-white border-b border-stone-200">
          <div class="max-w-[1200px] mx-auto px-8">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
              ${data.stats
                .map(
                  (item) => `
                    <div class="flex flex-col border-l-4 ${item.tone === "secondary" ? "border-secondary" : "border-primary"} pl-6">
                      <span class="text-stone-500 font-label-bold">${escapeHtml(item.label)}</span>
                      <div class="flex items-baseline gap-2 mt-2">
                        <span class="text-4xl font-display-lg ${item.tone === "secondary" ? "text-secondary" : "text-primary"}">${escapeHtml(item.value)}</span>
                        <span class="text-stone-400 font-label-sm">${escapeHtml(item.unit)}</span>
                      </div>
                    </div>`,
                )
                .join("")}
            </div>
          </div>
        </section>
        <section class="py-16 bg-surface">
          <div class="max-w-[1200px] mx-auto px-8">
            <h2 class="font-headline-md text-headline-md text-on-surface mb-2">栏目服务矩阵</h2>
            <div class="w-16 h-1 bg-primary mb-10"></div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              ${renderCards(data.cards)}
            </div>
          </div>
        </section>
      </div>

      <div class="page-panel" data-page="members">
        <section class="py-16 bg-white">
          <div class="max-w-[1200px] mx-auto px-8">
            <h2 class="font-headline-md text-headline-md text-on-surface mb-2">委员之家</h2>
            <div class="w-16 h-1 bg-primary mb-8"></div>
            <div class="flex gap-8 border-b border-stone-200 mb-8" role="tablist" aria-label="委员名单切换">
              ${data.memberTabs.map((tab, index) => `
                <button class="member-tab-button pb-4 ${index === 0 ? "border-b-2 border-primary text-primary" : "text-stone-400 hover:text-stone-600"} font-label-bold" data-member-tab="${escapeHtml(tab.key)}" role="tab" aria-selected="${index === 0}" >
                  ${escapeHtml(tab.label)} <span class="text-stone-400 font-label-sm">(${tab.total})</span>
                </button>`).join("")}
            </div>
            ${data.memberTabs.map((tab, index) => `
              <div class="member-tab-panel ${index === 0 ? "" : "hidden"}" data-member-panel="${escapeHtml(tab.key)}">
                ${renderMemberGroupTable(tab.groups, tab.columns)}
              </div>`).join("")}
          </div>
        </section>
      </div>

      <div class="page-panel" data-page="sectors">
        <section class="py-16 bg-surface">
          <div class="max-w-[1200px] mx-auto px-8">
            <h2 class="font-headline-md text-headline-md text-on-surface mb-2">界别基本情况</h2>
            <div class="w-16 h-1 bg-primary mb-4"></div>
            <p class="text-stone-500 mb-8">共 ${data.sectors.length} 个界别，${data.sectors.reduce((s, e) => s + (e.count || 0), 0)} 名委员</p>
            ${renderSectorCards(data.sectors)}
          </div>
        </section>
      </div>

      <div class="page-panel" data-page="practice">
        <section class="py-16 bg-white">
          <div class="max-w-[1200px] mx-auto px-8">
            <h2 class="font-headline-md text-headline-md text-on-surface mb-2">新时代协商民主实践分中心</h2>
            <div class="w-16 h-1 bg-primary mb-8"></div>
            <div class="bg-stone-50 rounded-lg p-8 mb-12">
              <div class="space-y-3 text-body-md text-stone-700 leading-relaxed">
                ${data.practice.basicInfo.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
              </div>
            </div>
            <h3 class="font-headline-sm text-headline-sm mb-6">界别、小组活动安排</h3>
            ${renderPracticeSchedule(data.practice.schedule)}
          </div>
        </section>
        <section class="py-16 bg-surface">
          <div class="max-w-[1200px] mx-auto px-8">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div>
                <h3 class="font-headline-sm text-headline-sm mb-6 flex items-center gap-2">
                  <span class="material-symbols-outlined text-primary">location_on</span>
                  彭埠分中心活动安排
                </h3>
                ${renderActivityTimeline(data.practice.pengbuActivities)}
              </div>
              <div>
                <h3 class="font-headline-sm text-headline-sm mb-6 flex items-center gap-2">
                  <span class="material-symbols-outlined text-secondary">location_on</span>
                  紫阳分中心活动安排
                </h3>
                ${renderActivityTimeline(data.practice.ziyangActivities)}
              </div>
            </div>
          </div>
        </section>
        <section class="py-16 bg-white">
          <div class="max-w-[1200px] mx-auto px-8">
            <h3 class="font-headline-sm text-headline-sm mb-6">彭埠分中心活动照片</h3>
            ${renderGallery(data.practice.pengbuImages)}
            <h3 class="font-headline-sm text-headline-sm mb-6 mt-12">紫阳分中心活动照片</h3>
            ${renderGallery(data.practice.ziyangImages)}
          </div>
        </section>
      </div>

      <div class="page-panel" data-page="platform">
        <section class="py-16 bg-white">
          <div class="max-w-[1200px] mx-auto px-8">
            <h2 class="font-headline-md text-headline-md text-on-surface mb-2">委员履职平台</h2>
            <div class="w-16 h-1 bg-primary mb-8"></div>
            <div class="bg-stone-50 rounded-lg p-8 mb-10">
              <p class="text-body-md text-stone-700 leading-relaxed">${escapeHtml(data.platform.overview)}</p>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
              <div class="bg-primary/5 rounded-lg p-5 text-center">
                <div class="text-3xl font-display-lg text-primary">${data.platform.totalStudios}</div>
                <div class="text-stone-500 font-label-bold mt-1">工作室总数</div>
              </div>
              <div class="bg-yellow-50 rounded-lg p-5 text-center">
                <div class="text-3xl font-display-lg text-secondary">${data.platform.fiveStar}</div>
                <div class="text-stone-500 font-label-bold mt-1">五星级</div>
              </div>
              <div class="bg-yellow-50/50 rounded-lg p-5 text-center">
                <div class="text-3xl font-display-lg text-secondary">${data.platform.fourStar}</div>
                <div class="text-stone-500 font-label-bold mt-1">四星级</div>
              </div>
              <div class="bg-stone-100 rounded-lg p-5 text-center">
                <div class="text-3xl font-display-lg text-stone-500">${data.platform.threeStar}</div>
                <div class="text-stone-500 font-label-bold mt-1">三星级</div>
              </div>
            </div>
            <h3 class="font-headline-sm text-headline-sm mb-6">50家委员工作室</h3>
            ${renderStudioGrid(data.platform.studios)}
          </div>
        </section>
        <section class="py-16 bg-surface">
          <div class="max-w-[1200px] mx-auto px-8">
            <h3 class="font-headline-sm text-headline-sm mb-6">工作室活动照片</h3>
            ${renderGallery(data.platform.images)}
          </div>
        </section>
      </div>

      <div class="page-panel" data-page="plan">
        <section class="py-16 bg-white">
          <div class="max-w-[1200px] mx-auto px-8">
            <h2 class="font-headline-md text-headline-md text-on-surface mb-2">2026年履职计划</h2>
            <div class="w-16 h-1 bg-primary mb-8"></div>
            <div class="flex gap-8 border-b border-stone-200 mb-8" role="tablist" aria-label="计划切换">
              ${data.planTabs.map((tab, index) => `
                <button class="plan-tab-button pb-4 ${index === 0 ? "border-b-2 border-primary text-primary" : "text-stone-400 hover:text-stone-600"} font-label-bold" data-plan-tab="${escapeHtml(tab.key)}" role="tab" aria-selected="${index === 0}">
                  ${escapeHtml(tab.label)}
                </button>`).join("")}
            </div>
            ${data.planTabs.map((tab, index) => `
              <div class="plan-tab-panel ${index === 0 ? "" : "hidden"}" data-plan-panel="${escapeHtml(tab.key)}">
                ${renderPlanGroups(tab.groups)}
              </div>`).join("")}
          </div>
        </section>
      </div>

      <div class="page-panel" data-page="download">
        <section id="cta" class="py-24 bg-red-900 text-white relative overflow-hidden">
          <div class="absolute inset-0 opacity-10">
            <div class="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
          </div>
          <div class="max-w-[1200px] mx-auto px-8 text-center relative z-10">
            <h2 class="font-display-lg text-display-lg mb-6">${escapeHtml(data.cta.title)}</h2>
            <p class="font-body-lg text-body-lg opacity-80 mb-10 max-w-2xl mx-auto">${escapeHtml(data.cta.summary)}</p>
            <div class="flex flex-col sm:flex-row justify-center gap-6">
              <a class="bg-white text-red-900 font-label-bold py-4 px-10 rounded-lg flex items-center justify-center gap-3 hover:bg-stone-100 transition-all" href="${escapeHtml(data.cta.primary.href)}" target="_blank" rel="noreferrer">
                <span class="material-symbols-outlined">download</span>
                ${escapeHtml(data.cta.primary.label)}
              </a>
              <a class="bg-transparent border border-white/40 text-white font-label-bold py-4 px-10 rounded-lg flex items-center justify-center gap-3 hover:bg-white/10 transition-all" href="#" data-page="home">
                <span class="material-symbols-outlined">arrow_upward</span>
                ${escapeHtml(data.cta.secondary.label)}
              </a>
            </div>
          </div>
        </section>
      </div>

    </main>
    ${renderLightbox()}
    <footer class="w-full mt-auto border-t-4 border-red-800 bg-stone-50">
      <div class="py-12 px-12 max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div>
          <div class="text-lg font-bold text-stone-800 mb-4">杭州市上城区政协</div>
          <p class="text-sm font-sans leading-relaxed text-stone-600 max-w-md">${escapeHtml(data.footer.summary)}</p>
        </div>
        <div class="flex flex-col md:items-end gap-6">
          <nav class="flex flex-wrap gap-x-8 gap-y-2 justify-start md:justify-end">
            ${data.nav
              .map((item) => `<a class="text-stone-500 hover:text-red-800 hover:underline transition-all text-sm nav-link" href="#" data-page="${escapeHtml(item.key)}">${escapeHtml(item.label)}</a>`)
              .join("")}
          </nav>
          <div class="text-sm font-sans leading-relaxed text-stone-600 text-right">
            ${escapeHtml(data.footer.copy)}<br/>
            ${escapeHtml(data.footer.updatedAt)}
          </div>
        </div>
      </div>
    </footer>
  `;
}

function bindTabs() {
  const buttons = app.querySelectorAll("[data-tab]");
  const panels = app.querySelectorAll("[data-panel]");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.getAttribute("data-tab");

      buttons.forEach((item) => {
        const active = item === button;
        item.setAttribute("aria-selected", active ? "true" : "false");
        item.classList.toggle("border-b-2", active);
        item.classList.toggle("border-primary", active);
        item.classList.toggle("text-primary", active);
        item.classList.toggle("text-stone-400", !active);
      });

      panels.forEach((panel) => {
        panel.classList.toggle("is-active", panel.getAttribute("data-panel") === key);
      });
    });
  });
}

function bindMemberTabs() {
  const buttons = app.querySelectorAll("[data-member-tab]");
  const panels = app.querySelectorAll("[data-member-panel]");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.getAttribute("data-member-tab");

      buttons.forEach((item) => {
        const active = item === button;
        item.setAttribute("aria-selected", active ? "true" : "false");
        item.classList.toggle("border-b-2", active);
        item.classList.toggle("border-primary", active);
        item.classList.toggle("text-primary", active);
        item.classList.toggle("text-stone-400", !active);
      });

      panels.forEach((panel) => {
        panel.classList.toggle("hidden", panel.getAttribute("data-member-panel") !== key);
      });
    });
  });
}

function bindPlanTabs() {
  const buttons = app.querySelectorAll("[data-plan-tab]");
  const panels = app.querySelectorAll("[data-plan-panel]");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.getAttribute("data-plan-tab");

      buttons.forEach((item) => {
        const active = item === button;
        item.setAttribute("aria-selected", active ? "true" : "false");
        item.classList.toggle("border-b-2", active);
        item.classList.toggle("border-primary", active);
        item.classList.toggle("text-primary", active);
        item.classList.toggle("text-stone-400", !active);
      });

      panels.forEach((panel) => {
        panel.classList.toggle("hidden", panel.getAttribute("data-plan-panel") !== key);
      });
    });
  });
}

function navigateToPage(targetPage) {
  const navItems = app.querySelectorAll(".nav-item");
  const pagePanels = app.querySelectorAll(".page-panel");

  navItems.forEach((nav) => {
    const active = nav.getAttribute("data-page") === targetPage;
    nav.classList.toggle("text-white", active);
    nav.classList.toggle("font-bold", active);
    nav.classList.toggle("border-b-4", active);
    nav.classList.toggle("border-yellow-500", active);
    nav.classList.toggle("pb-4", active);
    nav.classList.toggle("pt-1", active);
    nav.classList.toggle("text-white/90", !active);
  });

  pagePanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.getAttribute("data-page") === targetPage);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function bindNavPages() {
  app.addEventListener("click", (e) => {
    const target = e.target.closest("[data-page]");
    if (!target) return;
    e.preventDefault();
    const key = target.getAttribute("data-page");
    navigateToPage(key);
  });
}

function bindLightbox() {
  const lightbox = app.querySelector("#lightbox");
  const lightboxImg = app.querySelector("#lightbox-img");
  const lightboxCaption = app.querySelector("#lightbox-caption");
  if (!lightbox) return;

  app.addEventListener("click", (e) => {
    const item = e.target.closest(".gallery-item");
    if (!item) return;
    const url = item.getAttribute("data-url");
    const name = item.getAttribute("data-name") || "";
    if (url) {
      lightboxImg.src = url;
      lightboxImg.alt = name;
      lightboxCaption.textContent = name;
      lightbox.classList.remove("hidden");
      lightbox.classList.add("flex");
      document.body.style.overflow = "hidden";
    }
  });

  lightbox.addEventListener("click", () => {
    lightbox.classList.add("hidden");
    lightbox.classList.remove("flex");
    lightboxImg.src = "";
    document.body.style.overflow = "";
  });
}

function bindMobileMenu() {
  const btn = app.querySelector("#mobile-menu-btn");
  const menu = app.querySelector("#mobile-menu");
  if (!btn || !menu) return;

  btn.addEventListener("click", () => {
    menu.classList.toggle("hidden");
  });

  menu.addEventListener("click", (e) => {
    const item = e.target.closest("[data-page]");
    if (item) menu.classList.add("hidden");
  });
}

async function loadSiteData() {
  const root = await fetchJson(assetPath(`${DATA_ROOT}/index.json`));
  const details = await Promise.all(
    root.sections.map(async (section) => {
      const detail = await fetchJson(assetPath(`${root.root}/${section.index}`));
      return { ...section, ...detail };
    }),
  );

  const sectionMap = Object.fromEntries(details.map((item) => [item.folder, item]));
  const homeSection = sectionMap["01-委员之家"];
  const categorySection = sectionMap["03-界别基本情况"];
  const practiceSection = sectionMap["04-新时代协商民主实践分中心"];
  const platformSection = sectionMap["05-委员履职平台"];
  const planSection = sectionMap["07-2026年履职计划"];
  const streetSection = sectionMap["02-街道委员小组"];
  const studioPdfSection = sectionMap["06-星级委员工作室风采"];

  const [memberTable, streetTable, committeeTable, categoryDocument, platformDocument, platformJson, annualPlanTable, streetPlanTable, practiceBasicDoc, practiceActivityDoc] = await Promise.all([
    fetchJson(assetPath(`${homeSection.outputFolder}/${homeSection.tables[0].file}`)),
    fetchJson(assetPath(`${homeSection.outputFolder}/${homeSection.tables[1].file}`)),
    fetchJson(assetPath(`${homeSection.outputFolder}/${homeSection.tables[2].file}`)),
    fetchJson(assetPath(`${categorySection.outputFolder}/${categorySection.documents[0].file}`)),
    fetchJson(assetPath(`${platformSection.outputFolder}/${platformSection.documents[0].file}`)),
    fetchJson(assetPath(`${platformSection.outputFolder}/${platformSection.jsonFiles[0].file}`)),
    fetchJson(assetPath(`${planSection.outputFolder}/${planSection.tables[1].file}`)),
    fetchJson(assetPath(`${planSection.outputFolder}/${planSection.tables[0].file}`)),
    fetchJson(assetPath(`${practiceSection.outputFolder}/${practiceSection.documents[0].file}`)),
    fetchJson(assetPath(`${practiceSection.outputFolder}/${practiceSection.documents[1].file}`)),
  ]);

  const memberRecords = memberTable.sheets[0].data.records;
  const streetRecords = fillDownRecords(streetTable.sheets[0].data.records, "街道委员小组");
  const streetGroupCount = new Set(streetRecords.map((item) => normalizeWhitespace(item["街道委员小组"])).filter(Boolean)).size;
  const categoryEntries = parseCategorySections(categoryDocument, categorySection.images);
  const studioCards = parseStudioCards(platformSection.images, platformJson.studios);
  const practiceCards = parsePracticeCards(practiceSection.images);
  const annualPlans = parseAnnualPlans(annualPlanTable);
  const timeline = buildTimelineItems(platformJson.statistics.star_ratings_2025, annualPlans);
  const cards = makeSectionCards(root.sections, details);

  const sectorFullData = parseSectorFullData(categoryDocument, categorySection.images);
  const practicePlan = parsePracticeActivityPlan(practiceActivityDoc);
  const studioFullCards = parseStudioFullCards(platformSection.images, platformJson.studios);
  const streetPlanRecords = streetPlanTable.sheets[0].data.records;

  const practiceImages = practiceSection.images.map((img) => ({
    name: img.name,
    url: assetPath(`data/政协委员通/04-新时代协商民主实践分中心/${img.file}`),
  }));
  const pengbuImages = practiceImages.filter((img) => img.name.includes("彭埠"));
  const ziyangImages = practiceImages.filter((img) => img.name.includes("紫阳"));
  const platformImages = platformSection.images
    .filter((img) => !img.name.includes("供参考"))
    .map((img) => ({
      name: img.name,
      url: assetPath(`data/政协委员通/05-委员履职平台/${img.file}`),
    }));

  const sectorPlanGroups = groupRecordsByKey(annualPlanTable.sheets[0].data.records, "界别").map((group) => ({
    name: group.name,
    items: group.records.map((r) => ({
      title: normalizeWhitespace(r["活动名称"]),
      type: normalizeWhitespace(r["活动类型"]),
      month: normalizeWhitespace(r["拟召开时间"]),
    })),
  }));

  const streetPlanGroups = groupRecordsByKey(streetPlanRecords, "责任部门").map((group) => ({
    name: group.name,
    items: group.records.map((r) => ({
      title: normalizeWhitespace(r["协商课题"]),
      type: "",
      month: normalizeWhitespace(r["时间"]),
    })),
  }));

  return {
    siteTitle: "上城区政协智慧履职平台",
    updatedAt: root.generatedAt,
    nav: [
      { label: "首页", key: "home" },
      { label: "委员之家", key: "members" },
      { label: "界别基本情况", key: "sectors" },
      { label: "实践分中心", key: "practice" },
      { label: "履职平台", key: "platform" },
      { label: "履职计划", key: "plan" },
      { label: "资料下载", key: "download" },
    ],
    hero: {
      image: practiceCards[0]?.image || studioCards[0]?.image || "",
      alt: "上城区政协履职活动现场",
      badge: "数据全量接入",
      title: "上城区政协委员通",
      summary: normalizeWhitespace(platformDocument.paragraphs[1] || platformJson.overview),
      action: "查看履职计划",
    },
    stats: [
      { label: "政协委员总数", value: String(memberRecords.length), unit: "名", tone: "primary" },
      { label: "街道委员小组", value: String(streetGroupCount), unit: "个", tone: "secondary" },
      { label: "委员工作室", value: String(platformJson.statistics.total_studios), unit: "家", tone: "primary" },
      { label: "界别数量", value: String(sectorFullData.length), unit: "个", tone: "secondary" },
    ],
    cards,
    memberTabs: [
      {
        key: "sector-member",
        label: "界别委员名单",
        total: memberRecords.length,
        groups: groupRecordsByKey(memberRecords, "界别"),
        columns: [
          { key: "_index", label: "序号" },
          { key: "姓名", label: "姓名" },
          { key: "性别", label: "性别" },
          { key: "党派", label: "党派" },
          { key: "现工作单位及职务", label: "现工作单位及职务" },
        ],
      },
      {
        key: "street-member",
        label: "街道委员小组委员名单",
        total: streetRecords.length,
        groups: groupRecordsByKey(streetRecords, "街道委员小组"),
        columns: [
          { key: "_index", label: "序号" },
          { key: "姓名", label: "姓名" },
          { key: "党派", label: "党派" },
          { key: "性别", label: "性别" },
          { key: "现工作单位及职务", label: "现工作单位及职务" },
        ],
      },
      {
        key: "committee-member",
        label: "专委会分组委员名单",
        total: committeeTable.sheets[0].data.records.length,
        groups: groupRecordsByKey(committeeTable.sheets[0].data.records, "专门委员会"),
        columns: [
          { key: "_index", label: "序号" },
          { key: "姓名", label: "姓名" },
          { key: "党派", label: "党派" },
          { key: "性别", label: "性别" },
          { key: "现工作单位及职务", label: "现工作单位及职务" },
        ],
      },
    ],
    sectors: sectorFullData,
    practice: {
      basicInfo: practiceBasicDoc.paragraphs.filter((p) => normalizeWhitespace(p)),
      schedule: practicePlan.schedule,
      pengbuActivities: practicePlan.pengbuActivities,
      ziyangActivities: practicePlan.ziyangActivities,
      pengbuImages,
      ziyangImages,
      images: practiceImages,
    },
    platform: {
      overview: platformJson.overview,
      totalStudios: platformJson.statistics.total_studios,
      fiveStar: platformJson.statistics.star_ratings_2025.five_star,
      fourStar: platformJson.statistics.star_ratings_2025.four_star,
      threeStar: platformJson.statistics.star_ratings_2025.three_star,
      studios: platformJson.studios,
      images: platformImages,
    },
    planTabs: [
      { key: "sector-plan", label: "各界别履职计划", groups: sectorPlanGroups },
      { key: "street-plan", label: "街道民生议事堂计划", groups: streetPlanGroups },
    ],
    timeline,
    cta: {
      title: "公开资料统一接入",
      summary: "当前首页已基于原始页面设计接入真实数据、真实图片和真实附件入口，可直接访问街道资料与星级委员工作室风采文件。",
      primary: {
        label: "打开 14 个街道资料",
        href: assetPath(`${streetSection.outputFolder}/${streetSection.files[0].file}`),
      },
      secondary: {
        label: "返回首页",
        href: "#",
      },
    },
    footer: {
      summary: `界别数量 ${sectorFullData.length} 个，工作室总数 ${platformJson.statistics.total_studios} 家，委员总数 ${memberRecords.length} 名，页面数据更新时间为 ${root.generatedAt}。`,
      copy: "Copyright © 2026 杭州市上城区政协版权所有",
      updatedAt: `数据更新时间：${root.generatedAt}`,
    },
  };
}

async function init() {
  if (!app) return;

  app.innerHTML = renderStatus("页面加载中", "正在加载全部数据，请稍候...");

  try {
    const data = await loadSiteData();
    app.innerHTML = renderPage(data);
    bindTabs();
    bindMemberTabs();
    bindPlanTabs();
    bindNavPages();
    bindLightbox();
    bindMobileMenu();
  } catch (error) {
    console.error(error);
    app.innerHTML = renderStatus("页面加载失败", `数据资源读取异常：${error.message}。请检查部署环境中的静态文件路径。`);
  }
}

init();
