import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-blue-500 rounded-lg flex items-center justify-center font-bold text-white">
            CX
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">CoreX Platform</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {(user?.role === 'MSP_ADMIN' || user?.role === 'MSP_USER') && 'MSP Portal'}
              {(user?.role === 'STP_ADMIN' || user?.role === 'STP_USER') && 'STP Portal'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />

          <div className="flex items-center gap-3 rounded-lg bg-slate-100 px-4 py-2 dark:bg-slate-700">
            <User className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;