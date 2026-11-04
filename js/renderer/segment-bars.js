const BAR_CHART_LOGO_LAYOUT_OVERRIDES = Object.freeze({
  samsung: Object.freeze({
    dy: 22,
  }),
  alibaba: Object.freeze({
    dx: 36,
    dy: -96,
    widthScale: 0.68,
    heightScale: 0.68,
    scaleMultiplier: 0.76,
  }),
  jnj: Object.freeze({
    dx: 52,
    dy: -48,
    widthScale: 0.66,
    heightScale: 0.58,
    scaleMultiplier: 0.68,
  }),
  "procter-gamble": Object.freeze({
    dx: -70,
    dy: -22,
    widthScale: 0.58,
    heightScale: 0.58,
    scaleMultiplier: 0.72,
  }),
});

function barChartRectsOverlap(left, right, padding = 0) {
  return (
    safeNumber(left?.left) < safeNumber(right?.right) + padding &&
    safeNumber(left?.right) > safeNumber(right?.left) - padding &&
    safeNumber(left?.top) < safeNumber(right?.bottom) + padding &&
    safeNumber(left?.bottom) > safeNumber(right?.top) - padding
  );
}

function barChartRectIntersectionArea(left, right, padding = 0) {
  const intersectionLeft = Math.max(safeNumber(left?.left), safeNumber(right?.left) - padding);
  const intersectionTop = Math.max(safeNumber(left?.top), safeNumber(right?.top) - padding);
  const intersectionRight = Math.min(safeNumber(left?.right), safeNumber(right?.right) + padding);
  const intersectionBottom = Math.min(safeNumber(left?.bottom), safeNumber(right?.bottom) + padding);
  const intersectionWidth = Math.max(intersectionRight - intersectionLeft, 0);
  const intersectionHeight = Math.max(intersectionBottom - intersectionTop, 0);
  return intersectionWidth * intersectionHeight;
}

function collectBarChartLogoObstacleRects({ baselineY, barStartX, barWidth, barGap, valueScale, history }) {
  return (history?.quarters || []).reduce((rects, quarter, quarterIndex) => {
    const totalRevenueBn = safeNumber(quarter?.totalRevenueBn);
    if (!(totalRevenueBn > 0.005)) return rects;
    const x = barStartX + quarterIndex * (barWidth + barGap);
    const top = baselineY - Math.max(totalRevenueBn * valueScale, 1.2);
    rects.push({
      left: x - 4,
      top: top - 8,
      right: x + barWidth + 4,
      bottom: baselineY + 2,
    });
    return rects;
  }, []);
}

function resolveBarChartLogoPlacement({
  logoKey,
  plotLeft,
  chartTop,
  baselineY,
  barStartX,
  barWidth,
  barGap,
  valueScale,
  history,
  reservedRects = [],
}) {
  const normalizedLogoKey = normalizeLogoKey(logoKey);
  const override =
    BAR_CHART_LOGO_LAYOUT_OVERRIDES[logoKey] ||
    BAR_CHART_LOGO_LAYOUT_OVERRIDES[normalizedLogoKey] ||
    {};
  const logoMetrics = corporateLogoLayoutMetrics(logoKey);
  const area = {
    width: 228 * safeNumber(override.widthScale, 1),
    height: 148 * safeNumber(override.heightScale, 1),
    x: plotLeft + 30 + safeNumber(override.dx, 0),
    y: chartTop + 10 + safeNumber(override.dy, 0),
  };
  const baseScale =
    Math.min(area.width / Math.max(logoMetrics.visibleWidth, 1), area.height / Math.max(logoMetrics.visibleHeight, 1)) *
    safeNumber(override.scaleMultiplier, 1);
  const minVisibleX = Math.max(20, plotLeft + 24);
  const minVisibleY = Math.max(96, chartTop - 220);
  const maxVisibleRight = plotLeft + area.width + 96;
  const obstacleRects = collectBarChartLogoObstacleRects({
    baselineY,
    barStartX,
    barWidth,
    barGap,
    valueScale,
    history,
  }).concat(
    Array.isArray(reservedRects)
      ? reservedRects.filter(
          (rect) =>
            rect &&
            Number.isFinite(safeNumber(rect.left, NaN)) &&
            Number.isFinite(safeNumber(rect.top, NaN)) &&
            Number.isFinite(safeNumber(rect.right, NaN)) &&
            Number.isFinite(safeNumber(rect.bottom, NaN))
        )
      : []
  );
  const xOffsets = [0, 12, 24, 40, 58, 78, 102, -12, -24, 126, -40, 154];
  const yOffsets = [0, 10, 22, 38, 56, 78, 104, -10, -24, 132];
  const shrinkFactors = [1, 0.96, 0.92, 0.88, 0.84, 0.8, 0.76, 0.72];
  let bestPlacement = null;

  shrinkFactors.some((shrinkFactor) => {
    const scale = baseScale * shrinkFactor;
    const visibleWidth = logoMetrics.visibleWidth * scale * CORPORATE_LOGO_LINEAR_SCALE_MULTIPLIER;
    const visibleHeight = logoMetrics.visibleHeight * scale * CORPORATE_LOGO_LINEAR_SCALE_MULTIPLIER;
    const offsetX = logoMetrics.offsetX * scale * CORPORATE_LOGO_LINEAR_SCALE_MULTIPLIER;
    const offsetY = logoMetrics.offsetY * scale * CORPORATE_LOGO_LINEAR_SCALE_MULTIPLIER;
    const maxVisibleX = Math.max(minVisibleX, maxVisibleRight - visibleWidth);
    const anchorVisibleX = clamp(area.x, minVisibleX, maxVisibleX);
    const anchorVisibleY = Math.max(minVisibleY, area.y);
    let localBest = null;

    yOffsets.forEach((yOffset) => {
      const visibleY = Math.max(minVisibleY, anchorVisibleY + yOffset);
      xOffsets.forEach((xOffset) => {
        const visibleX = clamp(anchorVisibleX + xOffset, minVisibleX, maxVisibleX);
        const visibleRect = {
          left: visibleX,
          top: visibleY,
          right: visibleX + visibleWidth,
          bottom: visibleY + visibleHeight,
        };
        let collisionArea = 0;
        let collisionCount = 0;
        obstacleRects.forEach((obstacleRect) => {
          const obstaclePadding = safeNumber(obstacleRect.logoPadding, 10);
          if (!barChartRectsOverlap(visibleRect, obstacleRect, obstaclePadding)) return;
          collisionCount += 1;
          collisionArea += barChartRectIntersectionArea(visibleRect, obstacleRect, obstaclePadding);
        });
        const cornerDistancePenalty =
          Math.max(visibleRect.left - area.x, 0) * 180 +
          Math.max(visibleRect.top - area.y, 0) * 260;
        const penalty =
          collisionArea +
          collisionCount * 10000 +
          cornerDistancePenalty +
          Math.max(xOffset, 0) * 120 +
          Math.max(yOffset, 0) * 150 +
          Math.abs(Math.min(xOffset, 0)) * 36 +
          Math.abs(Math.min(yOffset, 0)) * 52 +
          (1 - shrinkFactor) * 160000;
        if (!localBest || penalty < localBest.penalty) {
          localBest = {
            penalty,
            collisionCount,
            scale,
            x: visibleX - offsetX,
            y: visibleY - offsetY,
            visibleLeft: visibleRect.left,
            visibleTop: visibleRect.top,
            visibleRight: visibleRect.right,
            visibleBottom: visibleRect.bottom,
          };
        }
      });
    });

    if (localBest && (!bestPlacement || localBest.penalty < bestPlacement.penalty)) {
      bestPlacement = localBest;
    }
    return !!localBest && localBest.collisionCount === 0;
  });

  return {
    scale: safeNumber(bestPlacement?.scale, baseScale),
    x: safeNumber(bestPlacement?.x, area.x),
    y: safeNumber(bestPlacement?.y, area.y),
    visibleLeft: safeNumber(bestPlacement?.visibleLeft, area.x),
    visibleTop: safeNumber(bestPlacement?.visibleTop, area.y),
    visibleRight: safeNumber(bestPlacement?.visibleRight, area.x + area.width),
    visibleBottom: safeNumber(bestPlacement?.visibleBottom, area.y + area.height),
  };
}

