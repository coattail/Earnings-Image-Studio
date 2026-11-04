// Label measurements and SVG annotations with explicit, per-call layout inputs.
const ReplicaAnnotations = Object.freeze({
  renderMetricCluster({ background, muted }, centerX, y, title, value, subline, deltaLine, color, layout) {
    return `
      <text x="${centerX}" y="${y}" text-anchor="middle" font-size="${layout.titleSize}" font-weight="700" fill="${color}" paint-order="stroke fill" stroke="${background}" stroke-width="${layout.titleStroke}" stroke-linejoin="round">${escapeHtml(localizeChartPhrase(title))}</text>
      <text x="${centerX}" y="${y + layout.valueOffset}" text-anchor="middle" font-size="${layout.valueSize}" font-weight="700" fill="${color}" paint-order="stroke fill" stroke="${background}" stroke-width="${layout.valueStroke}" stroke-linejoin="round">${escapeHtml(value)}</text>
      ${subline ? `<text x="${centerX}" y="${y + layout.subOffset}" text-anchor="middle" font-size="${layout.subSize}" fill="${muted}" paint-order="stroke fill" stroke="${background}" stroke-width="${layout.subStroke}" stroke-linejoin="round">${escapeHtml(localizeChartPhrase(subline))}</text>` : ""}
      ${deltaLine ? `<text x="${centerX}" y="${y + layout.deltaOffset}" text-anchor="middle" font-size="${layout.subSize}" fill="${muted}" paint-order="stroke fill" stroke="${background}" stroke-width="${layout.subStroke}" stroke-linejoin="round">${escapeHtml(deltaLine)}</text>` : ""}
    `;
  },

  metricClusterObstacleRect({ scaleY }, centerX, y, title, value, subline, deltaLine, layout, padding = scaleY(10)) {
    const localizedTitle = localizeChartPhrase(title);
    const localizedSubline = subline ? localizeChartPhrase(subline) : "";
    const widths = [
      approximateTextWidth(localizedTitle, layout.titleSize),
      approximateTextWidth(value, layout.valueSize),
      localizedSubline ? approximateTextWidth(localizedSubline, layout.subSize) : 0,
      deltaLine ? approximateTextWidth(deltaLine, layout.subSize) : 0,
    ];
    const blockWidth = Math.max(...widths, 1);
    const blockBottomBaseline = y + (deltaLine ? layout.deltaOffset : subline ? layout.subOffset : layout.valueOffset);
    const blockBottomSize = deltaLine || subline ? layout.subSize : layout.valueSize;
    return {
      left: centerX - blockWidth / 2 - padding,
      right: centerX + blockWidth / 2 + padding,
      top: y - layout.titleSize - padding,
      bottom: blockBottomBaseline + blockBottomSize * 0.42 + padding,
    };
  },

  resolveSourceMetricBaselines({ scaleY, sourceSlices }, slice, index, lineMetrics, options = {}) {
    if (!lineMetrics.length) return [];
    const minTop = scaleY(safeNumber(options.minTop, 188));
    const topPadding = scaleY(safeNumber(options.topPadding, 8));
    const bottomPadding = scaleY(safeNumber(options.bottomPadding, 10));
    const ribbonClearance = scaleY(safeNumber(options.ribbonClearance, 8));
    const verticalBias = clamp(safeNumber(options.verticalBias, 0.18), 0, 1);
    const prevBottom = index > 0 ? sourceSlices[index - 1].bottom : minTop - topPadding;
    const regionTop = Math.max(prevBottom + topPadding, minTop);
    const regionBottom = slice.top - bottomPadding - ribbonClearance;
    const blockHeight = lineMetrics.reduce((sum, line, lineIndex) => sum + line.fontSize + (lineIndex < lineMetrics.length - 1 ? line.gapAfter : 0), 0);
    const slack = Math.max(regionBottom - regionTop - blockHeight, 0);
    const top = regionTop + slack * verticalBias;
    let cursor = top;
    return lineMetrics.map((line, lineIndex) => {
      cursor += line.fontSize;
      const baseline = cursor;
      if (lineIndex < lineMetrics.length - 1) cursor += line.gapAfter;
      return baseline;
    });
  },

  renderSourceMetricBlock({ background, muted, showQoq }, item, x, anchor, baselines, sizes) {
    if (!baselines.length) return "";
    let block = `<text x="${x}" y="${baselines[0]}" text-anchor="${anchor}" font-size="${sizes.value}" font-weight="500" fill="${item.valueColor || muted}" paint-order="stroke fill" stroke="${background}" stroke-width="5" stroke-linejoin="round">${escapeHtml(formatSourceMetric(item))}</text>`;
    let lineIndex = 1;
    if (showQoq && item.qoqPct !== null && item.qoqPct !== undefined && baselines[lineIndex] !== undefined) {
      block += `<text x="${x}" y="${baselines[lineIndex]}" text-anchor="${anchor}" font-size="${sizes.qoq}" fill="${muted}" paint-order="stroke fill" stroke="${background}" stroke-width="4.5" stroke-linejoin="round">${escapeHtml(formatGrowthMetric(item.qoqPct, "qoq"))}</text>`;
      lineIndex += 1;
    }
    if (item.yoyPct !== null && item.yoyPct !== undefined && baselines[lineIndex] !== undefined) {
      block += `<text x="${x}" y="${baselines[lineIndex]}" text-anchor="${anchor}" font-size="${sizes.yoy}" fill="${muted}" paint-order="stroke fill" stroke="${background}" stroke-width="4.5" stroke-linejoin="round">${escapeHtml(formatGrowthMetric(item.yoyPct, "yoy"))}</text>`;
    }
    return block;
  },

  sourceTemplatePreset({  }, density = "regular", options = {}) {
    const detail = !!options.detail;
    if (density === "micro") {
      return {
        titleSize: detail ? 18 : 19,
        titleLineHeight: detail ? 21 : 22,
        subtitleSize: 12,
        subtitleLineHeight: 15,
        valueSize: 18,
        yoySize: 12,
        qoqSize: 12,
        metricGap: 3,
        metricBlockGap: 4,
      };
    }
    if (density === "compact" || density === "dense" || density === "ultra") {
      return {
        titleSize: detail ? 22 : 24,
        titleLineHeight: detail ? 25 : 27,
        subtitleSize: detail ? 13 : 14,
        subtitleLineHeight: detail ? 16 : 17,
        valueSize: detail ? 21 : 23,
        yoySize: detail ? 13 : 14,
        qoqSize: detail ? 13 : 14,
        metricGap: 4,
        metricBlockGap: 5,
      };
    }
    return {
      titleSize: detail ? 23 : 26,
      titleLineHeight: detail ? 26 : 29,
      subtitleSize: detail ? 13 : 14,
      subtitleLineHeight: detail ? 16 : 17,
      valueSize: detail ? 22 : 24,
      yoySize: detail ? 13 : 14,
      qoqSize: detail ? 13 : 14,
      metricGap: 4,
      metricBlockGap: 5,
    };
  },

  renderTemplateSourceAnnotation({ background, compactSources, dark, leftX, muted, scaleY, showQoq, sourceLabelX, sourceTemplatePreset }, item, slice, box, options = {}) {
    const density = options.density || item.layoutDensity || "regular";
    const preset = sourceTemplatePreset(density, options);
    const titleSize = safeNumber(options.titleSize, preset.titleSize);
    const titleLineHeight = safeNumber(options.titleLineHeight, preset.titleLineHeight);
    const subtitleSize = safeNumber(options.subtitleSize, preset.subtitleSize);
    const subtitleLineHeight = safeNumber(options.subtitleLineHeight, preset.subtitleLineHeight);
    const valueSize = safeNumber(options.valueSize, preset.valueSize);
    const yoySize = safeNumber(options.yoySize, preset.yoySize);
    const qoqSize = safeNumber(options.qoqSize, preset.qoqSize);
    const metricGap = safeNumber(options.metricGap, preset.metricGap);
    const metricBlockGap = safeNumber(options.metricBlockGap, preset.metricBlockGap);
    const labelLines = options.labelLines?.length
      ? localizeChartLines(options.labelLines)
      : resolveSourceLabelLines(item, {
          compactMode: compactSources || item.compactLabel,
          fontSize: titleSize,
          maxWidth: safeNumber(options.labelMaxWidth, currentChartLanguage() === "zh" ? 154 : 194),
          maxLines: currentChartLanguage() === "zh" ? 2 : 3,
        });
    const supportLines = resolveLocalizedSupportLines(item, options.supportLines, options.supportLinesZh);
    const titleColor = options.titleColor || item.labelColor || item.nodeColor || dark;
    const subtitleColor = options.subtitleColor || item.supportColor || muted;
    const valueColor = options.valueColor || item.valueColor || item.nodeColor || item.labelColor || dark;
    const labelX = safeNumber(options.labelX, sourceLabelX);
    const labelAnchor = options.labelAnchor || "start";
    const metricX = safeNumber(options.metricX, leftX - 12);
    const metricAnchor = options.metricAnchor || "end";
    const titleBlockHeight = labelLines.length * titleLineHeight;
    const subtitleGap = supportLines.length ? metricBlockGap : 0;
    const subtitleBlockHeight = supportLines.length ? supportLines.length * subtitleLineHeight : 0;
    const totalLabelHeight = titleBlockHeight + subtitleGap + subtitleBlockHeight;
    const clampLabelToBox = options.clampLabelToBox !== false;
    const labelCenterY = clampLabelToBox
      ? clamp(
          safeNumber(options.labelCenterY, slice.center),
          box.top + totalLabelHeight / 2,
          box.bottom - totalLabelHeight / 2
        )
      : safeNumber(options.labelCenterY, slice.center);
    const titleStartY = labelCenterY - totalLabelHeight / 2 + titleLineHeight * 0.8;
    const centeredWrappedLabel = labelLines.length > 1;
    const labelBlockWidth = approximateTextBlockWidth(labelLines, titleSize);
    const effectiveLabelAnchor = centeredWrappedLabel ? "middle" : labelAnchor;
    const effectiveLabelX =
      effectiveLabelAnchor === "middle"
        ? labelAnchor === "end"
          ? labelX - labelBlockWidth / 2
          : labelAnchor === "start"
            ? labelX + labelBlockWidth / 2
            : labelX
        : labelX;
    const metricLines = [
      {
        text: formatSourceMetric(item),
        size: valueSize,
        weight: 700,
        color: valueColor,
        strokeWidth: 6,
      },
    ];
    if (showQoq && item.qoqPct !== null && item.qoqPct !== undefined) {
      metricLines.push({
        text: formatGrowthMetric(item.qoqPct, "qoq"),
        size: qoqSize,
        weight: 500,
        color: muted,
        strokeWidth: 4.5,
      });
    }
    if (item.yoyPct !== null && item.yoyPct !== undefined) {
      metricLines.push({
        text: formatGrowthMetric(item.yoyPct, "yoy"),
        size: yoySize,
        weight: 500,
        color: muted,
        strokeWidth: 4.5,
      });
    }
    const metricBlockHeight = metricLines.reduce(
      (sum, line, lineIndex) => sum + line.size + (lineIndex < metricLines.length - 1 ? metricGap : 0),
      0
    );
    const metricPlacement = options.metricPlacement || "center";
    let metricTop;
    if (metricPlacement === "above-ribbon") {
      const metricTopPadding = scaleY(safeNumber(options.metricTopPadding, 10));
      const metricMinTop = scaleY(safeNumber(options.metricMinTop, 146));
      const ribbonTop = safeNumber(options.ribbonTop, slice.top);
      const previousRibbonBottom = options.previousRibbonBottom !== undefined && options.previousRibbonBottom !== null
        ? safeNumber(options.previousRibbonBottom)
        : null;
      const previousClearance = scaleY(safeNumber(options.metricPreviousClearance, 10));
      metricTop = safeNumber(options.metricTop, ribbonTop - metricTopPadding - metricBlockHeight);
      if (previousRibbonBottom !== null && previousRibbonBottom !== undefined) {
        metricTop = Math.max(metricTop, previousRibbonBottom + previousClearance);
      }
      metricTop = Math.max(metricTop, metricMinTop);
      metricTop = Math.min(metricTop, ribbonTop - scaleY(safeNumber(options.metricBottomClearance, 6)) - metricBlockHeight);
    } else {
      const metricCenterY = clamp(
        safeNumber(options.metricCenterY, slice.center),
        box.top + metricBlockHeight / 2,
        box.bottom - metricBlockHeight / 2
      );
      metricTop = metricCenterY - metricBlockHeight / 2;
    }
    let metricCursor = metricTop;
    let html = "";
    const collectTextBounds = (x, y, text, size, anchor, halo) => {
      if (!options.collectBounds) return;
      const textWidth = approximateTextWidth(text, size);
      const left = x - (anchor === "end" ? textWidth : anchor === "middle" ? textWidth / 2 : 0);
      options.collectBounds({ left: left - halo, right: left + textWidth + halo,
        top: y - size * 0.98 - halo, bottom: y + size * 0.28 + halo });
    };
    metricLines.forEach((line, lineIndex) => {
      metricCursor += line.size;
      collectTextBounds(metricX, metricCursor, line.text, line.size, metricAnchor, line.strokeWidth / 2);
      html += `<text x="${metricX}" y="${metricCursor}" text-anchor="${metricAnchor}" font-size="${line.size}" font-weight="${line.weight}" fill="${line.color}" paint-order="stroke fill" stroke="${background}" stroke-width="${line.strokeWidth}" stroke-linejoin="round">${escapeHtml(line.text)}</text>`;
      if (lineIndex < metricLines.length - 1) metricCursor += metricGap;
    });
    labelLines.forEach((line, index) => collectTextBounds(effectiveLabelX, titleStartY + index * titleLineHeight,
      line, titleSize, effectiveLabelAnchor, 2.5));
    html += svgTextBlock(effectiveLabelX, titleStartY, labelLines, {
      fill: titleColor,
      fontSize: titleSize,
      weight: 800,
      anchor: effectiveLabelAnchor,
      lineHeight: titleLineHeight,
      haloColor: background,
      haloWidth: 5,
    });
    if (supportLines.length) {
      supportLines.forEach((line, index) => collectTextBounds(effectiveLabelX,
        titleStartY + labelLines.length * titleLineHeight + subtitleGap + index * subtitleLineHeight,
        line, subtitleSize, effectiveLabelAnchor, 2));
      html += svgTextBlock(
        effectiveLabelX,
        titleStartY + labelLines.length * titleLineHeight + subtitleGap,
        supportLines,
        {
          fill: subtitleColor,
          fontSize: subtitleSize,
          weight: 500,
          anchor: effectiveLabelAnchor,
          lineHeight: subtitleLineHeight,
          haloColor: background,
          haloWidth: 4,
        }
      );
    }
    return html;
  },

  renderLeftDetailLabel({ compactSources, dark, detailSourceFlowPath, detailSourceLabelX, detailSourceMetricX, editableNodeFrame, editorOffsetForNode, leftDetailWidth, leftDetailX, leftX, renderEditableNodeRect, renderTemplateSourceAnnotation, snapshot, sourceSlices }, slice, box, index) {
    const item = slice.item;
    const detailNodeId = `left-detail-${index}`;
    const detailFrame = editableNodeFrame(detailNodeId, leftDetailX, slice.top, leftDetailWidth, slice.height);
    const targetIndex = sourceSlices.indexOf(slice.targetSlice);
    const targetNodeId = targetIndex >= 0 ? `source-${targetIndex}` : null;
    const targetShift = targetNodeId ? editorOffsetForNode(targetNodeId) : { dx: 0, dy: 0 };
    const detailShift = editorOffsetForNode(detailNodeId);
    const compactMode = compactSources || item.compactLabel;
    const labelLines = resolveSourceLabelLines(item, {
      compactMode,
      fontSize: safeNumber(snapshot.layout?.detailSourceTitleSize, safeNumber(snapshot.layout?.sourceTemplateTitleSize, 28)),
      maxWidth: currentChartLanguage() === "zh" ? 166 : 198,
    });
    const labelX = detailSourceLabelX + detailShift.dx;
    const metricX = detailSourceMetricX + detailShift.dx;
    let block = `<path d="${detailSourceFlowPath(detailFrame.right, detailFrame.top, detailFrame.bottom, leftX + targetShift.dx, slice.targetTop + targetShift.dy, slice.targetBottom + targetShift.dy)}" fill="${item.flowColor || slice.targetSlice.item.flowColor}" opacity="0.98"></path>`;
    block += renderEditableNodeRect(detailFrame, item.nodeColor || slice.targetSlice.item.nodeColor);
    block += renderTemplateSourceAnnotation(item, slice, box, {
      density: "regular",
      labelLines,
      supportLines: [],
      labelX,
      labelAnchor: "end",
      metricX,
      metricAnchor: "start",
      metricPlacement: "above-ribbon",
      previousRibbonBottom: box?.previousRibbonBottom ?? null,
      ribbonTop: detailFrame.top,
      labelCenterY: detailFrame.centerY,
      clampLabelToBox: false,
      titleSize: safeNumber(snapshot.layout?.detailSourceTitleSize, safeNumber(snapshot.layout?.sourceTemplateTitleSize, 28)),
      titleLineHeight: safeNumber(snapshot.layout?.detailSourceTitleLineHeight, safeNumber(snapshot.layout?.sourceTemplateTitleLineHeight, 31)),
      subtitleSize: safeNumber(snapshot.layout?.detailSourceSubtitleSize, safeNumber(snapshot.layout?.sourceTemplateSubtitleSize, 14)),
      subtitleLineHeight: safeNumber(snapshot.layout?.detailSourceSubtitleLineHeight, safeNumber(snapshot.layout?.sourceTemplateSubtitleLineHeight, 17)),
      valueSize: safeNumber(snapshot.layout?.detailSourceValueSize, safeNumber(snapshot.layout?.sourceTemplateValueSize, 24)),
      yoySize: safeNumber(snapshot.layout?.detailSourceYoySize, safeNumber(snapshot.layout?.sourceTemplateYoySize, 14)),
      qoqSize: safeNumber(snapshot.layout?.detailSourceQoqSize, safeNumber(snapshot.layout?.sourceTemplateQoqSize, 14)),
      titleColor: item.nodeColor || item.labelColor || dark,
      valueColor: item.nodeColor || item.valueColor || item.labelColor || dark,
    });
    return block;
  },

  renderLeftLabel({ compactSources, dark, editorOffsetForNode, leftX, renderTemplateSourceAnnotation, snapshot, sourceSlices, sourceSummaryLabelGapX, sourceTemplateLabelX, sourceTemplateMetricX, usesPreDetailRevenueLayout }, slice, box, index, annotationRects = null, offsetFor = editorOffsetForNode) {
    const item = slice.item;
    const sourceShift = offsetFor(`source-${index}`);
    const compactMode = compactSources || item.compactLabel;
    const labelLines = resolveSourceLabelLines(item, {
      compactMode,
      fontSize: safeNumber(snapshot.layout?.sourceTemplateTitleSize, 28),
      maxWidth: currentChartLanguage() === "zh" ? 166 : 198,
    });
    const labelX = safeNumber(slice.labelX, usesPreDetailRevenueLayout ? leftX - sourceSummaryLabelGapX : sourceTemplateLabelX) + sourceShift.dx;
    const metricX = safeNumber(slice.metricX, sourceTemplateMetricX) + sourceShift.dx;
    return `<g data-layout-source-label-id="source-${index}">` + renderTemplateSourceAnnotation(item, slice, box, {
      density: "regular",
      labelLines,
      supportLines: [],
      labelX,
      labelAnchor: "end",
      metricX,
      metricAnchor: "start",
      metricPlacement: "above-ribbon",
      collectBounds: annotationRects ? rect => annotationRects.push(rect) : null,
      previousRibbonBottom:
        index > 0
          ? safeNumber(sourceSlices[index - 1]?.bottom) + offsetFor(`source-${index - 1}`).dy
          : null,
      ribbonTop: slice.top + sourceShift.dy,
      labelCenterY: slice.center + sourceShift.dy,
      clampLabelToBox: false,
      titleSize: safeNumber(snapshot.layout?.sourceTemplateTitleSize, 28),
      titleLineHeight: safeNumber(snapshot.layout?.sourceTemplateTitleLineHeight, 31),
      subtitleSize: safeNumber(snapshot.layout?.sourceTemplateSubtitleSize, 14),
      subtitleLineHeight: safeNumber(snapshot.layout?.sourceTemplateSubtitleLineHeight, 17),
      valueSize: safeNumber(snapshot.layout?.sourceTemplateValueSize, 24),
      yoySize: safeNumber(snapshot.layout?.sourceTemplateYoySize, 14),
      qoqSize: safeNumber(snapshot.layout?.sourceTemplateQoqSize, 14),
      titleColor: item.nodeColor || item.labelColor || dark,
      valueColor: item.nodeColor || item.valueColor || item.labelColor || dark,
    }) + `</g>`;
  },

  renderTreeLabelBlock({ background, muted }, item, box, labelX, color, options = {}) {
    const baseLayout = box.layout || {};
    const resolvedDensity = options.density || baseLayout.density || (box.height <= 76 ? "dense" : "regular");
    const layout = replicaTreeBlockLayout(item, {
      density: resolvedDensity,
      defaultMode: options.defaultMode || "negative-parentheses",
      titleFontSize: safeNumber(options.titleFontSize, baseLayout.titleFontSize),
      titleLineHeight: safeNumber(options.titleLineHeight, baseLayout.titleLineHeight),
      noteFontSize: safeNumber(options.noteFontSize, baseLayout.noteFontSize),
      noteLineHeight: safeNumber(options.noteLineHeight, baseLayout.noteLineHeight),
      titleMaxWidth: options.maxWidth,
      noteMaxWidth: options.maxWidth,
      fallbackMinHeight: safeNumber(options.fallbackMinHeight, baseLayout.minHeight),
      topPadding: safeNumber(options.topPadding, baseLayout.topPadding),
      noteGap: safeNumber(options.noteGap, baseLayout.noteGap),
    });
    const titleLines =
      options.maxWidth && !item?.titleLines?.length
        ? resolveBranchTitleLines(item, options.defaultMode || "negative-parentheses", layout.titleFontSize, options.maxWidth)
        : localizeChartLines(layout.titleLines);
    const noteLines =
      options.maxWidth && !item?.noteLines?.length
        ? resolveTreeNoteLines(item, layout.density, layout.noteFontSize, options.maxWidth)
        : localizeChartLines(layout.noteLines);
    const titleBlockHeight = titleLines.length * layout.titleLineHeight;
    const noteOffsetY = clamp(
      safeNumber(options.noteOffsetY, 0),
      -Math.max(layout.titleLineHeight * 0.5, 0),
      Math.max(layout.noteLineHeight, 0)
    );
    const effectiveNoteGap = noteLines.length ? layout.noteGap + noteOffsetY : 0;
    const noteBlockHeight = noteLines.length ? noteLines.length * layout.noteLineHeight + effectiveNoteGap : 0;
    const totalBlockHeight = titleBlockHeight + noteBlockHeight;
    const labelCenterY = safeNumber(options.labelCenterY, box.center);
    const titleStartY = labelCenterY - totalBlockHeight / 2 + layout.titleLineHeight * 0.8;
    const defaultAnchor = options.anchor || "start";
    const shouldCenterWrapped = options.centerWrapped !== false && (titleLines.length > 1 || noteLines.length > 1);
    const effectiveAnchor = shouldCenterWrapped ? "middle" : defaultAnchor;
    const titleBlockWidth = approximateTextBlockWidth(titleLines, layout.titleFontSize);
    const noteBlockWidth = approximateTextBlockWidth(noteLines, layout.noteFontSize);
    const effectiveBlockWidth = Math.max(titleBlockWidth, noteBlockWidth, 0);
    const effectiveLabelX =
      effectiveAnchor === "middle" && defaultAnchor === "start"
        ? labelX + Math.min(effectiveBlockWidth, safeNumber(options.maxWidth, effectiveBlockWidth || 0)) / 2
        : labelX;
    let html = svgTextBlock(effectiveLabelX, titleStartY, titleLines, {
      fill: color,
      fontSize: layout.titleFontSize,
      weight: 700,
      anchor: effectiveAnchor,
      lineHeight: layout.titleLineHeight,
      haloColor: background,
      haloWidth: 7,
    });
    if (noteLines.length) {
      html += svgTextBlock(
        effectiveLabelX,
        titleStartY + titleBlockHeight + effectiveNoteGap,
        noteLines,
        {
          fill: muted,
          fontSize: layout.noteFontSize,
          weight: 400,
          anchor: effectiveAnchor,
          lineHeight: layout.noteLineHeight,
          haloColor: background,
          haloWidth: 5,
        }
      );
    }
    return html;
  },

  resolveRightBranchLabelSpec({ rightBranchLabelGapX, rightLabelPaddingRight, snapshot, width }, item, terminalNodeX, terminalNodeWidth, options = {}) {
    const labelX = safeNumber(options.labelX, terminalNodeX + terminalNodeWidth + rightBranchLabelGapX);
    const baseMaxWidth = Math.max(safeNumber(options.maxWidth, width - labelX - rightLabelPaddingRight), 120);
    const density = options.density || "regular";
    const titleFontSize = safeNumber(options.titleFontSize, safeNumber(snapshot.layout?.sourceTemplateTitleSize, 28));
    const titleLineHeight = safeNumber(
      options.titleLineHeight,
      safeNumber(snapshot.layout?.sourceTemplateTitleLineHeight, Math.max(Math.round(titleFontSize * 1.1), titleFontSize + 2))
    );
    const localizedTitle = currentChartLanguage() === "zh" ? localizeChartItemName(item) : String(item?.name || "");
    const configuredWrapMaxWidth = safeNumber(
      options.wrapMaxWidth,
      currentChartLanguage() === "zh"
        ? safeNumber(snapshot.layout?.rightBranchWrapMaxWidthZh, 136)
        : safeNumber(snapshot.layout?.rightBranchWrapMaxWidthEn, 196)
    );
    let wrapMaxWidth = Math.min(baseMaxWidth, configuredWrapMaxWidth);
    if (currentChartLanguage() === "zh" && localizedTitle && isCjkLabelText(localizedTitle)) {
      const condensedTitle = localizedTitle.replace(/\s+/g, "");
      const titleCharCount = [...condensedTitle].filter((char) => !/[()]/.test(char)).length;
      const shortSingleLineChars = Math.max(
        1,
        safeNumber(snapshot.layout?.rightBranchShortCjkSingleLineChars, density === "dense" ? 6 : 7)
      );
      const mediumSingleLineChars = Math.max(
        shortSingleLineChars,
        safeNumber(snapshot.layout?.rightBranchMediumCjkSingleLineChars, shortSingleLineChars + 1)
      );
      const desiredSingleLineWidth =
        approximateTextWidth(localizedTitle, titleFontSize) +
        safeNumber(snapshot.layout?.rightBranchShortCjkSingleLinePadX, 12);
      if (titleCharCount <= shortSingleLineChars) {
        wrapMaxWidth = Math.min(baseMaxWidth, Math.max(wrapMaxWidth, desiredSingleLineWidth));
      } else if (
        titleCharCount <= mediumSingleLineChars &&
        desiredSingleLineWidth <=
          baseMaxWidth * clamp(safeNumber(snapshot.layout?.rightBranchMediumCjkSingleLineWidthUtilization, 0.92), 0.72, 1)
      ) {
        wrapMaxWidth = Math.min(baseMaxWidth, Math.max(wrapMaxWidth, desiredSingleLineWidth));
      }
    }
    const sharedGrowthNoteSize = safeNumber(
      snapshot.layout?.sourceTemplateYoySize,
      safeNumber(snapshot.layout?.sourceTemplateQoqSize, 14)
    );
    const sharedGrowthNoteLineHeight = Math.max(
      safeNumber(snapshot.layout?.sourceTemplateSubtitleLineHeight, currentChartLanguage() === "zh" ? 17 : 18),
      sharedGrowthNoteSize + (currentChartLanguage() === "zh" ? 3 : 4)
    );
    const noteFontSize = safeNumber(options.noteFontSize, sharedGrowthNoteSize);
    const noteLineHeight = safeNumber(options.noteLineHeight, sharedGrowthNoteLineHeight);
    const noteGap = safeNumber(
      options.noteGap,
      safeNumber(snapshot.layout?.rightBranchNoteGapY, currentChartLanguage() === "zh" ? 2 : 3)
    );
    const noteOffsetY = safeNumber(
      options.noteOffsetY,
      safeNumber(snapshot.layout?.rightBranchNoteOffsetY, currentChartLanguage() === "zh" ? -12 : -10)
    );
    const layout = replicaTreeBlockLayout(item, {
      density,
      defaultMode: options.defaultMode || "negative-parentheses",
      titleFontSize,
      titleLineHeight,
      noteFontSize,
      noteLineHeight,
      noteGap,
      titleMaxWidth: wrapMaxWidth,
      noteMaxWidth: wrapMaxWidth,
      fallbackMinHeight: safeNumber(options.fallbackMinHeight, density === "dense" ? 42 : 52),
    });
    const titleLines =
      options.maxWidth && !item?.titleLines?.length
        ? resolveBranchTitleLines(item, options.defaultMode || "negative-parentheses", titleFontSize, wrapMaxWidth)
        : localizeChartLines(layout.titleLines);
    const noteLines =
      options.maxWidth && !item?.noteLines?.length
        ? resolveTreeNoteLines(item, layout.density, noteFontSize, wrapMaxWidth)
        : localizeChartLines(layout.noteLines);
    return {
      labelX,
      maxWidth: wrapMaxWidth,
      titleFontSize,
      titleLineHeight,
      noteFontSize,
      noteLineHeight,
      noteGap,
      noteOffsetY,
      blockWidth: Math.max(
        approximateTextBlockWidth(titleLines, titleFontSize),
        approximateTextBlockWidth(noteLines, noteFontSize),
        1
      ),
      collisionHeight: Math.max(
        safeNumber(options.minCollisionHeight, 0),
        layout.totalHeight + noteOffsetY + safeNumber(options.collisionPaddingY, currentChartLanguage() === "zh" ? 18 : 14)
      ),
    };
  },

  sampleXsAcrossRect({  }, rect, minX, maxX, count = 9) {
    if (!rect) return [];
    const left = clamp(rect.left + 1, minX, maxX);
    const right = clamp(rect.right - 1, minX, maxX);
    if (!(right >= left)) return [];
    if (right <= left + 0.5) return [left];
    return Array.from({ length: count }, (_unused, index) =>
      clamp(left + ((right - left) * index) / Math.max(count - 1, 1), minX, maxX)
    ).filter((value, index, values) => Number.isFinite(value) && (index === 0 || Math.abs(value - values[index - 1]) > 0.5));
  },

  resolveRightBranchLabelCenterY({ sampleXsAcrossRect, scaleY }, labelSpec, preferredCenterY, options = {}) {
    if (options.lockLabelCenterY) return preferredCenterY;
    const flowModel = options.avoidFlowModel;
    if (!flowModel) return preferredCenterY;
    const clearanceY = Math.max(scaleY(safeNumber(options.ribbonClearanceY, 10)), 0);
    const labelPadX = scaleY(safeNumber(options.labelPadX, 8));
    const maxAutoShiftY = scaleY(safeNumber(options.maxAutoShiftY, 42));
    let minCenterY = safeNumber(options.minLabelCenterY, preferredCenterY - maxAutoShiftY);
    let maxCenterY = safeNumber(options.maxLabelCenterY, preferredCenterY + maxAutoShiftY);
    const collisionBandCenterY = Number.isFinite(Number(options.collisionBandCenterY))
      ? Number(options.collisionBandCenterY)
      : preferredCenterY;
    const collisionBandHeight = Math.max(safeNumber(options.collisionBandHeight, 0), 0);
    if (collisionBandHeight > 0) {
      const bandShiftAllowanceY = Math.max((collisionBandHeight - labelSpec.collisionHeight) / 2, 0);
      minCenterY = Math.max(minCenterY, collisionBandCenterY - bandShiftAllowanceY);
      maxCenterY = Math.min(maxCenterY, collisionBandCenterY + bandShiftAllowanceY);
    }
    if (!(maxCenterY >= minCenterY)) return preferredCenterY;
    const rectForCenterY = (centerY) => ({
      left: labelSpec.labelX - labelPadX,
      right: labelSpec.labelX + labelSpec.blockWidth + labelPadX,
      top: centerY - labelSpec.collisionHeight / 2,
      bottom: centerY + labelSpec.collisionHeight / 2,
    });
    const overlapScore = (centerY) => {
      const rect = rectForCenterY(centerY);
      const sampleXs = sampleXsAcrossRect(
        rect,
        Math.min(flowModel.x0, flowModel.x1),
        Math.max(flowModel.x0, flowModel.x1)
      );
      let hitCount = 0;
      let overlapDepth = 0;
      sampleXs.forEach((sampleX) => {
        const envelope = flowEnvelopeAtX(
          sampleX,
          flowModel.x0,
          flowModel.sourceTop,
          flowModel.sourceBottom,
          flowModel.x1,
          flowModel.targetTop,
          flowModel.targetTop + flowModel.targetHeight,
          flowModel.options
        );
        if (!envelope) return;
        const overlapTop = Math.max(rect.top, envelope.top - clearanceY);
        const overlapBottom = Math.min(rect.bottom, envelope.bottom + clearanceY);
        const overlap = overlapBottom - overlapTop;
        if (overlap > 0) {
          hitCount += 1;
          overlapDepth += overlap;
        }
      });
      return {
        hitCount,
        overlapDepth,
        shiftDistance: Math.abs(centerY - preferredCenterY),
      };
    };
    const candidateStepY = Math.max(scaleY(safeNumber(options.candidateStepY, 8)), 4);
    const candidateCenters = [preferredCenterY, minCenterY, maxCenterY];
    for (let offsetY = candidateStepY; offsetY <= maxAutoShiftY + 0.5; offsetY += candidateStepY) {
      candidateCenters.push(preferredCenterY - offsetY, preferredCenterY + offsetY);
    }
    const resolvedCandidateCenters = candidateCenters
      .map((value) => clamp(value, minCenterY, maxCenterY))
      .filter((value, index, values) => values.findIndex((candidate) => Math.abs(candidate - value) < 0.5) === index);
    let bestCenterY = preferredCenterY;
    let bestScore = null;
    resolvedCandidateCenters.forEach((candidateCenterY) => {
      const score = overlapScore(candidateCenterY);
      if (
        !bestScore ||
        score.hitCount < bestScore.hitCount ||
        (score.hitCount === bestScore.hitCount && score.overlapDepth < bestScore.overlapDepth - 0.01) ||
        (score.hitCount === bestScore.hitCount &&
          Math.abs(score.overlapDepth - bestScore.overlapDepth) <= 0.01 &&
          score.shiftDistance < bestScore.shiftDistance)
      ) {
        bestCenterY = candidateCenterY;
        bestScore = score;
      }
    });
    return bestCenterY;
  },

  renderRightBranchLabel({ renderTreeLabelBlock, resolveRightBranchLabelCenterY, resolveRightBranchLabelSpec }, item, box, terminalNodeX, terminalNodeWidth, color, options = {}) {
      const labelSpec = resolveRightBranchLabelSpec(item, terminalNodeX, terminalNodeWidth, options);
      const preferredLabelCenterY = safeNumber(options.labelCenterY, box.center);
      const resolvedLabelCenterY = resolveRightBranchLabelCenterY(labelSpec, preferredLabelCenterY, {
        ...options,
        collisionBandCenterY: safeNumber(options.collisionBandCenterY, box.center),
        collisionBandHeight: safeNumber(options.collisionBandHeight, box.height),
      });
      const markup = renderTreeLabelBlock(item, box, labelSpec.labelX, color, {
        ...options,
        anchor: "start",
        centerWrapped: options.centerWrapped !== false,
        maxWidth: labelSpec.maxWidth,
        titleFontSize: labelSpec.titleFontSize,
        titleLineHeight: labelSpec.titleLineHeight,
        noteFontSize: labelSpec.noteFontSize,
        noteLineHeight: labelSpec.noteLineHeight,
        noteGap: labelSpec.noteGap,
        noteOffsetY: labelSpec.noteOffsetY,
        labelCenterY: resolvedLabelCenterY,
      });
      return options.labelId ? `<g data-layout-label-id="${escapeHtml(options.labelId)}">${markup}</g>` : markup;
    },

  renderRightSummaryLabel({ background }, lines, labelX, labelCenterY) {
    const blockHeight = lines.reduce((sum, line, index) => sum + line.size + (index < lines.length - 1 ? line.gapAfter : 0), 0);
    let cursor = labelCenterY - blockHeight / 2;
    return lines
      .map((line, index) => {
        cursor += line.size;
        const markup = `<text x="${labelX}" y="${cursor}" text-anchor="start" font-size="${line.size}" font-weight="${line.weight}" fill="${line.color}" paint-order="stroke fill" stroke="${background}" stroke-width="${line.strokeWidth}" stroke-linejoin="round">${escapeHtml(line.text)}</text>`;
        if (index < lines.length - 1) cursor += line.gapAfter;
        return markup;
      })
      .join("");
  },

  rightSummaryObstacleRect({ scaleY }, lines, labelX, labelCenterY, padding = scaleY(10)) {
    const blockHeight = lines.reduce((sum, line, index) => sum + line.size + (index < lines.length - 1 ? line.gapAfter : 0), 0);
    const blockWidth = Math.max(...lines.map((line) => approximateTextWidth(line.text, line.size)), 1);
    return {
      left: labelX - padding,
      right: labelX + blockWidth + padding,
      top: labelCenterY - blockHeight / 2 - padding,
      bottom: labelCenterY + blockHeight / 2 + padding,
    };
  },

  resolveAdaptiveNegativeTerminalBranchOptions({ scaleY }, baseOptions, sourceTop, sourceBottom, targetTop, targetHeight, options = {}) {
    const sourceCenter = (safeNumber(sourceTop, 0) + safeNumber(sourceBottom, 0)) / 2;
    const targetCenter = safeNumber(targetTop, 0) + safeNumber(targetHeight, 0) / 2;
    const deltaY = Math.abs(targetCenter - sourceCenter);
    const count = Math.max(safeNumber(options.count, 1), 1);
    const index = clamp(safeNumber(options.index, 0), 0, Math.max(count - 1, 0));
    const laneBias = safeNumber(options.laneBias, 0);
    const orderNorm = count <= 1 ? 0 : index / Math.max(count - 1, 1);
    const countNorm = clamp((count - 1) / 3, 0, 1);
    const deltaNorm = clamp(deltaY / scaleY(safeNumber(options.referenceDeltaY, 196)), 0, 1.8);
    const divergenceStrength = clamp(
      deltaNorm * safeNumber(options.deltaStrengthFactor, 0.92) +
        orderNorm * safeNumber(options.orderStrengthFactor, 0.28) +
        laneBias +
        countNorm * safeNumber(options.countStrengthFactor, 0.14),
      0,
      1.32
    );
    const minSourceHoldLength = Math.max(
      0,
      safeNumber(baseOptions.minSourceHoldLength, 0) -
        safeNumber(options.minSourceHoldReduction, 7) * divergenceStrength
    );
    const maxSourceHoldLength = Math.max(
      minSourceHoldLength,
      safeNumber(baseOptions.maxSourceHoldLength, minSourceHoldLength) -
        safeNumber(options.maxSourceHoldReduction, 12) * divergenceStrength
    );
    return {
      ...baseOptions,
      curveFactor: clamp(
        safeNumber(baseOptions.curveFactor, 0.56) + safeNumber(options.curveFactorGain, 0.08) * divergenceStrength,
        0.5,
        0.9
      ),
      startCurveFactor: clamp(
        safeNumber(baseOptions.startCurveFactor, 0.18) + safeNumber(options.startCurveGain, 0.14) * divergenceStrength,
        safeNumber(baseOptions.minStartCurveFactor, 0.14),
        safeNumber(baseOptions.maxStartCurveFactor, 0.28) + safeNumber(options.maxStartCurveBoost, 0.08) * divergenceStrength
      ),
      endCurveFactor: clamp(
        safeNumber(baseOptions.endCurveFactor, 0.3) + safeNumber(options.endCurveGain, 0.1) * divergenceStrength,
        safeNumber(baseOptions.minEndCurveFactor, 0.2),
        safeNumber(baseOptions.maxEndCurveFactor, 0.34) + safeNumber(options.maxEndCurveBoost, 0.08) * divergenceStrength
      ),
      minStartCurveFactor: clamp(
        safeNumber(baseOptions.minStartCurveFactor, 0.14) + safeNumber(options.minStartCurveGain, 0.05) * divergenceStrength,
        0.08,
        0.42
      ),
      maxStartCurveFactor: clamp(
        safeNumber(baseOptions.maxStartCurveFactor, 0.28) + safeNumber(options.maxStartCurveGain, 0.08) * divergenceStrength,
        0.16,
        0.52
      ),
      minEndCurveFactor: clamp(
        safeNumber(baseOptions.minEndCurveFactor, 0.2) + safeNumber(options.minEndCurveGain, 0.04) * divergenceStrength,
        0.14,
        0.42
      ),
      maxEndCurveFactor: clamp(
        safeNumber(baseOptions.maxEndCurveFactor, 0.34) + safeNumber(options.maxEndCurveGain, 0.08) * divergenceStrength,
        0.24,
        0.58
      ),
      deltaScale: clamp(
        safeNumber(baseOptions.deltaScale, 0.96) - safeNumber(options.deltaScaleReduction, 0.1) * divergenceStrength,
        0.68,
        1.08
      ),
      deltaInfluence: clamp(
        safeNumber(baseOptions.deltaInfluence, 0.042) + safeNumber(options.deltaInfluenceGain, 0.022) * divergenceStrength,
        0.018,
        0.14
      ),
      sourceHoldFactor: clamp(
        safeNumber(baseOptions.sourceHoldFactor, 0.03) - safeNumber(options.sourceHoldReduction, 0.022) * divergenceStrength,
        0.004,
        0.08
      ),
      minSourceHoldLength,
      maxSourceHoldLength,
      sourceHoldDeltaReduction: clamp(
        safeNumber(baseOptions.sourceHoldDeltaReduction, 0.72) + safeNumber(options.sourceDeltaReductionGain, 0.12) * divergenceStrength,
        0,
        0.96
      ),
      holdDeltaScale: clamp(
        safeNumber(baseOptions.holdDeltaScale, 0.46) - safeNumber(options.holdDeltaScaleReduction, 0.08) * divergenceStrength,
        0.24,
        0.7
      ),
    };
  },
});
