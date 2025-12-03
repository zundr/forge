# Tree System

> Deep dive into `lib/extension/tree.js` (~45KB)

## Overview

The tree system implements a hierarchical data structure for window layout, similar to i3-wm. Each node represents a workspace, monitor, container, or window.

---

## Node Types

```javascript
NODE_TYPES = {
  ROOT,       // Single root node
  WORKSPACE,  // Virtual desktop (ws0, ws1, ...)
  MONITOR,    // Physical display (mo0ws0 = monitor 0, workspace 0)
  CON,        // Container grouping windows
  WINDOW      // Leaf node with Meta.Window
}
```

## Layout Types

```javascript
LAYOUT_TYPES = {
  ROOT,     // Root node layout
  HSPLIT,   // Horizontal split (side-by-side)
  VSPLIT,   // Vertical split (stacked vertically)
  STACKED,  // Windows overlap, tabs visible
  TABBED,   // Windows overlap, tabs at top
  PRESET    // Preset layout
}
```

---

## Tree Structure

```
ROOT
├── WORKSPACE (ws0)
│   ├── MONITOR (mo0ws0) [HSPLIT]
│   │   ├── WINDOW (Terminal) [TILE]
│   │   └── CON [VSPLIT]
│   │       ├── WINDOW (Browser) [TILE]
│   │       └── WINDOW (Editor) [TILE]
│   └── MONITOR (mo1ws0) [TABBED]
│       ├── WINDOW (Music) [TILE]
│       └── WINDOW (Chat) [TILE]
└── WORKSPACE (ws1)
    └── MONITOR (mo0ws1)
        └── WINDOW (Video) [TILE]
```

**Naming Convention**:
- `ws0`, `ws1` - Workspace indices
- `mo0ws0` - Monitor 0 on workspace 0
- `mo1ws0` - Monitor 1 on workspace 0

---

## Node Class

### Properties

```javascript
class Node {
  _type;        // NODE_TYPES enum
  _data;        // Meta.Window or string ID
  _parent;      // Parent node reference
  _nodes;       // Child nodes array
  mode;         // WINDOW_MODES enum
  percent;      // Size percentage (0.0-1.0)
  _rect;        // Calculated rectangle {x, y, width, height}
  layout;       // LAYOUT_TYPES for containers
  tab;          // Tab widget for tabbed/stacked
  decoration;   // Decoration widget
  renderRect;   // Final rect after gap processing
}
```

### Key Methods

```javascript
// Getters
get nodeType()    // Returns _type
get nodeValue()   // Returns _data (Meta.Window or ID)
get parentNode()  // Returns _parent
get childNodes()  // Returns _nodes array
get rect()        // Returns calculated rectangle

// Type checks
isWindow()        // nodeType === WINDOW
isCon()           // nodeType === CON
isMonitor()       // nodeType === MONITOR
isWorkspace()     // nodeType === WORKSPACE

// Tree manipulation
addChild(node)    // Add child node
removeChild(node) // Remove child node
appendChild(node) // Move node to end of children
insertBefore(node, reference) // Insert before reference
```

---

## Tree Class

Extends `Node` as the root of the tree.

### Initialization

```javascript
class Tree extends Node {
  constructor(extWm) {
    super(NODE_TYPES.ROOT, rootBin);
    this.extWm = extWm;
    this._initWorkspaces();
  }
  
  _initWorkspaces() {
    let numWorkspaces = global.workspace_manager.get_n_workspaces();
    for (let i = 0; i < numWorkspaces; i++) {
      this.addWorkspace(i);
    }
  }
}
```

### Workspace/Monitor Management

```javascript
addWorkspace(wsIndex) {
  let wsNode = new Node(NODE_TYPES.WORKSPACE, `ws${wsIndex}`);
  this.addChild(wsNode);
  this.addMonitors(wsNode, wsIndex);
}

addMonitors(wsNode, wsIndex) {
  let numMonitors = global.display.get_n_monitors();
  for (let i = 0; i < numMonitors; i++) {
    let moNode = new Node(NODE_TYPES.MONITOR, `mo${i}ws${wsIndex}`);
    moNode.layout = LAYOUT_TYPES.HSPLIT;  // Default layout
    wsNode.addChild(moNode);
  }
}

removeWorkspace(wsIndex) {
  let wsNode = this.findNode(`ws${wsIndex}`);
  if (wsNode) {
    this.removeChild(wsNode);
  }
}
```

---

## Rendering Pipeline

### render(from)

Three-phase rendering:

