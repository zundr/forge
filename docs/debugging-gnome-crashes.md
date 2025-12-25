# Debugging GNOME Shell Crashes - Workflow Guide

## Overview
Systematic approach for debugging GNOME Shell crashes in the Forge extension using structured debugging methodologies and deep reasoning.

## Quick Reference Commands

```bash
# View recent crash logs
journalctl -b --since "10 minutes ago" | grep -v "slack.desktop" | grep -i "segfault\|crash\|fatal"

# View GNOME Shell logs
journalctl --user -b --since "10 minutes ago" | grep "gnome-shell"

# View kernel crash logs with context
journalctl -b --since "10 minutes ago" | grep -i -A 10 -B 5 "segfault"
```

## Debugging Workflow

### 1. Reproduce the Crash
- Document exact steps to reproduce
- Note the precise time when crash occurred
- Observe visual indicators (freeze, restart, etc.)
- Record system state (workspace, windows, layouts)

**Deep Reasoning**: Understanding the exact reproduction steps is critical for isolating the root cause. Consider:
- What was the system state before the crash?
- What sequence of actions triggered it?
- Can you reproduce it consistently?
- Are there environmental factors (timing, system load)?

### 2. Collect Crash Evidence

Use `debugging_approach` thinking pattern to systematically gather evidence:

```bash
# Kernel-level crashes (segfaults)
journalctl -b --since "TIME" | grep -i "segfault"

# GNOME Shell errors
journalctl --user -b --since "TIME" | grep "gnome-shell"

# Filter out noise
journalctl -b --since "TIME" | grep -v "slack.desktop" | grep -i "error\|fatal\|crash"
```

**Evidence Classification**:
- **Stack traces**: File paths, line numbers, function calls
- **Error messages**: Disposed objects, null references, type errors
- **System logs**: Segfault addresses, library names
- **Timing information**: When did it happen relative to user actions?

**Deep Reasoning**: Evidence quality determines investigation success. Ask:
- Is this evidence directly related to the crash?
- What does this evidence tell us about the failure mode?
- Are there patterns in the evidence?
- What evidence is missing that we need?

### 3. Analyze Stack Traces

Examine the complete call stack to understand the execution path:

**What to look for**:
- **Segfault location**: `segfault at ADDRESS ip INSTRUCTION_POINTER`
- **Library**: Which `.so` file crashed (e.g., `libmutter-clutter-14.so`)
- **JavaScript stack trace**: File paths and line numbers
- **Error messages**: Disposed objects, null references, type errors
- **Call sequence**: The path through the code that led to the crash

**Example Analysis**:
```
gnome-shell[PID]: segfault at 8 ip 0x... in libmutter-clutter-14.so.0.0.0
Object St.BoxLayout has been already disposed
#12 tree.js:1441
#13 tree.js:1315
#14 window.js:1233
```

**Deep Reasoning Questions**:
- Why did execution reach this point?
- What assumptions were violated?
- What state was expected vs actual?
- Are there recursive calls that might cause issues?
- What objects are being accessed and what's their lifecycle?

### 4. Identify Root Cause Patterns

**Use systematic hypothesis generation and testing**. Consider multiple potential root causes, not just the obvious ones.

#### Common Pattern Categories

##### A. Memory Management Issues

**1. Disposed GObject**
- **Symptom**: "Object X has been already disposed"
- **Cause**: JavaScript holds reference to GObject destroyed by native code
- **Solution**: Check validity before access using `isDisposed()`
- **Why it happens**: GObject lifecycle independent of JavaScript GC

**2. TOCTOU (Time-of-Check-Time-of-Use)**
- **Symptom**: Object valid at check, crashes at use
- **Cause**: Object destroyed between check and use (often during recursion)
- **Solution**: Re-check immediately before use
- **Why it happens**: Asynchronous operations, recursive calls, event handlers

**3. Use-After-Free**
- **Symptom**: Accessing memory that's been freed
- **Cause**: Dangling pointers, premature cleanup
- **Solution**: Nullify references after destruction, defensive checks
- **Why it happens**: Complex object graphs, circular references

**4. Double-Free**
- **Symptom**: Attempting to free already-freed memory
- **Cause**: Multiple cleanup paths, missing guards
- **Solution**: Check if already freed, use flags
- **Why it happens**: Error handling paths, exception unwinding

##### B. Concurrency Issues

