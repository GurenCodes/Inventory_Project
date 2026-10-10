import { createBrowserRouter, createRoutesFromElements, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import ProductForm from './pages/ProductForm';
import ProtectedRoute from './components/auth/ProtectedRoute';

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<Layout />}>
      <Route path="login" element={<Login />} />
      <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']} />}>
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="products/new" element={<ProductForm />} />
        <Route path="products/:id" element={<ProductDetail />} />
        <Route path="products/:id/edit" element={<ProductForm />} />
        <Route path="stock" element={<div>Stock Page - Coming Soon</div>} />
        <Route path="sales" element={<div>Sales Page - Coming Soon</div>} />
        <Route path="reports" element={<div>Reports Page - Coming Soon</div>} />
        <Route path="users" element={<div>Users Page - Coming Soon</div>} />
      </Route>
    </Route>
  )
);

export default router;