```javascript
render(from) {
  // Phase 1: Calculate positions
  this.processNode(this);
  
  // Phase 2: Apply to windows
  this.apply(this);
  
  // Phase 3: Cleanup orphans
  this.cleanTree(this);
}
```

### Phase 1: processNode()

Recursive position calculation:

```javascript
processNode(node) {
  if (node.nodeType === NODE_TYPES.ROOT || 
      node.nodeType === NODE_TYPES.WORKSPACE) {
    // Just recurse into children
    node.childNodes.forEach(child => this.processNode(child));
    return;
  }
  
  if (node.nodeType === NODE_TYPES.MONITOR || 
      node.nodeType === NODE_TYPES.CON) {
    // Get workarea for this monitor
    node.rect = this._getWorkArea(node);
    
    // Get tiled children only
    let tiledChildren = node.childNodes.filter(
      n => n.mode === WINDOW_MODES.TILE
    );
    
    if (tiledChildren.length === 0) return;
    
    // Compute sizes based on layout
    let sizes = this.computeSizes(node, tiledChildren);
    
    // Process each child
    tiledChildren.forEach((child, index) => {
      switch (node.layout) {
        case LAYOUT_TYPES.HSPLIT:
          this.processSplitH(node, child, sizes, index);
          break;
        case LAYOUT_TYPES.VSPLIT:
          this.processSplitV(node, child, sizes, index);
          break;
        case LAYOUT_TYPES.STACKED:
          this.processStacked(node, child, sizes, index);
          break;
        case LAYOUT_TYPES.TABBED:
          this.processTabbed(node, child, sizes, index);
          break;
      }
      
      // Recurse
      this.processNode(child);
    });
  }
  
  if (node.nodeType === NODE_TYPES.WINDOW) {
    // Apply gaps
    node.renderRect = this.processGap(node);
  }
}
```

### Split Processing

**Horizontal Split (HSPLIT)**:
```javascript
processSplitH(parent, child, sizes, index) {
  let offset = sizes.slice(0, index).reduce((a, b) => a + b, 0);
  
  child.rect = {
    x: parent.rect.x + offset,
    y: parent.rect.y,
    width: sizes[index],
    height: parent.rect.height
  };
}
```

**Vertical Split (VSPLIT)**:
```javascript
processSplitV(parent, child, sizes, index) {
  let offset = sizes.slice(0, index).reduce((a, b) => a + b, 0);
  
  child.rect = {
    x: parent.rect.x,
    y: parent.rect.y + offset,
    width: parent.rect.width,
    height: sizes[index]
  };
}
```

### Stacked/Tabbed Processing

```javascript
processStacked(parent, child, sizes, index) {
  let tabHeight = this.getTabHeight();
  
  child.rect = {
    x: parent.rect.x,
    y: parent.rect.y + tabHeight,
    width: parent.rect.width,
    height: parent.rect.height - tabHeight
  };
}

processTabbed(parent, child, sizes, index) {
  // Same as stacked, tabs rendered separately
  this.processStacked(parent, child, sizes, index);
}
```

### Gap Processing

```javascript
processGap(node) {
  let gap = this.extWm.calculateGaps(node);
  
  return {
    x: node.rect.x + gap,
    y: node.rect.y + gap,
    width: node.rect.width - gap * 2,
    height: node.rect.height - gap * 2
  };
}
```

### Phase 2: apply()

Apply calculated positions to windows:

```javascript
apply(node) {
  let tiledWindows = node.getNodeByMode(WINDOW_MODES.TILE);
  
  tiledWindows.forEach(windowNode => {
    let rect = windowNode.renderRect;
    
    if (rect.width > 0 && rect.height > 0) {
      this.extWm.move(windowNode.nodeValue, rect);
    }
  });
}
```

### Phase 3: cleanTree()

Remove orphaned nodes:

```javascript
cleanTree(node) {
  let changed = false;
  
  // Remove empty containers
  let containers = node.getNodeByType(NODE_TYPES.CON);
  for (let con of containers) {
    if (con.childNodes.length === 0) {
      con.parentNode.removeChild(con);
      changed = true;
    }
  }
  
  // Flatten unnecessary nesting: [con[con[window]]] → [con[window]]
  for (let con of containers) {
    if (con.childNodes.length === 1 && con.childNodes[0].isCon()) {
      let child = con.childNodes[0];
      con.parentNode.insertBefore(child, con);
      con.parentNode.removeChild(con);
      changed = true;
    }
  }
  
  if (changed) {
    this.render("cleanTree");
  }
}
```

---

## Tree Manipulation

### createNode()