**5. Race Conditions**
- **Symptom**: Intermittent crashes, timing-dependent
- **Cause**: Multiple operations on shared state without synchronization
- **Solution**: Proper locking, atomic operations, event serialization
- **Why it happens**: Async operations, timers, event handlers

**6. Event Queue Conflicts**
- **Symptom**: Crashes during rapid operations
- **Cause**: Events processed out of order or conflicting
- **Solution**: Event batching, debouncing, state validation
- **Why it happens**: User actions faster than processing

##### C. State Management Issues

**7. Invalid State Transitions**
- **Symptom**: Unexpected state when operation executes
- **Cause**: State changed between validation and use
- **Solution**: Atomic state transitions, state machine validation
- **Why it happens**: Complex state graphs, missing guards

**8. Incomplete Initialization**
- **Symptom**: Null/undefined access during operation
- **Cause**: Object used before fully initialized
- **Solution**: Initialization guards, factory patterns
- **Why it happens**: Async initialization, circular dependencies

**9. Stale References**
- **Symptom**: Operating on outdated object references
- **Cause**: References not updated when objects change
- **Solution**: Reference invalidation, observer patterns
- **Why it happens**: Caching, event handlers with closures

##### D. Type and Contract Violations

**10. Type Mismatches**
- **Symptom**: Unexpected type errors, method not found
- **Cause**: Wrong type passed or returned
- **Solution**: Type validation, defensive programming
- **Why it happens**: Dynamic typing, API changes

**11. Null/Undefined Dereference**
- **Symptom**: Cannot read property of null/undefined
- **Cause**: Missing null checks, unexpected null returns
- **Solution**: Null checks, optional chaining, default values
- **Why it happens**: Error conditions, edge cases

**12. Contract Violations**
- **Symptom**: Preconditions or postconditions violated
- **Cause**: Assumptions about function inputs/outputs wrong
- **Solution**: Explicit validation, assertions
- **Why it happens**: Incomplete specifications, edge cases

##### E. Resource Management Issues

**13. Resource Leaks**
- **Symptom**: Growing memory, eventual crash
- **Cause**: Resources not properly released
- **Solution**: RAII patterns, explicit cleanup
- **Why it happens**: Exception paths, forgotten cleanup

**14. Recursive Depth Exceeded**
- **Symptom**: Stack overflow, deep recursion crashes
- **Cause**: Unbounded recursion, circular structures
- **Solution**: Iteration instead of recursion, depth limits
- **Why it happens**: Tree traversal, circular references

##### F. Native Code Interaction

**15. Native Code Segfault**
- **Symptom**: Segfault in .so library, try-catch doesn't help
- **Cause**: Invalid pointer/reference passed to native code
- **Solution**: Prevent invalid calls at JavaScript level
- **Why it happens**: JavaScript exceptions don't cross native boundary

**16. ABI Mismatches**
- **Symptom**: Crashes in native calls with correct-looking code
- **Cause**: Version mismatches, incorrect bindings
- **Solution**: Verify versions, check bindings
- **Why it happens**: Library updates, build issues

##### G. Logic Errors

**17. Off-by-One Errors**
- **Symptom**: Array access errors, boundary issues
- **Cause**: Incorrect loop bounds, index calculations
- **Solution**: Careful boundary checking, tests
- **Why it happens**: Complexity, edge cases

**18. Incorrect Assumptions**
- **Symptom**: Crashes in "impossible" scenarios
- **Cause**: Assumptions about system behavior wrong
- **Solution**: Validate assumptions, defensive programming
- **Why it happens**: Incomplete understanding, edge cases

**Deep Reasoning Process**:

1. **Generate Multiple Hypotheses**: Don't fixate on first idea
   - List 3-5 potential root causes
   - Rank by likelihood based on evidence
   - Consider both common and rare causes

2. **Test Hypotheses Systematically**:
   - What evidence supports this hypothesis?
   - What evidence contradicts it?
   - What additional evidence would confirm/refute it?
   - Can we reproduce the issue in a controlled way?

3. **Consider Interaction Effects**:
   - Could multiple factors combine to cause the crash?
   - Are there timing dependencies?
   - Does system state matter?

4. **Think About Edge Cases**:
   - What happens at boundaries?
   - What about empty/null/zero cases?
   - What about maximum values?
   - What about rapid repeated operations?

