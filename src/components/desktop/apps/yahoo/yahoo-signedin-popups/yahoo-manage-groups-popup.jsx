import React from "react";
import closeIcon from "../../../../../assets/yahoo/header/close.png";
import "../../../../../styles/desktop/apps/yahoo/yahoo-signedin-popups/yahoo-manage-groups-popup.css";

const YahooManageGroupsPopup = ({
  isOpen = false,
  popupRef,
  groups = [],
  selectedGroup = "",
  draftName = "",
  statusText = "",
  canRename = true,
  canDelete = true,
  onSelectGroup,
  onDraftNameChange,
  onAddGroup,
  onRenameGroup,
  onDeleteGroup,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="yahoo-signedin-manage-groups-popup" role="dialog" ref={popupRef}>
      <div className="yahoo-signedin-manage-groups-header">
        <div className="yahoo-signedin-manage-groups-title">Manage Groups</div>
        <button
          type="button"
          className="yahoo-signedin-manage-groups-close"
          aria-label="Close"
          onClick={() => onClose?.()}
        >
          <img src={closeIcon} alt="" aria-hidden="true" />
        </button>
      </div>

      <div className="yahoo-signedin-manage-groups-body">
        <div className="yahoo-signedin-manage-groups-grid">
          <div className="yahoo-signedin-manage-groups-list-wrap">
            <div className="yahoo-signedin-manage-groups-label">Groups</div>
            <div className="yahoo-signedin-manage-groups-list" role="listbox" aria-label="Groups">
              {groups.length ? (
                groups.map((group) => (
                  <button
                    key={group.name}
                    type="button"
                    className={`yahoo-signedin-manage-groups-item${
                      selectedGroup === group.name ? " is-selected" : ""
                    }`}
                    onClick={() => onSelectGroup?.(group.name)}
                  >
                    <span>{group.name}</span>
                    <span className="yahoo-signedin-manage-groups-count">{group.count}</span>
                  </button>
                ))
              ) : (
                <div className="yahoo-signedin-manage-groups-empty">No groups.</div>
              )}
            </div>
          </div>

          <div className="yahoo-signedin-manage-groups-editor">
            <label className="yahoo-signedin-manage-groups-label">Group name</label>
            <input
              type="text"
              value={draftName}
              onChange={(event) => onDraftNameChange?.(event.target.value)}
              placeholder="Type a group name..."
            />

            <div className="yahoo-signedin-manage-groups-actions">
              <button
                type="button"
                className="yahoo-signedin-manage-groups-btn"
                onClick={() => onAddGroup?.()}
                disabled={!draftName.trim()}
              >
                Add
              </button>
              <button
                type="button"
                className="yahoo-signedin-manage-groups-btn"
                onClick={() => onRenameGroup?.()}
                disabled={!selectedGroup || !draftName.trim() || !canRename}
              >
                Rename
              </button>
              <button
                type="button"
                className="yahoo-signedin-manage-groups-btn"
                onClick={() => onDeleteGroup?.()}
                disabled={!selectedGroup || !canDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>

        <div className="yahoo-signedin-manage-groups-status">
          {statusText || "Use Add, Rename, or Delete to manage your contact groups."}
        </div>

        <div className="yahoo-signedin-manage-groups-footer">
          <button type="button" className="yahoo-signedin-manage-groups-btn is-primary" onClick={() => onClose?.()}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default YahooManageGroupsPopup;
