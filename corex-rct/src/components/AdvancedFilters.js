import React, { useState } from 'react';
import { Filter, X, ChevronDown } from 'lucide-react';

const AdvancedFilters = ({ onApplyFilters, onClearFilters, filterOptions }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState({
    role: 'ALL',
    status: 'ALL',
    organization: 'ALL',
    dateFrom: '',
    dateTo: '',
  });

  const handleChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleApply = () => {
    onApplyFilters(filters);
    setIsOpen(false);
  };

  const handleClear = () => {
    const clearedFilters = {
      role: 'ALL',
      status: 'ALL',
      organization: 'ALL',
      dateFrom: '',
      dateTo: '',
    };
    setFilters(clearedFilters);
    onClearFilters();
    setIsOpen(false);
  };

  const activeFilterCount = Object.values(filters).filter(
    v => v !== 'ALL' && v !== ''
  ).length;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-white transition-colors"
      >
        <Filter className="w-5 h-5" />
        <span>Advanced Filters</span>
        {activeFilterCount > 0 && (
          <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
            {activeFilterCount}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          ></div>
          
          <div className="absolute right-0 mt-2 w-96 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Advanced Filters</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {filterOptions.showRole && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Role
                  </label>
                  <select
                    value={filters.role}
                    onChange={(e) => handleChange('role', e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="ALL">All Roles</option>
                    <option value="GREEN_ADMIN">Green Admin</option>
                    <option value="MSP_ADMIN">MSP Admin</option>
                    <option value="MSP_USER">MSP User</option>
                    <option value="STP_ADMIN">STP Admin</option>
                    <option value="STP_USER">STP User</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => handleChange('status', e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="INACTIVE">Inactive Only</option>
                </select>
              </div>

              {filterOptions.organizations && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Organization
                  </label>
                  <select
                    value={filters.organization}
                    onChange={(e) => handleChange('organization', e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="ALL">All Organizations</option>
                    {filterOptions.organizations.map(org => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Created Date Range
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => handleChange('dateFrom', e.target.value)}
                    className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => handleChange('dateTo', e.target.value)}
                    className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleClear}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Clear All
              </button>
              <button
                onClick={handleApply}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white rounded-lg transition-all"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdvancedFilters;