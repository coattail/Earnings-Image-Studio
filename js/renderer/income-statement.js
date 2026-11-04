function renderIncomeStatementSvg(snapshot, company) {
  const issue = chartPublicationIssue(company, snapshot.quarterKey);
  if (issue) throw new Error(issue);
  if (snapshot.mode === "pixel-replica" || snapshot.mode === "replica-template") {
    return renderPixelReplicaSvg(snapshot);
  }
  const width = 1600;
  const height = 900;
  const titleText = localizeChartTitle(snapshot);
  const titleFontSize = 82;
  const titleX = width / 2;
  const titleY = 104;
  const inlinePeriodLayout = inlinePeriodEndLayout({
    titleText,
    titleFontSize,
    titleX,
    titleY,
    periodEndFontSize: 28,
    width,
    rightPadding: 70,
  });
  const periodEndX = inlinePeriodLayout.periodEndX;
  const periodEndY = inlinePeriodLayout.periodEndY;
  const revenue = Number(snapshot.revenueBn || 0);
  const companyBrand = resolvedCompanyBrand(company);
  const grossProfit = Number(snapshot.grossProfitBn || 0);
  const costOfRevenue =
    snapshot.costOfRevenueBn !== null && snapshot.costOfRevenueBn !== undefined
      ? Number(snapshot.costOfRevenueBn || 0)
      : Math.max(revenue - grossProfit, 0);
  const rawOperatingProfit = Number(snapshot.operatingProfitBn || 0);
  const hasOperatingLoss = rawOperatingProfit < -0.02;
  const operatingOutcomeLoss = isLossMakingOperatingOutcome(snapshot);
  const operatingProfit = hasOperatingLoss ? 0 : rawOperatingProfit;
  const operatingExpenses =
    snapshot.displayOperatingExpensesBn !== null && snapshot.displayOperatingExpensesBn !== undefined
      ? Math.max(Number(snapshot.displayOperatingExpensesBn || 0), 0)
      : snapshot.operatingExpensesBn !== null && snapshot.operatingExpensesBn !== undefined
      ? hasOperatingLoss
        ? Math.min(Number(snapshot.operatingExpensesBn || 0), grossProfit)
        : Number(snapshot.operatingExpensesBn || 0)
      : Math.max(grossProfit - operatingProfit, 0);
  const netOutcome = resolvedNetOutcomeValue(snapshot);
  const netLoss = isLossMakingNetOutcome(snapshot);
  const nearZeroNet = isNearZeroNetOutcome(snapshot);
  const netProfit = netLoss ? Math.abs(netOutcome) : Math.max(netOutcome, 0);
  const sources = [...(snapshot.businessGroups || [])].filter((item) => Number(item.valueBn || 0) > 0.02);
  const opexItems = [...(snapshot.opexBreakdown || [])].filter((item) => Number(item.valueBn || 0) > 0.02);
  const positiveAdjustments = [...(snapshot.positiveAdjustments || [])].filter(
    (item) => isRenderableFinancialBridgeItem(item, snapshot)
  );
  const belowOperatingItems = [...(snapshot.belowOperatingItems || [])].filter(
    (item) => isRenderableFinancialBridgeItem(item, snapshot)
  );

  const titleColor = snapshot.mode === "pixel-replica" ? "#145B8E" : "#17496D";
  const background = snapshot.mode === "pixel-replica" ? "#F6F5F2" : "#F7FBFF";
  const profitFill = "#9BD199";
  const profitNode = "#2CA52C";
  const expenseFill = "#EA9294";
  const expenseNode = "#E10600";
  const neutralNode = "#6A6A6A";

  const leftNodeX = 340;
  const revenueX = 556;
  const grossX = 812;
  const opX = 1078;
  const rightX = 1328;
  const nodeWidth = snapshot.mode === "pixel-replica" ? 56 : 42;
  const centerY = 468;
  const scale = 410 / Math.max(revenue, 1);

  const revenueHeight = Math.max(revenue * scale, 4);
  const grossHeight = Math.max(grossProfit * scale, 2);
  const costHeight = Math.max(costOfRevenue * scale, 2);
  const opHeight = Math.max(operatingProfit * scale, 2);
  const opexHeight = Math.max(operatingExpenses * scale, 2);
  const netHeight = Math.max(netProfit * scale, nearZeroNet ? 4 : 2);
  const operatingOutcomeLabel = resolvedOperatingOutcomeLabel(snapshot);
  const operatingOutcomeValueText = formatOperatingOutcomeBillions(snapshot);
  const operatingOutcomeNodeFill = operatingOutcomeLoss ? expenseNode : profitNode;
  const operatingOutcomeTextFill = operatingOutcomeLoss ? "#8C1F0A" : "#089256";
  const showOperatingOutcomeBridge = !hasOperatingLoss && opHeight > 0.5;

  const revenueTop = centerY - revenueHeight / 2;
  const revenueBottom = centerY + revenueHeight / 2;
  const grossTop = centerY - grossHeight / 2;
  const grossBottom = grossTop + grossHeight;
  const costTop = grossBottom;
  const costBottom = revenueBottom;
  const opTop = grossTop;
  const opBottom = opTop + opHeight;
  const opexTop = opBottom;
  const opexBottom = grossBottom;
  const netTop = opTop;
  const netBottom = netTop + netHeight;
  const fallbackExpenseTitleSize = 26;
  const fallbackExpenseValueSize = 26;
  const fallbackExpenseVisualGap = 18;
  const fallbackExpenseBaselineY = (nodeBottom) => nodeBottom + fallbackExpenseVisualGap + fallbackExpenseTitleSize * 0.82;

  const bridgeHeight = Math.min(opHeight, netHeight);
  const bridgeSourceBottom = opTop + bridgeHeight;
  const bridgeTargetBottom = netTop + bridgeHeight;

  let svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(titleText)}">
      <rect x="0" y="0" width="${width}" height="${height}" fill="${background}"></rect>
      <g id="chartContent">
      <text x="${titleX}" y="${titleY}" text-anchor="middle" font-size="${titleFontSize}" font-weight="800" fill="${titleColor}" letter-spacing="0.5">${escapeHtml(titleText)}</text>
      ${snapshot.periodEndLabel ? `<text x="${periodEndX}" y="${periodEndY}" text-anchor="start" font-size="28" fill="#5E6269">${escapeHtml(localizePeriodEndLabel(snapshot.periodEndLabel || ""))}</text>` : ""}
      ${renderCorporateLogo(snapshot.companyLogoKey, 650, 172)}
    `;

  let sourceCursor = revenueTop;
  sources.forEach((item) => {
    const value = Number(item.valueBn || 0);
    const heightValue = Math.max(value * scale, 2);
    const top = sourceCursor;
    const bottom = top + heightValue;
    const lockupProfile = lockupLayoutProfile(item.lockupKey);
    const lockupY = top + heightValue / 2 - (lockupProfile?.previewOffset || 30);
    svg += `<path d="${flowPath(leftNodeX + nodeWidth, top, bottom, revenueX, top, bottom)}" fill="${item.flowColor || rgba(companyBrand.primary, 0.48)}" opacity="0.94"></path>`;
    svg += `<rect x="${leftNodeX}" y="${top.toFixed(1)}" width="${nodeWidth}" height="${heightValue.toFixed(1)}" fill="${item.nodeColor || companyBrand.primary}"></rect>`;
    svg += renderBusinessLockup(item.lockupKey, 64, lockupY);
    const valueX = 324;
    const labelCenterY = top + heightValue / 2;
    svg += `<text x="${valueX}" y="${labelCenterY - 4}" text-anchor="end" font-size="22" font-weight="500" fill="#666666">${escapeHtml(formatBillions(value))}</text>`;
    if (item.qoqPct !== null && item.qoqPct !== undefined) {
      svg += `<text x="${valueX}" y="${labelCenterY + 18}" text-anchor="end" font-size="13" fill="#8A9098">${escapeHtml(formatGrowthMetric(item.qoqPct, "qoq"))}</text>`;
    }
    if (item.yoyPct !== null && item.yoyPct !== undefined) {
      svg += `<text x="${valueX}" y="${labelCenterY + (item.qoqPct !== null && item.qoqPct !== undefined ? 38 : 18)}" text-anchor="end" font-size="16" fill="#666666">${escapeHtml(formatGrowthMetric(item.yoyPct, "yoy"))}</text>`;
    }
    const fallbackLabelLines =
      currentChartLanguage() === "zh"
        ? wrapLabelWithMaxWidth(localizeChartItemName(item), snapshot.mode === "pixel-replica" ? 22 : 20, currentChartLanguage() === "zh" ? 150 : 180, {
            maxLines: 3,
          })
        : item.displayLines?.length
          ? item.displayLines
          : wrapLines(item.name || "", 14);
    if (fallbackLabelLines.length) {
      svg += svgTextBlock(
        252,
        labelCenterY + (fallbackLabelLines.length > 1 ? 40 : 34),
        fallbackLabelLines,
        {
          fill: "#555555",
          fontSize: snapshot.mode === "pixel-replica" ? 22 : 20,
          weight: 800,
          anchor: "middle",
          lineHeight: snapshot.mode === "pixel-replica" ? 26 : 24,
        }
      );
    }
    if (item.operatingMarginPct !== null && item.operatingMarginPct !== undefined) {
      const offset = fallbackLabelLines.length > 1 ? 76 : 58;
      svg += `<text x="252" y="${labelCenterY + offset}" text-anchor="middle" font-size="15" fill="#666666">${escapeHtml(formatPct(item.operatingMarginPct))} ${marginLabel()}</text>`;
    }
    sourceCursor = bottom;
  });

  svg += `
      <rect x="${revenueX}" y="${revenueTop.toFixed(1)}" width="${nodeWidth}" height="${revenueHeight.toFixed(1)}" fill="${neutralNode}"></rect>
      <text x="${revenueX + nodeWidth / 2}" y="${revenueTop - 28}" text-anchor="middle" font-size="30" font-weight="800" fill="#555A63">${escapeHtml(localizeChartPhrase("Revenue"))}</text>
      <text x="${revenueX + nodeWidth / 2}" y="${revenueTop + 2}" text-anchor="middle" font-size="34" font-weight="800" fill="#555A63">${escapeHtml(formatBillions(revenue))}</text>
      ${snapshot.revenueQoqPct !== null && snapshot.revenueQoqPct !== undefined ? `<text x="${revenueX + nodeWidth / 2}" y="${revenueTop + 28}" text-anchor="middle" font-size="14" fill="#8A9098">${escapeHtml(formatGrowthMetric(snapshot.revenueQoqPct, "qoq"))}</text>` : ""}
      ${snapshot.revenueYoyPct !== null && snapshot.revenueYoyPct !== undefined ? `<text x="${revenueX + nodeWidth / 2}" y="${revenueTop + (snapshot.revenueQoqPct !== null && snapshot.revenueQoqPct !== undefined ? 48 : 28)}" text-anchor="middle" font-size="16" fill="#666666">${escapeHtml(formatGrowthMetric(snapshot.revenueYoyPct, "yoy"))}</text>` : ""}

      <path d="${flowPath(revenueX + nodeWidth, revenueTop, grossBottom, grossX, grossTop, grossBottom)}" fill="${profitFill}" opacity="0.96"></path>
      <path d="${flowPath(revenueX + nodeWidth, grossBottom, revenueBottom, grossX, costTop, costBottom)}" fill="${expenseFill}" opacity="0.96"></path>

      <rect x="${grossX}" y="${grossTop.toFixed(1)}" width="${nodeWidth}" height="${grossHeight.toFixed(1)}" fill="${profitNode}"></rect>
      <text x="${grossX + nodeWidth / 2}" y="${grossTop - 28}" text-anchor="middle" font-size="26" font-weight="800" fill="#089256">${escapeHtml(localizeChartPhrase("Gross profit"))}</text>
      <text x="${grossX + nodeWidth / 2}" y="${grossTop + 2}" text-anchor="middle" font-size="26" font-weight="800" fill="#089256">${escapeHtml(formatBillions(grossProfit))}</text>
      <text x="${grossX + nodeWidth / 2}" y="${grossTop + 28}" text-anchor="middle" font-size="16" fill="#666666">${escapeHtml(formatPct(snapshot.grossMarginPct))} ${marginLabel()}</text>
      ${snapshot.grossMarginYoyDeltaPp !== null && snapshot.grossMarginYoyDeltaPp !== undefined ? `<text x="${grossX + nodeWidth / 2}" y="${grossTop + 52}" text-anchor="middle" font-size="15" fill="#666666">${escapeHtml(formatPp(snapshot.grossMarginYoyDeltaPp))}</text>` : ""}

      <rect x="${grossX}" y="${costTop.toFixed(1)}" width="${nodeWidth}" height="${costHeight.toFixed(1)}" fill="${expenseNode}"></rect>
      <text x="${grossX + nodeWidth / 2}" y="${fallbackExpenseBaselineY(costBottom)}" text-anchor="middle" font-size="${fallbackExpenseTitleSize}" font-weight="800" fill="#8C1F0A">${escapeHtml(localizeChartPhrase("Cost of revenue"))}</text>
      <text x="${grossX + nodeWidth / 2}" y="${fallbackExpenseBaselineY(costBottom) + 30}" text-anchor="middle" font-size="${fallbackExpenseValueSize}" font-weight="800" fill="#8C1F0A">${escapeHtml(formatBillions(costOfRevenue, true))}</text>

      ${showOperatingOutcomeBridge ? `<path d="${flowPath(grossX + nodeWidth, grossTop, opBottom, opX, opTop, opBottom)}" fill="${operatingOutcomeLoss ? expenseFill : profitFill}" opacity="0.96"></path>` : ""}
      <path d="${flowPath(grossX + nodeWidth, hasOperatingLoss ? grossTop : opBottom, grossBottom, opX, opexTop, opexBottom)}" fill="${expenseFill}" opacity="0.96"></path>

      <rect x="${opX}" y="${opTop.toFixed(1)}" width="${nodeWidth}" height="${opHeight.toFixed(1)}" fill="${operatingOutcomeNodeFill}"></rect>
      <text x="${opX + nodeWidth / 2}" y="${opTop - 28}" text-anchor="middle" font-size="26" font-weight="800" fill="${operatingOutcomeTextFill}">${escapeHtml(localizeChartPhrase(operatingOutcomeLabel))}</text>
      <text x="${opX + nodeWidth / 2}" y="${opTop + 2}" text-anchor="middle" font-size="26" font-weight="800" fill="${operatingOutcomeTextFill}">${escapeHtml(operatingOutcomeValueText)}</text>
      <text x="${opX + nodeWidth / 2}" y="${opTop + 28}" text-anchor="middle" font-size="16" fill="#666666">${escapeHtml(formatPct(snapshot.operatingMarginPct))} ${marginLabel()}</text>
      ${snapshot.operatingMarginYoyDeltaPp !== null && snapshot.operatingMarginYoyDeltaPp !== undefined ? `<text x="${opX + nodeWidth / 2}" y="${opTop + 52}" text-anchor="middle" font-size="15" fill="#666666">${escapeHtml(formatPp(snapshot.operatingMarginYoyDeltaPp))}</text>` : ""}

      <rect x="${opX}" y="${opexTop.toFixed(1)}" width="${nodeWidth}" height="${opexHeight.toFixed(1)}" fill="${expenseNode}"></rect>
      <text x="${opX + nodeWidth / 2}" y="${fallbackExpenseBaselineY(opexBottom)}" text-anchor="middle" font-size="${fallbackExpenseTitleSize}" font-weight="800" fill="#8C1F0A">${escapeHtml(localizeChartPhrase("Operating expenses"))}</text>
      <text x="${opX + nodeWidth / 2}" y="${fallbackExpenseBaselineY(opexBottom) + 30}" text-anchor="middle" font-size="${fallbackExpenseValueSize}" font-weight="800" fill="#8C1F0A">${escapeHtml(formatBillions(operatingExpenses, true))}</text>
    `;

  if (revenue > 0) {
    svg += `<text x="${opX + nodeWidth / 2}" y="${fallbackExpenseBaselineY(opexBottom) + 56}" text-anchor="middle" font-size="16" fill="#666666">${escapeHtml(formatPct((operatingExpenses / revenue) * 100))} ${ofRevenueLabel()}</text>`;
  }

  svg += `
      <path d="${flowPath(opX + nodeWidth, opTop, bridgeSourceBottom, rightX, netTop, bridgeTargetBottom)}" fill="${netLoss ? expenseFill : profitFill}" opacity="0.96"></path>
      <rect x="${rightX}" y="${netTop.toFixed(1)}" width="${nodeWidth}" height="${bridgeHeight.toFixed(1)}" fill="${netLoss ? expenseNode : profitNode}"></rect>
      ${svgTextBlock(rightX + 62, netTop + 12, [localizeChartPhrase(resolvedNetOutcomeLabel(snapshot)), formatNetOutcomeBillions(snapshot)], { fill: netLoss ? "#8C1F0A" : "#089256", fontSize: 24, weight: 800, lineHeight: 30 })}
      <text x="${rightX + 62}" y="${netTop + 68}" font-size="16" fill="#666666">${escapeHtml(formatPct(snapshot.netMarginPct))} ${marginLabel()}</text>
      ${snapshot.netMarginYoyDeltaPp !== null && snapshot.netMarginYoyDeltaPp !== undefined ? `<text x="${rightX + 62}" y="${netTop + 92}" font-size="15" fill="#666666">${escapeHtml(formatPp(snapshot.netMarginYoyDeltaPp))}</text>` : ""}
    `;

  let positiveCursor = bridgeTargetBottom;
  positiveAdjustments.forEach((item) => {
    const itemHeight = Math.max(Number(item.valueBn || 0) * scale, 4);
    svg += `<rect x="${rightX}" y="${positiveCursor.toFixed(1)}" width="${nodeWidth}" height="${itemHeight.toFixed(1)}" fill="${item.color || "#16A34A"}"></rect>`;
      svg += svgTextBlock(rightX + 62, positiveCursor + 14, [item.name, `+${formatBillions(item.valueBn)}`], {
        fill: "#089256",
        fontSize: 16,
        weight: 800,
        lineHeight: 20,
      });
    positiveCursor += itemHeight + 10;
  });

  let belowCursor = netBottom;
  belowOperatingItems.forEach((item, index) => {
    const itemHeight = Math.max(Number(item.valueBn || 0) * scale, index === 0 ? 10 : 4);
    const itemTop = belowCursor + (index === 0 ? 0 : 26);
    const itemBottom = itemTop + itemHeight;
    svg += `<path d="${outboundFlowPath(opX + nodeWidth, itemTop, itemBottom, rightX, itemTop, itemBottom, { targetCoverInsetX: 12 })}" fill="${expenseFill}" opacity="0.96"></path>`;
    svg += `<rect x="${rightX}" y="${itemTop.toFixed(1)}" width="${nodeWidth}" height="${itemHeight.toFixed(1)}" fill="${item.color || expenseNode}"></rect>`;
    svg += svgTextBlock(rightX + 62, itemTop + 6, [item.name, formatBillions(item.valueBn, true)], {
      fill: "#8C1F0A",
      fontSize: 16,
      weight: 800,
      lineHeight: 20,
    });
    belowCursor = itemBottom;
  });

  const opexTotal = opexItems.reduce((sum, item) => sum + Number(item.valueBn || 0), 0);
  let opexTargetY = 566;
  const opexTargetX = rightX;
  opexItems.forEach((item) => {
    const itemHeight = Math.max(Number(item.valueBn || 0) * scale, 5);
    const itemTop = opexTargetY;
    const itemBottom = itemTop + itemHeight;
    const sourceShare = opexTotal > 0 ? Number(item.valueBn || 0) / opexTotal : 0;
    const sourceCenter = opexTop + opexHeight * sourceShare * 0.5 + opexHeight * Math.max(0, opexItems.indexOf(item) / Math.max(opexItems.length, 1)) * 0.34;
    svg += `<path d="${outboundFlowPath(opX + nodeWidth, sourceCenter - itemHeight / 2, sourceCenter + itemHeight / 2, opexTargetX, itemTop, itemBottom, { targetCoverInsetX: 12 })}" fill="${expenseFill}" opacity="0.96"></path>`;
    svg += `<rect x="${opexTargetX}" y="${itemTop.toFixed(1)}" width="${nodeWidth}" height="${itemHeight.toFixed(1)}" fill="${item.color || expenseNode}"></rect>`;
    svg += svgTextBlock(opexTargetX + 62, itemTop + 6, [item.name, formatBillions(item.valueBn, true)], {
      fill: "#8C1F0A",
      fontSize: 16,
      weight: 800,
      lineHeight: 20,
    });
    if (item.note) {
      svg += `<text x="${opexTargetX + 62}" y="${itemTop + 44}" font-size="13" fill="#666666">${escapeHtml(displayChartNote(item.note))}</text>`;
    }
    opexTargetY = itemBottom + 48;
  });

  svg += `</g></svg>`;
  return svg;
}