5. **Trace Backwards from Crash**:
   - What was the immediate cause?
   - What led to that state?
   - What assumptions were violated?
   - Where did things first go wrong?

### 5. Locate Bug in Code

**Systematic Code Investigation**:

1. **Find the crash location** from stack trace
2. **Read surrounding code** for context (50-100 lines)
3. **Trace backwards** to find where objects were created/checked
4. **Identify the gap** where object can become invalid
5. **Check similar patterns** elsewhere in codebase
6. **Review recent changes** that might have introduced the bug

**Deep Reasoning Questions**:
- What invariants should hold at this point?
- What are the preconditions for this code?
- What are the postconditions?
- What can change between operations?
- Are there hidden dependencies?

### 6. Implement Fix

**Fix Strategy Selection**:

1. **Defensive Checks**: Add validation before operations
2. **Re-validation**: Check again after risky operations
3. **State Guards**: Ensure valid state transitions
4. **Lifecycle Management**: Proper initialization and cleanup
5. **Error Handling**: Graceful degradation, not crashes

**Implementation Principles**:
- Add defensive checks (null checks, disposed checks)
- Re-validate objects after operations that might invalidate them
- Use try-catch as defense-in-depth, not primary protection
- Follow existing code patterns
- Keep fixes minimal and focused

**Deep Reasoning**:
- Does this fix address the root cause or just symptoms?
- Could this fix introduce new issues?
- Are there other places with the same pattern?
- Is this the simplest fix that works?
- Does it maintain code clarity?

### 7. Test Fix

**Comprehensive Testing**:

1. **Reproduce original crash scenario** - verify it's fixed
2. **Test edge cases** - rapid operations, multiple windows, etc.
3. **Run existing test suite** - ensure no regressions
4. **Add new tests** - prevent future regressions
5. **Manual testing** - real-world usage patterns

**Test Coverage**:
- Normal operation
- Edge cases
- Error conditions
- Concurrent operations
- State transitions

## Case Study: Decoration TOCTOU Bug (Dec 2024)

### Scenario
Two terminals in vertical split → Change left to tabbed → Move right left → CRASH

### Evidence Collection
```
kernel: gnome-shell[2688822]: segfault at 8 in libmutter-clutter-14.so
gnome-shell: Object St.BoxLayout has been already disposed
Stack: tree.js:1707 -> tree.js:1515 -> tree.js:1508
```

### Hypothesis Generation

**Hypothesis 1** (Confirmed): TOCTOU bug
- Decoration checked at line 1508, used at line 1707
- Destroyed during recursive rendering between check and use
- Evidence: Stack shows recursive calls, disposed error

**Hypothesis 2** (Refuted): Event queue conflict
- Multiple rapid events causing conflicts
- Evidence: Stack shows synchronous path, not event-driven

**Hypothesis 3** (Refuted): Decoration lifecycle bug
- Decoration not properly created/destroyed
- Evidence: Decoration exists and is valid initially

### Root Cause Analysis

TOCTOU bug in tree.js:
- **Line 1508-1527**: Check if decoration disposed, nullify if so
- **Line 1530+**: Recursive rendering (decoration destroyed here)
- **Line 1694**: Re-access decoration WITHOUT re-checking
- **Line 1707**: Call set_size() on disposed object → SEGFAULT

**Why TOCTOU occurred**:
1. Initial check passes (decoration valid)
2. Recursive child rendering triggers GNOME Shell cleanup
3. GNOME Shell destroys decoration (native code)
4. JavaScript still holds reference
5. Code accesses disposed object → native segfault

### Fix Implementation

```javascript
let decoration = node.decoration;

// Re-check if decoration is still valid (TOCTOU fix)
// Decoration can be destroyed during recursive child rendering
if (decoration && isDisposed(decoration)) {
  node.decoration = null;
  decoration = null;
}

if (decoration !== null && decoration !== undefined) {
  // Safe to use
}
```

### Key Learnings

1. **Try-catch cannot catch native segfaults** - Must prevent invalid calls
2. **Objects can be destroyed during recursion** - Re-validate after recursive calls
3. **GObjects have lifecycle independent of JavaScript** - Always check before use
4. **Stack traces show the path** - Work backwards to find where object became invalid
5. **Multiple hypotheses are essential** - Don't fixate on first idea
6. **Evidence-based reasoning** - Let evidence guide investigation

## Common Pitfalls

