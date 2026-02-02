import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import resumeIcon from "../../../assets/startmenu/Pdf.png";
import zoomIcon from "../../../assets/startmenu/Search.png";
import saveIcon from "../../../assets/startmenu/Pdf.png";
import printIcon from "../../../assets/startmenu/Recent.webp";
import contactIcon from "../../../assets/startmenu/contact.webp";
import minimizeIcon from "../../../assets/window/Minimize.webp";
import maximizeIcon from "../../../assets/window/Maximize.webp";
import closeIcon from "../../../assets/window/Exit.png";
import resumePdf from "../../../assets/cv/CV_AngeloLucaci.pdf";
import ResizeHandles from "../ResizeHandles";
import useWindowResize from "../hooks/useWindowResize";
import { getDesktopPoint } from "../utils/desktopTransform";
import "../../../styles/desktop/window.css";
import "../../../styles/desktop/apps/resume.css";

const DEFAULT_SIZE = { width: 760, height: 560 };
const DEFAULT_POSITION = { x: 120, y: 80 };
const ZOOM_LEVELS = [1, 1.25, 1.5, 1.75, 2];
const VIEWER_PADDING = 24;

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const MyResumeWindow = ({
  windowId,
  title,
  onClose,
  onMinimize,
  onMaximize,
  zIndex,
  onMouseDown,
  onOpenContact,
  isActive = true,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [position, setPosition] = useState(DEFAULT_POSITION);
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [baseScale, setBaseScale] = useState(1);
  const [renderId, setRenderId] = useState(0);
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const windowRef = useRef(null);
  const viewerRef = useRef(null);
  const headerRef = useRef(null);
  const menuRef = useRef(null);
  const toolbarRef = useRef(null);
  const statusRef = useRef(null);
  const fileMenuRef = useRef(null);
  const fileButtonRef = useRef(null);
  const viewMenuRef = useRef(null);
  const viewButtonRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const originalPosition = useRef(DEFAULT_POSITION);
  const originalSize = useRef(DEFAULT_SIZE);
  const zoomFocusRef = useRef(null);
  const canvasRefs = useRef([]);
  const renderTasksRef = useRef([]);
  const didAutoSizeRef = useRef(false);
  const { startResize } = useWindowResize({
    position,
    size,
    setPosition,
    setSize,
    minWidth: 480,
    minHeight: 360,
    isMaximized,
    onFocus: () => onMouseDown(windowId),
  });

  useEffect(() => {
    if (isMaximized) {
      originalPosition.current = position;
      originalSize.current = size;
      setPosition({ x: 0, y: 0 });
      setSize({ width: window.innerWidth, height: window.innerHeight - 30 });
    } else {
      setPosition(originalPosition.current);
      setSize(originalSize.current);
    }
  }, [isMaximized]);

  useEffect(() => {
    if (!isFileMenuOpen && !isViewMenuOpen) return undefined;
    const handleOutsideClick = (event) => {
      if (fileMenuRef.current?.contains(event.target)) return;
      if (fileButtonRef.current?.contains(event.target)) return;
      if (viewMenuRef.current?.contains(event.target)) return;
      if (viewButtonRef.current?.contains(event.target)) return;
      setIsFileMenuOpen(false);
      setIsViewMenuOpen(false);
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsFileMenuOpen(false);
        setIsViewMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isFileMenuOpen, isViewMenuOpen]);

  const handleMouseDown = (e) => {
    if (isMaximized || e.button !== 0) return;
    setIsDragging(true);
    const point = getDesktopPoint(e);
    dragOffset.current = {
      x: point.x - position.x,
      y: point.y - position.y,
    };
    onMouseDown(windowId);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const point = getDesktopPoint(e);
    setPosition({
      x: point.x - dragOffset.current.x,
      y: point.y - dragOffset.current.y,
    });
  };

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
    if (onMaximize) onMaximize(windowId);
  };

  const handleSave = () => {
    const link = document.createElement("a");
    link.href = resumePdf;
    link.download = "Angelo_Lucaci_CV.pdf";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleFileMenuSave = () => {
    handleSave();
    setIsFileMenuOpen(false);
  };

  const handleFileMenuPrint = () => {
    setIsFileMenuOpen(false);
  };

  const handleFileMenuExit = () => {
    setIsFileMenuOpen(false);
    onClose?.(windowId);
  };

  const handleViewMenuMaximize = () => {
    if (!isMaximized) {
      setIsMaximized(true);
      onMaximize?.(windowId);
    }
    setIsViewMenuOpen(false);
  };

  const handleViewMenuMinimize = () => {
    setIsViewMenuOpen(false);
    onMinimize?.(windowId);
  };

  const queueZoom = (clientX, clientY) => {
    const viewer = viewerRef.current;
    const nextIndex = (zoomIndex + 1) % ZOOM_LEVELS.length;
    if (!viewer) {
      setZoomIndex(nextIndex);
      return;
    }
    const rect = viewer.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const offsetY = clientY - rect.top;
    const currentScale = baseScale * ZOOM_LEVELS[zoomIndex];
    const contentX = (viewer.scrollLeft + offsetX) / currentScale;
    const contentY = (viewer.scrollTop + offsetY) / currentScale;
    zoomFocusRef.current = { contentX, contentY, offsetX, offsetY };
    setZoomIndex(nextIndex);
  };

  const handleViewerClick = (event) => {
    if (event.button !== 0) return;
    queueZoom(event.clientX, event.clientY);
  };

  const handleToolbarZoom = () => {
    const viewer = viewerRef.current;
    if (!viewer) {
      setZoomIndex((prev) => (prev + 1) % ZOOM_LEVELS.length);
      return;
    }
    const rect = viewer.getBoundingClientRect();
    queueZoom(rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    let cancelled = false;
    const loadingTask = pdfjsLib.getDocument({ url: resumePdf });
    loadingTask.promise
      .then((doc) => {
        if (cancelled) return;
        setPdfDoc(doc);
        setPageCount(doc.numPages);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      loadingTask.destroy();
    };
  }, []);

  useEffect(() => {
    if (!pdfDoc || !viewerRef.current) return;
    let cancelled = false;
    const updateFitScale = async () => {
      const page = await pdfDoc.getPage(1);
      if (cancelled || !viewerRef.current) return;
      const viewport = page.getViewport({ scale: 1 });
      const availableWidth = viewerRef.current.clientWidth - VIEWER_PADDING;
      const availableHeight = viewerRef.current.clientHeight - VIEWER_PADDING;
      if (availableWidth <= 0 || availableHeight <= 0) return;
      const fitScale = Math.min(
        availableWidth / viewport.width,
        availableHeight / viewport.height,
      );
      setBaseScale(Math.max(0.4, fitScale));
    };
    updateFitScale();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, size.width, size.height]);

  useEffect(() => {
    if (!pdfDoc || didAutoSizeRef.current) return;
    let cancelled = false;
    const autoSizeToFirstPage = async () => {
      const page = await pdfDoc.getPage(1);
      if (cancelled) return;
      const viewport = page.getViewport({ scale: 1 });
      const chromeHeight =
        (headerRef.current?.offsetHeight || 0) +
        (menuRef.current?.offsetHeight || 0) +
        (toolbarRef.current?.offsetHeight || 0) +
        (statusRef.current?.offsetHeight || 0);
      const maxWidth = Math.min(window.innerWidth - 120, 980);
      const maxHeight = Math.min(window.innerHeight - 140, 760);
      const availableWidth = maxWidth - VIEWER_PADDING * 2;
      const availableHeight = maxHeight - chromeHeight - VIEWER_PADDING * 2;
      if (availableWidth <= 0 || availableHeight <= 0) return;
      const fitScale = Math.min(
        availableWidth / viewport.width,
        availableHeight / viewport.height,
      );
      const nextWidth = Math.round(viewport.width * fitScale + VIEWER_PADDING * 2);
      const nextHeight = Math.round(
        viewport.height * fitScale + chromeHeight + VIEWER_PADDING * 2,
      );
      setSize({ width: nextWidth, height: nextHeight });
      setPosition({
        x: Math.max(40, Math.round((window.innerWidth - nextWidth) / 2)),
        y: Math.max(40, Math.round((window.innerHeight - nextHeight - 30) / 2)),
      });
      setBaseScale(Math.max(0.4, fitScale));
      didAutoSizeRef.current = true;
    };
    autoSizeToFirstPage();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc]);

  useEffect(() => {
    if (!pdfDoc || !pageCount) return;
    let cancelled = false;
    renderTasksRef.current.forEach((task) => task?.cancel?.());
    renderTasksRef.current = [];
    const renderAllPages = async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const scale = baseScale * ZOOM_LEVELS[zoomIndex];
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        if (cancelled) return;
        const canvas = canvasRefs.current[pageNumber - 1];
        if (!canvas) continue;
        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        const context = canvas.getContext("2d");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        const renderTask = page.render({ canvasContext: context, viewport });
        renderTasksRef.current[pageNumber - 1] = renderTask;
        try {
          await renderTask.promise;
        } catch (error) {
          if (error?.name !== "RenderingCancelledException") {
            throw error;
          }
        }
      }
      if (!cancelled) {
        setRenderId((prev) => prev + 1);
      }
    };
    renderAllPages();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pageCount, baseScale, zoomIndex]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const focus = zoomFocusRef.current;
    if (!viewer || !focus) return;
    const scale = baseScale * ZOOM_LEVELS[zoomIndex];
    requestAnimationFrame(() => {
      viewer.scrollLeft = focus.contentX * scale - focus.offsetX;
      viewer.scrollTop = focus.contentY * scale - focus.offsetY;
    });
    zoomFocusRef.current = null;
  }, [renderId, baseScale, zoomIndex]);

  return (
    <div
      className={`window resume-window ${isActive ? "" : "is-inactive"} ${isMaximized ? "maximized" : ""}`}
      ref={windowRef}
      style={{ top: position.y, left: position.x, zIndex, width: size.width, height: size.height }}
      onMouseDown={() => onMouseDown(windowId)}
    >
      <div
        className="window-header"
        onMouseDown={handleMouseDown}
        onDoubleClick={toggleMaximize}
        ref={headerRef}
      >
        <div className="window-title">
          <img src={resumeIcon} alt="My Resume" className="window-title-icon" />
          <span>{title}</span>
        </div>
        <div className="window-buttons">
          <button className="window-btn minimize" onClick={() => onMinimize(windowId)}>
            <img src={minimizeIcon} alt="Minimize" />
          </button>
          <button className="window-btn maximize" onClick={toggleMaximize}>
            <img src={maximizeIcon} alt="Maximize" />
          </button>
          <button className="window-btn close" onClick={() => onClose(windowId)}>
            <img src={closeIcon} alt="Close" />
          </button>
        </div>
      </div>

      <div className="window-menu-bar" ref={menuRef}>
        <div className="resume-menu-wrapper">
          <button
            ref={fileButtonRef}
            type="button"
            className={`window-menu-btn resume-menu-trigger ${isFileMenuOpen ? "is-open" : ""}`}
            onClick={() => {
              setIsViewMenuOpen(false);
              setIsFileMenuOpen((prev) => !prev);
            }}
          >
            File
          </button>
          {isFileMenuOpen ? (
            <div className="resume-menu" ref={fileMenuRef}>
              <button type="button" className="resume-menu-item" onClick={handleFileMenuSave}>
                Save
              </button>
              <button
                type="button"
                className="resume-menu-item is-disabled"
                disabled
                onClick={handleFileMenuPrint}
              >
                Print
              </button>
              <div className="resume-menu-divider" />
              <button type="button" className="resume-menu-item" onClick={handleFileMenuExit}>
                Exit
              </button>
            </div>
          ) : null}
        </div>
        <div className="resume-menu-wrapper">
          <button
            ref={viewButtonRef}
            type="button"
            className={`window-menu-btn resume-menu-trigger ${isViewMenuOpen ? "is-open" : ""}`}
            onClick={() => {
              setIsFileMenuOpen(false);
              setIsViewMenuOpen((prev) => !prev);
            }}
          >
            View
          </button>
          {isViewMenuOpen ? (
            <div className="resume-menu" ref={viewMenuRef}>
              <button type="button" className="resume-menu-item" onClick={handleViewMenuMaximize}>
                Maximize
              </button>
              <button type="button" className="resume-menu-item" onClick={handleViewMenuMinimize}>
                Minimize
              </button>
            </div>
          ) : null}
        </div>
        <button type="button" className="window-menu-btn">Help</button>
      </div>

      <div className="resume-toolbar" ref={toolbarRef}>
        <button type="button" className="resume-tool" onClick={handleToolbarZoom}>
          <img src={zoomIcon} alt="" />
          Zoom
        </button>
        <button type="button" className="resume-tool" onClick={handleSave}>
          <img src={saveIcon} alt="" />
          Save
        </button>
        <button type="button" className="resume-tool is-muted">
          <img src={printIcon} alt="" />
          Print
        </button>
        <button type="button" className="resume-tool" onClick={() => onOpenContact?.()}>
          <img src={contactIcon} alt="" />
          Contact Me
        </button>
      </div>

      <div className="resume-viewer" ref={viewerRef} onClick={handleViewerClick}>
        <div className="resume-pdf">
          {Array.from({ length: pageCount }).map((_, index) => (
            <canvas
              key={`resume-page-${index}`}
              className="resume-page"
              ref={(node) => {
                canvasRefs.current[index] = node;
              }}
            />
          ))}
        </div>
      </div>

      <div className="resume-status" ref={statusRef}>
        Click to zoom, then drag to view other areas. Zoom:{" "}
        {Math.round(baseScale * ZOOM_LEVELS[zoomIndex] * 100)}%
      </div>
      <ResizeHandles onResizeStart={startResize} disabled={isMaximized} />
    </div>
  );
};

export default MyResumeWindow;
