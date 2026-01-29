import React from "react";

const Frame = ({ children, className = "" }) => {
  return (
    <div className={`mi-frame-outer ${className}`}>
      <div className="mi-frame-middle">
        <div className="mi-frame-inner">{children}</div>
      </div>
    </div>
  );
};

export default Frame;