```javascript
createNode(parentValue, type, data, mode) {
  let parent = this.findNode(parentValue);
  let node = new Node(type, data);
  node.mode = mode;
  parent.addChild(node);
  return node;
}
```

### findNode()

```javascript
findNode(value) {
  // Recursive search
  function search(node) {
    if (node.nodeValue === value) return node;
    if (node.nodeType === NODE_TYPES.WINDOW && 
        node.nodeValue === value) return node;
    
    for (let child of node.childNodes) {
      let found = search(child);
      if (found) return found;
    }
    return null;
  }
  
  return search(this);
}
```

### move()

Move node to new position:

```javascript
move(node, direction) {
  let adjacent = this.findAdjacentNode(node, direction);
  
  if (!adjacent) return false;
  
  // Remove from current parent
  node.parentNode.removeChild(node);
  
  // Add to new parent
  if (adjacent.isCon() || adjacent.isMonitor()) {
    adjacent.addChild(node);
  } else {
    adjacent.parentNode.insertBefore(node, adjacent);
  }
  
  return true;
}
```

### swap()

Exchange positions of two nodes:

```javascript
swap(node, direction) {
  let adjacent = this.findAdjacentNode(node, direction);
  
  if (!adjacent || !adjacent.isWindow()) return false;
  
  let nodeParent = node.parentNode;
  let nodeIndex = nodeParent.childNodes.indexOf(node);
  
  let adjParent = adjacent.parentNode;
  let adjIndex = adjParent.childNodes.indexOf(adjacent);
  
  // Swap positions
  nodeParent.childNodes[nodeIndex] = adjacent;
  adjParent.childNodes[adjIndex] = node;
  
  // Update parent references
  node._parent = adjParent;
  adjacent._parent = nodeParent;
  
  return true;
}
```

### split()

Split container for new layout:

```javascript
split(node, orientation) {
  let parent = node.parentNode;
  
  // Create new container
  let newCon = new Node(NODE_TYPES.CON, new St.Bin());
  newCon.layout = orientation === "horizontal" 
    ? LAYOUT_TYPES.HSPLIT 
    : LAYOUT_TYPES.VSPLIT;
  
  // Replace node with container
  let index = parent.childNodes.indexOf(node);
  parent.childNodes[index] = newCon;
  newCon._parent = parent;
  
  // Add node to container
  newCon.addChild(node);
  
  return newCon;
}
```

---

## Node Queries

### getNodeByType()

```javascript
getNodeByType(type) {
  let results = [];
  
  function collect(node) {
    if (node.nodeType === type) {
      results.push(node);
    }
    node.childNodes.forEach(collect);
  }
  
  collect(this);
  return results;
}
```

### getNodeByMode()

```javascript
getNodeByMode(mode) {
  let results = [];
  
  function collect(node) {
    if (node.mode === mode) {
      results.push(node);
    }
    node.childNodes.forEach(collect);
  }
  
  collect(this);
  return results;
}
```

### findAdjacentNode()

```javascript
findAdjacentNode(node, direction) {
  let parent = node.parentNode;
  let index = parent.childNodes.indexOf(node);
  
  switch (direction) {
    case "Left":
    case "Up":
      return parent.childNodes[index - 1] || null;
    case "Right":
    case "Down":
      return parent.childNodes[index + 1] || null;
  }
}
```

---

## Size Computation

### computeSizes()

Calculate child sizes based on percent values:

```javascript
computeSizes(parent, children) {
  let totalSize = parent.layout === LAYOUT_TYPES.HSPLIT
    ? parent.rect.width
    : parent.rect.height;
  
  // Check if any child has explicit percent
  let hasPercent = children.some(c => c.percent > 0);
  
  if (hasPercent) {
    // Use percent values
    return children.map(c => totalSize * (c.percent || 1/children.length));
  } else {
    // Equal distribution
    let size = totalSize / children.length;
    return children.map(() => size);
  }
}
```

---

## Key Methods Reference

| Method | Purpose |
|--------|---------|
| `render()` | Full rendering pipeline |
| `processNode()` | Calculate positions recursively |
| `apply()` | Apply positions to windows |
| `cleanTree()` | Remove orphaned nodes |
| `createNode()` | Create and attach new node |
| `findNode()` | Find node by value |
| `move()` | Move node to new position |
| `swap()` | Exchange two node positions |
| `split()` | Split container for new layout |
| `getNodeByType()` | Query nodes by type |
| `getNodeByMode()` | Query nodes by mode |
| `addWorkspace()` | Add workspace node |
| `removeWorkspace()` | Remove workspace node |
