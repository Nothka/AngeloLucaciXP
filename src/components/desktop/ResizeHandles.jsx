import React from "react";

const HANDLE_DIRECTIONS = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

const ResizeHandles = ({ onResizeStart, disabled = false }) => {
  if (disabled) return null;

  return (
    <div className="window-resize-handles" aria-hidden="true">
      {HANDLE_DIRECTIONS.map((direction) => (
        <div
          key={direction}
          className={`window-resize-handle window-resize-handle--${direction}`}
          onMouseDown={(event) => onResizeStart(event, direction)}
        />
      ))}
    </div>
  );
};

export default ResizeHandles;
