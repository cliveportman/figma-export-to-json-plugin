// Figma "Export to JSON" plugin
// Fully serializes frames, components, component sets, instances, and groups.
// Handles the common issue where component instances export as empty stubs by
// recursing into the full node tree and resolving instance children.

figma.showUI(__html__, { width: 420, height: 560, title: "Export to JSON" });

// ---------- Paint serializer ----------

function serializePaint(paint) {
  var result = { type: paint.type };

  // Only include visible/opacity/blendMode when non-default
  if (paint.visible === false) result.visible = false;
  if (paint.opacity !== undefined && paint.opacity !== 1) result.opacity = paint.opacity;
  if (paint.blendMode && paint.blendMode !== "NORMAL") result.blendMode = paint.blendMode;

  switch (paint.type) {
    case "SOLID":
      result.color = paint.color;
      break;
    case "GRADIENT_LINEAR":
    case "GRADIENT_RADIAL":
    case "GRADIENT_ANGULAR":
    case "GRADIENT_DIAMOND":
      result.gradientStops = paint.gradientStops;
      result.gradientTransform = paint.gradientTransform;
      break;
    case "IMAGE":
      result.scaleMode = paint.scaleMode;
      result.imageHash = paint.imageHash;
      if (paint.imageTransform) result.imageTransform = paint.imageTransform;
      if (paint.scalingFactor !== undefined) result.scalingFactor = paint.scalingFactor;
      if (paint.rotation) result.rotation = paint.rotation;
      if (paint.filters) result.filters = paint.filters;
      break;
    case "VIDEO":
      result.videoHash = paint.videoHash;
      break;
  }

  return result;
}

function trySerializePaints(node, key) {
  try {
    const val = node[key];
    if (!val || val === figma.mixed) return undefined;
    return val.map(serializePaint);
  } catch (_) {
    return undefined;
  }
}

// ---------- Text segment serializer ----------
// Handles mixed-style text nodes by serializing each styled run separately.

function serializeTextNode(node) {
  const result = {};

  result.characters = node.characters;

  // Resolve text style to human-readable name
  try {
    var textStyleId = node.textStyleId;
    if (textStyleId && textStyleId !== figma.mixed) {
      var textStyle = figma.getStyleById(textStyleId);
      if (textStyle) result.textStyle = textStyle.name;
    }
  } catch (_) {}

  // Try uniform value first; fall back to styled segments
  const scalarProps = [
    "fontSize",
    "fontWeight",
    "textAlignHorizontal",
    "textAlignVertical",
    "textAutoResize",
    "textTruncation",
    "letterSpacing",
    "lineHeight",
    "textCase",
    "textDecoration",
    "paragraphIndent",
    "paragraphSpacing",
    "hangingPunctuation",
    "hangingList",
    "listSpacing",
    "hyperlink",
  ];

  for (const prop of scalarProps) {
    try {
      const val = node[prop];
      if (val === figma.mixed) {
        result[prop] = "mixed";
      } else if (val !== undefined) {
        result[prop] = val;
      }
    } catch (_) {}
  }

  try {
    const fontName = node.fontName;
    result.fontName = fontName === figma.mixed ? "mixed" : fontName;
  } catch (_) {}

  // Styled segments — only included when text has mixed styles
  try {
    var segments = node.getStyledTextSegments([
      "fontSize",
      "fontName",
      "fontWeight",
      "textDecoration",
      "textCase",
      "lineHeight",
      "letterSpacing",
      "fills",
      "textStyleId",
      "fillStyleId",
      "hyperlink",
    ]);
    if (segments.length > 1) result.styledSegments = segments;
  } catch (_) {}

  return result;
}

// ---------- Effect serializer ----------

function serializeEffect(effect) {
  // Effects are plain objects — safe to spread as-is
  return Object.assign({}, effect);
}

// ---------- Main node serializer ----------

