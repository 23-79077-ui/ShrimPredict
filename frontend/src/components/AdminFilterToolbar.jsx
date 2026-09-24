import React from 'react';
import { FaSearch, FaFilter, FaFileCsv, FaSync, FaTimes, FaCalendarAlt } from 'react-icons/fa';

/**
 * Enterprise Admin Filter Toolbar matching standard executive UI format.
 * Features:
 * - Search bar with left search icon
 * - Action buttons (Filters toggle, Export CSV, Refresh)
 * - Stage / Category Tab pills & Meta text on right
 * - Collapsible / Expandable Grid of dropdowns & date filters with Reset button
 */
export default function AdminFilterToolbar({
  searchQuery = '',
  onSearchChange = () => {},
  searchPlaceholder = 'Search pond or caretaker',
  showFilters = true,
  onToggleFilters = null,
  onExportCSV = null,
  exportLabel = 'Export CSV',
  onRefresh = null,
  refreshLabel = 'Refresh',
  loading = false,
  tabs = [],
  activeTab = '',
  onTabChange = () => {},
  metaRight = null,
  filterFields = [],
  onResetFilters = null,
  extraActions = null,
  children = null,
}) {
  return (
    <div className="card border-0 shadow-sm rounded-4 bg-white p-4 mb-4 admin-filter-card">
      {/* 🌟 Top Row: Search Input + Action Buttons */}
      <div className="d-flex flex-column flex-xl-row align-items-xl-center justify-content-between gap-3">
        {/* Search Bar */}
        <div className="position-relative flex-grow-1 admin-search-input-wrap" style={{ maxWidth: 560 }}>
          <FaSearch className="position-absolute top-50 translate-middle-y text-primary admin-search-icon" style={{ left: 16 }} />
          <input
            type="text"
            className="form-control ps-5 pe-4 admin-search-input"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="btn btn-link p-0 position-absolute text-muted"
              style={{ right: 14, top: '50%', transform: 'translateY(-50%)', textDecoration: 'none' }}
              onClick={() => onSearchChange('')}
            >
              <FaTimes size={13} />
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="d-flex align-items-center gap-2 flex-wrap admin-actions">
          {extraActions}

          {onToggleFilters && (
            <button
              type="button"
              className={`btn btn-admin-filter ${showFilters ? 'active' : ''}`}
              onClick={onToggleFilters}
            >
              <FaFilter size={13} /> Filters
            </button>
          )}

          {onExportCSV && (
            <button
              type="button"
              className="btn btn-admin-export"
              onClick={onExportCSV}
            >
              <FaFileCsv size={15} /> {exportLabel}
            </button>
          )}

          {onRefresh && (
            <button
              type="button"
              className="btn btn-admin-refresh"
              onClick={onRefresh}
              disabled={loading}
            >
              <FaSync size={13} className={loading ? 'fa-spin' : ''} /> {refreshLabel}
            </button>
          )}
        </div>
      </div>

      {/* 🌟 Middle Row: Tab Pills & Subtitle Metadata (Only shown if tabs or meta exists or showFilters is true) */}
      {showFilters && (tabs.length > 0 || metaRight) && (
        <div className="mt-3 pt-3 border-top d-flex align-items-center justify-content-between flex-wrap gap-2 pb-1">
          {/* Left Tabs */}
          {tabs.length > 0 && (
            <div className="d-flex align-items-center gap-2 flex-wrap">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`btn btn-sm rounded-pill px-3.5 py-1.5 extra-small fw-bold transition-all admin-tab-pill ${
                      isActive ? 'active' : ''
                    }`}
                    style={tab.style ? tab.style(isActive) : undefined}
                    onClick={() => onTabChange(tab.id)}
                  >
                    {tab.icon && <span className="me-1">{tab.icon}</span>}
                    {tab.label} {tab.count !== undefined && `(${tab.count})`}
                  </button>
                );
              })}
            </div>
          )}

          {/* Right Meta Info */}
          {metaRight && (
            <div className="extra-small text-muted admin-tab-meta ms-auto">
              {metaRight}
            </div>
          )}
        </div>
      )}

      {/* 🌟 Bottom Row: Filter Dropdowns Grid */}
      {showFilters && (filterFields.length > 0 || children || onResetFilters) && (
        <div className="mt-3 pt-3 border-top">
          {children ? (
            children
          ) : (
            <div className="row g-3 align-items-end">
              {filterFields.map((field, idx) => (
                <div key={idx} className={field.colClass || 'col-12 col-md-3'}>
                  <label className="form-label extra-small fw-bold text-muted mb-1.5 d-flex align-items-center justify-content-between">
                    <span>
                      {field.icon && <span className="me-1">{field.icon}</span>}
                      {field.label}
                    </span>
                    {field.headerAction}
                  </label>

                  {field.type === 'date' ? (
                    <input
                      type="date"
                      className="form-control admin-filter-control"
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  ) : field.type === 'custom' ? (
                    field.render()
                  ) : (
                    <select
                      className="form-select admin-filter-control"
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                    >
                      {field.options &&
                        field.options.map((opt, oIdx) => (
                          <option key={oIdx} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              ))}

              {onResetFilters && (
                <div className="col-12 col-md-2 ms-auto">
                  <button
                    type="button"
                    className="btn btn-admin-reset w-100"
                    onClick={onResetFilters}
                  >
                    Reset Filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
