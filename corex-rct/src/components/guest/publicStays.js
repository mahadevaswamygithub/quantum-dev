import { bookingAPI } from '../../services/api';

// The public property list, fetched once per page load and shared by
// widgets that only need it for decoration or suggestions.
let promise = null;

export const loadPublicStays = () => {
  promise = promise || bookingAPI.getPublicOrgList()
    .then(({ data }) => data || [])
    .catch(() => { promise = null; return []; });
  return promise;
};