### ❌ Relying on try-catch for native code
```javascript
try {
  decoration.set_size(w, h); // Segfaults in native code
} catch (e) {
  // Never reached - native crash bypasses JS exception handling
}
```

### ✅ Prevent invalid calls
```javascript
if (decoration && !isDisposed(decoration)) {
  decoration.set_size(w, h); // Safe - validated before use
}
```

### ❌ Single check for long-lived references
```javascript
if (obj) {
  doRecursiveWork(); // obj might be destroyed here
  obj.method(); // CRASH - obj no longer valid
}
```

### ✅ Re-validate after risky operations
```javascript
if (obj) {
  doRecursiveWork();
  if (obj && !isDisposed(obj)) { // Re-check after risky operation
    obj.method(); // Safe
  }
}
```

### ❌ Assuming object validity
```javascript
function processNode(node) {
  let decoration = node.decoration;
  // ... lots of code ...
  decoration.show(); // Might be disposed by now
}
```

### ✅ Validate immediately before use
```javascript
function processNode(node) {
  let decoration = node.decoration;
  // ... lots of code ...
  if (decoration && !isDisposed(decoration)) {
    decoration.show(); // Safe
  }
}
```

## Tools and Techniques

### Debugging Tools
- `journalctl` - System and user logs
- GNOME Shell Looking Glass (Alt+F2, `lg`) - Live debugging
- `gdb` - Native debugger for C/native crashes
- `console.log` / `Logger.info` - Strategic logging
- `debugging_approach` - Structured debugging methodology

### Log Filtering Techniques
```bash
# Exclude noisy services
grep -v "slack.desktop\|microsoft-edge"

# Specific time window
--since "5 minutes ago" --until "1 minute ago"

# Context around matches
grep -A 10 -B 5 "pattern"

# Follow logs in real-time
journalctl -f
```

### Useful Code Patterns

```javascript
// Check if GObject is disposed
function isDisposed(obj) {
  if (!obj) return true;
  try {
    void obj.visible; // Access any property
    return false;
  } catch (e) {
    return true; // Throws if disposed
  }
}

// Safe GObject cleanup
function cleanupDecoration(node) {
  if (node.decoration) {
    try {
      if (global.window_group.contains(node.decoration)) {
        global.window_group.remove_child(node.decoration);
      }
      node.decoration.destroy();
    } catch (e) {
      // Already disposed
    }
    node.decoration = null;
  }
}

// Defensive property access
function safeGetProperty(obj, prop, defaultValue) {
  if (!obj || isDisposed(obj)) return defaultValue;
  try {
    return obj[prop];
  } catch (e) {
    return defaultValue;
  }
}
```

## Prevention Strategies

1. **Always validate GObject references before use**
   - Check for null/undefined
   - Use `isDisposed()` for GObjects
   - Validate after any operation that might invalidate

2. **Re-check after recursive operations or async calls**
   - Recursion can trigger cleanup
   - Async operations allow state changes
   - Event handlers can modify objects

3. **Nullify references after destruction**
   - Prevents use-after-free
   - Makes bugs obvious (null errors vs segfaults)
   - Helps garbage collection

4. **Use defensive programming for UI objects**
   - UI objects have complex lifecycles
   - Native code can destroy them anytime
   - Always validate before use

5. **Add comprehensive logging for lifecycle events**
   - Log object creation
   - Log object destruction
   - Log state transitions
   - Helps trace issues

6. **Write tests for object lifecycle scenarios**
   - Test normal lifecycle
   - Test edge cases (rapid operations, etc.)
   - Test error conditions
   - Test concurrent operations

7. **Use structured debugging methodologies**
   - `debugging_approach` for systematic investigation
   - Generate multiple hypotheses
   - Test hypotheses with evidence
   - Document findings

8. **Think deeply about root causes**
   - Don't stop at first explanation
   - Consider multiple factors
   - Look for interaction effects
   - Validate assumptions

## When to Update This Document

Add new entries when you:
- Discover a new crash pattern
- Find a new debugging technique
- Learn about GNOME Shell/GJS internals
- Implement a fix for a crash bug
- Identify a common pitfall
- Develop new prevention strategies

---

**Last Updated**: 2024-12-24  
**Related Files**: `lib/extension/tree.js`, `lib/extension/window.js`, `test/decoration-cleanup.test.js`  
**Debugging Methodology**: Uses `debugging_approach` thinking pattern for systematic investigation