function serializeNode(node) {
  const result = {
    id: node.id,
    name: node.name,
    type: node.type,
  };

  // --- Visibility / lock ---
  if ("visible" in node) result.visible = node.visible;
  if ("locked" in node) result.locked = node.locked;
  if ("opacity" in node) result.opacity = node.opacity;
  if ("blendMode" in node) result.blendMode = node.blendMode;
  if ("isMask" in node) result.isMask = node.isMask;
  if ("isAsset" in node) result.isAsset = node.isAsset;

  // --- Geometry ---
  if ("x" in node) result.x = node.x;
  if ("y" in node) result.y = node.y;
  if ("width" in node) result.width = node.width;
  if ("height" in node) result.height = node.height;
  if ("maxWidth" in node && node.maxWidth !== null) result.maxWidth = node.maxWidth;
  if ("maxHeight" in node && node.maxHeight !== null) result.maxHeight = node.maxHeight;
  if ("minWidth" in node && node.minWidth !== null) result.minWidth = node.minWidth;
  if ("minHeight" in node && node.minHeight !== null) result.minHeight = node.minHeight;
  if ("rotation" in node) result.rotation = node.rotation;
  if ("absoluteBoundingBox" in node) result.absoluteBoundingBox = node.absoluteBoundingBox;

  // --- Constraints ---
  if ("constraints" in node) result.constraints = node.constraints;
  if ("constraintProportions" in node) result.constraintProportions = node.constraintProportions;
  if ("layoutPositioning" in node) result.layoutPositioning = node.layoutPositioning;
  if ("layoutAlign" in node) result.layoutAlign = node.layoutAlign;
  if ("layoutGrow" in node) result.layoutGrow = node.layoutGrow;
  if ("layoutSizingHorizontal" in node) result.layoutSizingHorizontal = node.layoutSizingHorizontal;
  if ("layoutSizingVertical" in node) result.layoutSizingVertical = node.layoutSizingVertical;

  // --- Fills & strokes ---
  // Resolve named styles first; only fall back to raw paint data when no style is applied
  try {
    var fillStyleId = node.fillStyleId;
    if (fillStyleId && fillStyleId !== figma.mixed) {
      var fillStyle = figma.getStyleById(fillStyleId);
      if (fillStyle) result.fillStyle = fillStyle.name;
    }
  } catch (_) {}

  if (!result.fillStyle) {
    const fills = trySerializePaints(node, "fills");
    if (fills !== undefined) result.fills = fills;
  }

  try {
    var strokeStyleId = node.strokeStyleId;
    if (strokeStyleId && strokeStyleId !== figma.mixed) {
      var strokeStyle = figma.getStyleById(strokeStyleId);
      if (strokeStyle) result.strokeStyle = strokeStyle.name;
    }
  } catch (_) {}

  if (!result.strokeStyle) {
    const strokes = trySerializePaints(node, "strokes");
    if (strokes !== undefined) result.strokes = strokes;
  }

  const scalarStrokeProps = [
    "strokeWeight",
    "strokeAlign",
    "strokeCap",
    "strokeJoin",
    "strokeMiterLimit",
    "strokeDashes",
    "dashPattern",
  ];
  for (const p of scalarStrokeProps) {
    try {
      if (p in node) {
        const v = node[p];
        if (v !== figma.mixed) result[p] = v;
      }
    } catch (_) {}
  }

  // --- Corners ---
  const cornerProps = [
    "cornerRadius",
    "topLeftRadius",
    "topRightRadius",
    "bottomLeftRadius",
    "bottomRightRadius",
    "cornerSmoothing",
  ];
  for (const p of cornerProps) {
    try {
      if (p in node) {
        const v = node[p];
        result[p] = v === figma.mixed ? "mixed" : v;
      }
    } catch (_) {}
  }

  // --- Effects ---
  if ("effects" in node) {
    try {
      result.effects = node.effects.map(serializeEffect);
    } catch (_) {}
  }

  // --- Auto layout (frame-like nodes) ---
  const autoLayoutProps = [
    "layoutMode",
    "layoutWrap",
    "primaryAxisSizingMode",
    "counterAxisSizingMode",
    "primaryAxisAlignItems",
    "counterAxisAlignItems",
    "counterAxisAlignContent",
    "paddingLeft",
    "paddingRight",
    "paddingTop",
    "paddingBottom",
    "itemSpacing",
    "counterAxisSpacing",
    "itemReverseZIndex",
    "strokesIncludedInLayout",
    "clipsContent",
    "overflowDirection",
  ];
  for (const p of autoLayoutProps) {
    try {
      if (p in node) result[p] = node[p];
    } catch (_) {}
  }

  // --- Layout grids ---
  if ("layoutGrids" in node) {
    try {
      result.layoutGrids = node.layoutGrids;
    } catch (_) {}
  }

  // --- Background ---
  const backgrounds = trySerializePaints(node, "backgrounds");
  if (backgrounds !== undefined) result.backgrounds = backgrounds;

  // --- Export settings ---
  if ("exportSettings" in node) {
    try {
      result.exportSettings = node.exportSettings;
    } catch (_) {}
  }

  // --- Type-specific properties ---

  if (node.type === "TEXT") {
    Object.assign(result, serializeTextNode(node));
  }

  if (node.type === "ELLIPSE") {
    try { result.arcData = node.arcData; } catch (_) {}
  }

  if (node.type === "POLYGON" || node.type === "STAR") {
    try { result.pointCount = node.pointCount; } catch (_) {}
    if (node.type === "STAR") {
      try { result.innerRadius = node.innerRadius; } catch (_) {}
    }
  }

  if (node.type === "BOOLEAN_OPERATION") {
    result.booleanOperation = node.booleanOperation;
  }

  if (node.type === "VECTOR") {
    // vectorNetwork/vectorPaths are raw bezier data — too verbose for design specs
  }

  if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
    try {
      // componentPropertyDefinitions gives you variant/property definitions
      result.componentPropertyDefinitions = node.componentPropertyDefinitions;
    } catch (_) {}

    if (node.type === "COMPONENT_SET") {
      // Each variant is a COMPONENT child — handled via children below
      try { result.variantGroupProperties = node.variantGroupProperties; } catch (_) {}
    }
  }

  if (node.type === "INSTANCE") {
    // Capture which master component this is an instance of
    try {
      if (node.mainComponent) {
        result.mainComponent = {
          id: node.mainComponent.id,
          name: node.mainComponent.name,
          key: node.mainComponent.key,
          remote: node.mainComponent.remote,
        };
      }
    } catch (_) {}

    // componentProperties contains override values (text, boolean, instance-swap, etc.)
    try {
      result.componentProperties = node.componentProperties;
    } catch (_) {}
  }

  if (node.type === "SECTION") {
    try { result.sectionContentsHidden = node.sectionContentsHidden; } catch (_) {}
  }

  // --- Children (recurse into full tree) ---
  // This is the key fix: COMPONENT, INSTANCE, GROUP, SECTION, FRAME all have children.
  // Most plugins skip recursion for INSTANCE, causing the "empty JSON" problem.
  if ("children" in node && node.children.length > 0) {
    result.children = node.children.map((child) => serializeNode(child));
  }

  return result;
}

