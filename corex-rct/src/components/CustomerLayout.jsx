import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BedDouble, CalendarCheck, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';

/**
 * Thin top bar for the customer booking portal — deliberately not the
 * admin Sidebar/Navbar (this is a public-facing guest site, not the
 * MSP/STP back office).
 */
const CustomerLayout = ({ orgName, children }) => {
  const { orgId } = useParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate(`/book/${orgId}/login`);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={() => navigate(`/book/${orgId}`)} className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
            <BedDouble className="w-5 h-5 text-green-500" /> {orgName || 'Book a Room'}
          </button>
          <nav className="flex items-center gap-1">
            {user && (
              <button
                onClick={() => navigate(`/book/${orgId}/my-bookings`)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <CalendarCheck className="w-4 h-4" /> My Bookings
              </button>
            )}
            <ThemeToggle />
            {user && (
              <button
                onClick={handleLogout}
                title="Log out"
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
};

export default CustomerLayout;
