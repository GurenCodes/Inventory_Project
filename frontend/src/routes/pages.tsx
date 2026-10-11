import { lazy, Suspense, type ReactNode } from 'react';
import PageLoader from '../components/ui/PageLoader';

// K16: page components loaded on demand. Kept in a components-only module
// so Fast Refresh keeps working (router.tsx only exports the router object).
export const Login = lazy(() => import('../pages/Login'));
export const Dashboard = lazy(() => import('../pages/Dashboard'));
export const Products = lazy(() => import('../pages/Products'));
export const ProductDetail = lazy(() => import('../pages/ProductDetail'));
export const ProductForm = lazy(() => import('../pages/ProductForm'));
export const Stock = lazy(() => import('../pages/Stock'));
export const StockReceive = lazy(() => import('../pages/StockReceive'));
export const Sales = lazy(() => import('../pages/Sales'));
export const SaleDetail = lazy(() => import('../pages/SaleDetail'));
export const SaleNew = lazy(() => import('../pages/SaleNew'));
export const Reports = lazy(() => import('../pages/Reports'));
export const Users = lazy(() => import('../pages/Users'));

export function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}