// ---------- Strip defaults ----------
// Removes noise: default values, empty arrays/objects, and redundant properties.

var SCALAR_DEFAULTS = {
  visible: true,
  locked: false,
  opacity: 1,
  isMask: false,
  isAsset: false,
  rotation: 0,
  strokeCap: "NONE",
  strokeJoin: "MITER",
  strokeMiterLimit: 4,
  itemReverseZIndex: false,
  strokesIncludedInLayout: false,
  clipsContent: false,
  overflowDirection: "NONE",
  cornerSmoothing: 0,
  layoutGrow: 0,
  counterAxisSpacing: 0,
  layoutWrap: "NO_WRAP",
  counterAxisAlignContent: "AUTO",
  layoutPositioning: "AUTO",
  sectionContentsHidden: false,
  layoutMode: "NONE",
  // Text defaults
  textCase: "ORIGINAL",
  textDecoration: "NONE",
  textTruncation: "DISABLED",
  textAlignVertical: "TOP",
  textAlignHorizontal: "LEFT",
  paragraphIndent: 0,
  paragraphSpacing: 0,
  hangingPunctuation: false,
  hangingList: false,
  listSpacing: 0,
};

// Keys we always drop — either redundant or canvas-position data
var ALWAYS_DROP = {
  absoluteBoundingBox: true,
  exportSettings: true,
  backgrounds: true,   // redundant with fills on frame-like nodes
  layoutGrids: true,   // keep only if non-empty (handled below)
  textStyleId: true,   // replaced by resolved textStyle name
  fillStyleId: true,   // replaced by resolved fillStyle name
  strokeStyleId: true, // replaced by resolved strokeStyle name
};

// Stroke geometry is noise when the node has no strokes
var STROKE_ONLY = {
  strokeWeight: true,
  strokeAlign: true,
  strokeCap: true,
  strokeJoin: true,
  strokeMiterLimit: true,
  dashPattern: true,
};

function isEmptyArray(v) {
  return Array.isArray(v) && v.length === 0;
}

function isEmptyObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0;
}

