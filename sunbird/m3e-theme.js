// @description Rose-toned chat, search and grouped Discord settings with Lampcord-style spacing.
// @version 0.3.0
// @author onichan0923

(() => {
  const ui = phoenix.ui;
  // Fixed approximation of the supplied Monet palette: rose A1/A2 and warm N1/N2.
  const palettes = {
    dark: {
      canvas: 0xff1b1417, sheet: 0xff261c20, row: 0xff38282f, pressed: 0xff523640,
      field: 0xff483039, ink: 0xffffedf1, muted: 0xffcfb5bd, accent: 0xffefb2c3,
      onAccent: 0xff49232f, handle: 0xff977880, ripple: 0x28efb2c3,
    },
    light: {
      canvas: 0xfffff7f8, sheet: 0xfffff0f3, row: 0xfff5e2e7, pressed: 0xffebcbd4,
      field: 0xfff1d9e1, ink: 0xff281b20, muted: 0xff71545e, accent: 0xff814e60,
      onAccent: 0xffffffff, handle: 0xffa7828f, ripple: 0x20814e60,
    },
  };
  const clearFill = { background: 0, borderWidth: 0, borderColor: 0, focusBorderColor: 0 };
  const menuRoot = "message.actions.root";
  const menuMatch = { prefix: "message.actions." };
  const settingsMatch = { prefix: "settings.row." };
  const dividerName = /(?:^|[.:_-])(?:divider|separator)(?:$|[.:_-])/i;
  const searchId = "user_settings_search_input";
  const messageMatch = { prefix: "message.content:" };
  const sendNames = ["composer.send", "Send Message"];
  const toolNames = ["composer.expressions", "composer.gift", "Record Voice Message", ...sendNames];
  const watchers = [];
  const recentGroups = new Map();
  let rules = [];
  let palette;
  let lastList = null;
  let lastSettings = null;
  let lastSweep = 0;

  function parent(node) {
    return node && node.parent != null ? ui.node(node.parent) : null;
  }

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

  function tintIcon(button, color) {
    if (!button.children.length) return;
    const icon = ui.node(button.children[0]);
    if (icon && (icon.kind == null || icon.kind === "image")) ui.update(icon.id, { tint: color });
  }

  function iconBranch(node) {
    if (!node || /^(message\.|channel|profile|search\.)/.test(node.accessibilityId || "")) return false;
    if (node.kind === "image") return !node.children.length;
    if (node.children.length !== 1 || (node.kind && !["view", "stack"].includes(node.kind))) return false;
    const icon = ui.node(node.children[0]);
    return !!icon && !icon.children.length && (!icon.kind || icon.kind === "image");
  }

  // Restrict composer edits to a compact toolbar containing both the input and
  // at least one known action. The microphone can be outside the emoji/input row.
  function toolbarControls(group, inputId) {
    if (group.id === ui.root()) return null;
    const todo = [group.id], seen = new Set(), tools = [];
    let found = false;
    while (todo.length) {
      const id = todo.pop();
      if (seen.has(id)) continue;
      seen.add(id);
      if (seen.size > 72) return null;
      const node = ui.node(id);
      if (!node || ["navigator", "list", "scroll", "sheet"].includes(node.kind)) return null;
      const name = node.accessibilityId || "";
      if (id === inputId) found = true;
      else if (toolNames.includes(name)) tools.push(node);
      else if (name && !name.toLowerCase().includes("composer") &&
        (id === group.id || node.children.length > 1 || /^(message\.|channel|profile|search\.)/.test(name))) return null;
      for (const child of node.children) todo.push(child);
    }
    return found && tools.length ? tools : null;
  }

  function styleComposer(input) {
    let group = parent(input), bar = null, buttons = [];
    for (let depth = 0; group && depth < 5; depth++, group = parent(group)) {
      const tools = toolbarControls(group, input.id);
      const extra = bar && group.children.length === 2 && group.children.includes(bar.id)
        ? ui.node(group.children.find(id => id !== bar.id)) : null;
      if (tools && (tools.length > buttons.length || (tools.length === buttons.length && iconBranch(extra)))) {
        bar = group;
        buttons = tools;
      }
    }
    if (!bar) return;
    // Paint only the common outer bar. Clear nested backgrounds along control
    // paths without changing native height, hit targets, padding or flex layout.
    ui.update(bar.id, { background: palette.field, radius: 18, borderWidth: 0, borderColor: 0 });
    let shell = parent(bar);
    for (let depth = 0; depth < 2 && shell && shell.id !== ui.root() && !shell.accessibilityId
      && shell.children.length === 1 && (!shell.kind || shell.kind === "view" || shell.kind === "stack"); depth++) {
      ui.update(shell.id, clearFill);
      shell = parent(shell);
    }
    const cleared = new Set();
    for (const control of [input, ...buttons]) {
      for (let n = parent(control); n && n.id !== bar.id && !cleared.has(n.id); n = parent(n)) {
        cleared.add(n.id);
        ui.update(n.id, clearFill);
      }
    }
    for (const button of buttons) {
      const send = sendNames.includes(button.accessibilityId);
      ui.update(button.id, { background: send ? palette.accent : 0, activeBackground: palette.ripple, radius: 20 });
      tintIcon(button, send ? palette.onAccent : palette.accent);
    }
  }

  function styleSearch(input) {
    // Captured Discord layout: frame > row > [search icon wrapper, input].
    const row = parent(input), frame = parent(row);
    if (!frame || row.children.length !== 2 || row.children[1] !== input.id ||
        frame.children.length !== 1 || frame.children[0] !== row.id || frame.id === ui.root()) return;
    const leading = ui.node(row.children[0]);
    if (!leading) return;
    ui.update(frame.id, { ...clearFill, background: palette.field, radius: 16 });
    ui.update(row.id, clearFill);
    if (leading.kind === "image") ui.update(leading.id, { tint: palette.accent });
    else tintIcon(leading, palette.accent);
  }

  function action(node) {
    const id = node && node.accessibilityId;
    return typeof id === "string" && id.startsWith(menuMatch.prefix) && id !== menuRoot && !dividerName.test(id);
  }

  function settingsRow(node) {
    if (!node || node.accessibilityId === searchId) return false;
    const name = node.accessibilityId || "";
    if (dividerName.test(name)) return false;
    if (name.startsWith(settingsMatch.prefix) || name === "phoenix-Sunbird") return true;
    // Other settings rows can have localized or absent IDs. Only call this
    // matcher inside a settings section established from a settings screen anchor.
    if (node.kind != null && node.kind !== "view") return false;
    const inner = node.children.length === 1 ? ui.node(node.children[0]) : node;
    if (!inner || inner.children.length < 2 || inner.children.length > 4) return false;
    const lead = ui.node(inner.children[0]);
    if (!lead || lead.children.length || (lead.kind && lead.kind !== "text" && lead.kind !== "image")) return false;
    return !inner.children.some(id => {
      const child = ui.node(id);
      return child && (child.kind === "input" || child.accessibilityId === searchId);
    });
  }

  function divider(node) {
    if (!node || (node.accessibilityId && !dividerName.test(node.accessibilityId))
      || (node.kind != null && node.kind !== "view")) return false;
    if (!node.children.length) return true;
    if (node.children.length !== 1) return false;
    const line = ui.node(node.children[0]);
    return !!line && !line.accessibilityId && !line.children.length && (line.kind == null || line.kind === "view");
  }

  function styleGroup(group, isRow) {
    if (!group) return false;
    const kids = group.children.map(id => ui.node(id));
    const rows = kids.map(isRow);
    if (!rows.some(Boolean)) return false;
    const lines = kids.map((node, i) => rows[i - 1] && rows[i + 1] && divider(node));
    // Phoenix notifies once per named row in a mount batch. Write each group
    // once per burst; newly attached rows or dividers change the signature.
    const signature = kids.map((child, i) => {
      if (!child) return "-";
      const role = rows[i] ? "row" : lines[i] ? "divider" : "other";
      return [child.id, role, ...child.children].join(".");
    }).join(",");
    const previous = recentGroups.get(group.id), now = Date.now();
    if (previous && previous.signature === signature && now - previous.time < 120) return true;
    if (recentGroups.size >= 128) recentGroups.clear();
    recentGroups.set(group.id, { signature, time: now });
    if (group.accessibilityId !== menuRoot && group.kind !== "sheet" && kids.every((_, i) => rows[i] || lines[i])) {
      ui.update(group.id, { background: 0, radius: 20, borderWidth: 0, borderColor: 0 });
    }
    for (let i = 0; i < kids.length; i++) {
      const node = kids[i];
      if (lines[i]) {
        // This is the native separator between two recognized rows. Collapse
        // its original inset and make the line invisible even if it has a child.
        ui.update(node.id, { opacity: 0, height: 0, minHeight: 0, margin: 0, padding: 0, background: 0, borderWidth: 0 });
        if (node.children.length === 1) {
          ui.update(node.children[0], { background: 0, opacity: 0, height: 0, borderWidth: 0 });
        }
        continue;
      }
      if (!rows[i]) continue;
      const before = rows[i-1] || lines[i-1], after = rows[i+1] || lines[i+1];
      ui.update(node.id, {
        background: palette.row, activeBackground: palette.pressed, borderWidth: 0, borderColor: 0,
        radiusTopLeft: before ? 5 : 20, radiusTopRight: before ? 5 : 20,
        radiusBottomLeft: after ? 5 : 20, radiusBottomRight: after ? 5 : 20,
        margin: [0, 0, 0, after ? 4 : 0],
      });
      if (isRow === settingsRow) tintSettingsRow(node);
    }
    return true;
  }

  function tintSettingsRow(row) {
    // Keep semantic colors on account actions, and leave switch tracks alone.
    if (/logout|delete|remove|danger|ログアウト|削除|登出|退出登[錄录]|刪除|删除/i.test(row.accessibilityId || "")) return;
    const inner = row.children.length === 1 ? ui.node(row.children[0]) : row;
    if (!inner || inner.children.length < 2) return;
    const icon = ui.node(inner.children[0]), title = ui.node(inner.children[1]);
    if (icon && !icon.children.length && (icon.kind == null || icon.kind === "image")) {
      ui.update(icon.id, { tint: palette.accent });
    }
    if (title && !title.children.length && (title.kind == null || title.kind === "text")) {
      ui.update(title.id, { color: palette.ink });
    }
  }

  function styleSection(section) {
    if (!section || !section.children.length || section.children.length > 2) return;
    const last = section.children[section.children.length - 1];
    if (!styleGroup(ui.node(last), settingsRow) || section.children.length !== 2) return;
    const header = ui.node(section.children[0]);
    if (header && !header.children.length && (header.kind == null || header.kind === "text")) {
      ui.update(header.id, { color: palette.accent });
    }
  }

  function paintSettingsList(list) {
    lastSettings = list.id;
    lastSweep = Date.now();
    ui.update(list.id, { background: palette.canvas });
    const scroll = parent(list);
    if (scroll && scroll.id !== ui.root() && scroll.children.length === 1 &&
        (scroll.kind == null || scroll.kind === "scroll")) {
      ui.update(scroll.id, { background: palette.canvas });
    }
    for (const id of list.children) styleSection(ui.node(id));
  }

  // A localized settings page can mount its search box before its named rows.
  // Only accept a sibling section with a heading and multiple settings rows.
  function settingsFromSearch(input) {
    styleSearch(input);
    let branch = input;
    for (let depth = 0; depth < 8; depth++) {
      const host = parent(branch);
      if (!host || host.id === ui.root() || host.kind === "navigator") return;
      const confirmed = host.children.some(id => {
        const section = id !== branch.id && ui.node(id);
        if (!section || section.children.length !== 2) return false;
        const header = ui.node(section.children[0]), group = ui.node(section.children[1]);
        return header && !header.children.length && (!header.kind || header.kind === "text")
          && group && group.children.filter(kid => settingsRow(ui.node(kid))).length >= 2;
      });
      if (confirmed) { paintSettingsList(host); return; }
      branch = host;
    }
  }

  function styleSettings(anchor, force = false) {
    // Same anchor chain used by Sunbird to place its own entry on the Discord
    // settings home screen: settings row > group > section > list.
    const group = parent(anchor), section = parent(group), list = parent(section);
    if (!group) return;
    if (!list || list.id === ui.root() || !section.children.includes(group.id)) {
      styleGroup(group, settingsRow);
      return;
    }
    const now = Date.now();
    if (force || lastSettings !== list.id || now - lastSweep >= 400) {
      paintSettingsList(list);
    } else {
      styleSection(section);
    }
  }

  function styleMenu(node) {
    if (node.accessibilityId === menuRoot) {
      const id = node.kind === "sheet" ? node.id : node.sheet;
      if (id != null) ui.update(id, {
        background: palette.sheet, radiusTopLeft: 24, radiusTopRight: 24,
        handleColor: palette.handle, scrimColor: 0x99000000,
      });
    } else styleGroup(parent(node), action);
  }

  function styleChat(node) {
    if (node.list == null || node.list === lastList) return;
    ui.update(node.list, { background: palette.canvas });
    lastList = node.list;
  }

  function apply(choice) {
    palette = choice === "light" ? palettes.light : palettes.dark;
    for (const remove of rules) remove();
    rules = [];
    lastList = lastSettings = null;
    recentGroups.clear();
    const textField = { ...clearFill, radius: 0, color: palette.ink, placeholderColor: palette.muted };
    patch("composer", textField);
    patch(searchId, textField);
    patch("search.entry", { background: 0, activeBackground: palette.ripple, radius: 20, activeRadius: 20.5 });
    patch({ prefix: "message.author:" }, { fontWeight: 700 });
    patch({ prefix: "message.timestamp:" }, { color: palette.muted });
    forLive("search.entry", node => tintIcon(node, palette.accent));
    forLive("composer", styleComposer);
    forLive(searchId, settingsFromSearch);
    forLive(messageMatch, styleChat);
    const groups = new Set();
    forLive(menuMatch, node => {
      if (node.accessibilityId !== menuRoot && groups.has(node.parent)) return;
      if (node.accessibilityId !== menuRoot) groups.add(node.parent);
      styleMenu(node);
    });
    forLive(settingsMatch, node => {
      if (!groups.has(node.parent)) {
        groups.add(node.parent);
        styleSettings(node);
      }
    });
    forLive("phoenix-Sunbird", styleSettings);
  }

  const settings = phoenix.settings.define({
    scheme: {
      type: "select", title: "玫瑰配色", description: "玫瑰灰背景與豆沙粉強調色。選擇與 Discord 外觀搭配的明暗。",
      default: "dark", options: [{ value: "dark", label: "深色" }, { value: "light", label: "淺色" }],
      onChange: apply,
    },
  });
  watch("search.entry", node => tintIcon(node, palette.accent));
  watch("composer", styleComposer);
  watch(searchId, settingsFromSearch);
  for (const name of toolNames) watch(name, () => forLive("composer", styleComposer));
  watch(menuMatch, styleMenu);
  watch(settingsMatch, styleSettings);
  watch("phoenix-Sunbird", styleSettings);
  watch(messageMatch, styleChat);
  watchers.push(ui.onEvent("scrollSettle", event => {
    const list = lastSettings == null ? null : ui.node(lastSettings);
    if (list && (event.node === list.id || event.node === list.parent)) {
      paintSettingsList(list);
    } else if (lastList == null) {
      forLive(messageMatch, styleChat);
    }
  }));
  watchers.push(ui.onEvent("appeared", event => {
    const name = event.accessibilityId;
    if (name !== searchId && name !== "composer" && name !== menuRoot) return;
    const node = ui.node(event.node);
    if (!node || node.accessibilityId !== name) return;
    if (name === searchId) settingsFromSearch(node);
    else if (name === "composer") styleComposer(node);
    else styleMenu(node);
  }));
  watchers.push(ui.onEvent("focus", event => {
    const id = event.accessibilityId;
    if (id !== "composer" && id !== searchId) return;
    const node = ui.node(event.node);
    if (node && node.accessibilityId === id) (id === searchId ? styleSearch : styleComposer)(node);
  }));
  apply(settings.scheme);
  phoenix.onUnload(() => {
    for (const remove of watchers) remove();
    for (const remove of rules) remove();
  });
})();
