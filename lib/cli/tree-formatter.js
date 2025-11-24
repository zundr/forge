/**
 * Tree Formatter Module
 * Formats Forge window tree structure with Unicode box-drawing characters
 */

/**
 * Get Unicode prefix for tree visualization
 * @param {number} depth - Current depth in tree
 * @param {boolean} isLast - Whether this is the last child
 * @param {boolean[]} isLastArray - Array tracking if ancestors are last children
 * @returns {string} Unicode prefix string
 */
function getPrefix(depth, isLast, isLastArray) {
  if (depth === 0) {
    return "";
  }

  let prefix = "";

  // Build prefix based on ancestor positions
  for (let i = 0; i < isLastArray.length; i++) {
    if (isLastArray[i]) {
      prefix += "    "; // No vertical line for last children
    } else {
      prefix += "│   "; // Vertical line for non-last children
    }
  }

  // Add branch character for current node
  if (isLast) {
    prefix += "└── ";
  } else {
    prefix += "├── ";
  }

  return prefix;
}

/**
 * Format node attributes based on type and options
 * @param {Object} node - Tree node
 * @param {Object} options - Formatting options
 * @returns {string} Formatted attributes string
 */
function formatAttributes(node, options = {}) {
  const parts = [];

  // Format based on node type
  if (node.nodeType === "WINDOW") {
    const metaWindow = node.nodeValue;
    const wmClass = metaWindow.get_wm_class ? metaWindow.get_wm_class() : "unknown";
    const title = metaWindow.get_title ? metaWindow.get_title() : "unknown";
    const id = metaWindow.get_id ? metaWindow.get_id() : "unknown";

    parts.push(`class:${wmClass}`);
    parts.push(`title:"${title}"`);
    parts.push(`id:${id}`);

    // Add mode if requested
    if (options.mode || options.verbose) {
      parts.push(`mode:${node.mode}`);
    }

    // Add rect if requested
    if ((options.rect || options.verbose) && node.rect) {
      const r = node.rect;
      parts.push(`rect:${r.width}x${r.height}+${r.x}+${r.y}`);
    }
  } else if (node.nodeType === "CON" || node.nodeType === "MONITOR") {
    // Always show layout for containers, optionally for monitors
    if (node.layout) {
      parts.push(`[${node.layout}]`);
    }

    // Add rect if requested
    if ((options.rect || options.verbose) && node.rect) {
      const r = node.rect;
      parts.push(`rect:${r.width}x${r.height}+${r.x}+${r.y}`);
    }
  }

  return parts.join(" ");
}

/**
 * Format a single node with proper indentation
 * @param {Object} node - Tree node
 * @param {number} depth - Current depth in tree
 * @param {boolean} isLast - Whether this is the last child
 * @param {boolean[]} isLastArray - Array tracking if ancestors are last children
 * @param {Object} options - Formatting options
 * @returns {string} Formatted node string
 */
function formatNode(node, depth, isLast, isLastArray, options = {}) {
  const prefix = getPrefix(depth, isLast, isLastArray);
  const nodeType = node.nodeType;
  const nodeValue = node.nodeValue;

  let line = prefix + nodeType;

  // Add node value for non-window types
  if (nodeType === "WORKSPACE" || nodeType === "MONITOR") {
    line += " " + nodeValue;
  } else if (nodeType === "CON") {
    // Container doesn't need to show its value (St.Bin object)
  }

  // Add attributes
  const attrs = formatAttributes(node, options);
  if (attrs) {
    line += " " + attrs;
  }

  return line;
}

/**
 * Format entire tree recursively
 * @param {Object} node - Root node of tree
 * @param {Object} options - Formatting options
 * @param {number} depth - Current depth (internal)
 * @param {boolean[]} isLastArray - Ancestor last-child tracking (internal)
 * @returns {string} Formatted tree string
 */
function formatTree(node, options = {}, depth = 0, isLastArray = []) {
  const lines = [];

  // Format current node
  const isLast = depth > 0 && isLastArray[isLastArray.length - 1];
  const line = formatNode(node, depth, isLast, isLastArray.slice(0, -1), options);
  lines.push(line);

  // Recursively format children
  if (node.childNodes && node.childNodes.length > 0) {
    node.childNodes.forEach((child, index) => {
      const isLastChild = index === node.childNodes.length - 1;
      const newIsLastArray = [...isLastArray, isLastChild];
      const childOutput = formatTree(child, options, depth + 1, newIsLastArray);
      lines.push(childOutput);
    });
  }

  return lines.join("\n");
}

// Export functions
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    formatTree,
    formatNode,
    getPrefix,
    formatAttributes,
  };
}
