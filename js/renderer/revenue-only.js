function renderRevenueOnlyReplicaSvg(snapshot) {
  const canvas = snapshotCanvasSize(snapshot);
  const width = canvas.width;
  const height = canvas.height;
  const leftShiftX = safeNumber(canvas.leftShiftX, 0);
  const topCanvasPaddingY = safeNumber(canvas.topCanvasPaddingY, 0);
  const verticalScale = Math.max(height - topCanvasPaddingY, 1) / canvas.designHeight;
  const scaleY = (value) => value * verticalScale;
  const shiftCanvasX = (value, fallback) => safeNumber(value, fallback) + leftShiftX;
  const background = "#F6F5F2";
  const titleColor = "#175C8E";
  const muted = "#676C75";
  const dark = "#55595F";
  const revenueNode = "#707070";
  const cardStroke = "#D6DBE3";
  const cardFill = "#FBFBFA";
  const brand = resolvedCompanyBrand(getCompany(state.selectedCompanyId) || { id: snapshot.companyLogoKey });
  const titleText = localizeChartTitle(snapshot);
  const titleX = width / 2;
  const titleY = scaleY(safeNumber(snapshot.layout?.limitedTitleY, 126));
  const periodEndX = shiftCanvasX(snapshot.layout?.limitedPeriodEndX, width - 436);
  const periodEndY = scaleY(safeNumber(snapshot.layout?.limitedPeriodEndY, 154));
  const logoX = shiftCanvasX(snapshot.layout?.limitedLogoX, 154);
  const logoY = scaleY(safeNumber(snapshot.layout?.limitedLogoY, 542));
  const logoScale = safeNumber(snapshot.layout?.limitedLogoScale, 1.12);
  const revenueX = shiftCanvasX(snapshot.layout?.revenueX, 832);
  const revenueWidth = safeNumber(snapshot.layout?.limitedRevenueWidth, 58);
  const revenueTop = scaleY(safeNumber(snapshot.layout?.limitedRevenueTop, 380));
  const revenueHeight = scaleY(safeNumber(snapshot.layout?.limitedRevenueHeight, 432));
  const revenueBottom = revenueTop + revenueHeight;
  const revenueBn = Math.max(safeNumber(snapshot.revenueBn), 0.05);
  const revenueScale = revenueHeight / revenueBn;
  const sourceFlowOptions = {
    curveFactor: 0.36,
    startCurveFactor: 0.32,
    endCurveFactor: 0.36,
    minStartCurveFactor: 0.14,
    maxStartCurveFactor: 0.36,
    minEndCurveFactor: 0.16,
    maxEndCurveFactor: 0.38,
    deltaScale: 0.92,
    deltaInfluence: 0.065,
    thicknessInfluence: 0.055,
  };
  const fallbackSources = [
    {
      id: "reportedrevenue",
      name: "Reported revenue",
      nameZh: "报告营收",
      displayLines: [currentChartLanguage() === "en" ? "Reported revenue" : "报告营收"],
      valueBn: revenueBn,
      flowValueBn: revenueBn,
      nodeColor: brand.primary,
      flowColor: rgba(brand.primary, 0.55),
    },
  ];
  const sources = sortBusinessGroupsByValue(snapshot.businessGroups || []).filter((item) => safeNumber(item?.valueBn) > 0.02);
  const detailGroups = [...(snapshot.leftDetailGroups || [])].filter((item) => safeNumber(item?.valueBn) > 0.02);
  const hasDetailHierarchy = sources.length > 0 && detailGroups.length > 0;
  const resolvedSources = sources.length ? sources : fallbackSources;
  const revenueSlices = fitSlicesToBand(
    stackValueSlices(resolvedSources, revenueTop, revenueScale, {
      minHeight: scaleY(16),
      targetBottom: revenueBottom,
      valueKey: "flowValueBn",
    }),
    revenueTop,
    revenueBottom,
    {
      gap: scaleY(10),
      minHeight: scaleY(14),
    }
  );
  const sourceX = shiftCanvasX(snapshot.layout?.limitedSourceX, hasDetailHierarchy ? 662 : 356);
  const sourceWidth = safeNumber(snapshot.layout?.limitedSourceWidth, 52);
  const sourceBoxes = resolveVerticalBoxesVariableGap(
    revenueSlices.map((slice) => ({
      center: slice.center,
      height: Math.max(slice.height, scaleY(14)),
      gapAbove: 0,
    })),
    scaleY(safeNumber(snapshot.layout?.limitedSourceMinY, 280)),
    scaleY(safeNumber(snapshot.layout?.limitedSourceMaxY, 1034)),
    scaleY(safeNumber(snapshot.layout?.limitedSourceGapY, 22))
  );
  const sourceSlices = revenueSlices.map((slice, index) => ({
    ...slice,
    revenueTop: slice.top,
    revenueBottom: slice.bottom,
    top: sourceBoxes[index].top,
    bottom: sourceBoxes[index].bottom,
    center: sourceBoxes[index].center,
    height: sourceBoxes[index].height,
  }));
  const detailX = shiftCanvasX(snapshot.layout?.limitedDetailSourceX, 258);
  const detailWidth = safeNumber(snapshot.layout?.limitedDetailSourceWidth, 48);
  const detailSlices = [];
  if (hasDetailHierarchy) {
    const targetSliceFor = (item) => {
      const targetKey = normalizeLabelKey(item.targetId || item.targetName || item.target || item.groupName);
      return sourceSlices.find((slice) => {
        const sourceKeys = [slice.item?.id, slice.item?.memberKey, slice.item?.name].map((value) => normalizeLabelKey(value));
        return targetKey && sourceKeys.includes(targetKey);
      });
    };
    sourceSlices.forEach((targetSlice) => {
      const rows = detailGroups.filter((item) => targetSliceFor(item) === targetSlice);
      const totalValue = rows.reduce((sum, item) => sum + safeNumber(item?.valueBn), 0);
      if (!(totalValue > 0.02)) return;
      let cursor = targetSlice.top;
      rows.forEach((item, index) => {
        const targetTop = cursor;
        const targetBottom = index === rows.length - 1
          ? targetSlice.bottom
          : targetTop + (safeNumber(item.valueBn) / totalValue) * targetSlice.height;
        detailSlices.push({
          item,
          targetSlice,
          targetTop,
          targetBottom,
          top: targetTop,
          bottom: targetBottom,
          center: (targetTop + targetBottom) / 2,
          height: targetBottom - targetTop,
        });
        cursor = targetBottom;
      });
    });

    const detailBoxes = resolveVerticalBoxesVariableGap(
      detailSlices.map((slice) => ({
        center: slice.center,
        height: Math.max(slice.height, scaleY(14)),
        gapAbove: 0,
      })),
      scaleY(safeNumber(snapshot.layout?.limitedDetailSourceMinY, 250)),
      scaleY(safeNumber(snapshot.layout?.limitedDetailSourceMaxY, 1055)),
      scaleY(safeNumber(snapshot.layout?.limitedDetailSourceGapY, 64))
    );
    detailSlices.forEach((slice, index) => {
      const box = detailBoxes[index];
      slice.top = box.top;
      slice.bottom = box.bottom;
      slice.center = box.center;
      slice.height = box.height;
    });
  }
  const revenueFrame = {
    x: revenueX,
    y: revenueTop,
    width: revenueWidth,
    height: revenueHeight,
    top: revenueTop,
    bottom: revenueBottom,
    left: revenueX,
    right: revenueX + revenueWidth,
    centerX: revenueX + revenueWidth / 2,
  };
  const calloutX = shiftCanvasX(snapshot.layout?.limitedCalloutX, 1228);
  const calloutY = scaleY(safeNumber(snapshot.layout?.limitedCalloutY, 446));
  const calloutWidth = safeNumber(snapshot.layout?.limitedCalloutWidth, 470);
  const calloutHeight = scaleY(safeNumber(snapshot.layout?.limitedCalloutHeight, 248));
  const calloutTitle = currentChartLanguage() === "en" ? "Revenue structure only" : "仅展示营收结构";
  const calloutBody = currentChartLanguage() === "en"
    ? [
        "Gross and operating profit",
        "spine is not disclosed well enough",
        "Only revenue structure is shown.",
      ]
    : [
        "本季度缺少可稳定还原的",
        "毛利/营业利润主干披露",
        "这里只保留营收侧结构。",
      ];
  const netSummary =
    snapshot.netProfitBn !== null && snapshot.netProfitBn !== undefined
      ? currentChartLanguage() === "en"
        ? `Net income ${formatBillions(snapshot.netProfitBn)}`
        : `净利润 ${formatBillions(snapshot.netProfitBn)}`
      : snapshot.pretaxIncomeBn !== null && snapshot.pretaxIncomeBn !== undefined
        ? currentChartLanguage() === "en"
          ? `Pretax income ${formatBillions(snapshot.pretaxIncomeBn)}`
          : `税前利润 ${formatBillions(snapshot.pretaxIncomeBn)}`
        : "";

  let svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(titleText)}" font-family="Aptos, Segoe UI, Arial, Helvetica, sans-serif" data-editor-bounds-left="0" data-editor-bounds-top="0" data-editor-bounds-right="${width}" data-editor-bounds-bottom="${height}">
      <rect x="0" y="0" width="${width}" height="${height}" fill="${background}"></rect>
      <g id="chartContent"${topCanvasPaddingY > 0 ? ` transform="translate(0 ${topCanvasPaddingY})"` : ""}>
        <text x="${titleX}" y="${titleY}" text-anchor="middle" font-size="${safeNumber(snapshot.layout?.limitedTitleFontSize, 70)}" font-weight="800" fill="${titleColor}" letter-spacing="0.3">${escapeHtml(
    titleText
  )}</text>
        ${
          snapshot.periodEndLabel
            ? `<text x="${periodEndX}" y="${periodEndY}" text-anchor="start" font-size="${safeNumber(snapshot.layout?.limitedPeriodEndFontSize, 28)}" fill="${muted}">${escapeHtml(
                localizePeriodEndLabel(snapshot.periodEndLabel || "")
              )}</text>`
            : ""
        }
        ${renderCorporateLogo(snapshot.companyLogoKey, logoX, logoY, { scale: logoScale })}
  `;

  detailSlices.forEach((slice) => {
    const item = slice.item || {};
    const fillColor = item.nodeColor || brand.primary;
    const flowColor = item.flowColor || rgba(fillColor, 0.62);
    const localizedName = currentChartLanguage() === "en" ? item.name || "Category" : item.nameZh || translateBusinessLabelToZh(item.name || "Category");
    const labelLines = wrapLines(localizedName, 11);
    const labelX = detailX - 18;
    const labelStartY = slice.center - (labelLines.length - 1) * 16 - 10;
    svg += `<path d="${hornFlowPath(detailX + detailWidth, slice.top, slice.bottom, sourceX, slice.targetTop, slice.targetBottom, sourceFlowOptions)}" fill="${flowColor}" opacity="0.96"></path>`;
    svg += `<rect x="${detailX}" y="${slice.top}" width="${detailWidth}" height="${Math.max(slice.height, 2)}" rx="3" fill="${fillColor}"></rect>`;
    labelLines.forEach((line, lineIndex) => {
      svg += `<text x="${labelX}" y="${labelStartY + lineIndex * 30}" text-anchor="end" font-size="22" font-weight="700" fill="${fillColor}">${escapeHtml(line)}</text>`;
    });
    svg += `<text x="${labelX}" y="${labelStartY + labelLines.length * 30 + 2}" text-anchor="end" font-size="18" font-weight="600" fill="${muted}">${escapeHtml(
      formatBillions(item.valueBn)
    )}</text>`;
  });

  sourceSlices.forEach((slice) => {
    const item = slice.item || {};
    const fillColor = item.nodeColor || brand.primary;
    const flowColor = item.flowColor || rgba(fillColor, 0.56);
    const localizedName = currentChartLanguage() === "en" ? item.name || "Segment" : item.nameZh || translateBusinessLabelToZh(item.name || "Segment");
    const labelLines = wrapLines(localizedName, 14);
    const valueText = formatBillions(item.valueBn);
    const labelX = hasDetailHierarchy ? revenueX - 20 : sourceX - 18;
    const labelAnchor = "end";
    const labelStartY = slice.center - (labelLines.length - 1) * 16 - 10;
    svg += `<path d="${hornFlowPath(sourceX + sourceWidth, slice.top, slice.bottom, revenueFrame.left, slice.revenueTop, slice.revenueBottom, sourceFlowOptions)}" fill="${flowColor}" opacity="0.98"></path>`;
    svg += `<rect x="${sourceX}" y="${slice.top}" width="${sourceWidth}" height="${slice.height}" rx="4" fill="${fillColor}"></rect>`;
    labelLines.forEach((line, lineIndex) => {
      svg += `<text x="${labelX}" y="${labelStartY + lineIndex * 32}" text-anchor="${labelAnchor}" font-size="24" font-weight="700" fill="${dark}" paint-order="stroke fill" stroke="${background}" stroke-width="6" stroke-linejoin="round">${escapeHtml(line)}</text>`;
    });
    svg += `<text x="${labelX}" y="${labelStartY + labelLines.length * 32 + 4}" text-anchor="${labelAnchor}" font-size="20" font-weight="600" fill="${muted}" paint-order="stroke fill" stroke="${background}" stroke-width="5" stroke-linejoin="round">${escapeHtml(
      valueText
    )}</text>`;
  });

  const revenueLabel = currentChartLanguage() === "en" ? "Revenue" : "营收";
  svg += `
        <rect x="${revenueFrame.x}" y="${revenueFrame.y}" width="${revenueFrame.width}" height="${revenueFrame.height}" fill="${revenueNode}"></rect>
        <text x="${revenueFrame.centerX}" y="${revenueFrame.y - scaleY(26)}" text-anchor="middle" font-size="28" font-weight="800" fill="${dark}">${escapeHtml(
    revenueLabel
  )}</text>
        <text x="${revenueFrame.centerX}" y="${revenueFrame.y + revenueFrame.height / 2 + 12}" text-anchor="middle" font-size="58" font-weight="800" fill="#FFFFFF" paint-order="stroke fill" stroke="${background}" stroke-width="8" stroke-linejoin="round">${escapeHtml(
    formatBillions(snapshot.revenueBn)
  )}</text>
        ${
          snapshot.revenueYoyPct !== null && snapshot.revenueYoyPct !== undefined
            ? `<text x="${revenueFrame.centerX}" y="${revenueFrame.bottom + scaleY(34)}" text-anchor="middle" font-size="24" font-weight="700" fill="${muted}">${escapeHtml(
                currentChartLanguage() === "en" ? `YoY ${formatPct(snapshot.revenueYoyPct, true)}` : `同比 ${formatPct(snapshot.revenueYoyPct, true)}`
              )}</text>`
            : ""
        }
        <rect x="${calloutX}" y="${calloutY}" width="${calloutWidth}" height="${calloutHeight}" rx="24" fill="${cardFill}" stroke="${cardStroke}" stroke-width="2"></rect>
        <text x="${calloutX + 30}" y="${calloutY + 52}" text-anchor="start" font-size="34" font-weight="800" fill="${titleColor}">${escapeHtml(calloutTitle)}</text>
        <text x="${calloutX + 30}" y="${calloutY + 98}" text-anchor="start" font-size="22" font-weight="600" fill="${dark}">${escapeHtml(calloutBody[0])}</text>
        <text x="${calloutX + 30}" y="${calloutY + 134}" text-anchor="start" font-size="22" font-weight="600" fill="${dark}">${escapeHtml(calloutBody[1])}</text>
        <text x="${calloutX + 30}" y="${calloutY + 170}" text-anchor="start" font-size="22" font-weight="600" fill="${dark}">${escapeHtml(calloutBody[2])}</text>
        ${
          netSummary
            ? `<text x="${calloutX + 30}" y="${calloutY + 216}" text-anchor="start" font-size="28" font-weight="800" fill="#009B5F">${escapeHtml(netSummary)}</text>`
            : ""
        }
      </g>
      ${renderReplicaFooter(snapshot)}
    </svg>
  `;
  return svg;
}

