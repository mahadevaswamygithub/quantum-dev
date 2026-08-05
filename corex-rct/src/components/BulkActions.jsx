import React from 'react';
import { Check, X, Users, Trash2, Shield } from 'lucide-react';

const BulkActions = ({ 
  selectedCount, 
  onActivate, 
  onDeactivate, 
  onDelete, 
  onChangeRole, 
  onClearSelection,
  showRoleChange = false 
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40">
      <div className="bg-slate-800 border-2 border-green-500 rounded-xl shadow-2xl p-4 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
            <Check className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-semibold">
            {selectedCount} selected
          </span>
        </div>

        <div className="h-8 w-px bg-slate-600"></div>

        <div className="flex items-center gap-2">
          <button
            onClick={onActivate}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Activate
          </button>

          <button
            onClick={onDeactivate}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Deactivate
          </button>

          {showRoleChange && (
            <button
              onClick={onChangeRole}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Shield className="w-4 h-4" />
              Change Role
            </button>
          )}

          <button
            onClick={onDelete}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>

          <button
            onClick={onClearSelection}
            className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkActions;