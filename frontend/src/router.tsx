import { createBrowserRouter, createRoutesFromElements, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import ProductForm from './pages/ProductForm';
import Stock from './pages/Stock';
import StockReceive from './pages/StockReceive';
import Sales from './pages/Sales';
import SaleDetail from './pages/SaleDetail';
import SaleNew from './pages/SaleNew';
import Reports from './pages/Reports';
import Users from './pages/Users';
import ProtectedRoute from './components/auth/ProtectedRoute';

export const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      {/* Login sits outside the authenticated layout */}
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Layout />}>
        <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']} />}>
          <Route index element={<Dashboard />} />
          <Route path="products" element={<Products />} />
          <Route path="products/new" element={<ProductForm />} />
          <Route path="products/:id" element={<ProductDetail />} />
          <Route path="products/:id/edit" element={<ProductForm />} />
          <Route path="stock" element={<Stock />} />
          <Route path="stock/receive" element={<StockReceive />} />
          <Route path="stock/receive/:productId" element={<StockReceive />} />
          <Route path="sales" element={<Sales />} />
          <Route path="sales/new" element={<SaleNew />} />
          <Route path="sales/:id" element={<SaleDetail />} />
          <Route path="reports" element={<Reports />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
          <Route path="users" element={<Users />} />
        </Route>
      </Route>
    </>
  )
);

export default router;