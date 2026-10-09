import { useAuthStore } from '../store/authStore';

export function usePermissions() {
  const { user } = useAuthStore();

  const isAdmin = user?.role === 'ADMIN';
  const isManager = user?.role === 'MANAGER';

  const can = {
    // Product permissions
    viewProducts: !!user,
    createProduct: isAdmin,
    updateProduct: isAdmin,
    deleteProduct: isAdmin,
    discontinueProduct: isAdmin,
    reactivateProduct: isAdmin,

    // Stock permissions
    viewStock: !!user,
    receiveStock: !!user,
    adjustReorderLevel: isAdmin,

    // Sales permissions
    viewSales: !!user,
    createSale: true, // Both ADMIN and MANAGER can create sales
    viewSaleDetails: !!user,
    cancelSale: isAdmin,

    // Reports
    viewReports: !!user,
    generateReport: !!user,

    // User management
    viewUsers: isAdmin,
    createUser: isAdmin,
    updateUser: isAdmin,
    updateUserPassword: isAdmin,
    deleteUser: isAdmin,
  };

  const canAccess = (route: string): boolean => {
    const adminRoutes = [
      '/products/new',
      '/products/:id/edit',
      '/users',
      '/users/new',
      '/users/:id',
      '/users/:id/password',
      '/stock/:productId/reorder-level',
      '/sales/:id/cancel',
    ];

    const managerRoutes = [
      '/products',
      '/products/:id',
      '/stock',
      '/stock/:productId',
      '/stock/receive',
      '/sales',
      '/sales/new',
      '/sales/:id',
      '/reports',
      '/reports/:date',
    ];

    const publicRoutes = ['/login'];

    if (publicRoutes.includes(route)) return true;
    if (adminRoutes.some(r => route.startsWith(r.replace(':id', '')))) return isAdmin;
    if (managerRoutes.some(r => route.startsWith(r.replace(':id', '')))) return !!user;
    return false;
  };

  return {
    user,
    isAdmin,
    isManager,
    can,
    canAccess,
  };
}

export default usePermissions;