// Measure every logo and obstacle in the SVG's own viewBox coordinates.
// Client rectangles depend on letterboxing and the old chart container size
// while switching views, so they cannot be compared with SVG-unit offsets.
function barChartSvgRect(svg, node, padding = 0) {
  if (!svg?.getCTM || !node?.getBBox || !node?.getCTM) return null;
  try {
    const root = svg.getCTM(), local = node.getCTM(), box = node.getBBox();
    if (!root || !local || Math.abs(root.a * root.d - root.b * root.c) < 1e-12) return null;
    const matrix = root.inverse().multiply(local);
    const points = [[box.x, box.y], [box.x + box.width, box.y],
      [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]]
      .map(([x, y]) => ({ x: matrix.a * x + matrix.c * y + matrix.e,
        y: matrix.b * x + matrix.d * y + matrix.f }));
    if (points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return null;
    return {
      left: Math.min(...points.map(point => point.x)) - padding,
      top: Math.min(...points.map(point => point.y)) - padding,
      right: Math.max(...points.map(point => point.x)) + padding,
      bottom: Math.max(...points.map(point => point.y)) + padding,
    };
  } catch (_) { return null; }
}

function parseBarChartLogoTransform(transformText) {
  const transform = String(transformText || "").trim();
  const translateMatch = transform.match(/translate\(\s*([-0-9.]+)(?:[\s,]+([-0-9.]+))?\s*\)/i);
  if (!translateMatch) return null;
  const scaleMatch = transform.match(/scale\(\s*([-0-9.]+)\s*\)/i);
  return {
    x: safeNumber(translateMatch[1], 0),
    y: safeNumber(translateMatch[2], 0),
    scale: Math.max(safeNumber(scaleMatch?.[1], 1), 0.0001),
  };
}

function setBarChartLogoTransform(node, x, y, scale) {
  if (!node) return;
  node.setAttribute("transform", `translate(${safeNumber(x, 0).toFixed(2)} ${safeNumber(y, 0).toFixed(2)}) scale(${Math.max(safeNumber(scale, 1), 0.0001).toFixed(4)})`);
}

function collectBarChartDomObstacleRects(svg, logoWrapper) {
  const chartContent = svg?.querySelector("#chartContent");
  if (!chartContent || !logoWrapper) return [];
  const logoDescendants = new Set([logoWrapper, ...Array.from(logoWrapper.querySelectorAll("*"))]);
  return Array.from(chartContent.querySelectorAll("text, [data-bar-axis='true'], path, rect, ellipse, circle, polygon, polyline"))
    .filter((node) => {
      if (logoDescendants.has(node)) return false;
      if (node.getAttribute?.("data-bar-chart-logo-ignore") === "true") return false;
      if (safeNumber(node.getAttribute?.("opacity"), 1) <= 0.001) return false;
      return true;
    })
    .map((node) => {
      const tagName = String(node.tagName || "").toLowerCase();
      const padding = tagName === "text" ? 6 : tagName === "line" ? 6 : 4;
      return barChartSvgRect(svg, node, padding);
    })
    .filter((rect) => rect && rect.right > rect.left && rect.bottom > rect.top);
}

function refineRenderedBarChartLogoPlacement(svg) {
  const logoWrapper = svg?.querySelector("[data-bar-chart-logo='true']");
  const logoInner = logoWrapper?.firstElementChild;
  if (!svg || !logoWrapper || !logoInner) return;
  const baseTransform = logoInner.getAttribute("data-base-transform") || logoInner.getAttribute("transform") || "";
  const parsedBaseTransform = parseBarChartLogoTransform(baseTransform);
  if (!parsedBaseTransform) return;
  logoInner.setAttribute("data-base-transform", baseTransform);
  logoWrapper.removeAttribute("transform");
  setBarChartLogoTransform(logoInner, parsedBaseTransform.x, parsedBaseTransform.y, parsedBaseTransform.scale);

  const viewBoxValues = String(svg.getAttribute("viewBox") || "")
    .trim()
    .split(/\s+/)
    .map((value) => Number(value));
  const viewBox = viewBoxValues.length === 4 && viewBoxValues.every((value) => Number.isFinite(value))
    ? {
        left: viewBoxValues[0],
        top: viewBoxValues[1],
        right: viewBoxValues[0] + viewBoxValues[2],
        bottom: viewBoxValues[1] + viewBoxValues[3],
      }
    : { left: 0, top: 0, right: 2048, bottom: 1325 };
  const zone = {
    left: safeNumber(logoWrapper.getAttribute("data-logo-zone-left"), viewBox.left + 118),
    top: safeNumber(logoWrapper.getAttribute("data-logo-zone-top"), viewBox.top + 96),
    right: safeNumber(logoWrapper.getAttribute("data-logo-zone-right"), viewBox.left + 614),
    bottom: safeNumber(logoWrapper.getAttribute("data-logo-zone-bottom"), viewBox.top + 420),
  };
  const initialLogoRect = barChartSvgRect(svg, logoWrapper, 0);
  if (!initialLogoRect) return;
  const isWideWordmark = !!initialLogoRect && initialLogoRect.right - initialLogoRect.left > (initialLogoRect.bottom - initialLogoRect.top) * 1.65;
  const isMediumWideLogo = !!initialLogoRect && initialLogoRect.right - initialLogoRect.left > (initialLogoRect.bottom - initialLogoRect.top) * 1.35;
  if (isMediumWideLogo) {
    zone.right = Math.min(zone.right, viewBox.left + (viewBox.right - viewBox.left) * 0.35);
    zone.bottom = Math.min(zone.bottom, viewBox.top + (viewBox.bottom - viewBox.top) * 0.33);
  }
  const obstacleRects = collectBarChartDomObstacleRects(svg, logoWrapper);
  const xOffsets = [0, 12, 24, 40, 58, 78, 102, 128, -12, -24, -40, 160, -58, 196, -82, 236];
  const yOffsets = [0, 10, 24, 42, 64, 90, 120, -10, -24, 154, -42, 192];
  const scaleFactors = [1, 0.97, 0.94, 0.91, 0.88, 0.85, 0.82, 0.79, 0.76, 0.73, 0.7];
  let bestPlacement = null;

  scaleFactors.some((scaleFactor) => {
    const candidateScale = parsedBaseTransform.scale * scaleFactor;
    let localBest = null;
    setBarChartLogoTransform(logoInner, parsedBaseTransform.x, parsedBaseTransform.y, candidateScale);
    yOffsets.forEach((yOffset) => {
      xOffsets.forEach((xOffset) => {
        if (xOffset === 0 && yOffset === 0) {
          logoWrapper.removeAttribute("transform");
        } else {
          logoWrapper.setAttribute("transform", `translate(${xOffset.toFixed(2)} ${yOffset.toFixed(2)})`);
        }
        const logoRect = barChartSvgRect(svg, logoWrapper, 2);
        // The axis clearance is a hard boundary, never a soft collision cost.
        if (!logoRect || logoRect.left < zone.left) return;
        const overflowPenalty =
          Math.max(zone.left - logoRect.left, 0) +
          Math.max(zone.top - logoRect.top, 0) +
          Math.max(logoRect.right - zone.right, 0) +
          Math.max(logoRect.bottom - zone.bottom, 0);
        let collisionArea = 0;
        let collisionCount = 0;
        obstacleRects.forEach((obstacleRect) => {
          if (!barChartRectsOverlap(logoRect, obstacleRect, 2)) return;
          collisionCount += 1;
          collisionArea += barChartRectIntersectionArea(logoRect, obstacleRect, 2);
        });
        const cornerDistancePenalty =
          Math.max(logoRect.left - zone.left, 0) * 220 +
          Math.max(logoRect.top - zone.top, 0) * 320;
        const penalty =
          overflowPenalty * 1000000 +
          collisionCount * 100000 +
          collisionArea * 100 +
          cornerDistancePenalty +
          Math.max(xOffset, 0) * (isWideWordmark ? 180 : 100) +
          Math.max(yOffset, 0) * 124 +
          Math.abs(Math.min(xOffset, 0)) * 28 +
          Math.abs(Math.min(yOffset, 0)) * 36 +
          (1 - scaleFactor) * 18000;
        if (!localBest || penalty < localBest.penalty) {
          localBest = {
            penalty,
            collisionCount,
            xOffset,
            yOffset,
            scale: candidateScale,
          };
        }
      });
    });
    if (localBest && (!bestPlacement || localBest.penalty < bestPlacement.penalty)) {
      bestPlacement = localBest;
    }
    return !!localBest && localBest.collisionCount === 0;
  });

  logoWrapper.removeAttribute("transform");
  setBarChartLogoTransform(logoInner, parsedBaseTransform.x, parsedBaseTransform.y, parsedBaseTransform.scale);
  if (!bestPlacement) return;
  setBarChartLogoTransform(logoInner, parsedBaseTransform.x, parsedBaseTransform.y, bestPlacement.scale);
  if (bestPlacement.xOffset !== 0 || bestPlacement.yOffset !== 0) {
    logoWrapper.setAttribute("transform", `translate(${bestPlacement.xOffset.toFixed(2)} ${bestPlacement.yOffset.toFixed(2)})`);
  } else {
    logoWrapper.removeAttribute("transform");
  }
}

function computeNiceBarAxisStep(maxValue, maxGridLines = 6) {
  const numericMax = Math.max(safeNumber(maxValue, 0), 0);
  if (!(numericMax > 0)) return 1;
  const roughStep = numericMax / Math.max(maxGridLines, 1);
  if (!(roughStep > 0)) return 1;

  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  let niceNormalized = 10;

  if (normalized < 1.5) niceNormalized = 1;
  else if (normalized < 3) niceNormalized = 2;
  else if (normalized < 7) niceNormalized = 5;

  return niceNormalized * magnitude;
}

function formatBarAxisTick(value, step) {
  const numeric = safeNumber(value);
  const safeStep = Math.max(safeNumber(step, 1), 0.000001);
  const decimals = Math.max(0, Math.ceil(-Math.log10(safeStep) - 0.000001));
  return Number(numeric.toFixed(decimals)).toString();
}

function renderRevenueSegmentBarsSvg(snapshot, company, options = {}) {
  const width = 2048;
  const height = 1325;
  const configuredMaxQuarters = safeNumber(company?.classificationPolicy?.maxBarQuarters, 30);
  const history = buildRevenueSegmentBarHistory(
    company,
    snapshot?.quarterKey,
    safeNumber(options.maxQuarters, configuredMaxQuarters),
    { basis: options.basis }
  );
  const chartTitle =
    currentChartLanguage() === "en"
      ? `${displayChartTitle(company?.nameEn || "")} Revenue by Segment`
      : `${company?.nameZh || company?.nameEn || ""} 分部营收趋势`;
  if (!history || !history.quarters.length) {
    return {
      svg: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(chartTitle)}">
          <rect x="0" y="0" width="${width}" height="${height}" fill="#F3F3F3"></rect>
          <g id="chartContent">
            <text x="${width / 2}" y="150" text-anchor="middle" font-size="96" font-weight="800" fill="#155C8F">${escapeHtml(chartTitle)}</text>
            <text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-size="44" fill="#6B7280">${
              currentChartLanguage() === "en" ? "No segment history available." : "缺少可用的分部历史数据。"
            }</text>
          </g>
        </svg>
      `,
      history: null,
      width,
      height,
    };
  }

  const background = "#F3F3F3";
  const titleColor = "#155C8F";
  const mutedText = "#6B7280";
  const axisText = "#145B8E";
  const unitSpec = barChartUnitSpec(history);
  const unitLines = barAxisUnitLines(history);
  const hasConvertedCurrency = history.convertedQuarterCount > 0;
  const barCount = history.quarters.length;
  const plotLeft = 94;
  const plotRight = width - 38;
  const titleX = width / 2;
  const titleY = 146;
  const titleLength = String(chartTitle || "").length;
  const titleFontSize =
    currentChartLanguage() === "en"
      ? Math.round(clamp(88 - Math.max(titleLength - 30, 0) * 1.25, 56, 88) * 0.85)
      : clamp(80 - Math.max(titleLength - 16, 0) * 1.75, 52, 80);

  const latestQuarter = history.quarters[history.quarters.length - 1] || null;
  const latestPeriodEndRaw =
    formatPeriodEndLabel(latestQuarter?.entry?.periodEnd || "") ||
    latestQuarter?.entry?.periodEnd ||
    snapshot?.periodEndLabel ||
    "";
  const latestFiscalLabel = latestQuarter?.label || compactFiscalLabel(snapshot?.fiscalLabel || "") || "";
  const latestPeriodEnd = localizePeriodEndLabel(latestPeriodEndRaw);
  const legendItems = history.segmentStats;
  const legendTop = 218;
  const legendAreaLeft = plotLeft + 120;
  const legendAreaRight = plotRight - 120;
  const legendAvailableWidth = Math.max(320, legendAreaRight - legendAreaLeft);
  const legendRowGap = 20;
  const swatchSize = legendItems.length <= 3 ? 28 : 24;
  const swatchGap = 10;
  const legendItemGap = currentChartLanguage() === "en" ? 46 : 40;
  const maxLegendRows = legendItems.length <= 3 ? 1 : 2;

  const fitLegendLabel = (label, fontSize, maxTextWidth, options = {}) => {
    const raw = String(label || "").trim();
    if (!raw) return "";
    const truncate = options.truncate !== false;
    if (approximateTextWidth(raw, fontSize) <= maxTextWidth || !truncate) return raw;
    if (raw.length <= 4) return raw;
    let cut = raw.length;
    while (cut > 2) {
      const trial = `${raw.slice(0, cut)}...`;
      if (approximateTextWidth(trial, fontSize) <= maxTextWidth) return trial;
      cut -= 1;
    }
    return `${raw.slice(0, 2)}...`;
  };
  const buildLegendRows = (fontSize, options = {}) => {
    const truncateLabels = options.truncate !== false;
    const rows = [[]];
    const rowWidths = [0];
    legendItems.forEach((item) => {
      const rawLabel = localizedBarSegmentName(item);
      const maxLabelWidth = Math.max(
        truncateLabels ? 150 : 240,
        truncateLabels
          ? Math.min(
              legendAvailableWidth * (maxLegendRows === 1 ? 0.34 : 0.5),
              legendAvailableWidth - swatchSize - swatchGap - 20
            )
          : legendAvailableWidth - swatchSize - swatchGap - 20
      );
      const label = fitLegendLabel(rawLabel, fontSize, maxLabelWidth, { truncate: truncateLabels });
      const itemWidth = swatchSize + swatchGap + approximateTextWidth(label, fontSize);
      let rowIndex = rows.length - 1;
      let row = rows[rowIndex];
      let currentWidth = rowWidths[rowIndex];
      const neededGap = row.length ? legendItemGap : 0;
      if (row.length && currentWidth + neededGap + itemWidth > legendAvailableWidth) {
        rows.push([]);
        rowWidths.push(0);
        rowIndex += 1;
        row = rows[rowIndex];
        currentWidth = rowWidths[rowIndex];
      }
      const offsetX = currentWidth + (row.length ? legendItemGap : 0);
      row.push({
        item,
        label,
        itemWidth,
        offsetX,
      });
      rowWidths[rowIndex] = offsetX + itemWidth;
    });
    return {
      rows,
      rowWidths,
      hasOverflow: rowWidths.some((width) => width > legendAvailableWidth + 0.5),
    };
  };
  const isEnglishLegend = currentChartLanguage() === "en";
  let legendFontSize =
    isEnglishLegend
      ? 26
      : legendItems.length <= 3
        ? 32
        : 25;
  const legendMinFontSize = isEnglishLegend ? 18 : 18;
  let legendLayout = buildLegendRows(legendFontSize, { truncate: !isEnglishLegend });
  while ((legendLayout.rows.length > maxLegendRows || legendLayout.hasOverflow) && legendFontSize > legendMinFontSize) {
    legendFontSize -= 1;
    legendLayout = buildLegendRows(legendFontSize, { truncate: !isEnglishLegend });
  }
  if (isEnglishLegend && (legendLayout.rows.length > maxLegendRows || legendLayout.hasOverflow)) {
    while ((legendLayout.rows.length > maxLegendRows || legendLayout.hasOverflow) && legendFontSize > 18) {
      legendFontSize -= 1;
      legendLayout = buildLegendRows(legendFontSize, { truncate: true });
    }
  }
  const legendRows = legendLayout.rows;
  const legendRowWidths = legendLayout.rowWidths;
  const legendLineHeight = Math.round(legendFontSize * 1.12);
  const legendTotalHeight = legendRows.length * legendLineHeight + Math.max(0, legendRows.length - 1) * legendRowGap;

  const baselineY = 1166;
  const chartTop = legendTop + legendTotalHeight + 18;
  const defaultBarGap = barCount >= 28 ? 7 : barCount >= 22 ? 9 : 11;
  let barWidth = Math.floor((plotRight - plotLeft - defaultBarGap * Math.max(barCount - 1, 0)) / Math.max(barCount, 1));
  barWidth = clamp(barWidth, 16, 56);
  // Short windows keep the original column proportions while spreading across
  // the plot. The preview independently scales the entire SVG proportionally.
  const barGap = barCount > 1 && barCount <= 12
    ? (plotRight - plotLeft - barWidth * barCount) / (barCount - 1)
    : defaultBarGap;
  const barsTotalWidth = barWidth * barCount + barGap * Math.max(barCount - 1, 0);
  const barStartX = plotLeft + Math.max((plotRight - plotLeft - barsTotalWidth) / 2, 0);
  const chartHeight = Math.max(baselineY - chartTop, 120);
  // Samsung and a few other issuers report business-unit sales before intersegment
  // eliminations, so the stacked total can exceed consolidated revenue. Scale against
  // the actual stack and keep explicit headroom below the legend.
  const scaleMaxRevenueBn = Math.max(history.maxRevenueBn, history.maxStackRevenueBn || 0, 1) * 1.06;
  const valueScale = chartHeight / scaleMaxRevenueBn;
  const barCornerRadius = Math.min(14, Math.max(6, barWidth * 0.24));
  const topQuarterFontSize = currentChartLanguage() === "en" ? 58 : 56;
  const periodEndFontSize = currentChartLanguage() === "en" ? 28 : 26;
  const topInfoX = width - 76;
  const topQuarterY = titleY - 6;
  const estimatedQuarterLeft = topInfoX - approximateTextWidth(latestFiscalLabel, topQuarterFontSize);
  const estimatedTitleRight = titleX + approximateTextWidth(chartTitle, titleFontSize) / 2;
  const estimatedPeriodLeft = topInfoX - approximateTextWidth(latestPeriodEnd, periodEndFontSize);
  const topInfoNeedsShift = estimatedQuarterLeft < estimatedTitleRight + 26 || estimatedPeriodLeft < estimatedTitleRight + 26;
  const topQuarterDisplayY = topInfoNeedsShift ? titleY + 30 : topQuarterY;
  const topPeriodY = topInfoNeedsShift ? titleY + 64 : titleY + 30;
  const yLabelFontSize = currentChartLanguage() === "en" ? 22 : 20;
  const xLabelBaseFontSize = barCount >= 28 ? 14 : barCount >= 24 ? 15 : 17;
  const xLabelFontSize = Math.round(xLabelBaseFontSize * 1.15);
  const xLabelAngle = 38;
  const approxXLabelWidth = approximateTextWidth("Q4 FY25", xLabelFontSize);
  const minSlotForLabel = approxXLabelWidth * Math.cos((xLabelAngle * Math.PI) / 180) * 0.95;
  const strideByWidth = Math.ceil(minSlotForLabel / Math.max(barWidth + barGap, 1));
  const strideByCount = Math.ceil(barCount / 16);
  const labelStride = Math.max(1, strideByWidth, strideByCount);
  const maxGridLines = 6;
  const displayMaxRevenue = unitSpec.displayValue(history.maxRevenueBn);
  const gridStepDisplay = computeNiceBarAxisStep(displayMaxRevenue, maxGridLines);
  const gridStep = gridStepDisplay * unitSpec.unitValueBn;
  const gridValues = [];
  for (let value = gridStep; value < history.maxRevenueBn; value += gridStep) {
    gridValues.push(Number(value.toFixed(6)));
  }
  const titleHalfWidth = approximateTextWidth(chartTitle, titleFontSize) / 2;
  const unitLabelX = Math.max(18, plotLeft - 72);
  const unitLabelWidth = Math.max(
    approximateTextWidth(unitLines.line1, yLabelFontSize),
    approximateTextWidth(unitLines.line2, yLabelFontSize)
  );
  const reservedRects = [
    {
      left: titleX - titleHalfWidth - 28,
      top: titleY - titleFontSize * 0.96,
      right: titleX + titleHalfWidth + 28,
      bottom: titleY + titleFontSize * 0.22,
      logoPadding: 22,
    },
    {
      left: unitLabelX - 10,
      top: legendTop - 2,
      right: unitLabelX + unitLabelWidth + 14,
      bottom: legendTop + 58,
      logoPadding: 24,
    },
  ];
  if (latestFiscalLabel) {
    const quarterWidth = approximateTextWidth(latestFiscalLabel, topQuarterFontSize);
    reservedRects.push({
      left: topInfoX - quarterWidth - 14,
      top: topQuarterDisplayY - topQuarterFontSize * 0.92,
      right: topInfoX + 10,
      bottom: topQuarterDisplayY + topQuarterFontSize * 0.16,
      logoPadding: 22,
    });
  }
  if (latestPeriodEnd) {
    const periodWidth = approximateTextWidth(latestPeriodEnd, periodEndFontSize);
    reservedRects.push({
      left: topInfoX - periodWidth - 12,
      top: topPeriodY - periodEndFontSize * 0.92,
      right: topInfoX + 10,
      bottom: topPeriodY + periodEndFontSize * 0.18,
      logoPadding: 18,
    });
  }
  gridValues.forEach((gridValue) => {
    const tickValue = formatBarAxisTick(unitSpec.displayValue(gridValue), gridStepDisplay);
    const tickWidth = approximateTextWidth(tickValue, 18);
    const y = baselineY - gridValue * valueScale;
    if (y <= chartTop + 8 || y >= baselineY - 8) return;
    reservedRects.push({
      left: plotLeft - 18 - tickWidth,
      top: y - 16,
      right: plotLeft - 6,
      bottom: y + 10,
    });
  });
  legendRows.forEach((row, rowIndex) => {
    const rowWidth = legendRowWidths[rowIndex] || 0;
    const centeredFromTitle = titleX - rowWidth / 2;
    const rowStartX = clamp(centeredFromTitle, legendAreaLeft, Math.max(legendAreaLeft, legendAreaRight - rowWidth));
    const rowY = legendTop + rowIndex * (legendLineHeight + legendRowGap);
    reservedRects.push({
      left: rowStartX - 12,
      top: rowY - 10,
      right: rowStartX + rowWidth + 12,
      bottom: rowY + legendLineHeight + 10,
      logoPadding: 24,
    });
  });
  const chartLogoKey = snapshot?.companyLogoKey || company?.id || "";
  const chartLogoZone = {
    left: Math.max(28, plotLeft + 24),
    top: Math.max(96, chartTop - 220),
    right: Math.min(plotRight - 32, plotLeft + 520),
    bottom: Math.min(baselineY - 26, chartTop + 214),
  };
  const chartLogoPlacement = resolveBarChartLogoPlacement({
    logoKey: chartLogoKey,
    plotLeft,
    chartTop,
    baselineY,
    barStartX,
    barWidth,
    barGap,
    valueScale,
    history,
    reservedRects,
  });
  const taxonomyConnectorStartY = (markerX) => {
    const horizontalPad = 16;
    const verticalPad = 18;
    const rects = [
      {
        left: safeNumber(chartLogoPlacement.visibleLeft, NaN),
        top: safeNumber(chartLogoPlacement.visibleTop, NaN),
        right: safeNumber(chartLogoPlacement.visibleRight, NaN),
        bottom: safeNumber(chartLogoPlacement.visibleBottom, NaN),
      },
      chartLogoZone,
    ].filter(
      (rect) =>
        rect &&
        Number.isFinite(rect.left) &&
        Number.isFinite(rect.top) &&
        Number.isFinite(rect.right) &&
        Number.isFinite(rect.bottom) &&
        rect.right > rect.left &&
        rect.bottom > rect.top
    );
    return rects.reduce((startY, rect) => {
      if (markerX < rect.left - horizontalPad || markerX > rect.right + horizontalPad) return startY;
      const candidateY = rect.bottom + verticalPad;
      if (candidateY >= baselineY - 80) return startY;
      return Math.max(startY, candidateY);
    }, chartTop + 6);
  };
  const fxNoteY = hasConvertedCurrency ? height - 34 : chartTop - 10;
  const fxNoteX = hasConvertedCurrency ? 38 : plotLeft;
  const fxNoteFontSize = hasConvertedCurrency ? 20 : 18;
  const taxonomyBreakAnnotations = (() => {
    const breaks = Array.isArray(history?.taxonomyBreaks) ? history.taxonomyBreaks.slice(0, 4) : [];
    if (!breaks.length) return "";
    const labelFontSize = currentChartLanguage() === "en" ? 18 : 20;
    const labelHeight = labelFontSize + 18;
    const placedLabels = [];
    const rowLabelYs = [baselineY + 106, baselineY + 144];
    const bottomNoteSafeRight = hasConvertedCurrency ? fxNoteX + approximateTextWidth(
      currentChartLanguage() === "en" ? "Converted to USD by filing-date FX rates." : "已按申报日汇率折算为美元。",
      fxNoteFontSize
    ) + 26 : plotLeft + 10;
    return breaks
      .map((item) => {
        const breakIndex = Number.isInteger(item?.quarterIndex)
          ? item.quarterIndex
          : history.quarters.findIndex((quarter) => quarter?.quarterKey === item?.quarterKey);
        if (breakIndex < 0 || breakIndex >= history.quarters.length) return "";
        const markerX = barStartX + breakIndex * (barWidth + barGap) - Math.max(4, barGap / 2);
        const label = currentChartLanguage() === "en" ? item.labelEn || `${item.label || item.quarterKey} taxonomy change` : item.labelZh || `${item.label || item.quarterKey} 起分部口径调整`;
        const labelWidth = approximateTextWidth(label, labelFontSize) + 28;
        const preferredX = Math.max(markerX + 8, bottomNoteSafeRight);
        let bestPlacement = null;
        rowLabelYs.forEach((labelY, rowIndex) => {
          const labelX = clamp(preferredX, plotLeft + 10, plotRight - labelWidth - 6);
          const overlaps = placedLabels.some(
            (placed) => placed.rowIndex === rowIndex && labelX < placed.right + 12 && labelX + labelWidth > placed.left - 12
          );
          if (!overlaps && !bestPlacement) {
            bestPlacement = { labelX, labelY, rowIndex };
          }
        });
        if (!bestPlacement) {
          const rowIndex = placedLabels.length % rowLabelYs.length;
          bestPlacement = {
            labelX: clamp(preferredX, plotLeft + 10, plotRight - labelWidth - 6),
            labelY: rowLabelYs[rowIndex],
            rowIndex,
          };
        }
        const labelRectY = bestPlacement.labelY - labelFontSize - 12;
        const connectorY = labelRectY + labelHeight / 2;
        const labelEdgeX = bestPlacement.labelX >= markerX ? bestPlacement.labelX : bestPlacement.labelX + labelWidth;
        const connectorStartY = taxonomyConnectorStartY(markerX);
        placedLabels.push({
          rowIndex: bestPlacement.rowIndex,
          left: bestPlacement.labelX,
          right: bestPlacement.labelX + labelWidth,
        });
        const breakId =
          String(item?.id || `${company?.id || "company"}-${item?.quarterKey || breakIndex}`)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, "-")
            .replace(/^-+|-+$/g, "") || `break-${breakIndex}`;
        return `
          <g data-bar-taxonomy-break="${escapeHtml(breakId)}" opacity="0.92">
            <path d="M ${markerX.toFixed(2)} ${connectorStartY.toFixed(2)} V ${connectorY.toFixed(2)} H ${labelEdgeX.toFixed(
              2
            )}" fill="none" stroke="#5C7FA8" stroke-width="2" stroke-dasharray="8 8"></path>
            <rect x="${bestPlacement.labelX.toFixed(2)}" y="${labelRectY.toFixed(2)}" width="${labelWidth.toFixed(
              2
            )}" height="${labelHeight.toFixed(2)}" rx="7" fill="#E8EEF5" stroke="#CAD6E3" stroke-width="1"></rect>
            <text x="${(bestPlacement.labelX + 14).toFixed(2)}" y="${(bestPlacement.labelY - 4).toFixed(
              2
            )}" text-anchor="start" font-size="${labelFontSize}" font-weight="700" fill="#4E6684">${escapeHtml(label)}</text>
          </g>
        `;
      })
      .join("");
  })();

  let svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(chartTitle)}" data-chart-mode="bars">
      <rect x="0" y="0" width="${width}" height="${height}" fill="${background}"></rect>
      <g id="chartContent">
        <text x="${titleX}" y="${titleY}" text-anchor="middle" font-size="${titleFontSize}" font-weight="800" fill="${titleColor}">${escapeHtml(chartTitle)}</text>
        ${
          latestFiscalLabel
            ? `<text x="${topInfoX}" y="${topQuarterDisplayY}" text-anchor="end" font-size="${topQuarterFontSize}" font-weight="700" fill="#575C63">${escapeHtml(
                latestFiscalLabel
              )}</text>`
            : ""
        }
        ${
          latestPeriodEnd
            ? `<text x="${topInfoX}" y="${topPeriodY}" text-anchor="end" font-size="${periodEndFontSize}" font-weight="600" fill="${mutedText}">${escapeHtml(
                latestPeriodEnd
              )}</text>`
            : ""
        }
        <text x="${Math.max(18, plotLeft - 72).toFixed(2)}" y="${(legendTop + 18).toFixed(2)}" text-anchor="start" font-size="${yLabelFontSize}" font-weight="700" fill="${axisText}">${escapeHtml(
    unitLines.line1
  )}</text>
        <text x="${Math.max(18, plotLeft - 72).toFixed(2)}" y="${(legendTop + 48).toFixed(2)}" text-anchor="start" font-size="${yLabelFontSize}" font-weight="700" fill="${axisText}">${escapeHtml(
    unitLines.line2
  )}</text>
        ${
          hasConvertedCurrency
            ? `<text x="${fxNoteX}" y="${fxNoteY.toFixed(2)}" text-anchor="start" font-size="${fxNoteFontSize}" fill="#7B8490">${
                currentChartLanguage() === "en" ? "Converted to USD by filing-date FX rates." : "已按申报日汇率折算为美元。"
              }</text>`
            : ""
        }
  `;

  legendRows.forEach((row, rowIndex) => {
    const rowWidth = legendRowWidths[rowIndex] || 0;
    const centeredFromTitle = titleX - rowWidth / 2;
    const rowStartX = clamp(centeredFromTitle, legendAreaLeft, Math.max(legendAreaLeft, legendAreaRight - rowWidth));
    const rowY = legendTop + rowIndex * (legendLineHeight + legendRowGap);
    row.forEach((entry) => {
      const swatchX = rowStartX + entry.offsetX;
      const swatchY = rowY + (legendLineHeight - swatchSize) / 2;
      const textX = swatchX + swatchSize + swatchGap;
      const textY = rowY + legendFontSize * 0.82;
      svg += `<rect x="${swatchX.toFixed(2)}" y="${swatchY.toFixed(2)}" width="${swatchSize}" height="${swatchSize}" rx="${
        swatchSize * 0.24
      }" fill="${entry.item.color}"></rect>`;
      svg += `<text x="${textX.toFixed(2)}" y="${textY.toFixed(2)}" text-anchor="start" font-size="${legendFontSize}" font-weight="700" fill="${axisText}">${escapeHtml(
        entry.label
      )}</text>`;
    });
  });

  svg += `<line x1="${plotLeft}" y1="${chartTop}" x2="${plotLeft}" y2="${baselineY}" stroke="#C9CED6" stroke-width="2.2" data-bar-axis="true"></line>`;
  gridValues.forEach((gridValue) => {
    const y = baselineY - gridValue * valueScale;
    if (y <= chartTop + 8 || y >= baselineY - 8) return;
    svg += `<line x1="${plotLeft}" y1="${y.toFixed(2)}" x2="${plotRight}" y2="${y.toFixed(2)}" stroke="#DDE2E8" stroke-width="1.4" data-bar-grid="true"></line>`;
    svg += `<line x1="${plotLeft - 8}" y1="${y.toFixed(2)}" x2="${plotLeft}" y2="${y.toFixed(2)}" stroke="#C9CED6" stroke-width="1.8" data-bar-axis="true"></line>`;
    svg += `<text x="${plotLeft - 14}" y="${(y + 6).toFixed(2)}" text-anchor="end" font-size="18" fill="#8A9098">${escapeHtml(
      formatBarAxisTick(unitSpec.displayValue(gridValue), gridStepDisplay)
    )}</text>`;
  });
  svg += `<line x1="${plotLeft}" y1="${baselineY}" x2="${plotRight}" y2="${baselineY}" stroke="#C9CED6" stroke-width="2.2" data-bar-axis="true"></line>`;
  svg += taxonomyBreakAnnotations;
  svg += `
    <g opacity="0.98" data-bar-chart-logo="true" data-logo-zone-left="${chartLogoZone.left.toFixed(2)}" data-logo-zone-top="${chartLogoZone.top.toFixed(
      2
    )}" data-logo-zone-right="${chartLogoZone.right.toFixed(2)}" data-logo-zone-bottom="${chartLogoZone.bottom.toFixed(2)}">
      ${renderCorporateLogo(chartLogoKey, chartLogoPlacement.x.toFixed(2), chartLogoPlacement.y.toFixed(2), {
        scale: Number(chartLogoPlacement.scale.toFixed(4)),
      })}
    </g>
  `;

  svg += `<g data-bar-series="true" data-bar-plot-top="${chartTop.toFixed(2)}" data-bar-scale-max="${scaleMaxRevenueBn.toFixed(3)}">`;
  history.quarters.forEach((quarter, quarterIndex) => {
    const x = barStartX + quarterIndex * (barWidth + barGap);
    const activeKeys = history.stackOrder.filter((segmentKey) => safeNumber(quarter.segmentMap?.[segmentKey]) > 0.005);
    let cursorBottom = baselineY;
    activeKeys.forEach((segmentKey, segmentIndex) => {
      const valueBn = safeNumber(quarter.segmentMap?.[segmentKey]);
      const heightValue = Math.max(valueBn * valueScale, 1.2);
      const y = cursorBottom - heightValue;
      const isBottom = segmentIndex === 0;
      const isTop = segmentIndex === activeKeys.length - 1;
      const fillColor = history.colorBySegment[segmentKey] || "#1CA1E2";
      svg += stackedBarSegmentElement(
        x,
        y,
        barWidth,
        heightValue,
        barCornerRadius,
        isTop,
        isBottom,
        fillColor
      );
      const valueLabel = formatBarSegmentValue(valueBn, history);
      const valueFontSize = clamp(Math.round(barWidth * 0.42), 11, 24);
      if (heightValue >= valueFontSize + 7) {
        svg += `<text x="${x + barWidth / 2}" y="${y + heightValue / 2 + valueFontSize * 0.34}" text-anchor="middle" font-size="${valueFontSize}" font-weight="700" fill="${barSegmentTextColor(
          fillColor, company?.id
        )}">${escapeHtml(
          valueLabel
        )}</text>`;
      }
      cursorBottom = y;
    });
    if (!activeKeys.length) {
      const placeholderHeight = 8;
      const placeholderY = baselineY - placeholderHeight;
      svg += `<rect x="${x.toFixed(2)}" y="${placeholderY.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${placeholderHeight.toFixed(
        2
      )}" rx="${Math.min(4, barCornerRadius)}" fill="#C8D0DA" stroke="#AEB5BE" stroke-width="1"></rect>`;
    }
    const tickX = x + barWidth / 2;
    const tickY = baselineY + 30;
    const shouldRenderTick =
      quarterIndex % labelStride === 0 || quarterIndex === 0 || quarterIndex === barCount - 1;
    if (shouldRenderTick) {
      svg += `<text x="${tickX}" y="${tickY}" text-anchor="middle" font-size="${xLabelFontSize}" font-weight="700" fill="#111111" transform="rotate(${xLabelAngle} ${tickX} ${tickY})">${escapeHtml(
        quarter.label
      )}</text>`;
    }
  });
  svg += `</g>`;

  if (history.basis === "recast") {
    svg += `<text data-bar-basis-note="recast" x="${plotLeft}" y="${height - 24}" font-size="18" fill="${mutedText}">${escapeHtml(currentChartLanguage() === "en" ? history.basisNoteEn : history.basisNoteZh)}</text>`;
  }
  svg += "</g></svg>";
  return {
    svg,
    history,
    width,
    height,
  };
}

