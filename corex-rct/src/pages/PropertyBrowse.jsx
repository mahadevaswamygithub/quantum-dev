import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CustomerLayout from '../components/CustomerLayout';
import Card from '../components/common/Card';
import EmptyState from '../components/common/EmptyState';
import PageSpinner from '../components/common/PageSpinner';
import { useOrgInfo } from '../hooks/useOrgInfo';
import { bookingAPI } from '../services/api';
import { Building2, MapPin, BedDouble, ChevronRight } from 'lucide-react';

/**
 * One step between picking an org and browsing rooms — a guest chooses
 * which building/branch they want (e.g. a temple trust's separate
 * guest-house blocks). If the org only has one property, skip straight
 * through to it — most orgs are single-building, and the extra click
 * would just be friction for them.
 */
const PropertyBrowse = () => {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const { org } = useOrgInfo(orgId);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    bookingAPI.getProperties()
      .then(({ data }) => {
        if (cancelled) return;
        const list = data || [];
        if (list.length === 1) {
          navigate(`/book/${orgId}/properties/${list[0].id}`, { replace: true });
          return;
        }
        setProperties(list);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  if (loading) return <CustomerLayout orgName={org?.name}><PageSpinner label="Loading properties..." /></CustomerLayout>;

  return (
    <CustomerLayout orgName={org?.name}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Choose a Property</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{org?.name} has multiple buildings — pick one to see its rooms</p>
      </div>

      {properties.length === 0 ? (
        <Card><EmptyState icon={Building2} title="No properties available" description="Check back soon." /></Card>
      ) : (
        <div className="space-y-2">
          {properties.map(prop => (
            <Card
              key={prop.id} hover className="p-4 flex items-center justify-between cursor-pointer"
              onClick={() => navigate(`/book/${orgId}/properties/${prop.id}`)}
            >
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{prop.name}</h3>
                {prop.address && (
                  <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-0.5"><MapPin className="w-3.5 h-3.5" /> {prop.address}</p>
                )}
                <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  <BedDouble className="w-3.5 h-3.5" /> {prop.room_count} room{prop.room_count !== 1 ? 's' : ''}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
            </Card>
          ))}
        </div>
      )}
    </CustomerLayout>
  );
};

export default PropertyBrowse;
