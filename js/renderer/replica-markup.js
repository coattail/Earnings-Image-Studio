// SVG presentation of the finalized replica layout. Geometry stays in the layout owner.
function renderReplicaSvgMarkup(model) {
  const {
    autoLayoutOffsetForNode, background, balancedPositiveTop, belowLabelX,
    belowOperatingItems, chartBottomLimit, coreNetHeight, coreNetTargetHeight,
    costBottom, costBreakdownBoxes, costBreakdownSlices, costBreakdownSourceSlices,
    costFrame, costLabelLines, costOfRevenueBn, costSummaryBaselineY,
    costTop, deductionBoxes, deductionSlices, deductionSourceSlices,
    editableNodeFrame, editorOffsetForNode, expenseSummaryLayout, extremePositiveTopLaneBottomGapY,
    greenFlow, greenNode, greenText, grossExpenseBand,
    grossFrame, grossMetricLayout, grossMetricY, grossMetricYShifted,
    grossProfitBand, grossProfitBn, grossToExpenseRibbonOptions, grossToOperatingRibbonOptions,
    hasOperatingLoss, hasOrdinaryProfitSpine, height, layoutY,
    learnedEditorOffsetForNode, leftBoxes, leftDetailLabelBoxes, leftDetailRenderSlices,
    leftX, logoScale, logoX, logoY,
    lowerRightPressureY, maxPositiveLabelBlockWidth, mergeOutflowRibbonOptions, metricClusterObstacleRect,
    muted, negativeTerminalLabelX, netBottom, netBridgePath,
    netDisplayBand, netFrame, netLoss, netPositiveTop,
    netSummaryLines, netTop, netX, nodeWidth,
    opDeductionSourceBand, opNetBand, opX, operatingExpenseFrame,
    operatingFrame, operatingLaneTop, operatingMetricLayout, operatingMetricY,
    operatingMetricYShifted, operatingOutcomeLabel, operatingOutcomeLoss, operatingOutcomeNodeFill,
    operatingOutcomeTextColor, operatingOutcomeValueText, opexBottom, opexBoxes,
    opexInboundBand, opexLabelX, opexSlices, opexSourceSlices,
    opexTargetX, opexTop, periodEndFontSize, periodEndObstacle,
    periodEndX, periodEndY, positiveAbove, positiveAdjustmentExtremeStrength,
    positiveAdjustmentOpRatio, positiveAdjustmentScaleStrength, positiveAdjustments, positiveExtremeTopFloorY,
    positiveGap, positiveHeaderLabelClearanceBottom, positiveHeights, positiveLabelBlockHeight,
    positiveMergeHeights, positiveNodeGap, positiveSourceTopFloorY, positiveTargetBands,
    preDetailProfitContinuityStrength, rawBelowOperatingItems, rawCostBreakdown, rawOpexItems,
    redFlow, redNode, redText, renderCostBreakdownBlock,
    renderEditableNodeRect, renderLeftDetailLabel, renderLeftLabel, renderMetricCluster,
    renderOperatingProfitBreakdownCallout, renderOpexSummaryMarkup, renderRevenueLabelMarkup, renderRightBranchLabel,
    renderRightExpenseBlock, renderRightSummaryLabel, renderSharedTrunkCostBreakdownPair, renderTerminalCapRibbon,
    replicaFlowPath, replicaOutflowPath, resolveAdaptiveNegativeTerminalBranchOptions, resolveDeductionTerminalBranchOptions,
    resolveDeductionTerminalSourceSlice, revenueCostBand, revenueFrame, revenueGrossBand,
    revenueNodeFill, rightBranchLabelGapX, rightPrimaryLabelGapX, rightSummaryObstacleRect,
    rightTerminalNodeX, scale, scaleY, setAutoLayoutNodeOffset,
    shiftedMainNetRibbonEnvelopeAtX, showCostBridge, showOperatingOutcomeBridge, smallBridgeCalloutObstacles,
    smallBridgeCalloutRects, snapshot, sourceFlowPath, sourceNodeWidth,
    sourceSlices, standardTerminalBranchOptions, titleAnchor, titleColor,
    titleFontSize, titleObstacle, titleText, titleX,
    titleY, topCanvasPaddingY, totalPositiveHeight, totalPositiveMergeHeight,
    totalPositiveStackHeight, useExtremePositiveLayout, usesExtremePositiveTopLane, width

  } = model;
  const renderSmallBridgeCallout = ({ nodeId, frame, lines, color, candidateFactory, obstacles = [] }) => {
    const paddingX = scaleY(7);
    const paddingY = scaleY(5);
    const lineGap = scaleY(4);
    const contentWidth = Math.max(
      ...lines.map((line) => approximateTextWidth(line.text, line.size)),
      scaleY(24)
    );
    const contentHeight = lines.reduce(
      (sum, line, index) => sum + line.size + (index < lines.length - 1 ? lineGap : 0),
      0
    );
    const blockWidth = contentWidth + paddingX * 2;
    const blockHeight = contentHeight + paddingY * 2;
    const rectForCandidate = (candidate) => {
      const left =
        candidate.anchor === "end"
          ? candidate.x - blockWidth
          : candidate.anchor === "middle"
            ? candidate.x - blockWidth / 2
            : candidate.x;
      return {
        left,
        right: left + blockWidth,
        top: candidate.centerY - blockHeight / 2,
        bottom: candidate.centerY + blockHeight / 2,
      };
    };
    const collisionObstacles = [...smallBridgeCalloutObstacles, ...obstacles, ...smallBridgeCalloutRects].filter(Boolean);
    const candidates = candidateFactory({ width: blockWidth, height: blockHeight });
    let best = null;
    candidates.forEach((candidate, index) => {
      const rect = rectForCandidate(candidate);
      const collisionCount = collisionObstacles.reduce(
        (count, obstacle) => count + (rectsOverlap(rect, obstacle, scaleY(7)) ? 1 : 0),
        0
      );
      const boundaryPenalty =
        Math.max(scaleY(22) - rect.left, 0) +
        Math.max(rect.right - (width - scaleY(22)), 0) +
        Math.max(scaleY(18) - rect.top, 0) +
        Math.max(rect.bottom - (chartBottomLimit - scaleY(8)), 0);
      const score = collisionCount * 100000 + boundaryPenalty * 1000 + safeNumber(candidate.priority, index) * 100 + index;
      if (!best || score < best.score) best = { ...candidate, rect, score };
    });
    const placement = best || {
      anchor: "end",
      x: frame.left - scaleY(12),
      centerY: frame.centerY,
      side: "left",
      rect: {
        left: frame.left - scaleY(12) - blockWidth,
        right: frame.left - scaleY(12),
        top: frame.centerY - blockHeight / 2,
        bottom: frame.centerY + blockHeight / 2,
      },
    };
    smallBridgeCalloutRects.push(placement.rect);

    let startX = placement.rect.right;
    let startY = clamp(frame.centerY, placement.rect.top + scaleY(6), placement.rect.bottom - scaleY(6));
    let targetX = frame.left;
    let targetY = frame.centerY;
    if (placement.side === "right") {
      startX = placement.rect.left;
      targetX = frame.right;
    } else if (placement.side === "above") {
      startX = clamp(frame.centerX, placement.rect.left + scaleY(6), placement.rect.right - scaleY(6));
      startY = placement.rect.bottom;
      targetX = frame.centerX;
      targetY = frame.top;
    } else if (placement.side === "below") {
      startX = clamp(frame.centerX, placement.rect.left + scaleY(6), placement.rect.right - scaleY(6));
      startY = placement.rect.top;
      targetX = frame.centerX;
      targetY = frame.bottom;
    }
    const dx = targetX - startX;
    const dy = targetY - startY;
    const distance = Math.max(Math.hypot(dx, dy), 1);
    const ux = dx / distance;
    const uy = dy / distance;
    const arrowLength = scaleY(7);
    const arrowHalfWidth = scaleY(3.5);
    const arrowBaseX = targetX - ux * arrowLength;
    const arrowBaseY = targetY - uy * arrowLength;
    const perpendicularX = -uy * arrowHalfWidth;
    const perpendicularY = ux * arrowHalfWidth;
    const leaderPath = `M ${startX} ${startY} L ${targetX} ${targetY}`;
    let markup = `
      <path d="${leaderPath}" fill="none" stroke="${background}" stroke-width="6" stroke-linecap="round"></path>
      <path data-bridge-label-leader="${escapeHtml(nodeId)}" d="${leaderPath}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round"></path>
      <path d="M ${targetX} ${targetY} L ${arrowBaseX + perpendicularX} ${arrowBaseY + perpendicularY} L ${arrowBaseX - perpendicularX} ${arrowBaseY - perpendicularY} Z" fill="${color}" stroke="${background}" stroke-width="1.5" paint-order="stroke fill"></path>
    `;
    let cursorY = placement.rect.top + paddingY;
    lines.forEach((line) => {
      cursorY += line.size * 0.86;
      markup += `<text data-bridge-label-callout="${escapeHtml(nodeId)}" x="${placement.x}" y="${cursorY}" text-anchor="${placement.anchor}" font-size="${line.size}" font-weight="${line.weight || 700}" fill="${line.color || color}" paint-order="stroke fill" stroke="${background}" stroke-width="${line.strokeWidth || 6}" stroke-linejoin="round">${escapeHtml(line.text)}</text>`;
      cursorY += line.size * 0.14 + lineGap;
    });
    return { markup, placement };
  };
  const netLossDriverIndex =
    netLoss && belowOperatingItems.length
      ? belowOperatingItems.reduce(
          (bestIndex, item, index) =>
            safeNumber(item?.valueBn) > safeNumber(belowOperatingItems[bestIndex]?.valueBn) ? index : bestIndex,
          0
        )
      : -1;
  const useNetLossBalanceBridge = netLossDriverIndex >= 0 && belowOperatingItems.length > 0;
  const renderNetLossDriverBridge = () => {
    if (netLossDriverIndex < 0) return "";
    const driverItem = belowOperatingItems[netLossDriverIndex];
    const driverValueBn = useNetLossBalanceBridge
      ? belowOperatingItems.reduce((sum, item) => sum + Math.max(safeNumber(item?.valueBn), 0), 0)
      : Math.max(safeNumber(driverItem?.valueBn), 0);
    if (!(driverValueBn > 0.002)) return "";
    const primaryDriverValueBn = Math.max(safeNumber(driverItem?.valueBn), 0);
    const otherLossDriversBn = Math.max(driverValueBn - primaryDriverValueBn, 0);
    const driverHeight = driverValueBn * scale;
    const targetHeight = Math.min(driverHeight, netFrame.height);
    const driverWidth = Math.max(nodeWidth, scaleY(safeNumber(snapshot.layout?.netLossDriverWidth, 72)));
    const driverGapX = scaleY(safeNumber(snapshot.layout?.netLossDriverGapX, 78));
    const driverX = netFrame.x - driverGapX - driverWidth;
    const baseDetailLabelLiftY =
      useNetLossBalanceBridge && otherLossDriversBn > 0.05
        ? scaleY(safeNumber(snapshot.layout?.netLossDriverDetailLiftY, 50))
        : 0;
    const lowerOpexRibbonTopY =
      useNetLossBalanceBridge && otherLossDriversBn > 0.05
        ? opexSourceSlices.reduce((maxTop, slice) => Math.max(maxTop, safeNumber(slice?.top, -Infinity)), -Infinity)
        : -Infinity;
    const detailLabelOffsetY = scaleY(otherLossDriversBn > 0.05 ? 30 : 20);
    const maxDriverCenterForDetailClearance =
      Number.isFinite(lowerOpexRibbonTopY)
        ? lowerOpexRibbonTopY - scaleY(12) - detailLabelOffsetY - Math.max(driverHeight - targetHeight, 0) / 2
        : Infinity;
    const driverCenterY = Math.min(netFrame.centerY - baseDetailLabelLiftY, maxDriverCenterForDetailClearance);
    const driverTop = clamp(driverCenterY - driverHeight / 2, scaleY(184), Math.max(chartBottomLimit - driverHeight, scaleY(184)));
    const driverFrame = editableNodeFrame(`net-loss-driver-${netLossDriverIndex}`, driverX, driverTop, driverWidth, driverHeight);
    const targetTop = clamp(driverFrame.centerY - targetHeight / 2, netFrame.top, Math.max(netFrame.bottom - targetHeight, netFrame.top));
    const sourceTop = Math.max(driverFrame.bottom - targetHeight, driverFrame.top);
    const sourceBottom = sourceTop + targetHeight;
    const offsetHeight = Math.max(sourceTop - driverFrame.top, 0);
    const offsetValueBn = Math.max(driverValueBn - targetHeight / Math.max(scale, 0.0001), 0);
    const positiveOffsetBn = positiveAdjustments.reduce((sum, item) => sum + Math.max(safeNumber(item?.valueBn), 0), 0);
    const positiveOffsetHeight = Math.min(offsetHeight, positiveOffsetBn * scale);
    const operatingOffsetHeight = Math.max(offsetHeight - positiveOffsetHeight, 0);
    const positiveOffsetTop = driverFrame.top;
    const positiveOffsetBottom = positiveOffsetTop + positiveOffsetHeight;
    const operatingOffsetTop = positiveOffsetBottom;
    const operatingOffsetBottom = sourceTop;
    const smallBridgeCalloutEligible =
      useNetLossBalanceBridge &&
      positiveOffsetHeight > 0 &&
      (driverHeight <= scaleY(safeNumber(snapshot.layout?.smallBridgeCalloutMaxDriverHeightY, 34)) ||
        positiveOffsetHeight <= scaleY(safeNumber(snapshot.layout?.smallBridgeCalloutMaxPositiveHeightY, 12)));
    let useSeparatedSmallBridgeCallouts = false;
    const branchOptions = {
      ...mergeOutflowRibbonOptions(),
      curveFactor: 0.42,
      startCurveFactor: 0.2,
      endCurveFactor: 0.22,
      minStartCurveFactor: 0.14,
      maxStartCurveFactor: 0.26,
      minEndCurveFactor: 0.14,
      maxEndCurveFactor: 0.28,
      deltaScale: 0.6,
      deltaInfluence: 0.018,
      sourceHoldFactor: 0.08,
      targetHoldFactor: 0.08,
      minSourceHoldLength: 8,
      maxSourceHoldLength: 28,
      minTargetHoldLength: 8,
      maxTargetHoldLength: 28,
    };
    const driverLabel = localizeChartPhrase(driverItem?.nameZh || driverItem?.name || "Loss driver");
    const driverValue = formatBillionsByMode(primaryDriverValueBn, "negative-parentheses");
    const otherLossDriverLabel = currentChartLanguage() === "zh" ? "另含其他净费用" : "Includes other net expense";
    const offsetLabel = currentChartLanguage() === "zh" ? "营业利润及税项收益" : "Operating profit and tax benefit";
    const offsetActionLabel = currentChartLanguage() === "zh" ? "抵减" : "offset";
    const offsetValue = formatBillionsByMode(offsetValueBn, "positive-plus");
    const labelX = driverFrame.x - scaleY(14);
    const offsetLabelY = driverFrame.top + Math.max(offsetHeight * 0.5, scaleY(34));
    const residualLabelY = sourceTop + targetHeight / 2;
    let manualPositiveFrame = null;
    const manualPositiveMarkup = (() => {
      if (!useNetLossBalanceBridge || !(positiveOffsetHeight > 0)) return "";
      const item = positiveAdjustments[0] || {};
      const positiveWidth = Math.max(nodeWidth, scaleY(64));
      const positiveGapX = scaleY(34);
      const positiveFrameHeight = positiveOffsetHeight;
      const positiveFrame = editableNodeFrame(
        "positive-0",
        driverFrame.x - positiveGapX - positiveWidth,
        Math.max(driverFrame.top - positiveFrameHeight - scaleY(30), scaleY(152)),
        positiveWidth,
        positiveFrameHeight
      );
      manualPositiveFrame = positiveFrame;
      const positiveLabel = localizeChartItemName(item);
      const positiveValue = formatItemBillions(item, "positive-plus");
      const positiveLabelX = positiveFrame.x - scaleY(12);
      const positiveLabelY = positiveFrame.centerY;
      const naturalTextRect = (anchor, x, rows) => {
        const width = Math.max(...rows.map((row) => approximateTextWidth(row.text, row.size)), 1);
        const left = anchor === "end" ? x - width : anchor === "middle" ? x - width / 2 : x;
        return {
          left,
          right: left + width,
          top: Math.min(...rows.map((row) => row.y - row.size * 0.9)),
          bottom: Math.max(...rows.map((row) => row.y + row.size * 0.36)),
        };
      };
      if (smallBridgeCalloutEligible) {
        const naturalPositiveRect = naturalTextRect("end", positiveLabelX, [
          { text: positiveLabel, size: 20, y: positiveLabelY - scaleY(8) },
          { text: positiveValue, size: 18, y: positiveLabelY + scaleY(18) },
        ]);
        const naturalDriverRows = [
          {
            text: driverLabel,
            size: 22,
            y: residualLabelY - scaleY(otherLossDriversBn > 0.05 ? 24 : 12),
          },
          {
            text: driverValue,
            size: 20,
            y: residualLabelY + scaleY(otherLossDriversBn > 0.05 ? 4 : 20),
          },
          ...(otherLossDriversBn > 0.05
            ? [
                {
                  text: `${otherLossDriverLabel} ${formatBillionsByMode(otherLossDriversBn, "negative-parentheses")}`,
                  size: 15,
                  y: residualLabelY + scaleY(30),
                },
              ]
            : []),
        ];
        const naturalDriverRect = naturalTextRect("end", labelX, naturalDriverRows);
        const naturalObstacles = [
          ...smallBridgeCalloutObstacles,
          operatingFrame,
          netFrame,
        ].filter(Boolean);
        const labelPadding = scaleY(safeNumber(snapshot.layout?.smallBridgeNaturalLabelPaddingY, 7));
        useSeparatedSmallBridgeCallouts =
          rectsOverlap(naturalPositiveRect, naturalDriverRect, labelPadding) ||
          naturalObstacles.some(
            (obstacle) =>
              rectsOverlap(naturalPositiveRect, obstacle, labelPadding) ||
              rectsOverlap(naturalDriverRect, obstacle, labelPadding)
          );
      }
      const positiveCallout = useSeparatedSmallBridgeCallouts
        ? renderSmallBridgeCallout({
            nodeId: "positive-0",
            frame: positiveFrame,
            color: greenText,
            lines: [
              { text: positiveLabel, size: 20, weight: 700, strokeWidth: 7 },
              { text: positiveValue, size: 18, weight: 700, strokeWidth: 6 },
            ],
            obstacles: [driverFrame, operatingFrame, netFrame],
            candidateFactory: ({ height }) => [
              {
                anchor: "start",
                x: positiveFrame.right + scaleY(18),
                centerY: Math.max(
                  positiveHeaderLabelClearanceBottom + height / 2,
                  positiveFrame.top - height / 2 - scaleY(34)
                ),
                side: "above",
                priority: 0,
              },
              {
                anchor: "middle",
                x: positiveFrame.centerX,
                centerY: Math.max(
                  positiveHeaderLabelClearanceBottom + height / 2,
                  positiveFrame.top - height / 2 - scaleY(30)
                ),
                side: "above",
                priority: 1,
              },
              {
                anchor: "start",
                x: positiveFrame.right + scaleY(18),
                centerY: positiveFrame.centerY,
                side: "right",
                priority: 2,
              },
              {
                anchor: "end",
                x: positiveFrame.left - scaleY(18),
                centerY: positiveFrame.centerY,
                side: "left",
                priority: 3,
              },
            ],
          })
        : null;
      return `
      <path d="${flowPath(positiveFrame.right, positiveFrame.top, positiveFrame.bottom, driverFrame.x, positiveOffsetTop, positiveOffsetBottom, branchOptions)}" fill="${greenFlow}" opacity="0.97"></path>
      ${renderEditableNodeRect(positiveFrame, greenNode)}
      ${
        positiveCallout
          ? positiveCallout.markup
          : `<text x="${positiveLabelX}" y="${positiveLabelY - scaleY(8)}" text-anchor="end" font-size="20" font-weight="700" fill="${greenText}" paint-order="stroke fill" stroke="${background}" stroke-width="7" stroke-linejoin="round">${escapeHtml(positiveLabel)}</text>
      <text x="${positiveLabelX}" y="${positiveLabelY + scaleY(18)}" text-anchor="end" font-size="18" font-weight="700" fill="${greenText}" paint-order="stroke fill" stroke="${background}" stroke-width="6" stroke-linejoin="round">${escapeHtml(positiveValue)}</text>`
      }
      `;
    })();
    const operatingOffsetMarkup =
      useNetLossBalanceBridge && operatingOffsetHeight > 0
        ? (() => {
            const operatingSourceHeight = Math.min(operatingOffsetHeight, operatingFrame.height);
            const operatingSourceTop = clamp(
              operatingFrame.centerY - operatingSourceHeight / 2,
              operatingFrame.top,
              Math.max(operatingFrame.bottom - operatingSourceHeight, operatingFrame.top)
            );
            return `<path d="${flowPath(
              operatingFrame.right,
              operatingSourceTop,
              operatingSourceTop + operatingSourceHeight,
              driverFrame.x,
              operatingOffsetTop,
              operatingOffsetBottom,
              branchOptions
            )}" fill="${greenFlow}" opacity="0.95"></path>`;
          })()
        : "";
    const driverCallout = useSeparatedSmallBridgeCallouts
      ? renderSmallBridgeCallout({
          nodeId: `net-loss-driver-${netLossDriverIndex}`,
          frame: driverFrame,
          color: redText,
          lines: [
            { text: driverLabel, size: 22, weight: 700, strokeWidth: 7 },
            { text: driverValue, size: 20, weight: 700, strokeWidth: 6 },
            ...(otherLossDriversBn > 0.05
              ? [
                  {
                    text: `${otherLossDriverLabel} ${formatBillionsByMode(otherLossDriversBn, "negative-parentheses")}`,
                    size: 15,
                    weight: 700,
                    strokeWidth: 5,
                  },
                ]
              : []),
          ],
          obstacles: [operatingFrame, netFrame, manualPositiveFrame].filter(Boolean),
          candidateFactory: ({ height }) => [
            {
              anchor: "middle",
              x: driverFrame.centerX,
              centerY: driverFrame.bottom + height / 2 + scaleY(32),
              side: "below",
              priority: 0,
            },
            {
              anchor: "start",
              x: driverFrame.left,
              centerY: driverFrame.bottom + height / 2 + scaleY(32),
              side: "below",
              priority: 1,
            },
            {
              anchor: "middle",
              x: driverFrame.centerX,
              centerY: driverFrame.top - height / 2 - scaleY(30),
              side: "above",
              priority: 2,
            },
            {
              anchor: "end",
              x: driverFrame.left - scaleY(18),
              centerY: driverFrame.centerY,
              side: "left",
              priority: 3,
            },
          ],
        })
      : null;
    return `
      ${operatingOffsetMarkup}
      ${manualPositiveMarkup}
      <path d="${flowPath(driverFrame.right, sourceTop, sourceBottom, netFrame.x, targetTop, targetTop + targetHeight, branchOptions)}" fill="${redFlow}" opacity="0.97"></path>
      ${renderEditableNodeRect(driverFrame, redNode)}
      ${
        offsetHeight > scaleY(28)
          ? `
      <line x1="${driverFrame.x}" y1="${sourceTop}" x2="${driverFrame.right}" y2="${sourceTop}" stroke="${background}" stroke-width="${scaleY(5)}" stroke-linecap="round" opacity="0.95"></line>
      <text x="${labelX}" y="${offsetLabelY - scaleY(16)}" text-anchor="end" font-size="17" font-weight="700" fill="${greenText}" paint-order="stroke fill" stroke="${background}" stroke-width="6" stroke-linejoin="round">${escapeHtml(offsetLabel)}</text>
      <text x="${labelX}" y="${offsetLabelY + scaleY(7)}" text-anchor="end" font-size="17" font-weight="700" fill="${greenText}" paint-order="stroke fill" stroke="${background}" stroke-width="5" stroke-linejoin="round">${escapeHtml(offsetActionLabel)} ${escapeHtml(offsetValue)}</text>
      `
          : ""
      }
      ${
        driverCallout
          ? driverCallout.markup
          : `<text x="${labelX}" y="${residualLabelY - scaleY(otherLossDriversBn > 0.05 ? 24 : 12)}" text-anchor="end" font-size="22" font-weight="700" fill="${redText}" paint-order="stroke fill" stroke="${background}" stroke-width="7" stroke-linejoin="round">${escapeHtml(driverLabel)}</text>
      <text x="${labelX}" y="${residualLabelY + scaleY(otherLossDriversBn > 0.05 ? 4 : 20)}" text-anchor="end" font-size="20" font-weight="700" fill="${redText}" paint-order="stroke fill" stroke="${background}" stroke-width="6" stroke-linejoin="round">${escapeHtml(driverValue)}</text>
      ${
        otherLossDriversBn > 0.05
          ? `<text x="${labelX}" y="${residualLabelY + scaleY(30)}" text-anchor="end" font-size="15" font-weight="700" fill="${redText}" paint-order="stroke fill" stroke="${background}" stroke-width="5" stroke-linejoin="round">${escapeHtml(otherLossDriverLabel)} ${escapeHtml(formatBillionsByMode(otherLossDriversBn, "negative-parentheses"))}</text>`
          : ""
      }`
      }
    `;
  };
  let svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(titleText)}" font-family="Aptos, Segoe UI, Arial, Helvetica, sans-serif" data-editor-bounds-left="0" data-editor-bounds-top="0" data-editor-bounds-right="${width}" data-editor-bounds-bottom="${height}">
      <rect x="0" y="0" width="${width}" height="${height}" fill="${background}"></rect>
      <g id="chartContent"${topCanvasPaddingY > 0 ? ` transform="translate(0 ${topCanvasPaddingY})"` : ""}>
      <text x="${titleX}" y="${titleY}" text-anchor="${titleAnchor}" font-size="${titleFontSize}" font-weight="800" fill="${titleColor}" letter-spacing="0.3">${escapeHtml(titleText)}</text>
      ${snapshot.periodEndLabel ? `<text x="${periodEndX}" y="${periodEndY}" text-anchor="start" font-size="${periodEndFontSize}" fill="${muted}">${escapeHtml(localizePeriodEndLabel(snapshot.periodEndLabel || ""))}</text>` : ""}
    `;

  leftDetailRenderSlices.forEach((slice, index) => {
    svg += renderLeftDetailLabel(slice, {
      ...leftDetailLabelBoxes[index],
      previousRibbonBottom: index > 0 ? leftDetailRenderSlices[index - 1]?.bottom : null,
    }, index);
  });

  sourceSlices.forEach((slice, index) => {
    const sourceFrame = editableNodeFrame(`source-${index}`, safeNumber(slice.nodeX, leftX), slice.top, sourceNodeWidth, slice.height);
    const revenueBandTop = slice.revenueTop + editorOffsetForNode("revenue").dy;
    const revenueBandBottom = slice.revenueBottom + editorOffsetForNode("revenue").dy;
    svg += `<path d="${sourceFlowPath(sourceFrame.right, sourceFrame.top, sourceFrame.bottom, revenueFrame.left, revenueBandTop, revenueBandBottom)}" fill="${slice.item.flowColor}" opacity="0.98"></path>`;
    svg += renderEditableNodeRect(sourceFrame, slice.item.nodeColor);
    svg += renderLeftLabel(slice, leftBoxes[index], index);
  });

  svg += `
      ${renderEditableNodeRect(revenueFrame, revenueNodeFill)}

      <path d="${replicaFlowPath(revenueFrame.right, revenueGrossBand.top, revenueGrossBand.bottom, grossFrame.left, grossFrame.top, grossFrame.bottom)}" fill="${greenFlow}" opacity="0.97"></path>
      ${
        showCostBridge && revenueCostBand
          ? `<path d="${replicaFlowPath(revenueFrame.right, revenueCostBand.top, revenueCostBand.bottom, costFrame.left, costFrame.top, costFrame.bottom)}" fill="${redFlow}" opacity="0.97"></path>`
          : ""
      }

      ${renderEditableNodeRect(grossFrame, greenNode)}
      ${renderMetricCluster(
        grossFrame.centerX,
        grossMetricYShifted,
        localizeChartPhrase(snapshot.grossProfitLabel || "Gross profit"),
        formatBillions(grossProfitBn),
        snapshot.grossMarginPct !== null && snapshot.grossMarginPct !== undefined ? `${formatPct(snapshot.grossMarginPct)} ${marginLabel()}` : "",
        snapshot.grossMarginYoyDeltaPp !== null && snapshot.grossMarginYoyDeltaPp !== undefined ? formatPp(snapshot.grossMarginYoyDeltaPp) : "",
        greenText,
        grossMetricLayout
      )}

      ${
        showCostBridge
          ? `
      ${renderEditableNodeRect(costFrame, redNode)}
      ${svgTextBlock(costFrame.centerX, costSummaryBaselineY, costLabelLines, {
        fill: redText,
        fontSize: expenseSummaryLayout.titleSize,
        weight: 700,
        anchor: "middle",
        lineHeight: expenseSummaryLayout.titleSize + 1,
        haloColor: background,
        haloWidth: expenseSummaryLayout.titleStroke,
      })}
      <text x="${costFrame.centerX}" y="${costSummaryBaselineY + (costLabelLines.length - 1) * (expenseSummaryLayout.titleSize + 1) + expenseSummaryLayout.valueOffset}" text-anchor="middle" font-size="${expenseSummaryLayout.valueSize}" font-weight="700" fill="${redText}" paint-order="stroke fill" stroke="${background}" stroke-width="${expenseSummaryLayout.valueStroke}" stroke-linejoin="round">${escapeHtml(formatBillionsByMode(costOfRevenueBn, "negative-parentheses"))}</text>
      `
          : ""
      }

      ${
        showOperatingOutcomeBridge
          ? `<path d="${replicaOutflowPath(grossFrame.right, grossProfitBand.top, grossProfitBand.bottom, operatingFrame.left, operatingFrame.top, operatingFrame.bottom, grossToOperatingRibbonOptions)}" fill="${operatingOutcomeLoss ? redFlow : greenFlow}" opacity="0.97"></path>`
          : ""
      }
      <path d="${replicaOutflowPath(grossFrame.right, grossExpenseBand.top, grossExpenseBand.bottom, operatingExpenseFrame.left, opexInboundBand.top, opexInboundBand.bottom, grossToExpenseRibbonOptions)}" fill="${redFlow}" opacity="0.97"></path>

      ${renderEditableNodeRect(operatingFrame, hasOperatingLoss ? "transparent" : operatingOutcomeNodeFill)}
      ${
        hasOperatingLoss
          ? ""
          : renderMetricCluster(
              operatingFrame.centerX,
              operatingMetricYShifted,
              localizeChartPhrase(operatingOutcomeLabel),
              operatingOutcomeValueText,
              snapshot.operatingMarginPct !== null && snapshot.operatingMarginPct !== undefined ? `${formatPct(snapshot.operatingMarginPct)} ${marginLabel()}` : "",
              snapshot.operatingMarginYoyDeltaPp !== null && snapshot.operatingMarginYoyDeltaPp !== undefined ? formatPp(snapshot.operatingMarginYoyDeltaPp) : "",
              operatingOutcomeTextColor,
              operatingMetricLayout
            )
      }

      ${renderEditableNodeRect(operatingExpenseFrame, redNode)}

  `;

  let positiveMarkup = "";
  if (positiveAdjustments.length) {
    const positiveUpperLane = positiveAbove || usesExtremePositiveTopLane;
    const positiveRunwayAvailable = Math.max(netX - (opX + nodeWidth), 1);
    const positiveReferenceHeight = positiveHeights.length ? Math.max(...positiveHeights) : scaleY(10);
    const positiveNodeWidth = clamp(
      safeNumber(
        snapshot.layout?.positiveNodeWidth,
        Math.max(
          positiveReferenceHeight * safeNumber(snapshot.layout?.positiveSourceCapWidthFactor, 3.4),
          positiveRunwayAvailable * safeNumber(snapshot.layout?.positiveSourceCapWidthRunwayFactor, 0.065) +
            safeNumber(snapshot.layout?.positiveSourceCapBaseWidth, 52)
        )
      ),
      safeNumber(snapshot.layout?.positiveNodeMinWidth, 56),
      Math.max(
        safeNumber(snapshot.layout?.positiveNodeMaxWidth, clamp(positiveRunwayAvailable * 0.22, 84, 112)),
        safeNumber(snapshot.layout?.positiveNodeMinWidth, 56)
      )
    );
    const positiveTargetInsetX = safeNumber(snapshot.layout?.positiveTargetInsetX, 0);
    const positiveMergeOverlapY = scaleY(safeNumber(snapshot.layout?.positiveMergeOverlapY, 0));
    const positiveNodeMinX = opX + nodeWidth + clamp(
      safeNumber(snapshot.layout?.positiveNodeMinOffsetFromOpX, positiveRunwayAvailable * (positiveAbove ? 0.08 : 0.1)),
      24,
      56
    );
    const positiveNodeMaxX = netX - positiveNodeWidth - Math.max(
      clamp(
        safeNumber(snapshot.layout?.positiveNodeMinOffsetFromNetX, positiveRunwayAvailable * (positiveAbove ? 0.055 : 0.07)),
        18, 56
      ),
      hasOrdinaryProfitSpine && positiveUpperLane
        ? Math.min(positiveRunwayAvailable * 0.28, Math.max(positiveRunwayAvailable - positiveNodeWidth - 32, 0))
        : 0
    );
      const positiveNetAffinityStrength = clamp(
        safeNumber(
          snapshot.layout?.positiveNetAffinityStrength,
          positiveUpperLane
          ? (positiveAdjustments.length === 1 ? 0.2 : 0) +
            positiveAdjustmentScaleStrength * 0.28 +
            positiveAdjustmentOpRatio * 0.38 +
            positiveAdjustmentExtremeStrength * 0.12 +
            clamp(lowerRightPressureY / scaleY(92), 0, 1) * 0.18 +
            Math.max(rawCostBreakdown.length + rawOpexItems.length + rawBelowOperatingItems.length - 4, 0) * 0.04
          : 0
        ),
        0,
        0.68
      );
    const positiveBranchRunwayX = clamp(
      safeNumber(
        snapshot.layout?.positiveBranchRunwayX,
          Math.max(
          positiveReferenceHeight *
            safeNumber(
              snapshot.layout?.positiveBranchRunwayHeightFactor,
              positiveAbove
                ? Math.max(0.58, 0.98 - positiveAdjustmentScaleStrength * 0.24 - positiveAdjustmentExtremeStrength * 0.18)
                : 0.94
            ),
          positiveRunwayAvailable * safeNumber(snapshot.layout?.positiveBranchRunwayFactor, positiveAbove ? 0.074 : 0.068),
          positiveAbove ? 42 : 38
        )
      ),
      positiveAbove ? 30 : 28,
      Math.max(positiveRunwayAvailable - positiveNodeWidth - 20, positiveAbove ? 30 : 28)
    );
    const defaultPositiveNodeX = clamp(
      netX - positiveNodeWidth - positiveBranchRunwayX,
      positiveNodeMinX,
      Math.max(positiveNodeMaxX, positiveNodeMinX)
    );
    const positiveCorridorSampleXsForNode = (candidateNodeX) => {
      const runwayDx = Math.max(netX - (candidateNodeX + positiveNodeWidth), 1);
      return [0.14, 0.32, 0.52, 0.74].map((t) =>
        clamp(
          candidateNodeX + positiveNodeWidth + runwayDx * t,
          candidateNodeX + positiveNodeWidth + 1,
          Math.max(netX - 2, candidateNodeX + positiveNodeWidth + 1)
        )
      );
    };
    let positiveNodeX = defaultPositiveNodeX;
    const positiveSourceDropY = 0;
    const extremePositiveTopLaneMinGapX =
      usesExtremePositiveTopLane
        ? scaleY(safeNumber(snapshot.layout?.extremePositiveTopLaneMinGapX, 180))
        : 0;
    const extremePositiveTopLaneMaxBottom =
      usesExtremePositiveTopLane
        ? operatingLaneTop - extremePositiveTopLaneBottomGapY
        : Infinity;
    const extremePositiveTopLaneMinTop =
      usesExtremePositiveTopLane
        ? Math.max(
            positiveHeaderLabelClearanceBottom - scaleY(safeNumber(snapshot.layout?.extremePositiveTopLaneHeaderOverlapAllowanceY, 24)),
            scaleY(safeNumber(snapshot.layout?.extremePositiveTopLaneMinTopY, 88))
          )
        : -Infinity;
    let positiveTop = positiveAbove
      ? clamp(
          netTop - totalPositiveStackHeight - positiveNodeGap,
          Math.max(
            scaleY(212 - positiveAdjustmentExtremeStrength * safeNumber(snapshot.layout?.positiveExtremeTopReleaseY, 88)) +
              positiveLabelBlockHeight * (1 - positiveAdjustmentExtremeStrength * 0.46),
            extremePositiveTopLaneMinTop
          ),
          netTop - scaleY(10) - totalPositiveStackHeight
        )
      : clamp(
          usesExtremePositiveTopLane
            ? Math.min(netTop + scaleY(safeNumber(snapshot.layout?.extremePositiveTopLaneNetOffsetY, 4)), extremePositiveTopLaneMaxBottom - totalPositiveStackHeight)
            : netBottom + positiveNodeGap,
          usesExtremePositiveTopLane ? extremePositiveTopLaneMinTop : scaleY(308),
          usesExtremePositiveTopLane
            ? Math.max(extremePositiveTopLaneMinTop, extremePositiveTopLaneMaxBottom - totalPositiveStackHeight)
            : chartBottomLimit - totalPositiveStackHeight - positiveLabelBlockHeight - scaleY(12)
        );
    let upperMetricFloor = Math.max(grossMetricY + grossMetricLayout.blockHeight, operatingMetricY + operatingMetricLayout.blockHeight);
    let positiveBranchClearanceY = Math.max(scaleY(16), positiveReferenceHeight * 0.72);
    let positiveCapClearanceY = Math.max(scaleY(12), positiveReferenceHeight * 0.52);
    const positiveProminenceRatio =
      totalPositiveMergeHeight > 0 && coreNetTargetHeight > 0 ? totalPositiveMergeHeight / Math.max(coreNetTargetHeight, 1) : 0;
    const positiveProminentAbove =
      positiveAbove &&
      positiveProminenceRatio >= safeNumber(snapshot.layout?.positiveProminentThresholdRatio, 0.6);
    const positiveMergeShareOfNet =
      totalPositiveMergeHeight / Math.max(coreNetTargetHeight + totalPositiveMergeHeight, 1);
    const positiveSmallAdjustmentStrength =
      positiveUpperLane &&
      !useExtremePositiveLayout &&
      !usesExtremePositiveTopLane &&
      positiveAdjustments.length === 1
        ? clamp(
            (safeNumber(snapshot.layout?.positiveSmallAdjustmentThresholdRatio, 0.16) -
              positiveMergeShareOfNet) /
              Math.max(safeNumber(snapshot.layout?.positiveSmallAdjustmentActivationSpan, 0.12), 0.01),
            0,
            1
          )
        : 0;
    const positiveSmallAdjustmentLabelLiftY =
      positiveSmallAdjustmentStrength > 0
        ? Math.max(
            scaleY(safeNumber(snapshot.layout?.positiveSmallAdjustmentMinLiftY, 42)),
            positiveLabelBlockHeight *
              safeNumber(snapshot.layout?.positiveSmallAdjustmentLabelLiftFactor, 0.62)
          ) * positiveSmallAdjustmentStrength
        : 0;
    const positiveMaterialAbove =
      positiveAbove &&
      totalPositiveStackHeight >= scaleY(safeNumber(snapshot.layout?.positiveMaterialMinimumHeightY, 36)) &&
      positiveMergeShareOfNet >= safeNumber(snapshot.layout?.positiveMaterialMinimumNetShare, 0.2);
    const positiveNeedsVisibleMergeAngle =
      positiveUpperLane &&
      !positiveMaterialAbove &&
      !useExtremePositiveLayout &&
      !hasOperatingLoss &&
      positiveAdjustments.length === 1 &&
      totalPositiveStackHeight >= scaleY(safeNumber(snapshot.layout?.positiveAngledMinimumHeightY, 6)) &&
      positiveMergeShareOfNet >= safeNumber(snapshot.layout?.positiveAngledMinimumNetShare, 0.2);
    const positiveNeedsGentleMergeAngle =
      positiveUpperLane &&
      !positiveMaterialAbove &&
      !positiveNeedsVisibleMergeAngle &&
      !useExtremePositiveLayout &&
      !hasOperatingLoss &&
      positiveAdjustments.length === 1 &&
      totalPositiveStackHeight >= scaleY(safeNumber(snapshot.layout?.positiveGentleAngledMinimumHeightY, 4));
    const positiveRequiresVisibleMergeLead =
      positiveMaterialAbove || positiveNeedsVisibleMergeAngle || positiveNeedsGentleMergeAngle;
    const positiveAngledSourceTopFloorY = scaleY(
      safeNumber(snapshot.layout?.positiveAngledSourceTopFloorY, 32)
    );
    const positiveBranchPathOptions = {
      curveFactor: positiveAbove ? 0.68 : 0.7,
      startCurveFactor: positiveAbove ? 0.28 : 0.26,
      endCurveFactor: positiveAbove ? 0.42 : 0.46,
      minStartCurveFactor: 0.22,
      maxStartCurveFactor: 0.36,
      minEndCurveFactor: 0.34,
      maxEndCurveFactor: 0.54,
      deltaScale: 0.78,
      deltaInfluence: 0.036,
      thicknessInfluence: 0.038,
      sourceHoldFactor: 0,
      minSourceHoldLength: 0,
      maxSourceHoldLength: 1,
      targetHoldFactor: 0,
      minTargetHoldLength: 0,
      maxTargetHoldLength: 2,
      sourceHoldDeltaReduction: 0.08,
      targetHoldDeltaReduction: 0.14,
      minAdaptiveSourceHoldLength: 0,
      minAdaptiveTargetHoldLength: 0,
    };
    const grossMetricObstacle = metricClusterObstacleRect(
      grossFrame.centerX,
      grossMetricYShifted,
      snapshot.grossProfitLabel || "Gross profit",
      formatBillions(grossProfitBn),
      snapshot.grossMarginPct !== null && snapshot.grossMarginPct !== undefined ? `${formatPct(snapshot.grossMarginPct)} ${marginLabel()}` : "",
      snapshot.grossMarginYoyDeltaPp !== null && snapshot.grossMarginYoyDeltaPp !== undefined ? formatPp(snapshot.grossMarginYoyDeltaPp) : "",
      grossMetricLayout,
      scaleY(10)
    );
    const operatingMetricObstacle = metricClusterObstacleRect(
      operatingFrame.centerX,
      operatingMetricYShifted,
      operatingOutcomeLabel,
      operatingOutcomeValueText,
      snapshot.operatingMarginPct !== null && snapshot.operatingMarginPct !== undefined ? `${formatPct(snapshot.operatingMarginPct)} ${marginLabel()}` : "",
      snapshot.operatingMarginYoyDeltaPp !== null && snapshot.operatingMarginYoyDeltaPp !== undefined ? formatPp(snapshot.operatingMarginYoyDeltaPp) : "",
      operatingMetricLayout,
      scaleY(10)
    );
    const netSummaryObstacle = rightSummaryObstacleRect(
      netSummaryLines,
      netFrame.x + nodeWidth + rightPrimaryLabelGapX,
      netFrame.centerY,
      scaleY(10)
    );
    const positiveUpperObstacleBottomAtX = (sampleX) => {
      let bottom = 0;
      [titleObstacle, periodEndObstacle, grossMetricObstacle, operatingMetricObstacle].forEach((obstacle) => {
        if (!obstacle) return;
        if (sampleX >= obstacle.left && sampleX <= obstacle.right) {
          bottom = Math.max(bottom, obstacle.bottom);
        }
      });
      return bottom;
    };
    const positiveUpperObstacleBottomForXs = (sampleXs) =>
      sampleXs.reduce((maxBottom, sampleX) => Math.max(maxBottom, positiveUpperObstacleBottomAtX(sampleX)), 0);
    const rightSideObstacles = [
      { left: netFrame.left - 10, right: netFrame.right + 10, top: netFrame.top - 10, bottom: netFrame.bottom + 10 },
      netSummaryObstacle,
      titleObstacle,
      periodEndObstacle,
      grossMetricObstacle,
      operatingMetricObstacle,
      ...deductionBoxes.map((box) => ({ left: belowLabelX - 12, right: width - 56, top: box.top - 6, bottom: box.bottom + 6 })),
      ...opexBoxes.map((box) => ({ left: opexLabelX - 12, right: width - 56, top: box.top - 6, bottom: box.bottom + 6 })),
    ].filter(Boolean);
    const deductionFlowObstacles = deductionSlices
      .map((slice, index) => {
        const box = deductionBoxes[index];
        if (!box) return null;
        const sourceSlice = deductionSourceSlices[index] || slice;
        const adjustedSourceSlice = resolveDeductionTerminalSourceSlice(index, sourceSlice);
        const bridge = constantThicknessBridge(
          adjustedSourceSlice,
          box.center,
          0,
          opDeductionSourceBand.top,
          opDeductionSourceBand.bottom
        );
        const branchOptions = resolveAdaptiveNegativeTerminalBranchOptions(
          resolveDeductionTerminalBranchOptions(index),
          bridge.sourceTop + editorOffsetForNode("operating").dy,
          bridge.sourceBottom + editorOffsetForNode("operating").dy,
          bridge.targetTop + editorOffsetForNode(`deduction-${index}`).dy,
          bridge.targetHeight,
          {
            index,
            count: Math.max(deductionSlices.length + opexSlices.length, 1),
            laneBias: index === 0 ? 0.1 : 0.06,
          }
        );
        const targetFrame = editableNodeFrame(`deduction-${index}`, rightTerminalNodeX, bridge.targetTop, nodeWidth, bridge.targetHeight);
        return bridgeObstacleRect(
          operatingFrame.right,
          bridge.sourceTop + editorOffsetForNode("operating").dy,
          bridge.sourceBottom + editorOffsetForNode("operating").dy,
          targetFrame.x,
          targetFrame.y,
          targetFrame.height,
          {
            targetWidth: nodeWidth,
            padX: scaleY(18),
            padY: scaleY(12),
            branchOptions,
          }
        );
      })
      .filter(Boolean);
    const opexFlowObstacles = opexSlices
      .map((slice, index) => {
        const box = opexBoxes[index];
        const sourceSlice = opexSourceSlices[index] || slice;
        if (!box || !sourceSlice) return null;
        const bridge = constantThicknessBridge(sourceSlice, box.center, 12, opDeductionSourceBand.top, opDeductionSourceBand.bottom);
        const branchOptions = resolveAdaptiveNegativeTerminalBranchOptions(
          standardTerminalBranchOptions,
          bridge.sourceTop + editorOffsetForNode("operating-expenses").dy,
          bridge.sourceBottom + editorOffsetForNode("operating-expenses").dy,
          bridge.targetTop + editorOffsetForNode(`opex-${index}`).dy,
          bridge.targetHeight,
          {
            index,
            count: Math.max(opexSlices.length, 1),
            laneBias: 0.04,
          }
        );
        const targetFrame = editableNodeFrame(`opex-${index}`, rightTerminalNodeX, bridge.targetTop, nodeWidth, bridge.targetHeight);
        return bridgeObstacleRect(
          operatingExpenseFrame.right,
          bridge.sourceTop + editorOffsetForNode("operating-expenses").dy,
          bridge.sourceBottom + editorOffsetForNode("operating-expenses").dy,
          targetFrame.x,
          targetFrame.y,
          targetFrame.height,
          {
            targetWidth: nodeWidth,
            padX: scaleY(18),
            padY: scaleY(12),
            branchOptions,
          }
        );
      })
      .filter(Boolean);
    const positiveLabelObstacles = [...rightSideObstacles, ...deductionFlowObstacles, ...opexFlowObstacles];
    const branchSourceInsetX = Math.max(safeNumber(snapshot.layout?.branchSourceCoverInsetX, 1.5), 0);
    const branchTargetInsetX = safeNumber(snapshot.layout?.branchTargetCoverInsetX, 14);
    const deductionBranchModels = deductionSlices
      .map((slice, index) => {
        const box = deductionBoxes[index];
        if (!box) return null;
        const sourceSlice = deductionSourceSlices[index] || slice;
        const deductionSourceSlice = resolveDeductionTerminalSourceSlice(index, sourceSlice);
        const bridge = constantThicknessBridge(
          deductionSourceSlice,
          box.center,
          0,
          opDeductionSourceBand.top,
          opDeductionSourceBand.bottom
        );
        const sourceShift = editorOffsetForNode("operating");
        const targetFrame = editableNodeFrame(`deduction-${index}`, rightTerminalNodeX, bridge.targetTop, nodeWidth, bridge.targetHeight);
        const options = resolveAdaptiveNegativeTerminalBranchOptions(
          resolveDeductionTerminalBranchOptions(index),
          bridge.sourceTop + sourceShift.dy,
          bridge.sourceBottom + sourceShift.dy,
          targetFrame.y,
          targetFrame.height,
          {
            index,
            count: Math.max(deductionSlices.length + opexSlices.length, 1),
            laneBias: index === 0 ? 0.1 : 0.06,
          }
        );
        return {
          x0: operatingFrame.right - branchSourceInsetX,
          x1: targetFrame.x + safeNumber(options.targetCoverInsetX, branchTargetInsetX),
          sourceTop: bridge.sourceTop + sourceShift.dy,
          sourceBottom: bridge.sourceBottom + sourceShift.dy,
          targetTop: targetFrame.y,
          targetHeight: targetFrame.height,
          options,
        };
      })
      .filter(Boolean);
    const opexBranchModels = opexSlices
      .map((slice, index) => {
        const box = opexBoxes[index];
        const sourceSlice = opexSourceSlices[index] || slice;
        if (!box || !sourceSlice) return null;
        const bridge = constantThicknessBridge(sourceSlice, box.center, 14, opexTop, opexBottom);
        const targetFrame = editableNodeFrame(`opex-${index}`, rightTerminalNodeX, bridge.targetTop, nodeWidth, bridge.targetHeight);
        const options = resolveAdaptiveNegativeTerminalBranchOptions(
          standardTerminalBranchOptions,
          bridge.sourceTop + editorOffsetForNode("operating-expenses").dy,
          bridge.sourceBottom + editorOffsetForNode("operating-expenses").dy,
          targetFrame.y,
          targetFrame.height,
          {
            index,
            count: Math.max(opexSlices.length, 1),
            laneBias: 0.04,
          }
        );
        return {
          x0: operatingExpenseFrame.right - branchSourceInsetX,
          x1: targetFrame.x + safeNumber(options.targetCoverInsetX, branchTargetInsetX),
          sourceTop: bridge.sourceTop + editorOffsetForNode("operating-expenses").dy,
          sourceBottom: bridge.sourceBottom + editorOffsetForNode("operating-expenses").dy,
          targetTop: targetFrame.y,
          targetHeight: targetFrame.height,
          options,
        };
      })
      .filter(Boolean);
    const positiveRibbonTopAtX = (sampleX) => {
      let top = Infinity;
      [...deductionBranchModels, ...opexBranchModels].forEach((model) => {
        const envelope = flowEnvelopeAtX(
          sampleX,
          model.x0,
          model.sourceTop,
          model.sourceBottom,
          model.x1,
          model.targetTop,
          model.targetTop + model.targetHeight,
          model.options
        );
        if (envelope) {
          top = Math.min(top, envelope.top);
        }
      });
      return top;
    };
    const netMainRibbonBottomAtX = (sampleX) => {
      const envelope = shiftedMainNetRibbonEnvelopeAtX(sampleX);
      return envelope ? envelope.bottom : -Infinity;
    };
    const netMainRibbonTopAtX = (sampleX) => {
      const envelope = shiftedMainNetRibbonEnvelopeAtX(sampleX);
      return envelope ? envelope.top : Infinity;
    };
    const positiveTerminalObstacleReachX = Math.max(
      safeNumber(
        snapshot.layout?.positiveTerminalObstacleReachX,
        Math.max(
          positiveBranchRunwayX * safeNumber(snapshot.layout?.positiveTerminalObstacleReachFactor, 0.9),
          positiveAbove ? 68 : 56
        )
      ),
      24
    );
    let positiveTerminalNodeObstacles = [];
    let corridorSampleXs = [];
    let positiveTopMin = positiveTop;
    let positiveTopMax = positiveTop;
    let extremePositiveTopLaneMinX = positiveNodeMinX;
    if (positiveAdjustments.length) {
      const netShift = editorOffsetForNode("net");
      const positiveTargetStackCenter =
        positiveTargetBands.length
          ? (safeNumber(positiveTargetBands[0]?.top, netTop) + safeNumber(positiveTargetBands[positiveTargetBands.length - 1]?.bottom, netBottom)) / 2 + netShift.dy
          : (safeNumber(netPositiveTop, netTop) + safeNumber(netPositiveTop + totalPositiveHeight, netBottom)) / 2 + netShift.dy;
      const positiveTargetStackTop = positiveTargetBands.length
        ? safeNumber(positiveTargetBands[0]?.top, netTop) + netShift.dy
        : netPositiveTop + netShift.dy;
      const positiveTargetStackBottom = positiveTargetBands.length
        ? safeNumber(positiveTargetBands[positiveTargetBands.length - 1]?.bottom, netBottom) + netShift.dy
        : netPositiveTop + totalPositiveHeight + netShift.dy;
      positiveBranchClearanceY = Math.max(
        scaleY(safeNumber(snapshot.layout?.positiveBranchClearanceY, 16)),
        positiveReferenceHeight * safeNumber(snapshot.layout?.positiveBranchClearanceHeightFactor, 0.72)
      );
      positiveCapClearanceY = Math.max(
        scaleY(safeNumber(snapshot.layout?.positiveCapClearanceY, 12)),
        positiveReferenceHeight * safeNumber(snapshot.layout?.positiveCapClearanceHeightFactor, 0.52)
      );
      const positiveTerminalClearanceY = Math.max(
        scaleY(safeNumber(snapshot.layout?.positiveTerminalClearanceY, positiveAbove ? 24 : 20)),
        positiveCapClearanceY * safeNumber(snapshot.layout?.positiveTerminalClearanceCapFactor, positiveAbove ? 1.45 : 1.18)
      );
      const positiveTerminalCapClearanceY = Math.max(
        scaleY(safeNumber(snapshot.layout?.positiveTerminalCapObstacleClearanceY, positiveAbove ? 36 : 28)),
        positiveCapClearanceY * safeNumber(snapshot.layout?.positiveTerminalCapObstacleClearanceFactor, positiveAbove ? 2.25 : 1.65)
      );
      const positiveTerminalLabelObstacles = [...deductionBoxes, ...opexBoxes]
        .filter(Boolean)
        .map((box) => ({
          left: rightTerminalNodeX - positiveTerminalObstacleReachX,
          right: rightTerminalNodeX + nodeWidth,
          top: box.top - positiveTerminalClearanceY,
          bottom: box.bottom + positiveTerminalClearanceY,
        }));
      const positiveTerminalCapObstacles = [...deductionBranchModels, ...opexBranchModels]
        .map((model) => ({
          left: rightTerminalNodeX - positiveTerminalObstacleReachX,
          right: rightTerminalNodeX + nodeWidth,
          top: model.targetTop - positiveTerminalCapClearanceY,
          bottom: model.targetTop + model.targetHeight + positiveTerminalCapClearanceY,
        }));
      positiveTerminalNodeObstacles = [...positiveTerminalLabelObstacles, ...positiveTerminalCapObstacles];
      const positiveProminentMinRunwayX = positiveProminentAbove || usesExtremePositiveTopLane
        ? Math.max(
            safeNumber(snapshot.layout?.positiveProminentMinRunwayX, usesExtremePositiveTopLane ? 108 : 96),
            totalPositiveStackHeight * safeNumber(snapshot.layout?.positiveProminentMinRunwayHeightFactor, usesExtremePositiveTopLane ? 0.38 : 0.78)
          )
        : 0;
      const effectivePositiveNodeMaxX = positiveProminentAbove || usesExtremePositiveTopLane
        ? Math.min(positiveNodeMaxX, netX - positiveNodeWidth - positiveProminentMinRunwayX)
        : positiveNodeMaxX;
      extremePositiveTopLaneMinX = usesExtremePositiveTopLane
        ? Math.min(
            Math.max(positiveNodeMinX, opX + nodeWidth + extremePositiveTopLaneMinGapX),
            Math.max(effectivePositiveNodeMaxX, positiveNodeMinX)
          )
        : positiveNodeMinX;
      const positiveNodeXCandidates = [
        effectivePositiveNodeMaxX,
        netX - positiveNodeWidth - Math.max(positiveBranchRunwayX * 0.36, positiveAbove ? 14 : 12),
        netX - positiveNodeWidth - Math.max(positiveBranchRunwayX * 0.58, positiveAbove ? 20 : 18),
        defaultPositiveNodeX,
        netX - positiveNodeWidth - Math.max(positiveBranchRunwayX * 0.82, positiveAbove ? 28 : 24),
        extremePositiveTopLaneMinX,
        extremePositiveTopLaneMinX + (effectivePositiveNodeMaxX - extremePositiveTopLaneMinX) * 0.25,
        (extremePositiveTopLaneMinX + effectivePositiveNodeMaxX) / 2,
        extremePositiveTopLaneMinX + (effectivePositiveNodeMaxX - extremePositiveTopLaneMinX) * 0.75,
      ]
        .map((value) => clamp(value, extremePositiveTopLaneMinX, Math.max(effectivePositiveNodeMaxX, extremePositiveTopLaneMinX)))
        .filter((value, index, values) => values.findIndex((candidate) => Math.abs(candidate - value) < 1) === index);
      let bestNodePlacement = null;
      positiveNodeXCandidates.forEach((candidateNodeX) => {
        const runwayDx = Math.max(netX - (candidateNodeX + positiveNodeWidth), 1);
        const corridorSampleXsCandidate = positiveCorridorSampleXsForNode(candidateNodeX);
        const preferredVisualGapY = Math.max(
          safeNumber(snapshot.layout?.positiveCorridorPreferredGapY, 22),
          positiveReferenceHeight * safeNumber(snapshot.layout?.positiveCorridorPreferredGapFactor, positiveAbove ? 0.78 : 0.92)
        );
        const preferredCorridorTop = positiveAbove
          ? positiveUpperObstacleBottomForXs(corridorSampleXsCandidate) + scaleY(safeNumber(snapshot.layout?.positiveAboveCorridorTopGapY, 12))
          : Math.max(upperMetricFloor, ...corridorSampleXsCandidate.map((sampleX) => netMainRibbonBottomAtX(sampleX))) +
            scaleY(safeNumber(snapshot.layout?.positiveCorridorTopGapY, 18));
        const preferredCorridorBottom = positiveAbove
          ? Math.min(...corridorSampleXsCandidate.map((sampleX) => netMainRibbonTopAtX(sampleX))) -
            scaleY(safeNumber(snapshot.layout?.positiveAboveCorridorBottomGapY, 14))
          : (() => {
              const lowerRibbonSamples = corridorSampleXsCandidate.map((sampleX) => positiveRibbonTopAtX(sampleX)).filter((value) => Number.isFinite(value));
              const lowerRibbonTop = lowerRibbonSamples.length ? Math.min(...lowerRibbonSamples) : chartBottomLimit;
              return lowerRibbonTop - scaleY(safeNumber(snapshot.layout?.positiveCorridorBottomGapY, 14));
            })();
        const hardCorridorTop = positiveAbove
          ? positiveUpperObstacleBottomForXs(corridorSampleXsCandidate) +
            scaleY(safeNumber(snapshot.layout?.positiveAboveHardCorridorTopGapY, 0))
          : Math.max(upperMetricFloor, ...corridorSampleXsCandidate.map((sampleX) => netMainRibbonBottomAtX(sampleX))) +
            scaleY(safeNumber(snapshot.layout?.positiveCorridorHardTopGapY, 0));
        const hardCorridorBottom = positiveAbove
          ? Math.min(...corridorSampleXsCandidate.map((sampleX) => netMainRibbonTopAtX(sampleX))) -
            scaleY(safeNumber(snapshot.layout?.positiveAboveHardCorridorBottomGapY, 6))
          : (() => {
              const lowerRibbonSamples = corridorSampleXsCandidate.map((sampleX) => positiveRibbonTopAtX(sampleX)).filter((value) => Number.isFinite(value));
              const lowerRibbonTop = lowerRibbonSamples.length ? Math.min(...lowerRibbonSamples) : chartBottomLimit;
              return lowerRibbonTop - scaleY(safeNumber(snapshot.layout?.positiveCorridorHardBottomGapY, 6));
            })();
        const desiredLiftY = Math.max(
          scaleY(safeNumber(snapshot.layout?.positiveBranchLiftY, 28)),
          preferredVisualGapY * safeNumber(snapshot.layout?.positiveBranchLiftGapFactor, positiveAbove ? 1.16 : 0.86),
          positiveReferenceHeight * safeNumber(snapshot.layout?.positiveBranchLiftHeightFactor, positiveAbove ? 1.08 : 0.92)
        );
        const netAffinityAdjustedLiftY = Math.max(
          scaleY(safeNumber(snapshot.layout?.positiveBranchLiftMinY, positiveAbove ? 18 : 16)),
          desiredLiftY * (positiveAbove ? 1 - positiveNetAffinityStrength * 0.44 : 1)
        );
        const desiredCenter = positiveAbove
          ? balancedPositiveTop !== null ? balancedPositiveTop + totalPositiveStackHeight / 2
            : positiveTargetStackCenter - netAffinityAdjustedLiftY - positiveSmallAdjustmentLabelLiftY
          : positiveTargetStackCenter + netAffinityAdjustedLiftY;
        const positiveProminentMaxMergeDeltaY = positiveProminentAbove
          ? Math.max(
              scaleY(safeNumber(snapshot.layout?.positiveProminentMaxMergeDeltaY, 86)),
              totalPositiveStackHeight * safeNumber(snapshot.layout?.positiveProminentMaxMergeDeltaHeightFactor, 0.92),
              (positiveTargetStackBottom - positiveTargetStackTop) *
                safeNumber(snapshot.layout?.positiveProminentMaxMergeDeltaTargetFactor, 0.84)
            )
          : Infinity;
        const prominentTopFloor = Math.max(
          positiveProminentAbove
            ? positiveTargetStackCenter - positiveProminentMaxMergeDeltaY - totalPositiveStackHeight / 2
            : -Infinity,
          usesExtremePositiveTopLane ? extremePositiveTopLaneMinTop : -Infinity,
          balancedPositiveTop !== null && positiveAbove
            ? netFrame.top - totalPositiveStackHeight - (netFrame.left - operatingFrame.right) * 0.24 : -Infinity
        );
        const preferredTopMin = Math.max(preferredCorridorTop, prominentTopFloor);
        // A small group of gains shares one upper lane. Keep its last source
        // above the net node, so later items do not sag into the main spine.
        const gainGroupTopMax = hasOrdinaryProfitSpine && positiveAbove &&
            (positiveAdjustments.length > 1 || balancedPositiveTop !== null)
          ? netFrame.top - scaleY(balancedPositiveTop !== null ? 30 : 8) - totalPositiveStackHeight
          : Infinity;
        const laneTopMax = Math.min(
          usesExtremePositiveTopLane ? extremePositiveTopLaneMaxBottom - totalPositiveStackHeight : Infinity,
          gainGroupTopMax
        );
        const preferredTopMax = Math.max(Math.min(preferredCorridorBottom - totalPositiveStackHeight, laneTopMax), preferredTopMin);
        const candidateTopMin = Math.max(hardCorridorTop, prominentTopFloor);
        const candidateTopMax = Math.max(Math.min(hardCorridorBottom - totalPositiveStackHeight, laneTopMax), candidateTopMin);
        const desiredTop = clamp(
          desiredCenter - totalPositiveStackHeight / 2,
          preferredTopMin <= preferredTopMax ? preferredTopMin : candidateTopMin,
          preferredTopMin <= preferredTopMax ? preferredTopMax : candidateTopMax
        );
        const positiveBandEnvelopeAtX = (sampleX, stackTop) => {
          const stackBottom = stackTop + totalPositiveStackHeight;
          if (sampleX <= candidateNodeX + positiveNodeWidth) {
            return {
              top: stackTop,
              bottom: stackBottom,
            };
          }
          return flowEnvelopeAtX(
            sampleX,
            candidateNodeX + positiveNodeWidth,
            stackTop,
            stackBottom,
            netX + positiveTargetInsetX,
            positiveTargetStackTop,
            positiveTargetStackBottom,
            positiveBranchPathOptions
          );
        };
        const positiveVerticalCandidateTops = [];
        const positiveSearchOffsets = positiveAbove
          ? [-1.8, -1.35, -1, -0.65, -0.3, 0, 0.3, 0.6, 0.9]
          : [-1.45, -1.05, -0.72, -0.4, -0.12, 0.12, 0.42, 0.78, 1.08, 1.36];
        positiveSearchOffsets.forEach((offsetNorm) => {
          const offsetY = offsetNorm * Math.max(
            scaleY(safeNumber(snapshot.layout?.positiveTopSearchSpanY, 26)),
            positiveReferenceHeight * safeNumber(snapshot.layout?.positiveTopSearchSpanHeightFactor, 0.9)
          );
          positiveVerticalCandidateTops.push(clamp(desiredTop + offsetY, candidateTopMin, candidateTopMax));
        });
        positiveVerticalCandidateTops.push(candidateTopMin, candidateTopMax, desiredTop);
        let bestVerticalPlacement = null;
        [...new Set(positiveVerticalCandidateTops.map((value) => Number(value.toFixed(2))))].forEach((candidateTop) => {
          const nodeRect = {
            left: candidateNodeX,
            right: candidateNodeX + positiveNodeWidth,
            top: candidateTop,
            bottom: candidateTop + totalPositiveStackHeight,
          };
          const evaluationXs = [
            candidateNodeX + positiveNodeWidth * 0.16,
            candidateNodeX + positiveNodeWidth * 0.5,
            candidateNodeX + positiveNodeWidth * 0.84,
            ...corridorSampleXsCandidate,
          ];
          let gapShortfall = 0;
          let minGap = Infinity;
          let capGapShortfall = 0;
          evaluationXs.forEach((sampleX, sampleIndex) => {
            const envelope = positiveBandEnvelopeAtX(sampleX, candidateTop);
            if (!envelope) return;
            const requiredGap = sampleIndex < 3 ? positiveCapClearanceY : positiveBranchClearanceY;
            const upperGap = positiveAbove
              ? envelope.top - positiveUpperObstacleBottomAtX(sampleX)
              : envelope.top - Math.max(upperMetricFloor, netMainRibbonBottomAtX(sampleX));
            const lowerObstacleTop = positiveAbove ? netMainRibbonTopAtX(sampleX) : positiveRibbonTopAtX(sampleX);
            const lowerGap = (Number.isFinite(lowerObstacleTop) ? lowerObstacleTop : chartBottomLimit) - envelope.bottom;
            const localMinGap = Math.min(upperGap, lowerGap);
            minGap = Math.min(minGap, localMinGap);
            gapShortfall += Math.max(requiredGap - upperGap, 0) * 1.2 + Math.max(requiredGap - lowerGap, 0) * 1.35;
            if (sampleIndex < 3) {
              const capRequiredGap = requiredGap * safeNumber(snapshot.layout?.positiveCapPreferredGapFactor, 1.18);
              capGapShortfall += Math.max(capRequiredGap - upperGap, 0) * 2.5 + Math.max(capRequiredGap - lowerGap, 0) * 2.3;
            }
          });
          const sourceCenter = candidateTop + totalPositiveStackHeight / 2;
          const branchDirectionDelta = positiveAbove
            ? positiveTargetStackCenter - sourceCenter
            : sourceCenter - positiveTargetStackCenter;
          const preferredDirectionDelta =
            Math.max(
              scaleY(safeNumber(snapshot.layout?.positiveBranchPreferredDeltaY, 30)),
              preferredVisualGapY * safeNumber(snapshot.layout?.positiveBranchPreferredDeltaGapFactor, positiveAbove ? 0.92 : 0.72),
              positiveReferenceHeight *
                safeNumber(
                  snapshot.layout?.positiveBranchPreferredDeltaHeightFactor,
                  positiveAbove
                    ? Math.max(1.08, 2.15 - positiveAdjustmentExtremeStrength * 0.84 - positiveNetAffinityStrength * 0.38)
                    : 1.28
                )
            ) + positiveSmallAdjustmentLabelLiftY;
          const branchDirectionShortfall = Math.max(preferredDirectionDelta - branchDirectionDelta, 0);
          const excessiveBranchDirectionAllowance = preferredDirectionDelta * safeNumber(
            snapshot.layout?.positiveBranchExcessiveDeltaAllowanceFactor,
            positiveAbove ? 1.45 : 1.8
          );
          const branchDirectionExcess = Math.max(branchDirectionDelta - excessiveBranchDirectionAllowance, 0);
          const excessiveMergePenalty =
            positiveAbove && positiveNetAffinityStrength > 0
              ? branchDirectionExcess *
                safeNumber(
                  snapshot.layout?.positiveNetAffinityMergeDeltaPenaltyFactor,
                  4.6 + positiveNetAffinityStrength * 10
                )
              : 0;
          const targetDeviation = Math.abs(candidateTop - desiredTop);
          const preferredRunwayDxBase = clamp(
            Math.max(
              safeNumber(snapshot.layout?.positivePreferredRunwayX, positiveAbove ? 74 : 72),
              totalPositiveStackHeight *
                safeNumber(
                  snapshot.layout?.positivePreferredRunwayHeightFactor,
                  positiveAbove
                    ? Math.max(0.82, 2.25 - positiveAdjustmentExtremeStrength * 1.12 - positiveNetAffinityStrength * 0.46)
                    : 2.1
                ),
              preferredDirectionDelta *
                safeNumber(
                  snapshot.layout?.positivePreferredRunwayDeltaFactor,
                  positiveAbove
                    ? Math.max(0.38, 0.72 - positiveAdjustmentExtremeStrength * 0.22 - positiveNetAffinityStrength * 0.18)
                    : 0.62
                )
            ),
            24,
            Math.max(netX - positiveNodeWidth - positiveNodeMinX, 24)
          );
          const preferredRunwayDx = clamp(
            preferredRunwayDxBase * (positiveAbove ? 1 - positiveNetAffinityStrength * 0.5 : 1),
            24,
            Math.max(netX - positiveNodeWidth - positiveNodeMinX, 24)
          );
          const preferredNodeX = clamp(
            netX - positiveNodeWidth - preferredRunwayDx,
            positiveNodeMinX,
            Math.max(positiveNodeMaxX, positiveNodeMinX)
          );
          const runwayShortfallPenalty =
            Math.max(preferredRunwayDx - runwayDx, 0) *
            safeNumber(
              snapshot.layout?.positiveRunwayShortfallPenaltyFactor,
              positiveAbove ? Math.max(2.8, 7.4 - positiveAdjustmentExtremeStrength * 3.8 - positiveNetAffinityStrength * 1.4) : 4.2
            );
          const runwayExcessAllowanceFactor = safeNumber(
            snapshot.layout?.positiveRunwayExcessAllowanceFactor,
            positiveAbove ? Math.max(1.08, 1.22 - positiveNetAffinityStrength * 0.16) : 1.45
          );
          const runwayExcessPenaltyFactor = safeNumber(
            snapshot.layout?.positiveRunwayExcessPenaltyFactor,
            positiveAbove ? 0.8 + positiveNetAffinityStrength * 2.6 : 0.18
          );
          const runwayExcessPenalty =
            Math.max(runwayDx - preferredRunwayDx * runwayExcessAllowanceFactor, 0) * runwayExcessPenaltyFactor;
          const runwayDistancePenalty =
            positiveAbove && positiveNetAffinityStrength > 0
              ? runwayDx * safeNumber(snapshot.layout?.positiveNetAffinityRunwayPenaltyFactor, 0.04 + positiveNetAffinityStrength * 0.18)
              : 0;
          const nodeXDeviationPenalty =
            Math.abs(candidateNodeX - preferredNodeX) *
            safeNumber(snapshot.layout?.positiveNodeXDeviationPenaltyFactor, positiveAbove ? 0.42 : 0.24);
          let terminalObstacleHits = 0;
          let terminalObstacleOverlapDepth = 0;
          positiveTerminalNodeObstacles.forEach((obstacle) => {
            if (!rectsOverlap(nodeRect, obstacle)) return;
            terminalObstacleHits += 1;
            terminalObstacleOverlapDepth +=
              Math.max(Math.min(nodeRect.bottom, obstacle.bottom) - Math.max(nodeRect.top, obstacle.top), 0);
          });
          const score =
            gapShortfall * 100 +
            capGapShortfall * 126 +
            branchDirectionShortfall * 10.5 +
            branchDirectionExcess * safeNumber(snapshot.layout?.positiveBranchExcessPenaltyFactor, positiveAbove ? 3.1 : 1.6) +
            excessiveMergePenalty +
            targetDeviation * safeNumber(snapshot.layout?.positiveTargetDeviationPenaltyFactor, positiveAbove ? 0.72 : 0.26) +
            terminalObstacleHits * safeNumber(snapshot.layout?.positiveTerminalObstaclePenalty, 40000) +
            terminalObstacleOverlapDepth * safeNumber(snapshot.layout?.positiveTerminalObstacleDepthPenaltyFactor, 480) +
            runwayShortfallPenalty +
            runwayExcessPenalty +
            runwayDistancePenalty +
            nodeXDeviationPenalty -
            Math.max(minGap, 0) * 2.7;
          if (!bestVerticalPlacement || score < bestVerticalPlacement.score) {
            bestVerticalPlacement = {
              top: candidateTop,
              score,
              minGap,
            };
          }
        });
        if (!bestVerticalPlacement) return;
        if (!bestNodePlacement || bestVerticalPlacement.score < bestNodePlacement.score) {
          bestNodePlacement = {
            nodeX: candidateNodeX,
            top: bestVerticalPlacement.top,
            score: bestVerticalPlacement.score,
            minGap: bestVerticalPlacement.minGap,
            corridorSampleXs: corridorSampleXsCandidate,
            topMin: candidateTopMin,
            topMax: candidateTopMax,
          };
        }
      });
      if (bestNodePlacement) {
        const positiveAestheticNudgeStrength = clamp(
          safeNumber(
            snapshot.layout?.positiveAestheticNudgeStrength,
            positiveAbove ? positiveNetAffinityStrength + 0.12 : 0
          ),
          0,
          0.64
        );
        const positiveAestheticNudgeX =
          scaleY(safeNumber(snapshot.layout?.positiveAestheticNudgeX, positiveAbove ? 48 : 0)) * positiveAestheticNudgeStrength;
        const positiveAestheticNudgeY =
          scaleY(safeNumber(snapshot.layout?.positiveAestheticNudgeY, positiveAbove ? 40 : 0)) *
          positiveAestheticNudgeStrength *
          (1 - positiveAdjustmentExtremeStrength) *
          (1 - positiveSmallAdjustmentStrength);
        positiveNodeX = clamp(
          bestNodePlacement.nodeX + positiveAestheticNudgeX,
          extremePositiveTopLaneMinX,
          Math.max(positiveNodeMaxX, extremePositiveTopLaneMinX)
        );
        positiveTop = clamp(bestNodePlacement.top + positiveAestheticNudgeY, bestNodePlacement.topMin, bestNodePlacement.topMax);
        corridorSampleXs = positiveCorridorSampleXsForNode(positiveNodeX);
        positiveTopMin = bestNodePlacement.topMin;
        positiveTopMax = bestNodePlacement.topMax;
      }
    }
    if (snapshot.layout?.positiveForceTopY !== null && snapshot.layout?.positiveForceTopY !== undefined) {
      positiveTop = clamp(
        layoutY(snapshot.layout?.positiveForceTopY),
        positiveTopMin,
        positiveTopMax
      );
    }
    if (positiveUpperLane && preDetailProfitContinuityStrength > 0) {
      const preDetailPositiveSyncLiftY = scaleY(
        clamp(
          safeNumber(
            snapshot.layout?.preDetailPositiveSyncLiftY,
            8 + preDetailProfitContinuityStrength * 6
          ),
          0,
          safeNumber(snapshot.layout?.preDetailPositiveSyncLiftMaxY, 18)
        )
      );
      positiveTop = clamp(positiveTop - preDetailPositiveSyncLiftY, positiveTopMin, positiveTopMax);
    }
    if (positiveUpperLane && positiveNetAffinityStrength > 0) {
      const attachedTopMin = netTop - scaleY(
        safeNumber(
          snapshot.layout?.positiveMaxRiseAboveNetTopY,
          usesExtremePositiveTopLane ? 92 : 86
        )
      );
      positiveTop = clamp(
        Math.max(positiveTop, attachedTopMin),
        positiveTopMin,
        positiveTopMax
      );
    }
    if (positiveUpperLane && positiveNetAffinityStrength > 0) {
      const defaultAffinityTargetGapX = clamp(
        112 - positiveAdjustmentScaleStrength * 88 - positiveAdjustmentOpRatio * 48,
        usesExtremePositiveTopLane ? 66 : 72,
        usesExtremePositiveTopLane ? 104 : 122
      );
      const affinityTargetGapX = scaleY(
        safeNumber(
          snapshot.layout?.positiveNetAffinityTargetGapX,
          defaultAffinityTargetGapX
        )
      );
      const affinityTargetX = clamp(
        netX - positiveNodeWidth - affinityTargetGapX,
        extremePositiveTopLaneMinX,
        Math.max(positiveNodeMaxX, extremePositiveTopLaneMinX)
      );
      const affinityPostPlacementStrength = clamp(
        safeNumber(
          snapshot.layout?.positiveNetAffinityPostPlacementStrength,
          positiveNetAffinityStrength +
            positiveAdjustmentScaleStrength * 0.22 +
            positiveAdjustmentOpRatio * 0.16 +
            positiveAdjustmentExtremeStrength * 0.18
        ),
        0,
        0.86
      );
      positiveNodeX += (affinityTargetX - positiveNodeX) * affinityPostPlacementStrength;
      positiveNodeX = clamp(positiveNodeX, extremePositiveTopLaneMinX, Math.max(positiveNodeMaxX, extremePositiveTopLaneMinX));
      corridorSampleXs = positiveCorridorSampleXsForNode(positiveNodeX);
    }
    if (positiveRequiresVisibleMergeLead) {
      const netShift = editorOffsetForNode("net");
      const prominentTargetStackCenter = positiveTargetBands.length
        ? (safeNumber(positiveTargetBands[0]?.top, netTop) +
            safeNumber(positiveTargetBands[positiveTargetBands.length - 1]?.bottom, netBottom)) /
            2 +
          netShift.dy
        : (safeNumber(netPositiveTop, netTop) + safeNumber(netPositiveTop + totalPositiveHeight, netBottom)) / 2 + netShift.dy;
      const learnedPositiveStackShiftY = positiveAdjustments.reduce((weightedShift, _item, index) => {
        const itemHeight = Math.max(safeNumber(positiveHeights[index], 0), 0);
        return weightedShift + learnedEditorOffsetForNode(`positive-${index}`).dy * itemHeight;
      }, 0) / Math.max(totalPositiveStackHeight, 1);
      if (positiveNeedsVisibleMergeAngle || positiveNeedsGentleMergeAngle) {
        positiveTopMin = Math.min(positiveTopMin, positiveAngledSourceTopFloorY);
      }
      const prominentMinimumMergeLeadY = Math.max(
        scaleY(
          safeNumber(
            positiveNeedsGentleMergeAngle
              ? snapshot.layout?.positiveGentleAngledMinimumMergeLeadY
              : positiveNeedsVisibleMergeAngle
                ? snapshot.layout?.positiveAngledMinimumMergeLeadY
                : snapshot.layout?.positiveProminentMinimumMergeLeadY,
            positiveNeedsGentleMergeAngle ? 18 : positiveNeedsVisibleMergeAngle ? 44 : 36
          )
        ),
        positiveReferenceHeight *
          safeNumber(
            positiveNeedsGentleMergeAngle
              ? snapshot.layout?.positiveGentleMinimumMergeLeadHeightFactor
              : snapshot.layout?.positiveProminentMinimumMergeLeadHeightFactor,
            positiveNeedsGentleMergeAngle ? 0.28 : 0.42
          )
      );
      const prominentMaximumSourceTop =
        prominentTargetStackCenter -
        prominentMinimumMergeLeadY -
        totalPositiveStackHeight / 2 -
        learnedPositiveStackShiftY;
      positiveTop = clamp(
        Math.min(positiveTop, prominentMaximumSourceTop),
        positiveTopMin,
        positiveTopMax
      );

      if (!positiveNeedsGentleMergeAngle) {
        const prominentMinimumRunwayX = Math.max(
          scaleY(safeNumber(snapshot.layout?.positiveProminentMinimumRunwayX, 98)),
          positiveReferenceHeight * safeNumber(snapshot.layout?.positiveProminentMinimumRunwayHeightFactor, 1.03)
        );
        positiveNodeX = clamp(
          Math.min(positiveNodeX, netX - positiveNodeWidth - prominentMinimumRunwayX),
          extremePositiveTopLaneMinX,
          Math.max(positiveNodeMaxX, extremePositiveTopLaneMinX)
        );
        corridorSampleXs = positiveCorridorSampleXsForNode(positiveNodeX);
      }
    }
    if (positiveUpperLane && positiveSmallAdjustmentStrength > 0 && periodEndObstacle &&
        positiveTop < periodEndObstacle.bottom + positiveLabelBlockHeight + scaleY(12)) {
      const smallAdjustmentLabelGapX = safeNumber(snapshot.layout?.positiveLabelGapX, 14);
      const smallAdjustmentLabelLeftX =
        positiveNodeX - smallAdjustmentLabelGapX - maxPositiveLabelBlockWidth;
      const smallAdjustmentDateClearanceX = scaleY(
        safeNumber(snapshot.layout?.positiveSmallAdjustmentDateClearanceX, 24)
      );
      const requiredDateClearanceShiftX =
        periodEndObstacle.right + smallAdjustmentDateClearanceX - smallAdjustmentLabelLeftX;
      const smallAdjustmentMaxRightShiftX = scaleY(
        safeNumber(snapshot.layout?.positiveSmallAdjustmentMaxRightShiftX, 48)
      );
      const smallAdjustmentRightShiftX =
        clamp(requiredDateClearanceShiftX, 0, smallAdjustmentMaxRightShiftX) *
        positiveSmallAdjustmentStrength;
      positiveNodeX = clamp(
        positiveNodeX + smallAdjustmentRightShiftX,
        extremePositiveTopLaneMinX,
        Math.max(positiveNodeMaxX, extremePositiveTopLaneMinX)
      );
      corridorSampleXs = positiveCorridorSampleXsForNode(positiveNodeX);
    }
    if (positiveUpperLane && positiveSmallAdjustmentStrength > 0) {
      const smallAdjustmentSourceTopFloorY =
        positiveExtremeTopFloorY +
        (scaleY(safeNumber(snapshot.layout?.positiveSmallAdjustmentSourceTopFloorY, 100)) -
          positiveExtremeTopFloorY) *
          positiveSmallAdjustmentStrength;
      const smallAdjustmentPreferredTopY = Math.max(
        netFrame.top -
          positiveSmallAdjustmentLabelLiftY -
          scaleY(safeNumber(snapshot.layout?.positiveSmallAdjustmentNetClearanceY, 8)),
        smallAdjustmentSourceTopFloorY
      );
      positiveTop = clamp(
        Math.min(positiveTop, smallAdjustmentPreferredTopY),
        Math.min(positiveTopMin, smallAdjustmentSourceTopFloorY),
        positiveTopMax
      );
    }
    if (hasOrdinaryProfitSpine && positiveAbove && !snapshot.editModeEnabled) {
      // Corridor selection runs before interactive offsets are applied. Reserve
      // the header on the final cap positions as well, including old drafts.
      const capFloor = Math.max(titleObstacle.bottom, periodEndObstacle?.bottom || 0) + scaleY(24);
      let cursor = positiveTop;
      const caps = positiveAdjustments.map((_item, index) => {
        const top = cursor + editorOffsetForNode(`positive-${index}`).dy;
        cursor += positiveHeights[index] + positiveGap;
        return { top, height: positiveHeights[index] };
      });
      const capBottom = netFrame.top - scaleY(12);
      const totalHeight = caps.reduce((sum, cap) => sum + Math.max(cap.height, 1), 0);
      const maxLead = Math.max((netFrame.left - operatingFrame.right) * 0.32, scaleY(36));
      const preferredFloor = Math.max(capFloor, capBottom - totalPositiveStackHeight - maxLead);
      const hasStaleCapOffset = positiveAdjustments.some((_item, index) =>
        Math.abs(safeNumber(snapshot.interactiveEditorNodeOverrides?.[`positive-${index}`]?.dy, 0)) > 1);
      if (capBottom - capFloor >= totalHeight &&
          (caps.some(cap => cap.top < capFloor - 0.5) || hasStaleCapOffset)) {
        const safeCaps = resolveOrderedVerticalBoxes(caps, Math.min(preferredFloor, capBottom - totalHeight), capBottom, positiveGap);
        safeCaps.forEach((cap, index) => {
          const id = `positive-${index}`, offset = autoLayoutOffsetForNode(id);
          setAutoLayoutNodeOffset(id, { dy: offset.dy + cap.top - caps[index].top });
        });
      }
    }
    const placedPositiveLabelRects = [];
    let netPositiveCursor = netPositiveTop;
    const positiveStackStartY = positiveTop;
    positiveAdjustments.forEach((item, index) => {
      if (useNetLossBalanceBridge) return;
      const gainHeight = positiveHeights[index];
      const mergeHeight = positiveMergeHeights[index] ?? Math.max(safeNumber(item.valueBn) * scale, 0);
      const localizedPositiveName = localizeChartItemName(item);
      const positiveNameSize = localizedPositiveName.length > 14 ? 18 : 22;
      const positiveValueSize = localizedPositiveName.length > 14 ? 18 : 20;
      const labelGapX = safeNumber(snapshot.layout?.positiveLabelGapX, 14);
      const twoLineGap = scaleY(safeNumber(snapshot.layout?.positiveLabelLineGapY, 8));
      const valueYOffset = scaleY(safeNumber(snapshot.layout?.positiveLabelValueOffsetY, 16));
      const labelTopGapY = positiveValueSize * 0.5;
      const positiveTargetBand = positiveTargetBands[index] || {
        top: clamp(netPositiveCursor, netTop, netBottom - gainHeight),
        bottom: clamp(netPositiveCursor + mergeHeight, netTop + mergeHeight, netBottom),
        height: mergeHeight,
      };
      const netShift = editorOffsetForNode("net");
      const adjustedTargetTop = Math.max(positiveTargetBand.top + netShift.dy - positiveMergeOverlapY, netFrame.top);
      const adjustedTargetHeight = Math.min(
        Math.max(safeNumber(positiveTargetBand.height, mergeHeight), 0) + positiveMergeOverlapY,
        netFrame.bottom - adjustedTargetTop
      );
      const labelValue = formatItemBillions(item, "positive-plus");
      const leftCorridor = positiveNodeX - (opX + nodeWidth);
      const labelNameWidth = approximateTextWidth(localizedPositiveName, positiveNameSize);
      const labelValueWidth = approximateTextWidth(labelValue, positiveValueSize);
      const labelBlockWidth = Math.max(labelNameWidth, labelValueWidth, 1);
      const positiveLabelMinLeftPad = safeNumber(snapshot.layout?.positiveLabelMinLeftPadX, 10);
      const positiveLabelObstaclePadding = scaleY(safeNumber(snapshot.layout?.positiveLabelObstaclePadding, 6));
      const positiveLabelRibbonClearance = Math.max(
        positiveLabelObstaclePadding,
        scaleY(safeNumber(snapshot.layout?.positiveLabelRibbonClearanceY, 12))
      );
      const positiveLabelInterLabelPadding = Math.max(
        positiveLabelObstaclePadding,
        scaleY(safeNumber(snapshot.layout?.positiveLabelInterLabelPadding, 8))
      );
      const positiveLabelWidthPadding = Math.max(
        positiveLabelObstaclePadding,
        scaleY(safeNumber(snapshot.layout?.positiveLabelWidthPaddingX, 10))
      );
      const labelNameAscent = positiveNameSize * 0.9;
      const labelNameDescent = positiveNameSize * 0.34;
      const labelValueAscent = positiveValueSize * 0.9;
      const labelValueDescent = positiveValueSize * 0.36;
      const labelTopOffset = Math.min(-twoLineGap - labelNameAscent, valueYOffset - labelValueAscent) - positiveLabelObstaclePadding;
      const labelBottomOffset = Math.max(-twoLineGap + labelNameDescent, valueYOffset + labelValueDescent) + positiveLabelObstaclePadding;
      const labelBlockHeight = labelBottomOffset - labelTopOffset;
      const labelCenterBias = (labelTopOffset + labelBottomOffset) / 2;
      const positiveLabelOrderNorm = positiveAdjustments.length <= 1 ? 0.5 : index / Math.max(positiveAdjustments.length - 1, 1);
      const positiveLabelPreferredVerticalType =
        positiveAbove && positiveAdjustments.length > 1
          ? positiveLabelOrderNorm >= safeNumber(snapshot.layout?.positiveLabelPreferBelowFromOrderNorm, 0.5)
            ? "below"
            : "above"
          : null;
      const positiveExtremeAttachedLabel =
        positiveAbove && positiveAdjustmentExtremeStrength >= safeNumber(snapshot.layout?.positiveExtremeAttachedLabelThreshold, 0.72);
      const preferExtremeLeftLabel =
        usesExtremePositiveTopLane &&
        positiveAdjustmentExtremeStrength >= safeNumber(snapshot.layout?.positiveExtremeLeftLabelThreshold, 0.72) &&
        leftCorridor >= labelBlockWidth + safeNumber(snapshot.layout?.positiveExtremeLeftLabelMinCorridorX, 34);
      const labelBoundsRect = (anchor, x, centerY) => {
        const left =
          anchor === "middle"
            ? x - labelBlockWidth / 2 - positiveLabelWidthPadding
            : anchor === "start"
              ? x - positiveLabelWidthPadding
              : x - labelBlockWidth - positiveLabelWidthPadding;
        const right =
          anchor === "middle"
            ? x + labelBlockWidth / 2 + positiveLabelWidthPadding
            : anchor === "start"
              ? x + labelBlockWidth + positiveLabelWidthPadding
              : x + positiveLabelWidthPadding;
        return {
          left,
          right,
          top: centerY + labelTopOffset,
          bottom: centerY + labelBottomOffset,
        };
      };
      const positiveStackOffsetY = positiveTop - positiveStackStartY;
      const sourceTopSearchMin = clamp(
        positiveTopMin + positiveStackOffsetY + positiveSourceDropY,
        positiveNeedsVisibleMergeAngle || positiveNeedsGentleMergeAngle
          ? positiveAngledSourceTopFloorY
          : positiveMaterialAbove
            ? positiveSourceTopFloorY
            : positiveSmallAdjustmentStrength > 0
              ? positiveExtremeTopFloorY +
                (scaleY(safeNumber(snapshot.layout?.positiveSmallAdjustmentSourceTopFloorY, 100)) -
                  positiveExtremeTopFloorY) *
                  positiveSmallAdjustmentStrength
              : positiveExtremeTopFloorY,
        chartBottomLimit - gainHeight - scaleY(6)
      );
      const sourceTopSearchMax = clamp(
        positiveTopMax + positiveStackOffsetY + positiveSourceDropY,
        sourceTopSearchMin,
        chartBottomLimit - gainHeight - scaleY(6)
      );
      const resolvePositivePlacement = (sourceTopCandidate) => {
        const positiveSourceTop = clamp(sourceTopCandidate, sourceTopSearchMin, sourceTopSearchMax);
        const positiveSourceBottom = positiveSourceTop + gainHeight;
        const positiveSourceCenter = positiveSourceTop + gainHeight / 2;
        const positiveTargetCenter = adjustedTargetTop + adjustedTargetHeight / 2;
        const positiveLocalUpperObstacleBottom = positiveAbove
          ? positiveUpperObstacleBottomAtX(positiveNodeX + positiveNodeWidth * 0.5)
          : Math.max(upperMetricFloor, netMainRibbonBottomAtX(positiveNodeX + positiveNodeWidth * 0.5));
        const availableAbove = positiveSourceTop - positiveLocalUpperObstacleBottom;
        const positiveLocalLowerObstacleTop = (() => {
          const sampleX = positiveNodeX + positiveNodeWidth * 0.5;
          if (positiveAbove) {
            const mainRibbonTop = netMainRibbonTopAtX(sampleX);
            return Number.isFinite(mainRibbonTop) ? mainRibbonTop : chartBottomLimit;
          }
          const lowerRibbonTop = positiveRibbonTopAtX(sampleX);
          return Number.isFinite(lowerRibbonTop) ? lowerRibbonTop : chartBottomLimit;
        })();
        const availableBelow = positiveLocalLowerObstacleTop - positiveSourceBottom;
        const abovePlacementBaseCenterY = positiveSourceTop - labelTopGapY - labelBottomOffset;
        const belowPlacementBaseCenterY = positiveSourceBottom + labelTopGapY - labelTopOffset;
        const sampleXsAcrossRect = (rect, count = 5) => {
          if (!rect) return [];
          const left = clamp(rect.left + 1, opX + nodeWidth + 1, netX + positiveTargetInsetX);
          const right = clamp(rect.right - 1, opX + nodeWidth + 1, netX + positiveTargetInsetX);
          if (right <= left) return [left];
          return Array.from({ length: count }, (_unused, index) =>
            clamp(left + ((right - left) * index) / Math.max(count - 1, 1), opX + nodeWidth + 1, netX + positiveTargetInsetX)
          ).filter((value, idx, arr) => Number.isFinite(value) && (idx === 0 || Math.abs(value - arr[idx - 1]) > 0.8));
        };
        const lowerObstacleTopForRect = (rect) => {
          const sampleXs = sampleXsAcrossRect(rect, 7);
          let top = Infinity;
          sampleXs.forEach((sampleX) => {
            const candidateTop = positiveAbove ? netMainRibbonTopAtX(sampleX) : positiveRibbonTopAtX(sampleX);
            if (Number.isFinite(candidateTop)) {
              top = Math.min(top, candidateTop);
            }
          });
          return top;
        };
        const upperObstacleBottomForRect = (rect) => {
          const sampleXs = sampleXsAcrossRect(rect, 7);
          let bottom = positiveAbove ? positiveHeaderLabelClearanceBottom : Math.max(upperMetricFloor, positiveHeaderLabelClearanceBottom);
          sampleXs.forEach((sampleX) => {
            const mainBottom = positiveAbove ? positiveUpperObstacleBottomAtX(sampleX) : netMainRibbonBottomAtX(sampleX);
            if (Number.isFinite(mainBottom)) {
              bottom = Math.max(bottom, mainBottom);
            }
          });
          return bottom;
        };
        const labelRectIsValid = (rect) =>
          rect.left >= opX + nodeWidth + positiveLabelMinLeftPad &&
          rect.right <= width - 56 &&
          rect.top >= upperObstacleBottomForRect(rect) + scaleY(6) &&
          rect.bottom <= chartBottomLimit - scaleY(6);
        const positiveBranchEnvelopeAtX = (sampleX) =>
          flowEnvelopeAtX(
            sampleX,
            positiveNodeX + positiveNodeWidth,
            positiveSourceTop,
            positiveSourceBottom,
            netX + positiveTargetInsetX,
            adjustedTargetTop,
            adjustedTargetTop + adjustedTargetHeight,
            positiveBranchPathOptions
          );
        const branchClearanceScore = (() => {
          const sampleXs = [
            positiveNodeX + positiveNodeWidth * 0.12,
            positiveNodeX + positiveNodeWidth * 0.5,
            positiveNodeX + positiveNodeWidth * 0.88,
            ...corridorSampleXs,
          ];
          let penalty = 0;
          let minGap = Infinity;
          sampleXs.forEach((sampleX, sampleIndex) => {
            const envelope =
              sampleX <= positiveNodeX + positiveNodeWidth
                ? { top: positiveSourceTop, bottom: positiveSourceBottom }
                : positiveBranchEnvelopeAtX(sampleX);
            if (!envelope) return;
            const requiredGap =
              sampleIndex < 3
                ? positiveCapClearanceY * safeNumber(snapshot.layout?.positiveCapPreferredGapFactor, 1.18)
                : positiveBranchClearanceY;
            const upperGap = positiveAbove
              ? envelope.top - positiveUpperObstacleBottomAtX(sampleX)
              : envelope.top - Math.max(upperMetricFloor, netMainRibbonBottomAtX(sampleX));
            const lowerObstacleTop = positiveAbove ? netMainRibbonTopAtX(sampleX) : positiveRibbonTopAtX(sampleX);
            const lowerGap = (Number.isFinite(lowerObstacleTop) ? lowerObstacleTop : chartBottomLimit) - envelope.bottom;
            const localMinGap = Math.min(upperGap, lowerGap);
            minGap = Math.min(minGap, localMinGap);
            penalty += Math.max(requiredGap - upperGap, 0) * (sampleIndex < 3 ? 3.2 : 2.2);
            penalty += Math.max(requiredGap - lowerGap, 0) * (sampleIndex < 3 ? 3.4 : 2.4);
          });
          return {
            penalty,
            minGap,
          };
        })();
        const preferredMergeDeltaY = Math.max(
          scaleY(safeNumber(snapshot.layout?.positivePerItemPreferredMergeDeltaY, 26)),
          gainHeight * safeNumber(snapshot.layout?.positivePerItemPreferredMergeDeltaHeightFactor, 2),
          positiveReferenceHeight * safeNumber(snapshot.layout?.positivePerItemPreferredMergeDeltaReferenceFactor, 1.6)
        );
        const mergeDeltaY = positiveAbove
          ? positiveTargetCenter - positiveSourceCenter
          : positiveSourceCenter - positiveTargetCenter;
        const mergeDeltaShortfall = Math.max(preferredMergeDeltaY - mergeDeltaY, 0);
        const preferredMergeDeltaExcessAllowance = preferredMergeDeltaY * safeNumber(
          snapshot.layout?.positivePerItemMergeDeltaExcessAllowanceFactor,
          positiveAbove ? 1.08 : 1.36
        );
        const mergeDeltaExcess = Math.max(mergeDeltaY - preferredMergeDeltaExcessAllowance, 0);
        const mergeRunway = Math.max(netX - (positiveNodeX + positiveNodeWidth), 1);
        const evaluateLabelRibbonCollisions = (rect) => {
          const safeRectLeft = clamp(rect.left + 1, opX + nodeWidth + 1, netX + positiveTargetInsetX);
          const safeRectRight = clamp(rect.right - 1, opX + nodeWidth + 1, netX + positiveTargetInsetX);
          if (safeRectRight <= safeRectLeft) {
            return { hitCount: 0, overlapDepth: 0 };
          }
          const sampleCount = 11;
          const sampleXs = Array.from({ length: sampleCount }, (_unused, index) =>
            clamp(
              safeRectLeft + ((safeRectRight - safeRectLeft) * index) / Math.max(sampleCount - 1, 1),
              opX + nodeWidth + 1,
              netX + positiveTargetInsetX
            )
          ).filter((value, idx, arr) => Number.isFinite(value) && (idx === 0 || Math.abs(value - arr[idx - 1]) > 0.5));
          let hitCount = 0;
          let overlapDepth = 0;
          sampleXs.forEach((sampleX) => {
            const envelopes = [];
            const mainEnvelope = shiftedMainNetRibbonEnvelopeAtX(sampleX);
            if (mainEnvelope) envelopes.push(mainEnvelope);
            const positiveEnvelope = positiveBranchEnvelopeAtX(sampleX);
            if (positiveEnvelope) envelopes.push(positiveEnvelope);
            [...deductionBranchModels, ...opexBranchModels].forEach((model) => {
              const branchEnvelope = flowEnvelopeAtX(
                sampleX,
                model.x0,
                model.sourceTop,
                model.sourceBottom,
                model.x1,
                model.targetTop,
                model.targetTop + model.targetHeight,
                model.options
              );
              if (branchEnvelope) envelopes.push(branchEnvelope);
            });
            if (sampleX >= positiveNodeX && sampleX <= positiveNodeX + positiveNodeWidth) {
              envelopes.push({ top: positiveSourceTop, bottom: positiveSourceBottom });
            }
            let hasLocalHit = false;
            envelopes.forEach((envelope) => {
              const overlapTop = Math.max(rect.top, envelope.top - positiveLabelRibbonClearance);
              const overlapBottom = Math.min(rect.bottom, envelope.bottom + positiveLabelRibbonClearance);
              const overlap = overlapBottom - overlapTop;
              if (overlap > 0) {
                hasLocalHit = true;
                overlapDepth += overlap;
              }
            });
            if (hasLocalHit) hitCount += 1;
          });
          return { hitCount, overlapDepth };
        };
        const collisionPenalty = (rect) => {
          let penalty = 0;
          let obstacleHits = 0;
          let interLabelHits = 0;
          positiveLabelObstacles.forEach((obstacle) => {
            if (rectsOverlap(rect, obstacle, positiveLabelObstaclePadding)) {
              obstacleHits += 1;
              penalty += 12;
            }
          });
          placedPositiveLabelRects.forEach((placedRect) => {
            if (rectsOverlap(rect, placedRect, positiveLabelInterLabelPadding)) {
              interLabelHits += 1;
              penalty += safeNumber(snapshot.layout?.positiveLabelPlacedOverlapPenalty, 96);
            }
          });
          const ribbonCollision = evaluateLabelRibbonCollisions(rect);
          if (ribbonCollision.hitCount > 0) {
            penalty += ribbonCollision.hitCount * 24 + ribbonCollision.overlapDepth * 0.28;
          }
          return {
            penalty,
            obstacleHits,
            interLabelHits,
            ribbonHitCount: ribbonCollision.hitCount,
            ribbonOverlapDepth: ribbonCollision.overlapDepth,
            hardCollisionCount: obstacleHits + interLabelHits + ribbonCollision.hitCount,
          };
        };
        const associationAmbiguityPenalty = (candidate, rect) => {
          const verticalGapToBand = (box, bandTop, bandBottom) => {
            if (!Number.isFinite(bandTop) || !Number.isFinite(bandBottom)) return Infinity;
            if (box.bottom < bandTop) return bandTop - box.bottom;
            if (box.top > bandBottom) return box.top - bandBottom;
            return 0;
          };
          const ownGap = verticalGapToBand(rect, positiveSourceTop, positiveSourceBottom);
          const sampleXs = [
            rect.left + (rect.right - rect.left) * 0.2,
            rect.left + (rect.right - rect.left) * 0.5,
            rect.left + (rect.right - rect.left) * 0.8,
          ]
            .map((value) => clamp(value, opX + nodeWidth + 1, netX + positiveTargetInsetX))
            .filter((value, index, values) => Number.isFinite(value) && (index === 0 || Math.abs(value - values[index - 1]) > 0.8));
          let hardAmbiguityCount = 0;
          let proximityPenalty = 0;
          let minNearestCompetingGap = Infinity;
          sampleXs.forEach((sampleX) => {
            const competingGaps = [];
            const mainEnvelope = shiftedMainNetRibbonEnvelopeAtX(sampleX);
            if (mainEnvelope) {
              competingGaps.push(verticalGapToBand(rect, mainEnvelope.top, mainEnvelope.bottom));
            }
            [...deductionBranchModels, ...opexBranchModels].forEach((model) => {
              const envelope = flowEnvelopeAtX(
                sampleX,
                model.x0,
                model.sourceTop,
                model.sourceBottom,
                model.x1,
                model.targetTop,
                model.targetTop + model.targetHeight,
                model.options
              );
              if (envelope) {
                competingGaps.push(verticalGapToBand(rect, envelope.top, envelope.bottom));
              }
            });
            const nearestCompetingGap = competingGaps.length ? Math.min(...competingGaps) : Infinity;
            if (nearestCompetingGap < minNearestCompetingGap) minNearestCompetingGap = nearestCompetingGap;
            if (Number.isFinite(nearestCompetingGap)) {
              const associationSafeMargin = scaleY(safeNumber(snapshot.layout?.positiveLabelAssociationSafeMarginY, 8));
              if (ownGap > nearestCompetingGap + associationSafeMargin) {
                hardAmbiguityCount += 1;
                proximityPenalty += (ownGap - nearestCompetingGap) * 1.15;
              } else if (nearestCompetingGap < scaleY(16)) {
                proximityPenalty += (scaleY(16) - nearestCompetingGap) * 0.9;
              }
            }
          });
          if (Number.isFinite(minNearestCompetingGap)) {
            const associationSafeMargin = scaleY(safeNumber(snapshot.layout?.positiveLabelAssociationSafeMarginY, 8));
            const contrastShortfall = ownGap + associationSafeMargin - minNearestCompetingGap;
            if (contrastShortfall > 0) {
              proximityPenalty += contrastShortfall * safeNumber(snapshot.layout?.positiveLabelAssociationContrastPenaltyFactor, 7.2);
              if (contrastShortfall > scaleY(6)) {
                hardAmbiguityCount += 1;
              }
            }
          }
          const sourceAssociationCenterY = positiveSourceTop + gainHeight / 2 - labelCenterBias;
          const labelAssociationCenterY = (rect.top + rect.bottom) / 2;
          const associationDistance = Math.abs(labelAssociationCenterY - sourceAssociationCenterY);
          const hardAssociationDistanceThreshold = Math.max(
            scaleY(
              safeNumber(
                snapshot.layout?.positiveLabelHardAssociationDistanceY,
                candidate.variant === "extreme-attached" || candidate.variant === "extreme-left" ? 170 : 88
              )
            ),
            labelBlockHeight + scaleY(16)
          );
          if (associationDistance > hardAssociationDistanceThreshold) {
            hardAmbiguityCount += 1;
            proximityPenalty += (associationDistance - hardAssociationDistanceThreshold) * 1.6;
          }
          const directionalPenalty =
            candidate.type === "below"
              ? safeNumber(snapshot.layout?.positiveLabelBelowDirectionalPenalty, 0.7)
              : candidate.type === "above"
                ? safeNumber(snapshot.layout?.positiveLabelAboveDirectionalPenalty, 0.7)
                : safeNumber(snapshot.layout?.positiveLabelLeftDirectionalPenalty, 2.4);
          const placementOrderPenalty = (() => {
            if (!(positiveAbove && positiveAdjustments.length > 1 && positiveLabelPreferredVerticalType)) return 0;
            if (candidate.type === "left") {
              return safeNumber(snapshot.layout?.positiveLabelMultiSplitLeftPenalty, 9);
            }
            return candidate.type === positiveLabelPreferredVerticalType
              ? 0
              : safeNumber(snapshot.layout?.positiveLabelWrongSplitSidePenalty, 18);
          })();
          const penalty =
            hardAmbiguityCount * safeNumber(snapshot.layout?.positiveLabelHardAmbiguityPenalty, 260) +
            proximityPenalty +
            associationDistance *
              safeNumber(
                snapshot.layout?.positiveLabelAssociationDistancePenaltyFactor,
                candidate.variant === "extreme-attached" || candidate.variant === "extreme-left" ? 0.02 : 0.1
              ) +
            directionalPenalty +
            placementOrderPenalty;
          return {
            penalty,
            hardAmbiguityCount,
          };
        };
        const positiveNodeCenterX = positiveNodeX + positiveNodeWidth / 2;
        const positiveLabelFollowMinX = opX + nodeWidth + positiveLabelMinLeftPad + positiveLabelWidthPadding;
        const positiveLabelFollowMaxX = width - 56 - labelBlockWidth - positiveLabelWidthPadding;
        const positiveLabelBranchFollowForwardX = clamp(
          positiveNodeX +
            positiveNodeWidth +
            scaleY(safeNumber(snapshot.layout?.positiveLabelBranchFollowOffsetX, 18)),
          positiveLabelFollowMinX,
          Math.max(positiveLabelFollowMinX, positiveLabelFollowMaxX)
        );
        const positiveLabelBacktrackMinX =
          opX + nodeWidth + positiveLabelMinLeftPad + labelBlockWidth + positiveLabelWidthPadding;
        const positiveLabelBranchFollowBacktrackX = clamp(
          positiveNodeX - scaleY(safeNumber(snapshot.layout?.positiveLabelBranchBacktrackOffsetX, 18)),
          positiveLabelBacktrackMinX,
          width - 56 - positiveLabelWidthPadding
        );
        const singlePositivePrefersLeftLabel =
          positiveAdjustments.length === 1 &&
          leftCorridor >= labelBlockWidth + safeNumber(snapshot.layout?.positiveSingleLabelMinLeftCorridorX, 34);
        const positiveLabelCandidatePriority = (type, variant = null) => {
          if (type === "left") {
            if (variant === "extreme-left") return -2.4;
            if (singlePositivePrefersLeftLabel) {
              return safeNumber(snapshot.layout?.positiveSingleLeftLabelPriority, -0.55);
            }
            return leftCorridor >= labelBlockWidth + safeNumber(snapshot.layout?.positiveLabelMinCorridorX, 72) ? 1.2 : 3.2;
          }
          let priority = type === "above" ? 0 : 0.1;
          if (positiveLabelPreferredVerticalType) {
            priority +=
              type === positiveLabelPreferredVerticalType
                ? safeNumber(snapshot.layout?.positiveLabelPreferredPlacementBonus, -0.18)
                : safeNumber(snapshot.layout?.positiveLabelAlternatePlacementPenalty, 0.32);
          }
          if (variant === "branch-follow") {
            priority += safeNumber(snapshot.layout?.positiveLabelBranchFollowPriorityOffset, 0.06);
          }
          return priority;
        };
        const candidatePlacements = [
          ...(preferExtremeLeftLabel
            ? [
                {
                  priority: -2.4,
                  type: "left",
                  anchor: "end",
                  x: positiveNodeX - scaleY(safeNumber(snapshot.layout?.positiveExtremeLeftLabelGapX, 22)),
                  centerY: positiveSourceTop +
                    gainHeight * safeNumber(snapshot.layout?.positiveExtremeLeftLabelSourceFactor, 0.18) -
                    labelCenterBias,
                  variant: "extreme-left",
                },
              ]
            : []),
          ...(positiveExtremeAttachedLabel
            ? [
                {
                  priority: preferExtremeLeftLabel ? 0.6 : -1.2,
                  type: "left",
                  anchor: "end",
                  x: positiveNodeX - labelGapX,
                  centerY: Math.max(
                    positiveSourceTop +
                      gainHeight * safeNumber(snapshot.layout?.positiveExtremeAttachedLabelSourceFactor, 0.12) -
                      labelCenterBias,
                    positiveHeaderLabelClearanceBottom + scaleY(safeNumber(snapshot.layout?.positiveExtremeAttachedHeaderGapY, 6)) - labelTopOffset
                  ),
                  variant: "extreme-attached",
                },
              ]
            : []),
          {
            priority: positiveLabelCandidatePriority("above"),
            type: "above",
            anchor: "middle",
            x: positiveNodeCenterX,
            centerY: abovePlacementBaseCenterY,
          },
          {
            priority: positiveLabelCandidatePriority("below"),
            type: "below",
            anchor: "middle",
            x: positiveNodeCenterX,
            centerY: belowPlacementBaseCenterY,
          },
          ...(positiveLabelPreferredVerticalType && positiveLabelFollowMaxX > positiveLabelFollowMinX + 2
            ? [
                {
                  priority: positiveLabelCandidatePriority(positiveLabelPreferredVerticalType, "branch-follow"),
                  type: positiveLabelPreferredVerticalType,
                  anchor: positiveLabelPreferredVerticalType === "below" ? "end" : "start",
                  x:
                    positiveLabelPreferredVerticalType === "below"
                      ? positiveLabelBranchFollowBacktrackX
                      : positiveLabelBranchFollowForwardX,
                  centerY: positiveLabelPreferredVerticalType === "above" ? abovePlacementBaseCenterY : belowPlacementBaseCenterY,
                  variant: "branch-follow",
                },
              ]
            : []),
          {
            priority: positiveLabelCandidatePriority("left"),
            type: "left",
            anchor: "end",
            x: positiveNodeX - labelGapX,
            centerY: positiveSourceTop + gainHeight / 2 - labelCenterBias,
          },
        ];
        const comparePlacement = (placement, baseline) => {
          if (!baseline) return true;
          if (placement.hardViolationCount !== baseline.hardViolationCount) {
            return placement.hardViolationCount < baseline.hardViolationCount;
          }
          if (placement.hardAmbiguityCount !== baseline.hardAmbiguityCount) {
            return placement.hardAmbiguityCount < baseline.hardAmbiguityCount;
          }
          const placementConflictPenalty = placement.collisionPenalty + placement.ambiguityPenalty;
          const baselineConflictPenalty = baseline.collisionPenalty + baseline.ambiguityPenalty;
          if (Math.abs(placementConflictPenalty - baselineConflictPenalty) > 0.001) {
            return placementConflictPenalty < baselineConflictPenalty;
          }
          return placement.score < baseline.score;
        };
        const evaluatePlacement = (candidate) => {
          const baseRect = labelBoundsRect(candidate.anchor, candidate.x, candidate.centerY);
          const positiveNodeObstacleRect = {
            left: positiveNodeX,
            right: positiveNodeX + positiveNodeWidth,
            top: positiveSourceTop,
            bottom: positiveSourceBottom,
          };
          const effectiveRibbonClearance =
            candidate.variant === "branch-follow" &&
            candidate.type === "below" &&
            positiveAbove &&
            positiveAdjustments.length > 1
              ? positiveLabelRibbonClearance * safeNumber(snapshot.layout?.positiveLabelBelowSplitClearanceFactor, 0.45)
              : candidate.variant === "extreme-attached" || candidate.variant === "extreme-left"
                ? positiveLabelRibbonClearance * safeNumber(snapshot.layout?.positiveExtremeAttachedRibbonClearanceFactor, 0.18)
              : positiveLabelRibbonClearance;
          const hardUpperBoundary = upperObstacleBottomForRect(baseRect) + effectiveRibbonClearance;
          const hardLowerBoundaryTop = lowerObstacleTopForRect(baseRect);
          const minCenterY = hardUpperBoundary - labelTopOffset;
          const maxCenterY = Number.isFinite(hardLowerBoundaryTop)
            ? hardLowerBoundaryTop - effectiveRibbonClearance - labelBottomOffset
            : chartBottomLimit - scaleY(6) - labelBottomOffset;
          if (!(maxCenterY >= minCenterY)) return null;
          const resolvedCenterY = clamp(candidate.centerY, minCenterY, maxCenterY);
          const rect = labelBoundsRect(candidate.anchor, candidate.x, resolvedCenterY);
          if (!labelRectIsValid(rect)) return null;
          if (rectsOverlap(rect, positiveNodeObstacleRect, positiveLabelObstaclePadding * 0.5)) return null;
          if (rect.top < hardUpperBoundary) return null;
          if (Number.isFinite(hardLowerBoundaryTop) && rect.bottom > hardLowerBoundaryTop - effectiveRibbonClearance) return null;
          const collision = collisionPenalty(rect);
          const ambiguity = associationAmbiguityPenalty(candidate, rect);
          const requiredVerticalSpace = labelBlockHeight + labelTopGapY + scaleY(4);
          const verticalAvailabilityPenalty =
            candidate.type === "above"
              ? Math.max(requiredVerticalSpace - availableAbove, 0) * 0.42
              : candidate.type === "below"
                ? Math.max(requiredVerticalSpace - availableBelow, 0) * 0.42
                : 0;
          const sourceMovePenalty = Math.abs(positiveSourceTop - (positiveTop + positiveSourceDropY)) * 0.06;
          const leftPlacementPenalty =
            candidate.type === "left"
              ? (candidate.variant === "extreme-attached" ? -3.4 : 0.9) +
                Math.max(
                  mergeRunway - scaleY(safeNumber(snapshot.layout?.positiveLabelPreferredLeftRunwayX, 46)),
                  0
                ) *
                  safeNumber(
                    snapshot.layout?.positiveLabelLeftRunwayPenaltyFactor,
                    candidate.variant === "extreme-attached" ? 0.006 : 0.03
                  )
              : 0;
          const score =
            candidate.priority +
            collision.penalty +
            ambiguity.penalty +
            branchClearanceScore.penalty * 0.32 +
            mergeDeltaShortfall * 0.42 +
            mergeRunway * 0.022 +
            verticalAvailabilityPenalty +
            leftPlacementPenalty +
            Math.abs(resolvedCenterY - candidate.centerY) * safeNumber(snapshot.layout?.positiveLabelCenterAdjustmentPenaltyFactor, 0.22) +
            sourceMovePenalty -
            Math.max(branchClearanceScore.minGap, 0) * 0.08;
          const hardViolationCount = collision.hardCollisionCount + ambiguity.hardAmbiguityCount;
          return {
            ...candidate,
            centerY: resolvedCenterY,
            rect,
            score,
            collisionPenalty: collision.penalty,
            ambiguityPenalty: ambiguity.penalty,
            hardAmbiguityCount: ambiguity.hardAmbiguityCount,
            hardViolationCount,
            hardCollisionCount: collision.hardCollisionCount,
            collisionFree: hardViolationCount === 0,
          };
        };
        let bestPlacement = null;
        candidatePlacements.forEach((candidate) => {
          const placement = evaluatePlacement(candidate);
          if (!placement) return;
          if (comparePlacement(placement, bestPlacement)) bestPlacement = placement;
        });
        if (preferExtremeLeftLabel) {
          const forcedCenterY = Math.max(
            positiveSourceTop +
              gainHeight * safeNumber(snapshot.layout?.positiveExtremeLeftLabelSourceFactor, 0.18) -
              labelCenterBias,
            positiveHeaderLabelClearanceBottom + scaleY(safeNumber(snapshot.layout?.positiveExtremeAttachedHeaderGapY, 6)) - labelTopOffset
          );
          const forcedX = positiveNodeX - scaleY(safeNumber(snapshot.layout?.positiveExtremeLeftLabelGapX, 22));
          bestPlacement = {
            type: "left",
            anchor: "end",
            x: forcedX,
            centerY: forcedCenterY,
            rect: labelBoundsRect("end", forcedX, forcedCenterY),
            score: -Infinity,
            collisionPenalty: 0,
            ambiguityPenalty: 0,
            hardAmbiguityCount: 0,
            hardViolationCount: 0,
            hardCollisionCount: 0,
            collisionFree: true,
            variant: "extreme-left",
          };
        }
        if (positiveAbove && positiveAdjustments.length === 2) {
          const forcedNodeCenteredCandidate =
            index === 0
              ? {
                  priority: -0.6,
                  type: "above",
                  anchor: "middle",
                  x: positiveNodeCenterX,
                  centerY: abovePlacementBaseCenterY,
                  variant: "node-centered",
                }
              : {
                  priority: -0.6,
                  type: "below",
                  anchor: "middle",
                  x: positiveNodeCenterX,
                  centerY: belowPlacementBaseCenterY,
                  variant: "node-centered",
                };
          const forcedNodeCenteredPlacement = evaluatePlacement(forcedNodeCenteredCandidate);
          if (
            forcedNodeCenteredPlacement &&
            (!bestPlacement ||
              forcedNodeCenteredPlacement.hardViolationCount === 0 ||
              bestPlacement.hardViolationCount > 0 ||
              bestPlacement.type !== forcedNodeCenteredCandidate.type ||
              bestPlacement.anchor !== "middle")
          ) {
            bestPlacement = forcedNodeCenteredPlacement;
          } else if (!forcedNodeCenteredPlacement) {
            const fallbackCenterY =
              index === 0
                ? clamp(
                    positiveSourceTop -
                      Math.max(
                        labelBlockHeight * safeNumber(snapshot.layout?.positiveLabelSplitFallbackOffsetFactor, 0.58),
                        scaleY(34)
                      ),
                    upperMetricFloor + scaleY(12) - labelTopOffset,
                    positiveSourceTop - scaleY(8) - labelBottomOffset
                  )
                : clamp(
                    positiveSourceBottom +
                      Math.max(
                        labelBlockHeight * safeNumber(snapshot.layout?.positiveLabelSplitFallbackOffsetFactor, 0.58),
                        scaleY(34)
                      ),
                    positiveSourceBottom + scaleY(10) - labelTopOffset,
                    chartBottomLimit - scaleY(6) - labelBottomOffset
                  );
            bestPlacement = {
              ...(bestPlacement || {}),
              type: forcedNodeCenteredCandidate.type,
              anchor: "middle",
              x: positiveNodeCenterX,
              centerY: fallbackCenterY,
            };
          }
        }
        if (!bestPlacement) {
          const fallbackCandidates = [
            {
              type: "above",
              anchor: "middle",
              x: positiveNodeCenterX,
              centerY: abovePlacementBaseCenterY,
            },
            {
              type: "below",
              anchor: "middle",
              x: positiveNodeCenterX,
              centerY: belowPlacementBaseCenterY,
            },
            {
              type: "left",
              anchor: "end",
              x: positiveNodeX - labelGapX - 24,
              centerY: positiveSourceTop + gainHeight / 2 - labelCenterBias,
            },
          ];
          const resolvedFallback = fallbackCandidates
            .map((candidate) => {
              const rect = labelBoundsRect(candidate.anchor, candidate.x, candidate.centerY);
              if (!labelRectIsValid(rect)) return null;
              const hardUpperBoundary = upperObstacleBottomForRect(rect) + positiveLabelRibbonClearance;
              if (rect.top < hardUpperBoundary) return null;
              const hardLowerBoundaryTop = lowerObstacleTopForRect(rect);
              if (Number.isFinite(hardLowerBoundaryTop) && rect.bottom > hardLowerBoundaryTop - positiveLabelRibbonClearance) return null;
              return {
                ...candidate,
                rect,
              };
            })
            .find(Boolean);
          const fallbackPlacement = resolvedFallback || {
            type: "left",
            anchor: "end",
            x: positiveNodeX - labelGapX,
            centerY: clamp(
              Math.max(
                positiveSourceTop + gainHeight * safeNumber(snapshot.layout?.positiveExtremeFallbackLabelSourceFactor, positiveExtremeAttachedLabel ? 0.12 : positiveAbove ? 0.28 : 0.5) - labelCenterBias,
                positiveHeaderLabelClearanceBottom + scaleY(safeNumber(snapshot.layout?.positiveFallbackHeaderGapY, 8)) - labelTopOffset
              ),
              positiveHeaderLabelClearanceBottom + scaleY(safeNumber(snapshot.layout?.positiveFallbackHeaderGapY, 8)) - labelTopOffset,
              chartBottomLimit - scaleY(6) - labelBottomOffset
            ),
            rect: null,
          };
          fallbackPlacement.rect = labelBoundsRect(fallbackPlacement.anchor, fallbackPlacement.x, fallbackPlacement.centerY);
          bestPlacement = {
            ...fallbackPlacement,
            score: 9_999_999,
            collisionPenalty: 0,
            ambiguityPenalty: 0,
            hardAmbiguityCount: 0,
            hardViolationCount: 0,
            hardCollisionCount: 0,
            collisionFree: true,
          };
        }
        return {
          sourceTop: positiveSourceTop,
          sourceBottom: positiveSourceBottom,
          branchPenalty: branchClearanceScore.penalty,
          branchMinGap: branchClearanceScore.minGap,
          mergeDeltaShortfall,
          mergeDeltaY,
          placement: bestPlacement,
        };
      };
      const lockedSourceTop = clamp(
        positiveTop + positiveSourceDropY,
        sourceTopSearchMin,
        usesExtremePositiveTopLane
          ? Math.min(
              sourceTopSearchMax,
              operatingLaneTop - extremePositiveTopLaneBottomGapY - gainHeight
            )
          : sourceTopSearchMax
      );
      const chosenLayout = resolvePositivePlacement(lockedSourceTop);
      const finalSourceTop = chosenLayout?.sourceTop ?? lockedSourceTop;
      const finalSourceBottom = chosenLayout?.sourceBottom ?? finalSourceTop + gainHeight;
      const chosenPlacement = chosenLayout?.placement || {
        anchor: "middle",
        x: positiveNodeX + positiveNodeWidth / 2,
        centerY: finalSourceTop - labelTopGapY - labelBottomOffset,
      };
      const positiveNodeId = `positive-${index}`;
      const positiveFrame = editableNodeFrame(positiveNodeId, positiveNodeX, finalSourceTop, positiveNodeWidth, gainHeight);
      const positiveShift = editorOffsetForNode(positiveNodeId);
      positiveMarkup += `<path d="${flowPath(
        positiveFrame.right,
        positiveFrame.top,
        positiveFrame.bottom,
        netFrame.x + positiveTargetInsetX,
        adjustedTargetTop,
        adjustedTargetTop + adjustedTargetHeight,
        positiveBranchPathOptions
      )}" fill="${greenFlow}" opacity="0.97"></path>`;
      positiveMarkup += renderEditableNodeRect(positiveFrame, greenNode);
      const forceLeftCenteredLabel = snapshot.layout?.positiveLabelPlacement === "left-center";
      const alignSingleLeftLabelToNode =
        (positiveNeedsVisibleMergeAngle || positiveSmallAdjustmentStrength > 0) &&
        positiveAdjustments.length === 1 &&
        chosenPlacement.type === "left" &&
        snapshot.layout?.positiveSingleLeftLabelFollowNodeCenter !== false;
      const useLeftCenteredLabel = forceLeftCenteredLabel || alignSingleLeftLabelToNode;
      const labelAnchor = useLeftCenteredLabel ? "end" : chosenPlacement.anchor;
      const labelX = useLeftCenteredLabel
        ? positiveFrame.x - labelGapX
        : chosenPlacement.x + positiveShift.dx;
      let labelCenterY = useLeftCenteredLabel
        ? positiveFrame.centerY - labelCenterBias
        : chosenPlacement.centerY + positiveShift.dy;
      let chosenLabelRect = labelBoundsRect(labelAnchor, labelX, labelCenterY);
      placedPositiveLabelRects.forEach((placedRect) => {
        const overlapsHorizontally =
          chosenLabelRect.left < placedRect.right + positiveLabelInterLabelPadding &&
          chosenLabelRect.right > placedRect.left - positiveLabelInterLabelPadding;
        const overlapsVertically =
          chosenLabelRect.top < placedRect.bottom + positiveLabelInterLabelPadding &&
          chosenLabelRect.bottom > placedRect.top - positiveLabelInterLabelPadding;
        if (!overlapsHorizontally || !overlapsVertically) return;
        const shiftDownY = placedRect.bottom + positiveLabelInterLabelPadding - chosenLabelRect.top;
        labelCenterY = clamp(
          labelCenterY + shiftDownY,
          positiveHeaderLabelClearanceBottom - labelTopOffset,
          chartBottomLimit - scaleY(6) - labelBottomOffset
        );
        chosenLabelRect = labelBoundsRect(labelAnchor, labelX, labelCenterY);
      });
      placedPositiveLabelRects.push(chosenLabelRect);
      positiveMarkup += `<text x="${labelX}" y="${labelCenterY - twoLineGap}" text-anchor="${labelAnchor}" font-size="${positiveNameSize}" font-weight="700" fill="${greenText}" paint-order="stroke fill" stroke="${background}" stroke-width="7" stroke-linejoin="round">${escapeHtml(localizedPositiveName)}</text>`;
      positiveMarkup += `<text x="${labelX}" y="${labelCenterY + valueYOffset}" text-anchor="${labelAnchor}" font-size="${positiveValueSize}" font-weight="700" fill="${greenText}" paint-order="stroke fill" stroke="${background}" stroke-width="6" stroke-linejoin="round">${escapeHtml(labelValue)}</text>`;
      positiveTop = finalSourceTop + gainHeight + positiveGap;
      netPositiveCursor += mergeHeight;
    });
  }

  if (coreNetHeight > 0 && coreNetTargetHeight > 0) {
    svg += `<path d="${netBridgePath(
      operatingFrame.right,
      opNetBand.top,
      opNetBand.bottom,
      netFrame.x,
      netDisplayBand.top,
      netDisplayBand.bottom
    )}" fill="${netLoss ? redFlow : greenFlow}" opacity="0.97"></path>`;
  }
  svg += positiveMarkup;
  svg += renderNetLossDriverBridge();
  svg += `
      ${renderEditableNodeRect(netFrame, netLoss ? redNode : greenNode)}
      ${renderRightSummaryLabel(netSummaryLines, netFrame.x + nodeWidth + rightPrimaryLabelGapX, netFrame.centerY)}
  `;

  deductionSlices.forEach((slice, index) => {
    if (useNetLossBalanceBridge) return;
    if (index === netLossDriverIndex) return;
    const box = deductionBoxes[index];
    const sourceSlice = deductionSourceSlices[index] || slice;
    const deductionSourceSlice = resolveDeductionTerminalSourceSlice(index, sourceSlice);
    const bridge = constantThicknessBridge(
      deductionSourceSlice,
      box.center,
      0,
      opDeductionSourceBand.top,
      opDeductionSourceBand.bottom
    );
    const deductionFrame = editableNodeFrame(`deduction-${index}`, rightTerminalNodeX, bridge.targetTop, nodeWidth, bridge.targetHeight);
    const operatingShift = editorOffsetForNode("operating");
    const deductionBranchOptions = resolveAdaptiveNegativeTerminalBranchOptions(
      resolveDeductionTerminalBranchOptions(index),
      bridge.sourceTop + operatingShift.dy,
      bridge.sourceBottom + operatingShift.dy,
      deductionFrame.y,
      deductionFrame.height,
      {
        index,
        count: Math.max(deductionSlices.length + opexSlices.length, 1),
        laneBias: index === 0 ? 0.1 : 0.06,
      }
    );
    svg += renderTerminalCapRibbon({
      sourceX: operatingFrame.right,
      sourceTop: bridge.sourceTop + operatingShift.dy,
      sourceBottom: bridge.sourceBottom + operatingShift.dy,
      capX: deductionFrame.x,
      capWidth: nodeWidth,
      targetTop: deductionFrame.y,
      targetHeight: deductionFrame.height,
      flowColor: redFlow,
      capColor: redNode,
      branchOptions: deductionBranchOptions,
    });
    svg += renderEditableNodeRect(deductionFrame, redNode);
    svg += renderRightBranchLabel(slice.item, box, deductionFrame.x, nodeWidth, redText, {
      labelId: `deduction-${index}`,
      density: deductionSlices.length >= 3 ? "dense" : "regular",
      defaultMode: "negative-parentheses",
      labelX: Math.max(negativeTerminalLabelX, deductionFrame.right + rightBranchLabelGapX),
      lockLabelCenterY: true,
      labelCenterY: deductionFrame.centerY,
      avoidFlowModel: {
        x0: operatingFrame.right - Math.max(safeNumber(deductionBranchOptions.sourceCoverInsetX, safeNumber(snapshot.layout?.branchSourceCoverInsetX, 1.5)), 0),
        x1: deductionFrame.x + safeNumber(deductionBranchOptions.targetCoverInsetX, safeNumber(snapshot.layout?.branchTargetCoverInsetX, 14)),
        sourceTop: bridge.sourceTop + operatingShift.dy,
        sourceBottom: bridge.sourceBottom + operatingShift.dy,
        targetTop: deductionFrame.y,
        targetHeight: deductionFrame.height,
        options: mergeOutflowRibbonOptions(deductionBranchOptions),
      },
    });
  });
  const costBreakdownBlocks = costBreakdownSlices.map((slice, index) => {
    const box = costBreakdownBoxes[index];
    const sourceSlice = costBreakdownSourceSlices[index] || slice;
    const bridge = constantThicknessBridge(sourceSlice, box.center, 10, costTop, costBottom);
    return {
      ...sourceSlice,
      box,
      bridge,
    };
  });
  if (costBreakdownBlocks.length === 2 && costBreakdownBlocks.every(Boolean)) {
    svg += renderSharedTrunkCostBreakdownPair(costBreakdownBlocks[0], costBreakdownBlocks[1]);
  } else {
    costBreakdownBlocks.forEach((block, index) => {
      svg += renderCostBreakdownBlock(block, block.bridge.targetTop, block.bridge.targetHeight, index);
    });
  }
  opexSlices.forEach((slice, index) => {
    const box = opexBoxes[index];
    const sourceSlice = opexSourceSlices[index] || slice;
    const bridge = constantThicknessBridge(sourceSlice, box.center, 14, opexTop, opexBottom);
    svg += renderRightExpenseBlock(
      opexTargetX,
      nodeWidth,
      {
        ...sourceSlice,
        box,
        bridge,
      },
      bridge.targetTop,
      bridge.targetHeight,
      opexLabelX,
      redFlow,
      index
    );
  });

  svg += renderOperatingProfitBreakdownCallout();

  svg += `
    ${renderCorporateLogo(snapshot.companyLogoKey, logoX, logoY, { scale: logoScale })}
    ${renderRevenueLabelMarkup()}
    ${renderOpexSummaryMarkup()}
  `;

  svg += `</g>${renderReplicaFooter(snapshot)}</svg>`;
  return svg;
}
