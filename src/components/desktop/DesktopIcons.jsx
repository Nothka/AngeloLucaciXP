import React, { useEffect, useRef, useState } from "react";

const DRAG_ICON_MIME = "text/x-desktop-icon-id";
const TASKBAR_HEIGHT = 30;
const FALLBACK_ICON_POSITION = { x: 24, y: 24 };

const DesktopIcons = ({
  items = [],
  onOpenItem,
  onMoveToRecycleBin,
  onMoveItem,
  selectionRect,
  isSelecting,
}) => {
  const [activeIconId, setActiveIconId] = useState(null);
  const [selectedIconIds, setSelectedIconIds] = useState([]);
  const [isRecycleDropTarget, setIsRecycleDropTarget] = useState(false);
  const [draggedIconId, setDraggedIconId] = useState(null);
  const desktopIconsRef = useRef(null);
  const dragPointerOffsetRef = useRef({ x: 0, y: 0 });
  const iconRefs = useRef({});
  const visibleSelectedIcons = selectedIconIds.filter((id) =>
    items.some((item) => item.id === id)
  );
  const visibleActiveIcon = items.some((item) => item.id === activeIconId) ? activeIconId : null;

  const handleClick = (item) => {
    setActiveIconId(item.id);
    setSelectedIconIds([item.id]);
  };

  const handleDoubleClick = (item) => {
    onOpenItem?.(item);
    setActiveIconId(null);
  };

  const handleDragStart = (event, item) => {
    const sourceRect = event.currentTarget.getBoundingClientRect();
    dragPointerOffsetRef.current = {
      x: Math.max(0, event.clientX - sourceRect.left),
      y: Math.max(0, event.clientY - sourceRect.top),
    };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(DRAG_ICON_MIME, item.id);
    event.dataTransfer.setData("text/plain", item.id);
    setDraggedIconId(item.id);
    setActiveIconId(item.id);
    setSelectedIconIds([item.id]);
  };

  const handleRecycleDragOver = (event, item) => {
    if (!item.isRecycleBin) return;
    const iconId =
      draggedIconId ||
      event.dataTransfer.getData(DRAG_ICON_MIME) ||
      event.dataTransfer.getData("text/plain");
    if (!iconId || iconId === item.id) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setIsRecycleDropTarget(true);
  };

  const handleRecycleDragLeave = (item) => {
    if (!item.isRecycleBin) return;
    setIsRecycleDropTarget(false);
  };

  const handleRecycleDrop = (event, item) => {
    if (!item.isRecycleBin) return;
    const iconId =
      draggedIconId ||
      event.dataTransfer.getData(DRAG_ICON_MIME) ||
      event.dataTransfer.getData("text/plain");
    event.preventDefault();
    event.stopPropagation();
    setIsRecycleDropTarget(false);
    setDraggedIconId(null);
    if (!iconId || iconId === item.id) return;
    onMoveToRecycleBin?.(iconId);
    setActiveIconId(null);
    setSelectedIconIds([]);
  };

  const handleDesktopDragOver = (event) => {
    const iconId =
      draggedIconId ||
      event.dataTransfer.getData(DRAG_ICON_MIME) ||
      event.dataTransfer.getData("text/plain");
    if (!iconId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleDesktopDrop = (event) => {
    const iconId =
      draggedIconId ||
      event.dataTransfer.getData(DRAG_ICON_MIME) ||
      event.dataTransfer.getData("text/plain");
    setIsRecycleDropTarget(false);
    setDraggedIconId(null);
    if (!iconId) return;
    event.preventDefault();
    const container = desktopIconsRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const draggedIconNode = iconRefs.current[iconId];
    const iconWidth = draggedIconNode?.offsetWidth ?? 110;
    const iconHeight = draggedIconNode?.offsetHeight ?? 84;
    const maxX = Math.max(0, containerRect.width - iconWidth);
    const maxY = Math.max(0, containerRect.height - TASKBAR_HEIGHT - iconHeight);
    const nextX = Math.round(
      Math.min(
        Math.max(0, event.clientX - containerRect.left - dragPointerOffsetRef.current.x),
        maxX
      )
    );
    const nextY = Math.round(
      Math.min(
        Math.max(0, event.clientY - containerRect.top - dragPointerOffsetRef.current.y),
        maxY
      )
    );
    onMoveItem?.(iconId, { x: nextX, y: nextY });
  };

  const handleDragEnd = () => {
    setIsRecycleDropTarget(false);
    setDraggedIconId(null);
  };

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      if (!isSelecting || !selectionRect) {
        return;
      }
      if (selectionRect.width < 2 && selectionRect.height < 2) {
        setSelectedIconIds([]);
        setActiveIconId(null);
        return;
      }

      const nextSelected = items
        .filter((item) => {
          const node = iconRefs.current[item.id];
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return !(
            selectionRect.right < rect.left ||
            selectionRect.left > rect.right ||
            selectionRect.bottom < rect.top ||
            selectionRect.top > rect.bottom
          );
        })
        .map((item) => item.id);
      setSelectedIconIds(nextSelected);
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [isSelecting, items, selectionRect]);

  return (
    <div
      className="desktop-icons"
      ref={desktopIconsRef}
      onDragOver={handleDesktopDragOver}
      onDrop={handleDesktopDrop}
    >
      {items.map((item) => (
        <button
          key={item.id || item.label}
          type="button"
          draggable
          className={`icon ${visibleActiveIcon === item.id ? "active" : ""} ${
            visibleSelectedIcons.includes(item.id) ? "is-selected" : ""
          } ${item.isRecycleBin && isRecycleDropTarget ? "is-drop-target" : ""}`}
          style={{
            left: `${item.position?.x ?? FALLBACK_ICON_POSITION.x}px`,
            top: `${item.position?.y ?? FALLBACK_ICON_POSITION.y}px`,
          }}
          onClick={() => handleClick(item)}
          onDoubleClick={() => handleDoubleClick(item)}
          onDragStart={(event) => handleDragStart(event, item)}
          onDragEnd={handleDragEnd}
          onDragOver={(event) => handleRecycleDragOver(event, item)}
          onDragLeave={() => handleRecycleDragLeave(item)}
          onDrop={(event) => handleRecycleDrop(event, item)}
          ref={(node) => {
            if (node) {
              iconRefs.current[item.id] = node;
            } else {
              delete iconRefs.current[item.id];
            }
          }}
        >
          <div className="icon-img">
            <img src={item.icon} alt={item.label} />
          </div>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
};

export default DesktopIcons;