function stripNode(obj) {
  var hasStrokes = Array.isArray(obj.strokes) && obj.strokes.length > 0;
  var result = {};

  for (var key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;

    // Always-drop list
    if (ALWAYS_DROP[key]) continue;

    var val = obj[key];

    // Nulls
    if (val === null || val === undefined) continue;

    // Empty arrays
    if (isEmptyArray(val)) continue;

    // Empty objects
    if (isEmptyObject(val)) continue;

    // Stroke-only props when there are no strokes
    if (!hasStrokes && STROKE_ONLY[key]) continue;

    // Known scalar defaults
    if (key in SCALAR_DEFAULTS && val === SCALAR_DEFAULTS[key]) continue;

    // blendMode: PASS_THROUGH and NORMAL are both "invisible default" blends
    if (key === "blendMode" && (val === "PASS_THROUGH" || val === "NORMAL")) continue;

    // Zero letter spacing is the default
    if (key === "letterSpacing" && val && val.value === 0) continue;

    // AUTO line height is the default
    if (key === "lineHeight" && val && val.unit === "AUTO") continue;

    // boundVariables and hyperlink are noise when empty/null
    if (key === "boundVariables" && isEmptyObject(val)) continue;
    if (key === "hyperlink" && val === null) continue;

    // Recurse
    if (key === "children" && Array.isArray(val)) {
      result.children = val.map(stripNode);
      continue;
    }

    result[key] = val;
  }

  // Drop auto-layout props when there is no auto layout — they're meaningless
  if (result.layoutMode === "NONE" || !result.layoutMode) {
    delete result.layoutMode;
    delete result.primaryAxisSizingMode;
    delete result.counterAxisSizingMode;
    delete result.primaryAxisAlignItems;
    delete result.counterAxisAlignItems;
    delete result.counterAxisAlignContent;
    delete result.paddingLeft;
    delete result.paddingRight;
    delete result.paddingTop;
    delete result.paddingBottom;
    delete result.itemSpacing;
    delete result.counterAxisSpacing;
    delete result.layoutWrap;
    delete result.itemReverseZIndex;
    delete result.strokesIncludedInLayout;
  }

  // Corner radius consolidation
  // All zero → drop everything
  var cr = result.cornerRadius;
  var tl = result.topLeftRadius;
  var tr = result.topRightRadius;
  var bl = result.bottomLeftRadius;
  var br = result.bottomRightRadius;

  var allZero = (cr === 0 || cr === undefined) &&
                (tl === 0 || tl === undefined) &&
                (tr === 0 || tr === undefined) &&
                (bl === 0 || bl === undefined) &&
                (br === 0 || br === undefined);

  if (allZero) {
    delete result.cornerRadius;
    delete result.topLeftRadius;
    delete result.topRightRadius;
    delete result.bottomLeftRadius;
    delete result.bottomRightRadius;
  } else if (cr !== undefined && tl === cr && tr === cr && bl === cr && br === cr) {
    // Uniform radius → just keep cornerRadius
    delete result.topLeftRadius;
    delete result.topRightRadius;
    delete result.bottomLeftRadius;
    delete result.bottomRightRadius;
  }

  return result;
}

// ---------- Message handler ----------

figma.ui.onmessage = (msg) => {
  if (msg.type === "export") {
    const selection = figma.currentPage.selection;

    if (selection.length === 0) {
      figma.ui.postMessage({
        type: "error",
        message: "Select a frame, component, or instance first.",
      });
      return;
    }

    if (selection.length > 1) {
      figma.ui.postMessage({
        type: "error",
        message: "Select only one node at a time.",
      });
      return;
    }

    const node = selection[0];
    const supported = [
      "FRAME",
      "COMPONENT",
      "COMPONENT_SET",
      "INSTANCE",
      "GROUP",
      "SECTION",
      "BOOLEAN_OPERATION",
    ];

    if (!supported.includes(node.type)) {
      figma.ui.postMessage({
        type: "error",
        message: `"${node.type}" nodes can't be exported as structured JSON. Select a frame, component, or group.`,
      });
      return;
    }

    try {
      const data = stripNode(serializeNode(node));
      figma.ui.postMessage({
        type: "result",
        json: JSON.stringify(data, null, 2),
        nodeName: node.name,
        nodeType: node.type,
      });
    } catch (err) {
      figma.ui.postMessage({
        type: "error",
        message: "Export failed: " + err.message,
      });
    }
  }

  if (msg.type === "close") {
    figma.closePlugin();
  }
};
