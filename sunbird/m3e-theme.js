// @description Lampcord-inspired chat input, toolbar icons and grouped message menus for Android Phoenix.
// @version 0.2.0
// @author onichan0923

(() => {
  const ui = phoenix.ui;
  // Fixed surface roles for clients without access to Android's dynamic palette.
  const palettes = {
    dark: {
      sheet: 0xff151419, row: 0xff211f25, rowPressed: 0xff35323b,
      input: 0xff2b292f, ink: 0xffe7e1e6, icon: 0xffcac5cf, muted: 0xffa39ea9,
      outline: 0x0acac5cf, accent: 0xffcfbcff, onAccent: 0xff381e72,
      ripple: 0x20cac5cf, handle: 0x66cac5cf,
    },
    light: {
      sheet: 0xfffdf8fd, row: 0xfff1edf3, rowPressed: 0xffe1dce4,
      input: 0xffebe6ec, ink: 0xff1d1b20, icon: 0xff49454f, muted: 0xff69646f,
      outline: 0x33c7c5d0, accent: 0xff6750a4, onAccent: 0xffffffff,
      ripple: 0x1849454f, handle: 0x6649454f,
    },
  };
  const menuRoot = "message.actions.root";
  const menuMatch = { prefix: "message.actions." };
  const sendNames = ["composer.send", "Send Message"];
  const toolbarButtons = ["composer.expressions", "composer.gift", "Record Voice Message", ...sendNames];
  let palette;
  let rules = [];
  const watchers = [];

  function forLive(match, visit) {
    for (const id of ui.find(match)) {
      const node = ui.node(id);
      if (node) visit(node);
    }
  }

  function watch(match, visit) {
    watchers.push(ui.onNode(match, snapshot => {
      const node = ui.node(snapshot.id);
      if (node && node.accessibilityId === snapshot.accessibilityId) visit(node);
    }));
  }

  function patch(match, props) {
    rules.push(ui.patchProps(match, props));
    forLive(match, node => ui.update(node.id, props));
  }

  function tintIcon(button, color = palette.icon) {
    // Search and expressions use Phoenix's icon-button template.
    if (!button.children.length) return;
    const icon = ui.node(button.children[0]);
    if (icon && (icon.kind == null || icon.kind === "image")) {
      ui.update(icon.id, { tint: color });
    }
  }

  function toolbarControls(group, inputId) {
    if (group.id === ui.root()) return null;
    const pending = [group.id];
    const seen = new Set();
    let hasInput = false;
    let hasAction = false;
    const sendButtons = [];
    while (pending.length) {
      const id = pending.pop();
      if (seen.has(id)) continue;
      seen.add(id);
      if (seen.size > 72) return null;
      const node = ui.node(id);
      if (!node || ["navigator", "list", "sheet", "scroll"].includes(node.kind)) return null;
      const name = node.accessibilityId;
      if (id === inputId) hasInput = true;
      else if (toolbarButtons.includes(name)) {
        hasAction = true;
        if (sendNames.includes(name)) sendButtons.push(node);
      } else if (name && !name.toLowerCase().includes("composer")
        && (id === group.id || node.children.length > 1 || /^(message\.|channel|profile|search\.)/.test(name))) {
        return null;
      }
      for (const child of node.children) pending.push(child);
    }
    return hasInput && hasAction ? sendButtons : null;
  }

  function styleComposer(input) {
    // Find the nearest compact group containing both input and tools. Leave
    // unfamiliar layouts alone instead of painting the entire chat screen.
    let parentId = input.parent;
    for (let depth = 0; depth < 4 && parentId != null; depth++) {
      const group = ui.node(parentId);
      if (!group) return;
      const sendButtons = toolbarControls(group, input.id);
      if (sendButtons) {
        ui.update(group.id, {
          background: palette.input, radius: 16, borderWidth: 1, borderColor: palette.outline,
          minHeight: 60, padding: [12, 8, 12, 8], gap: 8,
        });
        for (const send of sendButtons) {
          ui.update(send.id, { background: palette.accent, radius: 20 });
          tintIcon(send, palette.onAccent);
        }
        return;
      }
      parentId = group.parent;
    }
  }

  function isAction(node) {
    const name = node && node.accessibilityId;
    return typeof name === "string" && name.startsWith(menuMatch.prefix) && name !== menuRoot;
  }

  function isDivider(node) {
    // Sunbird's menu template inserts an anonymous view containing one line
    // between actions. Named separators and headings stay group boundaries.
    if (!node || node.accessibilityId || (node.kind != null && node.kind !== "view")
      || node.children.length !== 1) return false;
    const line = ui.node(node.children[0]);
    return !!line && !line.accessibilityId && (line.kind == null || line.kind === "view")
      && line.children.length === 0;
  }

  function styleMenuRow(node, includeNeighbors) {
    const parent = node.parent == null ? null : ui.node(node.parent);
    const siblings = parent ? parent.children : [];
    const at = i => i >= 0 && i < siblings.length ? ui.node(siblings[i]) : null;
    const adjacent = (i, step) => {
      const near = at(i + step);
      const j = i + (isDivider(near) ? 2 * step : step);
      return isAction(at(j)) ? j : -1;
    };
    const style = (row, before, after) => {
      if (!isAction(row)) return;
      ui.update(row.id, {
        background: palette.row, activeBackground: palette.rowPressed,
        radiusTopLeft: before ? 5 : 20, radiusTopRight: before ? 5 : 20,
        radiusBottomLeft: after ? 5 : 20, radiusBottomRight: after ? 5 : 20,
        margin: [0, 0, 0, after ? 4 : 0],
      });
    };
    const i = siblings.indexOf(node.id);
    if (i < 0) return style(node, false, false);
    const prev = adjacent(i, -1);
    const next = adjacent(i, 1);
    style(node, prev >= 0, next >= 0);
    if (i === 0 && parent && parent.accessibilityId !== menuRoot
      && siblings.every(id => { const n = ui.node(id); return isAction(n) || isDivider(n); })) {
      ui.update(parent.id, { radius: 20, background: 0 });
    }
    if (includeNeighbors && prev >= 0) style(at(prev), adjacent(prev, -1) >= 0, true);
    if (includeNeighbors && next >= 0) style(at(next), true, adjacent(next, 1) >= 0);
  }

  function styleMenu(node, includeNeighbors) {
    if (node.accessibilityId !== menuRoot) {
      styleMenuRow(node, includeNeighbors);
      return;
    }
    const sheet = node.kind === "sheet" ? node.id : node.sheet;
    if (sheet != null) {
      ui.update(sheet, {
        background: palette.sheet, radiusTopLeft: 24, radiusTopRight: 24,
        handleColor: palette.handle, scrimColor: 0x99000000,
      });
    }
  }

  function apply(choice) {
    palette = choice === "light" ? palettes.light : palettes.dark;
    for (const remove of rules) remove();
    rules = [];
    // The outer toolbar owns the fill. Clear any 0.1 input/button backgrounds
    // on a live upgrade, including when the emoji button has been hidden.
    patch("composer", {
      background: 0, borderWidth: 0, borderColor: 0, focusBorderColor: 0, radius: 0,
      color: palette.ink, placeholderColor: palette.muted,
    });
    patch("user_settings_search_input", {
      background: palette.input, color: palette.ink, placeholderColor: palette.muted,
      radius: 16, borderWidth: 1, borderColor: palette.outline, focusBorderColor: palette.accent,
    });
    const iconButton = { background: 0, activeBackground: palette.ripple, radius: 20, activeRadius: 20.5 };
    for (const name of ["search.entry", "composer.expressions"]) {
      patch(name, iconButton);
      forLive(name, tintIcon);
    }
    patch({ prefix: "message.author:" }, { fontWeight: 700 });
    patch({ prefix: "message.timestamp:" }, { color: palette.muted });
    forLive("composer", styleComposer);
    forLive(menuMatch, node => styleMenu(node, false));
  }

  const settings = phoenix.settings.define({
    scheme: {
      type: "select", title: "配色", description: "選擇與 Discord 外觀搭配的配色。",
      default: "dark", options: [{ value: "dark", label: "深色" }, { value: "light", label: "淺色" }],
      onChange: apply,
    },
  });
  watch("search.entry", tintIcon);
  watch("composer", styleComposer);
  for (const name of toolbarButtons) {
    watch(name, node => {
      if (name === "composer.expressions") tintIcon(node);
      forLive("composer", styleComposer);
    });
  }
  watch(menuMatch, node => styleMenu(node, true));
  watchers.push(ui.onEvent("focus", event => {
    if (event.accessibilityId === "composer") {
      const input = ui.node(event.node);
      if (input && input.accessibilityId === "composer") styleComposer(input);
    }
  }));
  apply(settings.scheme);
  phoenix.onUnload(() => {
    for (const remove of watchers) remove();
    for (const remove of rules) remove();
  });
})();
