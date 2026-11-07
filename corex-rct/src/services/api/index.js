/**
 * Re-exports every API module so existing imports like
 * `import { userAPI, tenantAPI } from '../services/api'` keep working
 * unchanged while each domain's calls live in its own file.
 */
export { default } from './httpClient';
export { authAPI } from './authApi';
export { userAPI } from './userApi';
export { tenantAPI } from './tenantApi';
export { attendanceAPI } from './attendanceApi';
export { salaryAPI } from './salaryApi';
export { leaveAPI } from './leaveApi';
export { chatAPI } from './chatApi';
export { activityAPI } from './activityApi';
export { bookingAPI } from './bookingApi';
export { platformAPI } from './platformApi';
