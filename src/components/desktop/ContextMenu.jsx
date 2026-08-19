import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

const EDGE_PADDING = 4;
const SUBMENU_OPEN_DELAY = 220;

/*
 * A single XP-style popup menu. Rendered with position: fixed so it is placed
 * straight from the pointer's client coordinates and never inherits the
 * desktop's transform.
 */
const MenuPanel = ({ x, y, items, onSelect, isSubmenu = false }) => {
  const panelRef = useRef(null);
  const submenuTimerRef = useRef(null);
  const [openSubmenuId, setOpenSubmenuId] = useState(null);
  const [submenuAnchor, setSubmenuAnchor] = useState(null);
  const [placement, setPlacement] = useState({ left: x, top: y, visibility: "hidden" });

  // Flip the panel back inside the viewport before it is painted.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const { offsetWidth: width, offsetHeight: height } = panel;
    const maxLeft = window.innerWidth - width - EDGE_PADDING;
    const maxTop = window.innerHeight - height - EDGE_PADDING;
    setPlacement({
      left: Math.max(EDGE_PADDING, Math.min(x, maxLeft)),
      top: Math.max(EDGE_PADDING, Math.min(y, maxTop)),
      visibility: "visible",
    });
  }, [x, y, items]);

  useEffect(() => {
    return () => {
      if (submenuTimerRef.current) clearTimeout(submenuTimerRef.current);
    };
  }, []);

  const scheduleSubmenu = (item, event) => {
    if (submenuTimerRef.current) clearTimeout(submenuTimerRef.current);
    if (!item.submenu) {
      submenuTimerRef.current = setTimeout(() => setOpenSubmenuId(null), SUBMENU_OPEN_DELAY);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const panelRect = panelRef.current?.getBoundingClientRect();
    setSubmenuAnchor({
      x: (panelRect?.right ?? rect.right) - 3,
      y: rect.top - 3,
    });
    setOpenSubmenuId(item.id);
  };

  const handleItemClick = (item) => {
    if (item.disabled || item.submenu) return;
    onSelect?.(item);
  };

  return (
    <>
      <div
        ref={panelRef}
        className={`xp-context-menu ${isSubmenu ? "is-submenu" : ""}`}
        style={placement}
        role="menu"
        onContextMenu={(event) => event.preventDefault()}
      >
        {items.map((item, index) =>
          item.separator ? (
            <div key={`sep-${index}`} className="xp-context-menu-separator" role="separator" />
          ) : (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={`xp-context-menu-item ${item.disabled ? "is-disabled" : ""} ${
                item.bold ? "is-default" : ""
              } ${openSubmenuId === item.id ? "is-open" : ""}`}
              disabled={item.disabled}
              aria-haspopup={item.submenu ? "menu" : undefined}
              aria-expanded={item.submenu ? openSubmenuId === item.id : undefined}
              onMouseEnter={(event) => scheduleSubmenu(item, event)}
              onClick={() => handleItemClick(item)}
            >
              <span className="xp-context-menu-check" aria-hidden="true">
                {item.checked ? "✓" : ""}
              </span>
              <span className="xp-context-menu-label">{item.label}</span>
              {item.submenu ? <span className="xp-context-menu-arrow" aria-hidden="true" /> : null}
            </button>
          )
        )}
      </div>

      {openSubmenuId && submenuAnchor ? (
        <MenuPanel
          x={submenuAnchor.x}
          y={submenuAnchor.y}
          items={items.find((item) => item.id === openSubmenuId)?.submenu ?? []}
          onSelect={onSelect}
          isSubmenu
        />
      ) : null}
    </>
  );
};

const ContextMenu = ({ x, y, items, onSelect, onClose }) => {
  useEffect(() => {
    const handlePointerDown = (event) => {
      if (event.target?.closest?.(".xp-context-menu")) return;
      onClose?.();
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    /*
     * Capture phase matters: a right-click elsewhere must tear this menu down
     * before the desktop's own handler opens the replacement, otherwise the
     * close would land after the open and swallow the new menu.
     */
    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("contextmenu", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", onClose);
    window.addEventListener("blur", onClose);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("contextmenu", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  if (!items?.length) return null;

  const handleSelect = (item) => {
    onClose?.();
    item.onSelect?.();
    onSelect?.(item);
  };

  return <MenuPanel x={x} y={y} items={items} onSelect={handleSelect} />;
};

export default ContextMenu;
